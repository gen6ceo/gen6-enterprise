// GEN6 Enterprise — save a booking into the portal database (Supabase)
// Called by the booking wizard after a reservation/checkout so the
// client sees it in their portal. Uses the service key (the person
// isn't logged in yet); the claim_bookings trigger links the row to
// their account when they first sign in with the same email.

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    // portal not configured yet — succeed quietly so booking still works
    return { statusCode: 200, body: JSON.stringify({ saved: false }) };
  }

  let b;
  try { b = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }
  if (!b.email || !b.firstName) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  try {
    const { data, error } = await sb.from('bookings').insert({
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
    }).select('id').single();

    if (error) throw error;
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saved: true, id: data.id }) };
  } catch (err) {
    console.error('save-booking error:', err.message);
    return { statusCode: 200, body: JSON.stringify({ saved: false }) };
  }
};
