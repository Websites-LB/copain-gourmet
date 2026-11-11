/* Copain Gourmet — behaviour
   1. Live opening status (Beirut time)   2. Menu   3. Booking message
   4. Motion: only runs when GSAP loaded and the visitor has not asked for reduced motion.
   The page is fully readable without any of it. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // Menu photos are local copies made by tools/fetch-images.mjs (128px thumbnail, 400px preview)
  const photo = (path, w) => `img/${w}/${path.split('/').pop().replace(/\.\w+$/, '')}.webp`;
  const WHATSAPP = '96176363811';
  const OPEN = 9 * 60;          // 09:00
  const CLOSE = 23 * 60 + 30;   // 23:30
  const OFFER_UNTIL = 18 * 60;  // reservation offer runs 9:00 to 18:00

  /* ── 1. time at Copain ─────────────────────────── */
  function beirutNow() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Beirut', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type).value;
    const h = Number(get('hour')) % 24;
    const m = Number(get('minute'));
    return { mins: h * 60 + m, date: `${get('year')}-${get('month')}-${get('day')}` };
  }
  const pad = (n) => String(n).padStart(2, '0');
  const fmt12 = (mins) => `${Math.floor(mins / 60) % 12 || 12}:${pad(mins % 60)} ${mins >= 720 ? 'PM' : 'AM'}`;
  const fmt24 = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

  function moment(mins) {
    if (mins < OPEN) return { line: 'The door opens at 9. Coffee comes first.', cat: 'Petit Dej' };
    if (mins < 13 * 60) return { line: 'Breakfast is on.', cat: 'Petit Dej' };
    if (mins < 16 * 60) return { line: 'Lunch is on the table.', cat: 'Sandwiches' };
    if (mins < 19 * 60) return { line: 'Coffee and something sweet?', cat: 'Desserts' };
    if (mins < CLOSE) return { line: 'Apéro hour. Bring the copains.', cat: 'A Partager' };
    return { line: 'Closed for the night. The door opens again at 9.', cat: 'Petit Dej' };
  }

  const statusEl = $('[data-status]');
  const statusText = $('[data-status-text]');
  const nowEl = $('[data-now]');
  function paintTime() {
    const { mins } = beirutNow();
    const open = mins >= OPEN && mins < CLOSE;
    statusEl.classList.toggle('is-open', open);
    statusEl.classList.toggle('is-closed', !open);
    statusText.textContent = open ? 'Open now · until 11:30 PM' : 'Closed · opens 9:00 AM';
    nowEl.textContent = '';
    if (open) {
      const b = document.createElement('b');
      b.textContent = fmt12(mins);
      nowEl.append('It’s ', b, ` in Jbeil. ${moment(mins).line}`);
    } else {
      nowEl.textContent = moment(mins).line;
    }
  }
  paintTime();
  setInterval(paintTime, 30000);

  /* ── 2. menu ───────────────────────────────────── */
  const MENU = window.COPAIN_MENU;
  const list = $('[data-menu-list]');
  const chips = $('[data-chips]');
  const tabs = $$('[data-menu]');
  const price = (p) => `$${Number.isInteger(p) ? p : p.toFixed(2)}`;
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };

  if (MENU && list) {
    let active = 'food';
    const wanted = moment(beirutNow().mins).cat;
    const picked = {
      food: MENU.food.some((c) => c.name === wanted) ? wanted : MENU.food[0].name,
      drinks: MENU.drinks[0].name,
    };

    const renderItem = (item, withThumbs) => {
      const row = el('div', 'item');
      if (withThumbs) {
        if (item.i) {
          const thumb = el('div', 'item__thumb');
          const im = new Image();
          im.loading = 'lazy'; im.alt = ''; im.width = 64; im.height = 64;
          im.src = photo(item.i, 128);
          thumb.append(im);
          row.append(thumb);
          row.dataset.img = item.i;
        } else {
          row.append(el('div', 'item__thumb item__thumb--none', item.n.trim()[0].toLowerCase()));
        }
      }
      const body = el('div');
      const top = el('div', 'item__top');
      top.append(el('span', 'item__name', item.n), el('i', 'item__dots'), el('span', 'item__price', price(item.p)));
      body.append(top);
      const desc = item.set ? `${item.d ? item.d + ' · ' : ''}${item.set.join(', ')}` : item.d;
      if (desc) body.append(el('p', 'item__desc', desc));
      row.append(body);
      return row;
    };

    const render = () => {
      const cats = MENU[active];
      const cat = cats.find((c) => c.name === picked[active]) || cats[0];
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.menu === active)));

      chips.replaceChildren(...cats.map((c) => {
        const chip = el('button', 'chip', c.name);
        chip.type = 'button';
        chip.setAttribute('aria-pressed', String(c.name === cat.name));
        chip.addEventListener('click', () => { picked[active] = c.name; render(); });
        return chip;
      }));

      list.classList.toggle('is-drinks', active === 'drinks');
      const rows = cat.items.map((item) => renderItem(item, active === 'food'));
      list.replaceChildren(...rows);
      if (window.gsap && !reduce) {
        gsap.fromTo(rows, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .03, ease: 'expo.out', overwrite: true });
      }
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    };

    tabs.forEach((t) => t.addEventListener('click', () => { active = t.dataset.menu; render(); }));
    render();

    // the dish follows the pointer, served on a plate
    const plate = $('[data-plate]');
    const plateImg = $('[data-plate-img]');
    if (finePointer && window.gsap && !reduce) {
      const px = gsap.quickTo(plate, 'x', { duration: .6, ease: 'expo.out' });
      const py = gsap.quickTo(plate, 'y', { duration: .6, ease: 'expo.out' });
      let current = null;
      list.addEventListener('pointermove', (e) => {
        const row = e.target.closest('.item[data-img]');
        px(e.clientX); py(e.clientY);
        if (row === current) return;
        current = row;
        if (row) {
          plateImg.src = photo(row.dataset.img, 400);
          gsap.to(plate, { opacity: 1, scale: 1, rotate: 0, duration: .6, ease: 'expo.out' });
        } else {
          gsap.to(plate, { opacity: 0, scale: .8, rotate: -8, duration: .4, ease: 'expo.out' });
        }
      });
      list.addEventListener('pointerleave', () => {
        current = null;
        gsap.to(plate, { opacity: 0, scale: .8, rotate: -8, duration: .4, ease: 'expo.out' });
      });
    }
  }

  /* ── 3. booking: writes the WhatsApp message for the guest ── */
  const form = $('[data-book]');
  if (form) {
    const send = $('[data-book-send]', form);
    const guestsOut = $('[data-guests]', form);
    const perk = $('[data-perk]', form);
    const now = beirutNow();
    let guests = 2;

    for (let t = OPEN; t <= 23 * 60; t += 30) form.time.add(new Option(fmt12(t), String(t)));
    const next = Math.ceil((now.mins + 45) / 30) * 30;
    form.time.value = String(next >= OPEN && next <= 23 * 60 ? next : 20 * 60);
    form.date.min = now.date;
    form.date.value = now.date;
    if (next > 23 * 60) {
      // too late for tonight: suggest tomorrow
      const [y, m, d] = now.date.split('-').map(Number);
      const t = new Date(y, m - 1, d + 1);
      form.date.value = [t.getFullYear(), pad(t.getMonth() + 1), pad(t.getDate())].join('-');
    }

    const update = () => {
      const mins = Number(form.time.value);
      const [y, m, d] = (form.date.value || now.date).split('-').map(Number);
      const day = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const name = form.name.value.trim();
      const msg = `Bonjour Copain! I would like to book a table for ${guests} on ${day} at ${fmt12(mins)}.${name ? ` The name is ${name}.` : ''} Merci!`;
      send.href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
      guestsOut.textContent = guests;
      perk.hidden = mins >= OFFER_UNTIL;
    };
    form.addEventListener('input', update);
    form.addEventListener('submit', (e) => e.preventDefault());
    $$('[data-step]', form).forEach((btn) => btn.addEventListener('click', () => {
      guests = clamp(guests + Number(btn.dataset.step), 1, 20);
      update();
    }));
    update();
  }

  /* the day's photos sit off to the side, so fetch them a screen early */
  const dayEl = $('.day');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      $$('img[loading="lazy"]', dayEl).forEach((im) => { im.loading = 'eager'; });
      io.disconnect();
    }, { rootMargin: '100% 0px' });
    io.observe(dayEl);
  }

  /* ── 4. motion ─────────────────────────────────── */
  let lenis = null;
  const canAnimate = window.gsap && window.ScrollTrigger && !reduce;

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target.id === 'top' ? 0 : target, { offset: target.id === 'book' ? -96 : 0, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }));

  if (!canAnimate) return;

  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'expo.out', duration: 1.2 });

  if (window.Lenis) {
    lenis = new Lenis({ lerp: .1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // hand-drawn lines: hide by dash offset, then draw
  const prepDraw = (paths) => paths.forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });
  const draw = (paths, stagger = .12) => gsap.to(paths, { strokeDashoffset: 0, duration: 1.1, stagger, ease: 'power2.out' });

  // headlines: one word at a time, rising from behind a mask
  function split(node) {
    const out = document.createDocumentFragment();
    const wrap = (content, isScript) => {
      const w = el('span', isScript ? 'w w--script' : 'w');
      const wi = el('span', 'wi');
      wi.append(content);
      w.append(wi);
      return w;
    };
    node.setAttribute('aria-label', node.textContent.replace(/\s+/g, ' ').trim());
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        child.textContent.split(/(\s+)/).forEach((tok) => {
          if (!tok) return;
          out.append(/^\s+$/.test(tok) ? ' ' : wrap(tok, false));
        });
      } else {
        out.append(wrap(child, true));
      }
    });
    node.replaceChildren(out);
    return $$('.wi', node);
  }

  /* hero: the first three seconds */
  const heroNotes = $$('.hero .note .draw path');
  prepDraw(heroNotes);
  gsap.timeline({ delay: .15 })
    .from('.nav__logo, .nav__pill', { y: -32, opacity: 0, stagger: .08, duration: 1 })
    .from('[data-hero-title] .line:not(.line--script) > span', { yPercent: 110, stagger: .08, duration: 1.3 }, .1)
    .from('[data-hero-title] .line--script > span', { y: 24, opacity: 0, rotate: -6, duration: 1.3 }, .34)
    .from('[data-stage-arch]', { y: 48, opacity: 0, scale: .94, duration: 1.4 }, .25)
    .from('[data-stage-arch] img', { scale: 1.3, duration: 1.8 }, .25)
    .from('[data-hero-fade]', { y: 24, opacity: 0, stagger: .08 }, .6)
    .from('.hero .note .script', { opacity: 0, y: 8, stagger: .12, duration: .8 }, 1)
    .add(draw(heroNotes), 1.1)
    .from('.badge', { scale: 0, rotate: -90, duration: 1.2, ease: 'back.out(1.6)' }, 1.2);

  /* the day: scroll becomes the clock */
  const day = $('.day');
  const track = $('[data-track]');
  const clock = $('[data-clock]');
  const sun = $('[data-sun]');
  const KEYS = [[0, 540], [.2, 540], [.4, 750], [.6, 960], [.8, 1170], [1, 1410]];
  function paintClock(p) {
    let mins = 1410;
    for (let i = 1; i < KEYS.length; i++) {
      const [p0, m0] = KEYS[i - 1];
      const [p1, m1] = KEYS[i];
      if (p <= p1) { mins = m0 + (m1 - m0) * clamp((p - p0) / (p1 - p0)); break; }
    }
    clock.textContent = fmt24(Math.round(mins / 5) * 5);
    const t = clamp((mins - 540) / 870);
    const arcY = (1 - t) * (1 - t) * 54 + 2 * (1 - t) * t * -34 + t * t * 54;
    gsap.set(sun, { x: (10 + 180 * t) * .6, y: arcY * .6 });
    const dusk = clamp((t - .7) / .1);
    gsap.set($('.sun', sun), { opacity: 1 - dusk });
    gsap.set($('.moon', sun), { opacity: dusk });
  }

  const hourBits = (hour) => $$('.hour__time, .hour__name, .body, .dishes li, .handoff', hour);
  const hours = $$('.hour:not(.hour--intro)');
  const dayDoodles = $$('.day .draw');
  dayDoodles.forEach((d) => prepDraw($$('path', d)));

  // Same ride on every screen size: the section pins, the hours slide sideways and the clock runs.
  // On a phone the address bar sliding away must not restart it, and each hour gets a longer
  // stretch of scroll so one swipe does not skip past it.
  ScrollTrigger.config({ ignoreMobileResize: true });
  day.classList.add('is-horizontal');
  const dist = () => track.scrollWidth - innerWidth;
  // How much scrolling one hour takes, as a share of the screen's width. Lower = faster.
  const stretch = () => (innerWidth < 900 ? 1.2 : .5);
  const ride = gsap.to(track, {
    x: () => -dist(), ease: 'none',
    scrollTrigger: { trigger: day, pin: true, scrub: .3, start: 'top top', end: () => `+=${dist() * stretch()}`, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: (s) => paintClock(s.progress) },
  });
  paintClock(0);
  hours.forEach((hour) => {
    gsap.from(hourBits(hour), { y: 40, opacity: 0, stagger: .06, scrollTrigger: { trigger: hour, containerAnimation: ride, start: 'left 62%' } });
    $$('.hour__img', hour).forEach((im) => gsap.fromTo(im, { xPercent: 14 }, { xPercent: -14, ease: 'none', scrollTrigger: { trigger: hour, containerAnimation: ride, start: 'left right', end: 'right left', scrub: true } }));
    $$('.draw', hour).forEach((d) => ScrollTrigger.create({ trigger: hour, containerAnimation: ride, start: 'left 50%', once: true, onEnter: () => draw($$('path', d)) }));
  });
  $$('.hour--intro .draw').forEach((d) => ScrollTrigger.create({ trigger: day, start: 'top 60%', once: true, onEnter: () => draw($$('path', d), .2) }));

  /* everything else reveals in rhythm */
  $$('[data-split]').forEach((h) => {
    const words = split(h);
    gsap.from(words.filter((w) => !w.parentNode.classList.contains('w--script')), { yPercent: 112, stagger: .06, duration: 1.2, scrollTrigger: { trigger: h, start: 'top 86%' } });
    const scripts = words.filter((w) => w.parentNode.classList.contains('w--script'));
    if (scripts.length) gsap.from(scripts, { y: 24, opacity: 0, duration: 1.2, delay: .35, scrollTrigger: { trigger: h, start: 'top 86%' } });
  });

  gsap.set('[data-reveal]', { y: 32, opacity: 0 });
  ScrollTrigger.batch('[data-reveal]', { start: 'top 90%', once: true, onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, stagger: .1, overwrite: true }) });

  $$('main .draw').filter((d) => !d.closest('.hero') && !d.closest('.day')).forEach((d) => {
    const paths = $$('path', d);
    prepDraw(paths);
    ScrollTrigger.create({ trigger: d, start: 'top 85%', once: true, onEnter: () => draw(paths) });
  });

  $$('[data-speed]').forEach((node) => {
    const s = Number(node.dataset.speed);
    gsap.fromTo(node, { yPercent: -s }, { yPercent: s, ease: 'none', scrollTrigger: { trigger: node, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* pointer: small answers to small movements (skipped on touch) */
  if (finePointer) {
    const stage = $('[data-stage]');
    const hero = $('.hero');
    const arch = $('[data-stage-arch]');
    const rx = gsap.quickTo(arch, 'rotationX', { duration: 1 });
    const ry = gsap.quickTo(arch, 'rotationY', { duration: 1 });
    const layers = $$('[data-depth]', stage).map((node) => ({
      d: Number(node.dataset.depth),
      x: gsap.quickTo(node, 'x', { duration: 1.2 }),
      y: gsap.quickTo(node, 'y', { duration: 1.2 }),
    }));
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - .5;
      const ny = e.clientY / innerHeight - .5;
      ry(nx * 10); rx(-ny * 10);
      layers.forEach((l) => { l.x(nx * l.d); l.y(ny * l.d); });
    });
    hero.addEventListener('pointerleave', () => { rx(0); ry(0); layers.forEach((l) => { l.x(0); l.y(0); }); });

    $$('[data-magnetic]').forEach((btn) => {
      const bx = gsap.quickTo(btn, 'x', { duration: .8 });
      const by = gsap.quickTo(btn, 'y', { duration: .8 });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        bx((e.clientX - r.left - r.width / 2) * .25);
        by((e.clientY - r.top - r.height / 2) * .35);
      });
      btn.addEventListener('pointerleave', () => { bx(0); by(0); });
    });

    const zone = $('[data-glow-zone]');
    const glow = $('[data-glow]');
    const gx = gsap.quickTo(glow, 'x', { duration: .9 });
    const gy = gsap.quickTo(glow, 'y', { duration: .9 });
    zone.addEventListener('pointermove', (e) => {
      const r = zone.getBoundingClientRect();
      gx(e.clientX - r.left); gy(e.clientY - r.top);
      gsap.to(glow, { opacity: 1, duration: .6, overwrite: 'auto' });
    });
    zone.addEventListener('pointerleave', () => gsap.to(glow, { opacity: 0, duration: .8, overwrite: 'auto' }));

    $$('[data-tilt]').forEach((card) => {
      gsap.set(card, { transformPerspective: 800 });
      const tx = gsap.quickTo(card, 'rotationX', { duration: .9 });
      const ty = gsap.quickTo(card, 'rotationY', { duration: .9 });
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        ty(((e.clientX - r.left) / r.width - .5) * 12);
        tx(((e.clientY - r.top) / r.height - .5) * -12);
      });
      card.addEventListener('pointerleave', () => { tx(0); ty(0); });
    });
  }

  ScrollTrigger.sort();
  addEventListener('load', () => ScrollTrigger.refresh());
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
