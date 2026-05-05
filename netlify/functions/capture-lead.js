exports.handler = async function(event) {
  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const SUPABASE_URL = 'https://klgofcqrncabfhskiijn.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_nBf8FEP-zsgCGXlTImEDKQ_cknCqWok';

  try {
    const body = JSON.parse(event.body);
    const { email, pdf_type, estimate_context } = body;

    if(!email || !email.includes('@')){
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const res = await fetch(SUPABASE_URL + '/rest/v1/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, pdf_type, estimate_context })
    });

    if(!res.ok){
      const txt = await res.text();
      return { statusCode: 500, body: JSON.stringify({ error: txt }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
