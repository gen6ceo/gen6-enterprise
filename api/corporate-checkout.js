// GEN6 Enterprise — corporate instant checkout
// If the requested vehicles fit current availability for the dates,
// assigns real vehicles and creates ONE Stripe subscription checkout
// (all vehicles on one weekly bill). Housing units or oversized
// requests fall back to the manual-confirm request flow.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { getStore } = require('@netlify/blobs');

const RATES = { fusion: 32500, buick: 35000, rogue: 35000, wrangler: 37500 };
const NAMES = {
  fusion: 'Ford Fusion (sedan) — $325/wk',
  buick: 'Buick Encore (SUV) — $350/wk',
  rogue: 'Nissan Rogue (SUV) — $350/wk',
  wrangler: 'Jeep Wrangler Rubicon (4x4) — $375/wk',
};
const POOLS = { sedans: ['fusion'], suvs: ['buick', 'rogue'], fourbyfours: ['wrangler'] };
const BLOCKING = new Set(['reserved', 'confirmed', 'active', 'paid']);

function store() {
  return getStore({ name: 'bookings', siteID: process.env.SITE_ID || '6f67932f-82a2-4a35-a18f-32d16cf4381c', token: process.env.NETLIFY_BLOBS_TOKEN });
}

async function bookedClasses(start, end) {
  const s = store();
  const { blobs } = await s.list();
  const taken = new Set();
  for (const blob of blobs) {
    let b;
    try { b = await s.get(blob.key, { type: 'json' }); } catch { continue; }
    if (!b || !b.start_date || !b.vehicle_class) continue;
    if (!BLOCKING.has(b.status || 'reserved')) continue;
    const startsBeforeQueryEnds = end ? b.start_date <= end : true;
    const endsAfterQueryStarts = b.end_date ? b.end_date >= start : true;
    if (startsBeforeQueryEnds && endsAfterQueryStarts) taken.add(b.vehicle_class);
  }
  return taken;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let b;
  try { b = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const counts = {
    sedans: parseInt(b.sedans, 10) || 0,
    suvs: parseInt(b.suvs, 10) || 0,
    fourbyfours: parseInt(b.fourbyfours, 10) || 0,
  };
  const units = parseInt(b.units, 10) || 0;
  const totalVehicles = counts.sedans + counts.suvs + counts.fourbyfours;

  // Housing or empty vehicle order → manual path
  if (units > 0 || totalVehicles === 0 || !b.startDate || !b.email) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payable: false, reason: 'manual' }) };
  }

  // Assign real vehicles against live availability
  let assigned = [];
  try {
    const taken = await bookedClasses(b.startDate, b.endDate || null);
    for (const [pool, classes] of Object.entries(POOLS)) {
      const free = classes.filter((c) => !taken.has(c));
      if (free.length < counts[pool]) {
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payable: false, reason: 'availability' }) };
      }
      assigned = assigned.concat(free.slice(0, counts[pool]));
    }
  } catch (err) {
    console.error('corporate availability error:', err.message);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payable: false, reason: 'manual' }) };
  }

  const siteUrl = process.env.URL || 'https://gen6enterprise.com';
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: b.email,
      line_items: assigned.map((cls) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'GEN6 Fleet — ' + NAMES[cls],
            description: `Corporate rental for ${b.company || 'company'} · ${b.startDate} → ${b.endDate || 'open'} · No deposit`,
          },
          unit_amount: RATES[cls],
          recurring: { interval: 'week' },
        },
        quantity: 1,
      })),
      subscription_data: {
        metadata: { service: 'corporate', company: b.company || '', vehicles: assigned.join(','), start_date: b.startDate, end_date: b.endDate || '' },
      },
      metadata: { service: 'corporate', company: b.company || '', vehicles: assigned.join(','), contact: b.contactName || '', phone: b.phone || '' },
      success_url: `${siteUrl}/booking-success.html?session_id={CHECKOUT_SESSION_ID}&corp=1`,
      cancel_url: `${siteUrl}/corporate.html?canceled=1`,
    });

    // Reserve each assigned vehicle (blocks the dates immediately)
    try {
      const s = store();
      const parent = 'corp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      for (const cls of assigned) {
        const id = parent + '-' + cls;
        await s.setJSON(id, {
          id, email: b.email, company: b.company || '', first_name: b.contactName || '',
          phone: b.phone || '', service: 'fleet', vehicle_class: cls, city: b.location || '',
          start_date: b.startDate, end_date: b.endDate || null, billing: 'weekly',
          status: 'reserved', details: 'Corporate booking — ' + (b.company || ''), created: new Date().toISOString(),
        });
      }
    } catch (err) { console.error('corporate reserve error:', err.message); }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payable: true, url: session.url, vehicles: assigned }),
    };
  } catch (err) {
    console.error('corporate checkout error:', err.message);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payable: false, reason: 'manual' }) };
  }
};
