// GEN6 Enterprise — date availability (Turo-style)
// GET /api/availability?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns { unavailable: ["fusion", "housing", ...] } — resources with a
// booking that overlaps the requested dates. Vehicles are keyed by class;
// housing is the single key "housing".

const { getStore } = require('@netlify/blobs');

const BLOCKING = new Set(['reserved', 'confirmed', 'active', 'paid']);

exports.handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const start = qs.start || null;
  const end = qs.end || null;   // may be empty (open-ended request)
  if (!start) {
    return { statusCode: 400, body: JSON.stringify({ error: 'start required' }) };
  }

  const unavailable = new Set();

  try {
    const store = getStore({ name: 'bookings', siteID: process.env.SITE_ID || '6f67932f-82a2-4a35-a18f-32d16cf4381c', token: process.env.NETLIFY_BLOBS_TOKEN });
    const { blobs } = await store.list();
    for (const blob of blobs) {
      let b;
      try { b = await store.get(blob.key, { type: 'json' }); }
      catch { continue; }
      if (!b || !b.start_date) continue;
      if (!BLOCKING.has(b.status || 'reserved')) continue;

      // Overlap test on date strings (YYYY-MM-DD compares lexicographically).
      // Booking [bs, be] vs query [start, end]; null end = open-ended.
      const bs = b.start_date;
      const be = b.end_date || null;
      const startsBeforeQueryEnds = end ? bs <= end : true;
      const endsAfterQueryStarts = be ? be >= start : true;
      if (!(startsBeforeQueryEnds && endsAfterQueryStarts)) continue;

      if ((b.service === 'fleet' || b.service === 'both') && b.vehicle_class) {
        unavailable.add(b.vehicle_class);
      }
      if (b.service === 'housing' || b.service === 'both') {
        unavailable.add('housing');
      }
    }
  } catch (err) {
    console.error('availability error:', err.message);
    // On storage failure, fail open (nothing blocked) so booking still works.
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({ unavailable: Array.from(unavailable) }),
  };
};
