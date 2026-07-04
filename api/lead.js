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

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  };
};
