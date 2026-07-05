// GEN6 Enterprise — Stripe Checkout session (Netlify function)
// Creates a payment session for online-bookable rentals.
// Payment methods: card + Affirm + Klarna (activate both in the
// Stripe Dashboard → Settings → Payment methods before going live).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Weekly rates in cents. null = not bookable online yet → the client
// falls back to the reserve flow and Trey sends a payment link with
// the confirmed quote. Add prices here as they're locked in.
const WEEKLY_RATES = {
  sedan:       40000,  // Executive Sedan — $400/week
  'suv-exec':  null,   // Executive SUV
  'suv-prem':  null,   // Premium SUV
  executive:   null,   // Executive Class
};

const CLASS_NAMES = {
  sedan:      'GEN6 Fleet — Executive Sedan (weekly rental)',
  'suv-exec': 'GEN6 Fleet — Executive SUV (weekly rental)',
  'suv-prem': 'GEN6 Fleet — Premium SUV (weekly rental)',
  executive:  'GEN6 Fleet — Executive Class (weekly rental)',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const {
    vehicleClass, weeks, startDate, endDate,
    firstName, lastName, email, phone, city, insurance,
  } = body;

  const rate = WEEKLY_RATES[vehicleClass];
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

  const qty = Math.min(Math.max(parseInt(weeks, 10) || 1, 1), 26);
  const siteUrl = process.env.URL || 'https://gen6enterprise.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'affirm', 'klarna'],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: CLASS_NAMES[vehicleClass] || 'GEN6 Fleet rental',
            description: `${qty} week${qty > 1 ? 's' : ''} · ${startDate || 'start TBD'} → ${endDate || 'open'} · No deposit`,
          },
          unit_amount: rate,
        },
        quantity: qty,
      }],
      metadata: {
        service: 'fleet',
        vehicle_class: vehicleClass,
        weeks: String(qty),
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
