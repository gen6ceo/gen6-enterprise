// GEN6 Enterprise — Stripe Checkout session (Netlify function)
// Recurring billing: the client pays the weekly or monthly rate at
// checkout, then the same rate auto-bills every period until their
// end date (the webhook sets the subscription to cancel then).
//
// Payment methods: card + Klarna (both support recurring on Stripe).
// Affirm does not support recurring payments — use it on one-time
// Stripe Payment Links for custom quotes instead.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Rates in cents per billing period. null = not bookable online yet →
// the client falls back to the reserve flow. Add rates as they're set.
const RATES = {
  sedan:      { weekly: null,  monthly: null },  // Executive Sedan — from $250/wk, varies by vehicle
  'suv-exec': { weekly: null,  monthly: null },  // Executive SUV
  'suv-prem': { weekly: null,  monthly: null },  // Premium SUV
  executive:  { weekly: null,  monthly: null },  // Executive Class
};

const CLASS_NAMES = {
  sedan:      'GEN6 Fleet — Executive Sedan',
  'suv-exec': 'GEN6 Fleet — Executive SUV',
  'suv-prem': 'GEN6 Fleet — Premium SUV',
  executive:  'GEN6 Fleet — Executive Class',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const {
    vehicleClass, billing, startDate, endDate,
    firstName, lastName, email, phone, city, insurance,
  } = body;

  const period = billing === 'monthly' ? 'monthly' : 'weekly';
  const rate = RATES[vehicleClass] ? RATES[vehicleClass][period] : null;

  if (!rate) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payable: false }),
    };
  }
  if (!email || !firstName) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const siteUrl = process.env.URL || 'https://gen6enterprise.com';
  const interval = period === 'monthly' ? 'month' : 'week';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'klarna'],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: CLASS_NAMES[vehicleClass] || 'GEN6 Fleet rental',
            description: `Billed ${period} · ${startDate || 'start TBD'} → ${endDate || 'open'} · No deposit`,
          },
          unit_amount: rate,
          recurring: { interval },
        },
        quantity: 1,
      }],
      subscription_data: {
        metadata: {
          service: 'fleet',
          vehicle_class: vehicleClass,
          billing: period,
          start_date: startDate || '',
          end_date: endDate || '',
        },
      },
      metadata: {
        service: 'fleet',
        vehicle_class: vehicleClass,
        billing: period,
        start_date: startDate || '',
        end_date: endDate || '',
        first_name: firstName || '',
        last_name: lastName || '',
        phone: phone || '',
        city: city || '',
        insurance: insurance || '',
      },
      success_url: `${siteUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/book.html?canceled=1`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payable: true, url: session.url }),
    };
  } catch (err) {
    console.error('Stripe error:', err.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'checkout_failed' }) };
  }
};
