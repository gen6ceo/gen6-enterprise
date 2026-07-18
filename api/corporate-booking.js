// GEN6 Enterprise — corporate/team booking request
// Saves to the bookings store with status "requested" — it does NOT block
// availability until Trey confirms it (corporate requests can exceed
// current inventory; he sources vehicles/units, then flips the status).

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let b;
  try { b = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  if (!b.email || !b.company) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const id = 'corp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const record = {
    id,
    email: b.email,
    company: b.company,
    first_name: b.contactName || '',
    phone: b.phone || '',
    service: 'corporate',
    vehicle_class: '',
    needs: {
      sedans: parseInt(b.sedans, 10) || 0,
      suvs: parseInt(b.suvs, 10) || 0,
      fourbyfours: parseInt(b.fourbyfours, 10) || 0,
      units: parseInt(b.units, 10) || 0,
    },
    city: b.location || '',
    start_date: b.startDate || null,
    end_date: b.endDate || null,
    billing: b.billing || '',
    status: 'requested',
    roster: b.roster || '',
    details: b.details || '',
    created: new Date().toISOString(),
  };

  let saved = false;
  try {
    const store = getStore({ name: 'bookings', siteID: process.env.SITE_ID || '6f67932f-82a2-4a35-a18f-32d16cf4381c', token: process.env.NETLIFY_BLOBS_TOKEN });
    await store.setJSON(id, record);
    saved = true;
  } catch (err) {
    console.error('corporate-booking save error:', err.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saved, id }),
  };
};
