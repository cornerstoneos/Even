const https = require('https');

exports.handler = async function(event) {
  if(event.httpMethod !== 'POST'){
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const SUPABASE_URL = 'klgofcqrncabfhskiijn.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_nBf8FEP-zsgCGXlTImEDKQ_cknCqWok';

  try {
    const body = JSON.parse(event.body);
    const { email, pdf_type, estimate_context } = body;

    if(!email || !email.includes('@')){
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const payload = JSON.stringify({ email, pdf_type, estimate_context });

    await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: SUPABASE_URL,
        path: '/rest/v1/leads',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'return=minimal',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', resolve);
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
