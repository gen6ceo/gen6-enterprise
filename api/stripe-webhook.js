// GEN6 Enterprise — Stripe webhook (Netlify function)
// Records completed checkouts in GoHighLevel as paid bookings.
// Set the endpoint in Stripe Dashboard → Developers → Webhooks:
//   https://gen6enterprise.com/api/stripe-webhook
// listening for checkout.session.completed, then put the signing
// secret in the STRIPE_WEBHOOK_SECRET env var.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const sig = event.headers['stripe-signature'];
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: 'Invalid signature' };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const m = session.metadata || {};

    try {
      await fetch('https://services.leadconnectorhq.com/contacts/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28',
        },
        body: JSON.stringify({
          firstName: m.first_name,
          lastName: m.last_name,
          email: session.customer_email || session.customer_details?.email,
          phone: m.phone,
          locationId: process.env.GHL_LOCATION_ID,
          tags: ['fleet-lead', 'booked-paid', 'high-priority'],
          source: 'GEN6 Website — Paid Booking',
          customField: {
            inquiry_type: 'fleet-booking-paid',
            rental_type: m.vehicle_class || '',
            city_needed: m.city || '',
            move_in_date: m.start_date || '',
            move_out_date: m.end_date || '',
            insurance: m.insurance || '',
            details: `PAID ${(session.amount_total / 100).toFixed(2)} ${String(session.currency).toUpperCase()} — ${m.weeks} week(s), session ${session.id}`,
          },
        }),
      });
    } catch (err) {
      console.error('GHL error:', err.message);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
