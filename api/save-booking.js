// GEN6 Enterprise — save a booking
// Primary store: Netlify Blobs (powers date availability, Turo-style).
// Best-effort secondary: Supabase portal DB, if configured and reachable.

const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let b;
  try { b = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  if (!b.email || !b.firstName) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  const record = {
    id,
    email: b.email,
    first_name: b.firstName,
    last_name: b.lastName || '',
    phone: b.phone || '',
    service: b.service || '',
    vehicle_class: b.vehicleClass || '',
    city: b.city || '',
    start_date: b.startDate || null,
    end_date: b.endDate || null,
    billing: b.billing || '',
    insurance: b.insurance || '',
    status: 'reserved',
    details: b.details || '',
    created: new Date().toISOString(),
  };

  let saved = false;

  // Primary: Netlify Blobs
  try {
    const store = getStore('bookings');
    await store.setJSON(id, record);
    saved = true;
  } catch (err) {
    console.error('blobs save error:', err.message);
  }

  // Secondary: Supabase portal (best-effort; project may be offline)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      const row = { ...record };
      delete row.id;
      delete row.created;
      await sb.from('bookings').insert(row);
    } catch (err) {
      console.error('supabase save error:', err.message);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saved, id }),
  };
};
