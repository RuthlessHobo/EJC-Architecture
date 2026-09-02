/* ============================================================
   EJC ARCHITECTURE - interaction layer
   Vanilla JS. No dependencies. rAF-lerped parallax,
   IntersectionObserver reveals, magnetic elements.
   ============================================================ */
(() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- Preloader ---------- */
  const preloader = document.querySelector('.preloader');
  const boot = () => {
    document.body.classList.add('is-ready');
    if (!preloader) return;
    const count = preloader.querySelector('.preloader__count');
    if (prefersReduced || sessionStorage.getItem('ejc-seen')) {
      preloader.classList.add('is-done');
      setTimeout(() => preloader.remove(), 1200);
      return;
    }
    sessionStorage.setItem('ejc-seen', '1');
    let n = 0;
    const tick = () => {
      n = Math.min(100, n + Math.ceil(Math.random() * 16));
      if (count) count.textContent = String(n).padStart(3, '0');
      if (n < 100) {
        setTimeout(tick, 24);
      } else {
        setTimeout(() => {
          preloader.classList.add('is-done');
          setTimeout(() => preloader.remove(), 1200);
        }, 140);
      }
    };
    tick();
  };
  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);

  /* ---------- Custom cursor ---------- */
  if (finePointer && !prefersReduced) {
    const dot = document.createElement('div');
    dot.className = 'cursor is-hidden';
    document.body.appendChild(dot);
    let cx = -100, cy = -100, tx = -100, ty = -100;
    window.addEventListener('pointermove', (e) => {
      tx = e.clientX; ty = e.clientY;
      dot.classList.remove('is-hidden');
    }, { passive: true });
    document.addEventListener('mouseleave', () => dot.classList.add('is-hidden'));
    const hoverables = 'a, button, input, textarea, select, .work-card, .index-row';
    document.addEventListener('mouseover', (e) => {
      dot.classList.toggle('is-hover', !!e.target.closest(hoverables));
    });
    // Run only while the dot is still catching up to the pointer. A loop that
    // never stops keeps the main thread (and the GPU) busy on an idle page.
    let cursorRunning = false;
    const cursorLoop = () => {
      cx = lerp(cx, tx, 0.2); cy = lerp(cy, ty, 0.2);
      dot.style.left = cx + 'px';
      dot.style.top = cy + 'px';
      if (Math.abs(cx - tx) < 0.1 && Math.abs(cy - ty) < 0.1) { cursorRunning = false; return; }
      requestAnimationFrame(cursorLoop);
    };
    const kickCursor = () => {
      if (cursorRunning) return;
      cursorRunning = true;
      requestAnimationFrame(cursorLoop);
    };
    window.addEventListener('pointermove', kickCursor, { passive: true });
  }

  /* ---------- Header: shrink + hide on scroll down ---------- */
  const header = document.querySelector('.header');
  let lastY = window.scrollY;
  const onScrollHeader = () => {
    if (!header) return;
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 60);
    if (!header.classList.contains('is-open') &&
        !document.body.classList.contains('stages-pinned')) {
      header.classList.toggle('is-hidden', y - lastY > 4 && y > 300);
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ---------- Fullscreen menu ---------- */
  const menu = document.querySelector('.menu');
  const toggle = document.querySelector('.menu-toggle');
  if (menu && toggle && header) {
    const label = toggle.querySelector('.menu-toggle__label span');
    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      header.classList.toggle('is-open', open);
      header.classList.remove('is-hidden');
      document.body.classList.toggle('is-locked', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Close' : 'Menu';
    };
    toggle.addEventListener('click', () =>
      setOpen(!menu.classList.contains('is-open'))
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
    // hover previews
    const previews = menu.querySelectorAll('.menu__preview img');
    menu.querySelectorAll('.menu__link').forEach((link) => {
      link.addEventListener('mouseenter', () => {
        const key = link.dataset.preview;
        previews.forEach((img) =>
          img.classList.toggle('is-active', img.dataset.key === key)
        );
      });
    });
    if (previews.length) previews[0].classList.add('is-active');
  }

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }
  );
  document
    .querySelectorAll('.reveal, .reveal-lines, .wipe, .crossbar-watch')
    .forEach((el) => io.observe(el));

  /* ---------- Marquee: animate only while visible ---------- */
  document.querySelectorAll('.marquee__track').forEach((t) => {
    new IntersectionObserver((es) => {
      es.forEach((en) => t.classList.toggle('is-paused', !en.isIntersecting));
    }, { threshold: 0 }).observe(t);
  });

  /* ---------- Hero video: load and decode only while visible ----------
     Below 820px the stylesheet hides this video and paints the poster instead,
     so playing it there would pull megabytes nobody sees. Letting the observer
     start playback also keeps preload="none" honoured, so the video no longer
     competes with the hero image for bandwidth during first paint. */
  const heroVid = document.querySelector('.hero video');
  const heroVideoWanted = !prefersReduced && !window.matchMedia('(max-width: 820px)').matches;
  if (heroVid && heroVideoWanted) {
    heroVid.muted = true;
    new IntersectionObserver((es) => {
      es.forEach((en) => { en.isIntersecting ? heroVid.play().catch(() => {}) : heroVid.pause(); });
    }, { threshold: 0.05 }).observe(heroVid);
  }

  /* ---------- Parallax (rAF-lerped) ---------- */
  const pxEls = [...document.querySelectorAll('[data-parallax]')].map((el) => ({
    el,
    speed: parseFloat(el.dataset.parallax) || 0.15,
    cur: 0,
  }));
  const coarse = window.matchMedia('(hover: none)').matches;
  if (pxEls.length && !prefersReduced && !coarse) {
    // Only track elements that are actually on screen, and only run the loop
    // while one of them is still easing. Reading getBoundingClientRect for every
    // element on every frame forces a layout each frame, which is what makes
    // scrolling feel heavy.
    const visible = new Set();
    const vis = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        en.isIntersecting ? visible.add(en.target) : visible.delete(en.target);
      });
      kick();
    }, { rootMargin: '20% 0px' });
    pxEls.forEach((item) => vis.observe(item.el));

    let running = false;
    const update = () => {
      const vh = window.innerHeight;
      let settled = true;
      pxEls.forEach((item) => {
        if (!visible.has(item.el)) return;
        const rect = item.el.getBoundingClientRect();
        const center = rect.top + rect.height / 2 - vh / 2;
        const target = -center * item.speed;
        item.cur = lerp(item.cur, target, 0.08);
        if (Math.abs(item.cur - target) > 0.2) settled = false;
        item.el.style.transform = `translate3d(0, ${item.cur.toFixed(2)}px, 0)`;
      });
      if (settled) { running = false; return; }
      requestAnimationFrame(update);
    };
    function kick() {
      if (running || !visible.size) return;
      running = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick, { passive: true });
    kick();
  }

  /* ---------- Magnetic elements ---------- */
  if (finePointer && !prefersReduced) {
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.25;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1)';
        el.style.transform = 'translate(0,0)';
        setTimeout(() => (el.style.transition = ''), 600);
      });
    });
  }

  /* ---------- Rolling text spans ---------- */
  document.querySelectorAll('.roll > span').forEach((span) => {
    if (!span.dataset.text) span.dataset.text = span.textContent.trim();
  });

  /* ---------- Projects index: floating hover preview ---------- */
  const indexList = document.querySelector('.index-list');
  const preview = document.querySelector('.index-preview');
  if (indexList && preview && finePointer && !prefersReduced) {
    const imgs = preview.querySelectorAll('img');
    let px = 0, py = 0, txp = 0, typ = 0, active = false;
    indexList.addEventListener('pointermove', (e) => {
      txp = e.clientX + 28;
      typ = e.clientY - preview.offsetHeight / 2;
    }, { passive: true });
    indexList.querySelectorAll('.index-row').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        if (!active) { px = txp; py = typ; }
        active = true;
        preview.classList.add('is-active');
        imgs.forEach((img) =>
          img.classList.toggle('is-active', img.dataset.key === row.dataset.preview)
        );
      });
    });
    indexList.addEventListener('mouseleave', () => {
      active = false;
      preview.classList.remove('is-active');
    });
    // Same treatment as the cursor: idle when the preview is neither shown nor
    // still gliding into place.
    let previewRunning = false;
    const previewLoop = () => {
      px = lerp(px, txp, 0.12);
      py = lerp(py, typ, 0.12);
      if (active || Math.abs(px - txp) > 0.5) {
        preview.style.left = px + 'px';
        preview.style.top = py + 'px';
      }
      if (!active && Math.abs(px - txp) < 0.5 && Math.abs(py - typ) < 0.5) {
        previewRunning = false;
        return;
      }
      requestAnimationFrame(previewLoop);
    };
    const kickPreview = () => {
      if (previewRunning) return;
      previewRunning = true;
      requestAnimationFrame(previewLoop);
    };
    indexList.addEventListener('pointerenter', kickPreview, { passive: true });
    indexList.addEventListener('pointermove', kickPreview, { passive: true });
  }

  /* ---------- Reviews slider ---------- */
  const reviews = document.querySelectorAll('.review');
  if (reviews.length > 1) {
    let idx = 0;
    const show = (i) => {
      idx = (i + reviews.length) % reviews.length;
      reviews.forEach((r, n) => r.classList.toggle('is-active', n === idx));
      const counter = document.querySelector('.reviews__count');
      if (counter) counter.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(reviews.length).padStart(2, '0')}`;
    };
    document.querySelector('.reviews__prev')?.addEventListener('click', () => show(idx - 1));
    document.querySelector('.reviews__next')?.addEventListener('click', () => show(idx + 1));
    show(0);
  }


  /* ---------- Work cards: sketch -> render crossfade on hover ---------- */
  document.querySelectorAll('[data-slideshow]').forEach((card) => {
    const slides = card.querySelector('.work-card__slides');
    if (!slides) return;
    const imgs = slides.querySelectorAll('img');
    let idx = 0, timer = null;
    const show = (i) => imgs.forEach((im, k) => im.classList.toggle('is-on', k === i));
    card.addEventListener('mouseenter', () => {
      card.classList.add('is-playing');
      idx = 0; show(0);
      if (prefersReduced || imgs.length < 2) return;
      timer = setInterval(() => { idx = (idx + 1) % imgs.length; show(idx); }, 1500);
    });
    card.addEventListener('mouseleave', () => {
      if (timer) { clearInterval(timer); timer = null; }
      card.classList.remove('is-playing');
    });
  });

  /* ---------- Stages lookup ---------- */
  const stages = document.querySelector('[data-stages]');
  /* ---------- Stages: sketch -> render scroll progress ---------- */
  if (stages && !prefersReduced) {
    const stageNames = [
      'Stage 01: Inception',
      'Stage 02: Concept',
      'Stage 03: Design development',
      'Stage 04: Council submission',
      'Stage 05: Construction',
      'Stage 06: Close out',
    ];
    const label = stages.querySelector('.stages__stage');
    const stagesMobile = window.matchMedia('(max-width: 820px)').matches;
    if (stagesMobile) {
      stages.classList.add('stages--m');
      // The pencil-line SVG is display:none on phones, but its ~390 paths still
      // sit in the tree and get their style re-resolved along with everything
      // else. They can go entirely.
      stages.querySelectorAll('.stages__draw, .stages__drawvid').forEach((el) => el.remove());
    }
    /* How progress reaches the page differs by device.

       Desktop sets the inherited --p custom property on the section and lets
       the stylesheet derive every mask, stroke and opacity from it. That is
       the right tool there: the SVG linework and gradient masks need it.

       On a phone that channel is the bottleneck. Changing an inherited custom
       property makes the browser re-resolve style for every element beneath
       it, every frame -- measured at ~4ms for this section on a throttled CPU,
       against ~0.14ms for writing the six moving properties directly. So on
       touch screens the same formulas the stylesheet uses are evaluated here
       and written straight onto the six elements that actually change. */
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const reveal = stages.querySelector('.stages__reveal');
    const hint = stages.querySelector('.stages__hint');
    const bar = stages.querySelector('.stages__bar i');
    // Caption timing lives in the stylesheet (--in / --out per caption); read it
    // once so the CSS stays the single source of truth for the choreography.
    const caps = [...stages.querySelectorAll('.stages__cap')].map((el) => {
      const cs = getComputedStyle(el);
      return {
        el,
        in: parseFloat(cs.getPropertyValue('--in')) || 0,
        out: parseFloat(cs.getPropertyValue('--out')) || 1,
      };
    });
    const paint = (p) => {
      if (!stagesMobile) { stages.style.setProperty('--p', p.toFixed(4)); return; }
      if (reveal) reveal.style.opacity = clamp01((p - 0.38) / 0.34);
      if (hint) hint.style.opacity = 1 - clamp01(p / 0.12);
      if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
      for (const c of caps) {
        c.el.style.opacity = clamp01((p - c.in) / 0.06) - clamp01((p - c.out) / 0.06);
        c.el.style.transform = `translateY(${((1 - clamp01((p - c.in) / 0.10)) * 26).toFixed(2)}px)`;
      }
    };
    let cur = 0;
    let lastP = -1;
    let lastStage = -1;
    let done = false;
    let stagesPinned = false;
    const resetStages = () => {
      done = false; cur = 0; lastP = -1;
      stages.style.height = '';
      paint(0);
    };
    document.addEventListener('ejc:pagechange', resetStages);
    /* Progress is measured against the pinned plate itself rather than
       window.innerHeight. The three heights in play here do not agree: the
       section is sized in vh (large viewport), .stages__pin in svh (small
       viewport), and window.innerHeight sits between the two, changing as a
       phone's URL bar hides and shows. Mixing them made the scroll maths jump
       every time that bar moved, which is what read as vibration on mobile.
       The pin is the element actually on screen, so measuring it keeps the
       maths and the layout in agreement whatever the browser chrome does. */
    const pin = stages.querySelector('.stages__pin');
    let vw0 = window.innerWidth;
    let pinH = pin ? pin.getBoundingClientRect().height : window.innerHeight;
    window.addEventListener('resize', () => {
      // Height-only resizes are the URL bar; re-measuring on those reintroduces
      // the jump. Only a width change is a real layout change.
      if (window.innerWidth !== vw0) {
        vw0 = window.innerWidth;
        pinH = pin ? pin.getBoundingClientRect().height : window.innerHeight;
      }
    });
    const tick = () => {
      const rect = stages.getBoundingClientRect();
      const total = rect.height - pinH;
      const raw = total > 0 ? -rect.top / total : 1;
      /* Keep the nav out of the way while the plate is pinned. The scroll
         handler also writes this class, so flag the pinned state and let it
         stand down -- otherwise the two fight and the header flickers. */
      const pinned = rect.top <= 2 && rect.bottom >= pinH - 2 &&
                     !document.body.classList.contains('is-locked');
      if (pinned !== stagesPinned) {
        stagesPinned = pinned;
        document.body.classList.toggle('stages-pinned', pinned);
        // Written on the transition only. classList.add rewrites the class
        // attribute even when the token is already present, and doing that
        // every frame dirtied style a second time per frame -- a whole extra
        // style/layout/paint pass on top of the scrub's own.
        if (pinned) header?.classList.add('is-hidden');
      }
      const target = done ? 1 : Math.min(1, Math.max(0, raw));
      /* On a touch screen, scrolling is composited off the main thread, so an
         eased value is permanently chasing a target it never catches and the
         catch-up reads as judder. Locking progress straight to scroll position
         makes it a pure function of where the finger is, which cannot wobble.
         Desktop keeps the easing, where it is smooth and wanted. */
      cur = done ? 1 : (stagesMobile ? target : lerp(cur, target, 0.14));
      if (Math.abs(cur - target) < 0.001) cur = target;
      if (!done && cur > 0.985) { done = true; cur = 1; }
      const q = Math.round(cur * 400) / 400;
      if (q !== lastP) { paint(q); lastP = q; }
      if (label) {
        const idx = Math.min(5, Math.floor(cur * 6));
        const name = stageNames[idx];
        if (label.textContent !== name) label.textContent = name;
      }
      if (!onScreen) { stagesRunning = false; return; }
      requestAnimationFrame(tick);
    };
    // The stages plate is one section of a long page. Driving its scroll maths
    // every frame regardless of where the reader is costs a layout per frame for
    // nothing, so only run it while the section is anywhere near the viewport.
    let onScreen = false;
    let stagesRunning = false;
    const kickStages = () => {
      if (stagesRunning || !onScreen) return;
      stagesRunning = true;
      requestAnimationFrame(tick);
    };
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      kickStages();
    }, { rootMargin: '50% 0px' }).observe(stages);
  }

  /* ---------- Contact form ---------- */
  document.querySelectorAll('.field input, .field textarea, .field select').forEach((input) => {
    const sync = () =>
      input.closest('.field').classList.toggle('is-filled', !!input.value.trim());
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    sync();
  });
  // Keep FormSubmit's post-submit redirect on the origin the page is served
  // from, so the demo deploy returns to the demo and live returns to live.
  document.querySelectorAll('.contact-form input[name="_next"]').forEach((next) => {
    try {
      const u = new URL(next.value, window.location.href);
      next.value = window.location.origin + u.pathname + u.search + u.hash;
    } catch (_) {
      /* leave the authored value alone if it will not parse */
    }
  });
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      const status = form.querySelector('.form-status');
      const required = [...form.querySelectorAll('[required]')];
      const missing = required.filter((f) => !f.value.trim());
      if (missing.length) {
        e.preventDefault();
        if (status) status.textContent = 'Please complete the highlighted fields.';
        missing[0].focus();
        return;
      }
      if (status) status.textContent = 'Sending…';
      form.querySelectorAll('.field').forEach((f) => f.classList.remove('is-filled'));
    });
  }

  /* ---------- Page transitions ---------- */
  const veil = document.createElement('div');
  veil.className = 'veil';
  document.body.appendChild(veil);
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return;
    const [path, hash] = href.split('#');
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey) return;
      const current = window.location.pathname.split('/').pop() || 'index.html';
      if (hash && path === current) {
        // same-page section link: close the menu and glide to it
        e.preventDefault();
        document.querySelector('.menu')?.classList.remove('is-open');
        document.querySelector('.header')?.classList.remove('is-open');
        document.body.classList.remove('is-locked');
        const t = document.querySelector('.menu-toggle');
        if (t) {
          t.setAttribute('aria-expanded', 'false');
          const lbl = t.querySelector('.menu-toggle__label span');
          if (lbl) lbl.textContent = 'Menu';
        }
        document.getElementById(hash)?.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
        return;
      }
      if (prefersReduced) return;
      e.preventDefault();
      veil.classList.add('is-in');
      setTimeout(() => (window.location.href = href), 300);
    });
  });
  window.addEventListener('pageshow', () => veil.classList.remove('is-in'));
})();
