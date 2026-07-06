// GEN6 Enterprise — Stripe billing portal session
// Returns a secure Stripe-hosted URL where the client manages their
// card, sees payment history, and downloads receipts. Activates once
// STRIPE_SECRET_KEY is set in Netlify.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { statusCode: 503, body: JSON.stringify({ error: 'billing_not_configured' }) };
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  if (!body.customerId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing_customer' }) };
  }

  const siteUrl = process.env.URL || 'https://gen6enterprise.com';

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: body.customerId,
      return_url: `${siteUrl}/portal/app.html`,
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('stripe-portal error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'portal_failed' }) };
  }
};
