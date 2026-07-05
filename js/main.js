/* ═══════════════════════════════════════════════════════════
   GEN6 ENTERPRISE — SHARED JAVASCRIPT
   Scroll reveal · counters · nav · forms · conditional fields
   ═══════════════════════════════════════════════════════════ */

// ── Scroll reveal ──────────────────────────────────────────
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ── Animated counters ──────────────────────────────────────
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 2000;
  const start = performance.now();
  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease out cubic
    const v = Math.floor(ease * target);
    el.textContent = 'plain' in el.dataset ? String(v) : v.toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && !e.target.dataset.counted) {
      e.target.dataset.counted = 'true';
      animateCounter(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.counter').forEach(el => counterObserver.observe(el));

// ── Active nav link ────────────────────────────────────────
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-link').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath ||
      href === currentPath.replace('.html', '') ||
      (currentPath === '/' && href === '/index.html')) {
    link.classList.add('active');
  }
});

// ── Mobile nav toggle ──────────────────────────────────────
const navToggle = document.querySelector('.nav-toggle');
const navMenu   = document.querySelector('.nav-menu');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded',
      navMenu.classList.contains('open'));
  });
}

// ── Conditional form fields (contact page) ─────────────────
const inquiryType = document.getElementById('inquiryType');
if (inquiryType) {
  inquiryType.addEventListener('change', function () {
    const val = this.value;
    document.querySelectorAll('.conditional-fields').forEach(el => {
      const showFor = el.dataset.showFor.split(',');
      el.style.display = showFor.includes(val) ? 'block' : 'none';
    });
  });
}

// ── Generic form handler — works for all forms ─────────────
document.querySelectorAll('form[id]').forEach(form => {
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const btn = this.querySelector('.form-submit-btn');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.textContent = 'Sending...';

    // Add source field
    const data = Object.fromEntries(new FormData(this).entries());
    data.source = `GEN6 Website — ${document.title}`;

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();

      // Show success
      this.innerHTML = `
        <div class="form-success">
          <div class="form-success-icon">✓</div>
          <h3>Message received.</h3>
          <p>We'll follow up within 24 hours. Check your email — including spam.</p>
        </div>`;
    } catch {
      btn.disabled = false;
      btn.innerHTML = originalText;
      const errDiv = document.createElement('div');
      errDiv.className = 'form-error-msg';
      errDiv.textContent = 'Something went wrong. Try again or reach us at @gen6enterprise.';
      this.appendChild(errDiv);
    }
  });
});
