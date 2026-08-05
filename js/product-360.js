/**
 * NEXORA 360° Product Viewer — drag to spin (frame sequence or CSS 3D)
 * Uses dedicated spin frames when present; otherwise gallery photos (phones & other products).
 */
(function (global) {
  'use strict';

  function t(key, fallback) {
    if (typeof NexoraI18n !== 'undefined' && NexoraI18n.t) {
      const v = NexoraI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function resolveUrl(src) {
    if (!src) return '';
    if (typeof NexoraApp !== 'undefined' && NexoraApp.resolveMediaUrl) {
      return NexoraApp.resolveMediaUrl(src);
    }
    return src;
  }

  function uniqueSrcs(list) {
    const out = [];
    (list || []).forEach(function (src) {
      const u = resolveUrl(src);
      if (u && out.indexOf(u) === -1) out.push(u);
    });
    return out;
  }

  function gallerySrcs(product, galleryImages) {
    const fromGallery = (galleryImages || []).map(function (img) {
      if (!img) return '';
      if (typeof img === 'string') return img;
      return img.src || img.url || '';
    });
    const fromProduct = (product.images || []).map(function (img) {
      if (!img) return '';
      if (typeof img === 'string') return img;
      return img.src || img.url || '';
    });
    const merged = uniqueSrcs(fromGallery.concat(fromProduct));
    const main = resolveUrl(product.image || '');
    if (main && merged.indexOf(main) === -1) merged.unshift(main);
    return merged;
  }

  function resolveFrames(product, galleryImages) {
    const raw = product.views360 || product.spin || product.spinFrames || null;
    if (Array.isArray(raw) && raw.length >= 4) {
      const dedicated = uniqueSrcs(raw.map(function (f) {
        if (typeof f === 'string') return f;
        return (f && (f.src || f.url)) || '';
      }));
      if (dedicated.length >= 4) return dedicated;
    }
    // Admin-added phones / products: 2–3 gallery photos → smooth spin
    const gallery = gallerySrcs(product, galleryImages);
    if (gallery.length >= 2) return gallery;
    return null;
  }

  function primaryImage(product, galleryImages) {
    const gallery = gallerySrcs(product, galleryImages);
    if (gallery.length) return gallery[0];
    if (galleryImages && galleryImages[0] && galleryImages[0].src) return galleryImages[0].src;
    return resolveUrl(product.image || '');
  }

  function preload(urls) {
    (urls || []).forEach(function (u) {
      if (!u) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = u;
    });
  }

  function mount(host, product, galleryImages) {
    if (!host || !product) return null;
    if (host.querySelector('[data-p360-btn]')) return host._p360 || null;

    const frames = resolveFrames(product, galleryImages);
    const imgSrc = primaryImage(product, galleryImages);
    if (!imgSrc && !frames) return null;

    if (frames) preload(frames);
    else if (imgSrc) preload([imgSrc]);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'p360-badge';
    btn.setAttribute('data-p360-btn', '1');
    btn.setAttribute('aria-label', t('p360_title', '360° məhsul görünüşü'));
    btn.innerHTML = '<span class="p360-badge-icon" aria-hidden="true">🔄</span><span>360°</span>';
    host.appendChild(btn);

    const state = {
      active: false,
      angle: 0,
      velocity: 0,
      dragging: false,
      lastX: 0,
      lastT: 0,
      raf: 0,
      auto: true,
      frameIndex: 0,
      frames: frames,
      mode: frames ? 'frames' : '3d',
      shell: null,
      backupNodes: []
    };

    function stopRaf() {
      if (state.raf) {
        cancelAnimationFrame(state.raf);
        state.raf = 0;
      }
    }

    function applyVisual() {
      if (!state.shell) return;
      if (state.mode === 'frames') {
        const n = state.frames.length;
        // Even sectors around the circle so 2–3 phone photos feel natural
        const idx = ((Math.round((-state.angle / 360) * n) % n) + n) % n;
        state.frameIndex = idx;
        const img = state.shell.querySelector('.p360-frame-img');
        if (img && state.frames[idx]) {
          const next = state.frames[idx];
          if (img.getAttribute('src') !== next) {
            img.classList.remove('is-swap');
            // force reflow for fade
            void img.offsetWidth;
            img.setAttribute('src', next);
            img.classList.add('is-swap');
          }
        }
        const meter = state.shell.querySelector('.p360-meter-fill');
        if (meter) meter.style.width = (((idx + 1) / n) * 100) + '%';
        const count = state.shell.querySelector('.p360-frame-count');
        if (count) count.textContent = (idx + 1) + ' / ' + n;
      } else {
        const turn = state.shell.querySelector('.p360-turntable');
        if (turn) turn.style.transform = 'rotateY(' + state.angle + 'deg)';
        const shadow = state.shell.querySelector('.p360-shadow');
        if (shadow) {
          const a = ((state.angle % 360) + 360) % 360;
          const skew = Math.sin((a * Math.PI) / 180);
          shadow.style.transform = 'translateX(' + (skew * 18) + '%) scaleX(' + (0.78 + Math.abs(Math.cos((a * Math.PI) / 180)) * 0.22) + ')';
          shadow.style.opacity = String(0.28 + Math.abs(Math.cos((a * Math.PI) / 180)) * 0.22);
        }
        const glare = state.shell.querySelector('.p360-glare');
        if (glare) {
          const a = ((state.angle % 360) + 360) % 360;
          glare.style.background =
            'linear-gradient(' + (120 + a * 0.4) + 'deg, rgba(255,255,255,0.22), transparent 42%, transparent 58%, rgba(255,255,255,0.06))';
        }
      }
      const deg = state.shell.querySelector('.p360-deg');
      if (deg) deg.textContent = Math.round(((state.angle % 360) + 360) % 360) + '°';
    }

    function tick() {
      state.raf = 0;
      if (!state.active) return;
      if (!state.dragging) {
        if (Math.abs(state.velocity) > 0.02) {
          state.angle += state.velocity;
          state.velocity *= 0.94;
        } else if (state.auto) {
          // Slower auto-spin with few gallery frames so phones stay readable
          const step = state.mode === 'frames' && state.frames && state.frames.length < 6 ? 0.22 : 0.35;
          state.angle += step;
          state.velocity = 0;
        } else {
          state.velocity = 0;
        }
      }
      applyVisual();
      if (state.active && (state.dragging || state.auto || Math.abs(state.velocity) > 0.02)) {
        state.raf = requestAnimationFrame(tick);
      }
    }

    function ensureAnim() {
      if (!state.raf) state.raf = requestAnimationFrame(tick);
    }

    function buildShell() {
      const shell = document.createElement('div');
      shell.className = 'p360-shell';
      shell.setAttribute('data-p360-shell', '1');
      const alt = String(product.name || '').replace(/"/g, '&quot;');

      if (state.mode === 'frames') {
        shell.innerHTML =
          '<div class="p360-frame-wrap">' +
            '<img class="p360-frame-img is-swap" src="' + state.frames[0] + '" alt="' + alt +
              ' 360°" draggable="false">' +
          '</div>' +
          '<div class="p360-meter" aria-hidden="true"><div class="p360-meter-fill"></div></div>';
      } else {
        shell.innerHTML =
          '<div class="p360-scene">' +
            '<div class="p360-turntable">' +
              '<div class="p360-card">' +
                '<div class="p360-face p360-face-front">' +
                  '<img class="p360-img" src="' + imgSrc + '" alt="' + alt + '" draggable="false">' +
                  '<div class="p360-glare" aria-hidden="true"></div>' +
                '</div>' +
                '<div class="p360-face p360-face-back" aria-hidden="true">' +
                  '<img class="p360-img" src="' + imgSrc + '" alt="" draggable="false">' +
                  '<div class="p360-back-tint"></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="p360-shadow" aria-hidden="true"></div>' +
            '<div class="p360-ring" aria-hidden="true"></div>' +
          '</div>';
      }

      const hint = state.mode === 'frames'
        ? t('p360_hint', 'Sürükləyərək fırladın')
        : t('p360_hint', 'Sürükləyərək fırladın');

      shell.innerHTML +=
        '<div class="p360-hud">' +
          '<span class="p360-hint">' + hint + '</span>' +
          '<span class="p360-deg">0°</span>' +
          (state.mode === 'frames'
            ? '<span class="p360-frame-count">1 / ' + state.frames.length + '</span>'
            : '') +
        '</div>' +
        '<div class="p360-toolbar">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-p360-auto>' +
            t('p360_auto', 'Avto') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-p360-reset>' +
            t('p360_reset', 'Sıfırla') + '</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-p360-exit>' +
            t('p360_exit', 'Bağla') + '</button>' +
        '</div>';

      return shell;
    }

    function onPointerDown(e) {
      if (e.target.closest && e.target.closest('.p360-toolbar')) return;
      const pt = e.touches ? e.touches[0] : e;
      state.dragging = true;
      state.auto = false;
      const autoBtn = state.shell && state.shell.querySelector('[data-p360-auto]');
      if (autoBtn) autoBtn.classList.remove('is-on');
      state.lastX = pt.clientX;
      state.lastT = performance.now();
      state.velocity = 0;
      ensureAnim();
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!state.dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const now = performance.now();
      const dx = pt.clientX - state.lastX;
      const dt = Math.max(8, now - state.lastT);
      // With 2–3 photos, slightly higher sensitivity so one swipe changes angle enough
      const sens = state.mode === 'frames' && state.frames && state.frames.length <= 3 ? 0.72 : 0.55;
      state.angle += dx * sens;
      state.velocity = (dx * sens) * (16 / dt);
      state.lastX = pt.clientX;
      state.lastT = now;
      applyVisual();
      e.preventDefault();
    }

    function onPointerUp() {
      if (!state.dragging) return;
      state.dragging = false;
      ensureAnim();
    }

    function enter() {
      if (state.active) return;
      state.active = true;
      state.angle = 0;
      state.velocity = 0;
      state.auto = true;
      host.classList.add('is-360');
      host.setAttribute('data-zoom', 'off');
      host.style.cursor = 'grab';

      state.backupNodes = [];
      Array.prototype.slice.call(host.childNodes).forEach(function (node) {
        if (node === btn) return;
        state.backupNodes.push(node);
        host.removeChild(node);
      });

      state.shell = buildShell();
      host.insertBefore(state.shell, btn);
      btn.classList.add('is-active');

      const autoBtn = state.shell.querySelector('[data-p360-auto]');
      autoBtn.classList.add('is-on');
      autoBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        state.auto = !state.auto;
        autoBtn.classList.toggle('is-on', state.auto);
        if (state.auto) ensureAnim();
      });
      state.shell.querySelector('[data-p360-reset]').addEventListener('click', function (e) {
        e.stopPropagation();
        state.angle = 0;
        state.velocity = 0;
        applyVisual();
      });
      state.shell.querySelector('[data-p360-exit]').addEventListener('click', function (e) {
        e.stopPropagation();
        exit();
      });

      state.shell.addEventListener('mousedown', onPointerDown);
      state.shell.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('mousemove', onPointerMove, { passive: false });
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);

      applyVisual();
      ensureAnim();
      host.dispatchEvent(new CustomEvent('product-360:enter', { bubbles: true }));
    }

    function exit() {
      if (!state.active) return;
      state.active = false;
      state.dragging = false;
      stopRaf();
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);

      host.classList.remove('is-360');
      host.style.cursor = '';
      host.setAttribute('data-zoom', '');
      btn.classList.remove('is-active');

      if (state.shell && state.shell.parentNode) state.shell.parentNode.removeChild(state.shell);
      state.shell = null;
      (state.backupNodes || []).forEach(function (node) {
        host.insertBefore(node, btn);
      });
      state.backupNodes = [];
      host.dispatchEvent(new CustomEvent('product-360:exit', { bubbles: true }));
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      if (state.active) exit();
      else enter();
    });

    host._p360 = {
      enter: enter,
      exit: exit,
      isActive: function () { return state.active; },
      destroy: function () {
        exit();
        btn.remove();
        delete host._p360;
      }
    };
    return host._p360;
  }

  global.NexoraProduct360 = {
    mount: mount,
    resolveFrames: resolveFrames
  };
})(typeof window !== 'undefined' ? window : global);
