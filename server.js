const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
app.use(cors());

// ─── Stripe webhook MUST come before express.json() ───────────────────────────
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj = event.data.object;

  try {
    switch (event.type) {

      // ── User just paid ────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const userId       = obj.metadata?.supabase_user_id;
        const customerId   = obj.customer;
        const subscriptionId = obj.subscription;
        if (!userId) break;

        // Fetch full subscription from Stripe to get period end
        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        await supabase.from('users').update({
          is_pro: true,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          subscription_ends_at: null
        }).eq('id', userId);

        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          status: 'active',
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
          updated_at: new Date().toISOString()
        }, { onConflict: 'stripe_subscription_id' });

        break;
      }

      // ── Subscription created ──────────────────────────────────────────────
      case 'customer.subscription.created': {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', obj.customer)
          .single();

        if (!user) break;

        await supabase.from('subscriptions').upsert({
          user_id: user.id,
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          status: obj.status,
          current_period_end: new Date(obj.current_period_end * 1000).toISOString(),
          cancel_at_period_end: obj.cancel_at_period_end,
          updated_at: new Date().toISOString()
        }, { onConflict: 'stripe_subscription_id' });

        break;
      }

      // ── Subscription updated (upgrade, downgrade, cancel scheduled) ───────
      case 'customer.subscription.updated': {
        const isActive = obj.status === 'active';
        const periodEnd = new Date(obj.current_period_end * 1000).toISOString();

        // If cancelling at period end — keep access until then
        const subscriptionEndsAt = obj.cancel_at_period_end ? periodEnd : null;

        await supabase.from('users').update({
          is_pro: isActive,
          subscription_status: obj.status,
          subscription_ends_at: subscriptionEndsAt
        }).eq('stripe_subscription_id', obj.id);

        await supabase.from('subscriptions').upsert({
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          status: obj.status,
          current_period_end: periodEnd,
          cancel_at_period_end: obj.cancel_at_period_end,
          updated_at: new Date().toISOString()
        }, { onConflict: 'stripe_subscription_id' });

        break;
      }

      // ── Subscription fully deleted ────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const periodEnd = new Date(obj.current_period_end * 1000).toISOString();

        await supabase.from('users').update({
          is_pro: false,
          subscription_status: 'canceled',
          subscription_ends_at: periodEnd
        }).eq('stripe_subscription_id', obj.id);

        await supabase.from('subscriptions').upsert({
          stripe_subscription_id: obj.id,
          stripe_customer_id: obj.customer,
          status: 'canceled',
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString()
        }, { onConflict: 'stripe_subscription_id' });

        break;
      }

      // ── Payment succeeded — restore/confirm active ────────────────────────
      case 'invoice.paid': {
        const subscriptionId = obj.subscription;
        if (!subscriptionId) break;

        await supabase.from('users').update({
          is_pro: true,
          subscription_status: 'active',
          subscription_ends_at: null
        }).eq('stripe_subscription_id', subscriptionId);

        await supabase.from('subscriptions').update({
          status: 'active',
          updated_at: new Date().toISOString()
        }).eq('stripe_subscription_id', subscriptionId);

        break;
      }

      // ── Payment failed — mark delinquent but don't cut off immediately ────
      case 'invoice.payment_failed': {
        const subscriptionId = obj.subscription;
        if (!subscriptionId) break;

        await supabase.from('users').update({
          subscription_status: 'past_due'
        }).eq('stripe_subscription_id', subscriptionId);

        await supabase.from('subscriptions').update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        }).eq('stripe_subscription_id', subscriptionId);

        break;
      }
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err.message);
  }

  res.json({ received: true });
});

// ─── JSON middleware for all other routes ─────────────────────────────────────
app.use(express.json({ limit: '25mb' }));

// ─── Anthropic proxy ──────────────────────────────────────────────────────────
app.post('/api/estimate', async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stripe checkout session ───────────────────────────────────────────────────
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1
      }],
      metadata: {
        supabase_user_id: userId
      },
      success_url: 'https://cornerstone-os.netlify.app/?upgraded=true',
      cancel_url: 'https://cornerstone-os.netlify.app/'
    });

    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stripe customer portal ───────────────────────────────────────────────────
app.post('/api/customer-portal', async (req, res) => {
  try {
    const { userId } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!user?.stripe_customer_id) {
      return res.status(404).json({ error: 'No billing account found' });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: 'https://cornerstone-os.netlify.app/'
    });

    res.json({ url: portal.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Even proxy running on port ${PORT}`));
