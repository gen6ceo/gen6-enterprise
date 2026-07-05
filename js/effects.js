/* ═══════════════════════════════════════════════════════════
   GEN6 ENTERPRISE — INTERACTIVE EFFECTS
   Shader hero · nav shrink · scroll progress · card tilt
   ═══════════════════════════════════════════════════════════ */

(function () {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Live shader hero background (mouse-reactive) ──────────
  function initShader(canvas) {
    function syncSize() {
      const w = canvas.clientWidth || 1280;
      const h = canvas.clientHeight || 720;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(syncSize).observe(canvas);
    }
    syncSize();

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    const vs = `attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }`;
    const fs = `precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      varying vec2 v_texCoord;
      void main() {
        vec2 uv = v_texCoord;
        vec2 mouse = u_mouse / u_resolution;
        float t = u_time * 0.2;
        float noise = sin(uv.x * 3.0 + t) * cos(uv.y * 2.0 - t * 0.5);
        noise += sin(uv.y * 4.0 - t * 0.8) * cos(uv.x * 3.5 + t * 0.4);
        vec3 base = vec3(0.015, 0.035, 0.07);      /* deep navy */
        vec3 blue = vec3(0.12, 0.30, 0.72);        /* GEN6 blue */
        vec3 green = vec3(0.0, 1.0, 0.53);         /* GEN6 green */
        float dist = length(uv - mouse);
        float glow = 0.05 / (dist + 0.5);
        vec3 color = mix(base, blue * 0.22, noise * 0.5 + 0.5);
        color += green * glow * 0.18;
        color += green * 0.03 * (sin(uv.x * 6.0 - t) * 0.5 + 0.5) * (1.0 - uv.y);
        gl_FragColor = vec4(color, 1.0);
      }`;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
    window.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      if (r.width && r.height) {
        mouse.x = (e.clientX - r.left) / r.width * canvas.width;
        mouse.y = (1 - (e.clientY - r.top) / r.height) * canvas.height;
      }
    });

    function render(t) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uTime) gl.uniform1f(uTime, t * 0.001);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(render);
    }
    render(0);
  }

  if (!reducedMotion) {
    document.querySelectorAll('.hero-shader canvas').forEach(initShader);
  }

  // ── Nav shrinks on scroll ──────────────────────────────────
  const nav = document.querySelector('.site-nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });
  }

  // ── Scroll progress bar ────────────────────────────────────
  if (!reducedMotion) {
    const bar = document.createElement('div');
    bar.id = 'scroll-progress';
    document.body.appendChild(bar);
    window.addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
    }, { passive: true });
  }

  // ── Cursor spotlight on cards ──────────────────────────────
  const spotTargets = document.querySelectorAll(
    '.division-card, .listing-card, .client-card, .service-card, .value-card, .opportunity-box, .dash-widget, .callout-box, .testimonial-card'
  );
  spotTargets.forEach((card) => {
    const spot = document.createElement('div');
    spot.className = 'card-spot';
    card.appendChild(spot);
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      spot.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      spot.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  // ── Hero background parallax ───────────────────────────────
  const heroBg = document.querySelector('.hero-bg img');
  if (heroBg && !reducedMotion) {
    window.addEventListener('mousemove', (e) => {
      const dx = (e.clientX / window.innerWidth - 0.5) * 18;
      const dy = (e.clientY / window.innerHeight - 0.5) * 12;
      heroBg.style.transform = 'scale(1.08) translate(' + -dx + 'px, ' + -dy + 'px)';
    }, { passive: true });
  }

  // ── 3D card tilt on hover ──────────────────────────────────
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover && !reducedMotion) {
    const cards = document.querySelectorAll(
      '.division-card, .service-card, .opportunity-box, .value-card, .client-card'
    );
    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform =
          'perspective(900px) rotateX(' + (-py * 5) + 'deg) rotateY(' + (px * 5) + 'deg) translateY(-6px)';
        card.style.transition = 'transform 0.08s linear';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1)';
        card.style.transform = '';
      });
    });
  }
})();
