/* ═══════════════════════════════════════════════════════════
   GEN6 ENTERPRISE — BOOKING WIZARD
   Trip → Documents → Confirm & Pay (Stripe: card/Affirm/Klarna)
   ═══════════════════════════════════════════════════════════ */

(function () {
  // Rates in dollars per billing period. Mirror of the server table in
  // api/create-checkout-session.js — null means quote-first.
  const RATES = {
    sedan:      { weekly: null, monthly: null },  // varies by vehicle — quote path
    'suv-exec': { weekly: null, monthly: null },
    'suv-prem': { weekly: null, monthly: null },
    executive:  { weekly: null, monthly: null },
  };

  const state = {
    service: null,       // fleet | housing | both
    vehicleClass: null,  // sedan | suv-exec | suv-prem | executive
    billing: 'weekly',   // weekly | monthly
  };

  function currentRate() {
    if (!state.vehicleClass || !RATES[state.vehicleClass]) return null;
    return RATES[state.vehicleClass][state.billing];
  }

  const $ = (id) => document.getElementById(id);
  const panes = [1, 2, 3].map((n) => $('pane-' + n));
  const inds = document.querySelectorAll('.wizard-step-ind');

  function goTo(step) {
    panes.forEach((p, i) => p.classList.toggle('active', i === step - 1));
    inds.forEach((ind) => {
      const n = parseInt(ind.dataset.ind, 10);
      ind.classList.toggle('active', n === step);
      ind.classList.toggle('done', n < step);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showErr(id, on) { $(id).style.display = on ? 'block' : 'none'; }

  // ── Step 1: service + class + dates ────────────────────────
  const classWrap = $('classPickWrap');
  document.querySelectorAll('#serviceChoice .choice-card').forEach((card) => {
    const pick = () => {
      document.querySelectorAll('#serviceChoice .choice-card').forEach((c) => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      state.service = card.dataset.service;
      classWrap.style.display = state.service === 'housing' ? 'none' : 'block';
      document.getElementById('billingWrap').style.display = state.service === 'housing' ? 'none' : 'block';
      showErr('err-service', false);
    };
    card.addEventListener('click', pick);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });

  document.querySelectorAll('.class-row').forEach((row) => {
    const pick = () => {
      document.querySelectorAll('.class-row').forEach((r) => r.classList.remove('selected'));
      row.classList.add('selected');
      state.vehicleClass = row.dataset.class;
      showErr('err-class', false);
    };
    row.addEventListener('click', pick);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });

  // Billing frequency choice
  document.querySelectorAll('#billingChoice .choice-card').forEach((card) => {
    const pick = () => {
      document.querySelectorAll('#billingChoice .choice-card').forEach((c) => {
        c.classList.remove('selected');
        c.setAttribute('aria-pressed', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-pressed', 'true');
      state.billing = card.dataset.billing;
    };
    card.addEventListener('click', pick);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });

  // Preselect from ?service= query param
  const preset = new URLSearchParams(location.search).get('service');
  if (preset) {
    const presetCard = document.querySelector('#serviceChoice .choice-card[data-service="' + preset + '"]');
    if (presetCard) presetCard.click();
  }

  $('toStep2').addEventListener('click', () => {
    let ok = true;
    if (!state.service) { showErr('err-service', true); ok = false; }
    if (state.service && state.service !== 'housing' && !state.vehicleClass) { showErr('err-class', true); ok = false; }
    if (!$('startDate').value) { showErr('err-dates', true); ok = false; } else { showErr('err-dates', false); }
    if (ok) {
      $('hint-license').textContent = state.service === 'housing'
        ? 'For identity verification'
        : 'Required for vehicle bookings';
      goTo(2);
    }
  });

  // ── Step 2: details + documents ────────────────────────────
  document.querySelectorAll('.doc-upload input[type="file"]').forEach((input) => {
    input.addEventListener('change', () => {
      const wrap = input.closest('.doc-upload');
      const hint = wrap.querySelector('.doc-hint');
      if (input.files.length) {
        wrap.classList.add('has-file');
        hint.className = 'doc-file';
        hint.textContent = '✓ ' + input.files[0].name;
        wrap.querySelector('.doc-btn').textContent = 'Change';
      }
    });
  });

  $('backTo1').addEventListener('click', () => goTo(1));
  $('toStep3').addEventListener('click', () => {
    const need = ['firstName', 'lastName', 'email', 'phone'];
    const missing = need.some((id) => !$(id).value.trim());
    showErr('err-details', missing);
    const noInsurance = !$('insurance').value;
    showErr('err-insurance', noInsurance);
    if (missing || noInsurance) return;
    buildSummary();
    goTo(3);
  });
  $('backTo2').addEventListener('click', () => goTo(2));

  // ── Step 3: summary + pay ──────────────────────────────────
  function payableNow() {
    return state.service === 'fleet' && currentRate() !== null;
  }

  const CLASS_LABELS = {
    sedan: 'Executive Sedan', 'suv-exec': 'Executive SUV',
    'suv-prem': 'Premium SUV', executive: 'Executive Class',
  };
  const SERVICE_LABELS = { fleet: 'Vehicle', housing: 'Housing', both: 'Housing + Vehicle' };

  function buildSummary() {
    const rows = [];
    rows.push(['Booking', SERVICE_LABELS[state.service]]);
    if (state.service !== 'housing') rows.push(['Vehicle', CLASS_LABELS[state.vehicleClass]]);
    rows.push(['Dates', $('startDate').value + ($('endDate').value ? ' → ' + $('endDate').value : ' → open')]);
    rows.push(['City', $('city').value ? $('city').selectedOptions[0].text : '—']);
    rows.push(['Insurance', $('insurance').selectedOptions[0].text]);
    rows.push(['Deposit', 'None']);

    let totalRow = '';
    if (payableNow()) {
      const rate = currentRate();
      const per = state.billing === 'monthly' ? 'month' : 'week';
      rows.push(['Rate', '$' + rate.toLocaleString() + '/' + per]);
      rows.push(['Then', '$' + rate.toLocaleString() + ' every ' + per +
        ($('endDate').value ? ' — stops automatically ' + $('endDate').value : ' until you end the rental')]);
      totalRow = '<div class="sum-row sum-total"><span>Due today</span><span class="sum-val">$' + rate.toLocaleString() + '</span></div>';
      $('payMethods').style.display = 'flex';
      $('confirmBtn').innerHTML = 'Confirm &amp; Pay →';
      $('confirmNote').textContent = 'No deposit. First ' + per + ' due today, then the same rate each ' + per + '.';
      if ($('insurance').value === 'gen6') {
        $('confirmNote').textContent += ' GEN6 coverage is priced separately and added to your agreement.';
      }
    } else {
      totalRow = '<div class="sum-row sum-total"><span>Due today</span><span class="sum-val">$0 — quote first</span></div>';
      $('payMethods').style.display = 'none';
      $('confirmBtn').innerHTML = 'Confirm Reservation →';
      $('confirmNote').textContent = 'No deposit, nothing charged now. We confirm your quote within hours and send a secure payment link with your exact rate, billed weekly or monthly — card, Affirm, and Klarna accepted.';
    }

    $('summary').innerHTML = rows.map(([k, v]) =>
      '<div class="sum-row"><span>' + k + '</span><span class="sum-val">' + v + '</span></div>'
    ).join('') + totalRow;
  }

  function collect() {
    return {
      service: state.service,
      vehicleClass: state.vehicleClass || '',
      billing: state.billing,
      startDate: $('startDate').value,
      endDate: $('endDate').value,
      city: $('city').value,
      firstName: $('firstName').value.trim(),
      lastName: $('lastName').value.trim(),
      email: $('email').value.trim(),
      phone: $('phone').value.trim(),
      insurance: $('insurance').value,
      details: $('details').value.trim(),
    };
  }

  // Documents → Netlify Forms (multipart). Fails silently on localhost.
  async function uploadDocuments(data) {
    const fd = new FormData();
    fd.append('form-name', 'booking-documents');
    Object.entries(data).forEach(([k, v]) => fd.append(k, v));
    ['docLicense', 'docAssignment', 'docInsurance'].forEach((id) => {
      const input = $(id);
      if (input.files.length) fd.append(id, input.files[0]);
    });
    try {
      await fetch('/', { method: 'POST', body: fd });
    } catch (err) {
      console.warn('Document upload skipped:', err.message);
    }
  }

  $('confirmBtn').addEventListener('click', async () => {
    const btn = $('confirmBtn');
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Processing…';
    showErr('err-confirm', false);

    const data = collect();

    try {
      // 1. documents + lead into the CRM (always)
      await uploadDocuments(data);
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          inquiryType: state.service,
          rentalType: state.vehicleClass || '',
          moveIn: data.startDate,
          moveOut: data.endDate,
          source: 'GEN6 Website — Booking Wizard',
        }),
      }).catch(() => {});

      // portal record (client sees it after signing in)
      fetch('/api/save-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});

      // 2. payable → Stripe Checkout; otherwise instant reservation
      if (payableNow()) {
        const res = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('checkout failed');
        const out = await res.json();
        if (out.payable && out.url) {
          window.location.href = out.url;
          return;
        }
      }

      window.location.href = '/booking-success.html?mode=reserved';
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = original;
      showErr('err-confirm', true);
    }
  });
})();
