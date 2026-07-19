// GEN6 Enterprise — lead capture function (Netlify)
// Handles ALL form submissions from every page.
// Pushes contacts to GoHighLevel and subscribes them to Beehiiv.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const {
    firstName, lastName, email, phone,
    inquiryType, service, clientType, partnerType,
    city, address, propertyType, bedrooms, furnished,
    moveIn, moveOut, startDate, endDate, rentalType,
    insurance, alsoNeedVehicle,
    details, source = 'GEN6 Website',
  } = body;

  if (!email || !firstName) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  // Determine tags based on inquiry type
  const tagMap = {
    housing:   ['housing-lead', 'gen6-housing'],
    fleet:     ['fleet-lead', 'gen6-fleet'],
    both:      ['housing-lead', 'fleet-lead', 'gen6-mobility'],
    property:  ['property-owner-lead'],
    investor:  ['investor-lead', 'high-priority'],
    strategic: ['partner-lead', 'strategic'],
    partner:   ['partner-lead'],
    funding:   ['partner-lead', 'funding'],
    partnership: ['partner-lead'],
    other:     ['general-lead'],
  };
  const type = inquiryType || service || partnerType || 'other';
  const tags = tagMap[type] || ['general-lead'];

  // 1. GoHighLevel
  try {
    await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        locationId: process.env.GHL_LOCATION_ID,
        tags,
        source,
        customField: {
          inquiry_type:  type,
          client_type:   clientType || '',
          city_needed:   city || address || '',
          move_in_date:  moveIn || startDate || '',
          move_out_date: moveOut || endDate || '',
          rental_type:   rentalType || '',
          insurance:     insurance || '',
          also_needs_vehicle: alsoNeedVehicle ? 'yes' : '',
          property_type: propertyType || '',
          bedrooms:      bedrooms || '',
          furnished:     furnished || '',
          details:       details || '',
        },
      }),
    });
  } catch (err) {
    console.error('GHL error:', err.message);
  }

  // 2. Beehiiv newsletter
  try {
    await fetch(
      `https://api.beehiiv.com/v2/publications/${process.env.BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          first_name: firstName,
          reactivate_existing: true,
          send_welcome_email: true,
        }),
      }
    );
  } catch (err) {
    console.error('Beehiiv error:', err.message);
  }

  // 3. Save the full lead to Netlify Blobs (so nothing is ever lost)
  let saved = false;
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore({ name: 'leads', siteID: process.env.SITE_ID || '6f67932f-82a2-4a35-a18f-32d16cf4381c', token: process.env.NETLIFY_BLOBS_TOKEN });
    const id = 'lead-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    await store.setJSON(id, { id, ...body, type, created: new Date().toISOString() });
    saved = true;
  } catch (err) {
    console.error('lead blobs error:', err.message);
  }

  // 4. Forward into Netlify Forms → instant email notification to Trey
  let notified = false;
  try {
    const siteUrl = process.env.URL || 'https://gen6enterprise.com';
    const res = await fetch(siteUrl + '/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        'form-name': 'site-lead',
        firstName: firstName || '',
        lastName: lastName || '',
        email: email || '',
        phone: phone || '',
        type,
        city: city || address || '',
        startDate: moveIn || startDate || '',
        endDate: moveOut || endDate || '',
        source,
        details: details || '',
      }).toString(),
    });
    notified = res.ok;
  } catch (err) {
    console.error('lead notify error:', err.message);
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, saved, notified }),
  };
};
