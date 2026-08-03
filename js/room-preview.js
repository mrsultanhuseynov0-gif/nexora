/**
 * NEXORA Smart Room Preview — camera AR-lite for TVs on the wall
 */
(function (global) {
  'use strict';

  function isTvProduct(product) {
    if (!product) return false;
    if (product.subcategory === 'tv') return true;
    const blob = [product.name, product.category, product.subcategory, (product.tags || []).join(' ')].join(' ').toLowerCase();
    return /\btv\b|televizor|smart\s*tv|oled|qled|television/.test(blob);
  }

  function parseInches(product) {
    const specs = product.specs || {};
    const text = [product.name, specs.Ekran, specs.Screen, specs['Ekran ölçüsü'], specs.Size].join(' ');
    const m = String(text).match(/(\d{2,3})\s*("|''|”|inch|inç|dyuym)?/i);
    if (m) {
      const n = Number(m[1]);
      if (n >= 24 && n <= 100) return n;
    }
    // fallback by price band
    const price = Number(product.price) || 0;
    if (price > 2500) return 65;
    if (price > 1500) return 55;
    if (price > 800) return 50;
    return 43;
  }

  function t(key, fallback) {
    if (typeof NexoraI18n !== 'undefined' && NexoraI18n.t) {
      const v = NexoraI18n.t(key);
      if (v && v !== key) return v;
    }
    return fallback;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function createOverlay(product) {
    const inches = parseInches(product);
    const img = product.image || (product.images && product.images[0]) || '';
    const wrap = document.createElement('div');
    wrap.id = 'roomPreviewModal';
    wrap.className = 'room-preview';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', t('room_preview_title', 'Smart Room Preview'));
    wrap.innerHTML =
      '<div class="room-preview-panel">' +
        '<header class="room-preview-head">' +
          '<div>' +
            '<h2 class="room-preview-title">🏠 ' + t('room_preview_title', 'Smart Room Preview') + '</h2>' +
            '<p class="room-preview-sub">' + esc(product.name) + ' · ~' + inches + '"' + '</p>' +
          '</div>' +
          '<button type="button" class="icon-btn" data-room-close aria-label="' + t('close', 'Bağla') + '">' +
            '<span class="icon icon-md" data-icon="close"></span></button>' +
        '</header>' +
        '<div class="room-preview-stage" id="roomStage">' +
          '<video id="roomVideo" class="room-preview-video" playsinline muted autoplay></video>' +
          '<div class="room-preview-hint" id="roomHint">' +
            t('room_preview_hint', 'Kameranı divara tutun. TV-ni sürükləyin və ölçüsünü dəyişin.') +
          '</div>' +
          '<div class="room-tv" id="roomTv" style="--tv-scale:1">' +
            '<div class="room-tv-bezel">' +
              '<div class="room-tv-screen">' +
                (img ? '<img src="' + esc(img) + '" alt="" draggable="false">' : '<div class="room-tv-placeholder">NEXORA TV</div>') +
                '<div class="room-tv-glow"></div>' +
              '</div>' +
            '</div>' +
            '<div class="room-tv-stand" aria-hidden="true"></div>' +
            '<div class="room-tv-handle" data-resize title="Ölçü"></div>' +
          '</div>' +
        '</div>' +
        '<div class="room-preview-toolbar">' +
          '<label class="room-preview-size">' + t('room_preview_size', 'Ölçü') +
            ' <input type="range" id="roomScale" min="55" max="160" value="100">' +
            ' <span id="roomScaleLabel">100%</span></label>' +
          '<div class="room-preview-actions">' +
            '<button type="button" class="btn btn-outline btn-sm" id="roomFlip">' +
              t('room_preview_flip', 'Kamera dəyiş') + '</button>' +
            '<button type="button" class="btn btn-outline btn-sm" id="roomSnap">' +
              t('room_preview_snap', 'Şəkil çək') + '</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-room-close>' +
              t('room_preview_done', 'Hazırdır') + '</button>' +
          '</div>' +
        '</div>' +
        '<p class="room-preview-note">' +
          t('room_preview_note', 'Demo AR: telefon kamerası ilə divarda TV-nin necə görünəcəyini yoxlayın.') +
          ' · ~' + inches + '"' +
        '</p>' +
      '</div>';
    return wrap;
  }

  async function open(product) {
    if (!isTvProduct(product)) {
      if (typeof NexoraToast !== 'undefined') NexoraToast.info('Bu funksiya TV məhsulları üçündür');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (typeof NexoraToast !== 'undefined') {
        NexoraToast.error('Bu cihazda kamera dəstəklənmir. HTTPS və ya localhost lazımdır.');
      }
      return;
    }

    close();
    const modal = createOverlay(product);
    document.body.appendChild(modal);
    document.body.classList.add('room-preview-open');
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();

    const video = modal.querySelector('#roomVideo');
    const tv = modal.querySelector('#roomTv');
    const stage = modal.querySelector('#roomStage');
    const hint = modal.querySelector('#roomHint');
    const scaleInput = modal.querySelector('#roomScale');
    const scaleLabel = modal.querySelector('#roomScaleLabel');
    let stream = null;
    let facingMode = 'environment';
    let dragging = false;
    let resizing = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;
    let scale = 1;

    function placeDefault() {
      const sw = stage.clientWidth;
      const sh = stage.clientHeight;
      const tw = Math.min(sw * 0.55, 420);
      tv.style.width = tw + 'px';
      tv.style.left = Math.max(12, (sw - tw) / 2) + 'px';
      tv.style.top = Math.max(40, sh * 0.28) + 'px';
    }

    async function startCamera() {
      if (stream) {
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        stream = null;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        video.srcObject = stream;
        stage.classList.toggle('is-rear', facingMode === 'environment');
        await video.play().catch(function () { /* autoplay policies */ });
        hint.hidden = false;
        setTimeout(function () { if (hint) hint.classList.add('is-fade'); }, 3500);
      } catch (e) {
        hint.textContent = t('room_preview_cam_err', 'Kamera açıla bilmədi. Brauzerdə kamera icazəsini verin.');
        hint.classList.add('is-error');
        if (typeof NexoraToast !== 'undefined') NexoraToast.error(hint.textContent);
      }
    }

    function onPointerDown(e) {
      if (e.target && e.target.getAttribute('data-resize') != null) {
        resizing = true;
      } else {
        dragging = true;
      }
      const pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      origLeft = tv.offsetLeft;
      origTop = tv.offsetTop;
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!dragging && !resizing) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - startX;
      const dy = pt.clientY - startY;
      if (dragging) {
        const maxL = stage.clientWidth - tv.offsetWidth;
        const maxT = stage.clientHeight - tv.offsetHeight;
        tv.style.left = Math.max(0, Math.min(maxL, origLeft + dx)) + 'px';
        tv.style.top = Math.max(0, Math.min(maxT, origTop + dy)) + 'px';
      } else if (resizing) {
        const next = Math.max(0.55, Math.min(1.6, scale + dx / 220));
        scale = next;
        scaleInput.value = String(Math.round(scale * 100));
        scaleLabel.textContent = Math.round(scale * 100) + '%';
        tv.style.transform = 'scale(' + scale + ')';
        startX = pt.clientX;
      }
      e.preventDefault();
    }

    function onPointerUp() {
      dragging = false;
      resizing = false;
    }

    tv.addEventListener('mousedown', onPointerDown);
    tv.addEventListener('touchstart', onPointerDown, { passive: false });
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);

    scaleInput.addEventListener('input', function () {
      scale = Number(scaleInput.value) / 100;
      scaleLabel.textContent = Math.round(scale * 100) + '%';
      tv.style.transform = 'scale(' + scale + ')';
    });

    modal.querySelector('#roomFlip').addEventListener('click', function () {
      facingMode = facingMode === 'environment' ? 'user' : 'environment';
      startCamera();
    });

    modal.querySelector('#roomSnap').addEventListener('click', function () {
      try {
        const canvas = document.createElement('canvas');
        const w = video.videoWidth || stage.clientWidth;
        const h = video.videoHeight || stage.clientHeight;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);

        // map TV box from stage coords to video coords
        const rect = stage.getBoundingClientRect();
        const tvRect = tv.getBoundingClientRect();
        const sx = w / rect.width;
        const sy = h / rect.height;
        const x = (tvRect.left - rect.left) * sx;
        const y = (tvRect.top - rect.top) * sy;
        const tw = tvRect.width * sx;
        const th = tvRect.height * sy;

        // bezel
        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, tw, th * 0.92);
        ctx.fillStyle = '#000';
        const pad = Math.max(4, tw * 0.03);
        ctx.fillRect(x + pad, y + pad, tw - pad * 2, th * 0.92 - pad * 2);

        const screenImg = tv.querySelector('img');
        if (screenImg && screenImg.complete) {
          ctx.drawImage(screenImg, x + pad, y + pad, tw - pad * 2, th * 0.92 - pad * 2);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + pad, y + pad, (tw - pad * 2) * 0.35, th * 0.92 - pad * 2);

        canvas.toBlob(function (blob) {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'nexora-room-preview-' + (product.id || 'tv') + '.jpg';
          a.click();
          URL.revokeObjectURL(url);
          if (typeof NexoraToast !== 'undefined') NexoraToast.success(t('room_preview_saved', 'Şəkil yükləndi'));
        }, 'image/jpeg', 0.92);
      } catch (err) {
        if (typeof NexoraToast !== 'undefined') NexoraToast.error(err.message || 'Şəkil alınmadı');
      }
    });

    modal.querySelectorAll('[data-room-close]').forEach(function (btn) {
      btn.addEventListener('click', close);
    });

    modal._cleanup = function () {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchend', onPointerUp);
      if (stream) stream.getTracks().forEach(function (tr) { tr.stop(); });
      stream = null;
    };

    placeDefault();
    await startCamera();
    placeDefault();
  }

  function close() {
    const modal = document.getElementById('roomPreviewModal');
    if (!modal) return;
    if (typeof modal._cleanup === 'function') modal._cleanup();
    modal.remove();
    document.body.classList.remove('room-preview-open');
  }

  function mountButton(product, host) {
    if (!host || !isTvProduct(product)) return null;
    if (host.querySelector('[data-room-preview]')) return host.querySelector('[data-room-preview]');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline w-full mt-3';
    btn.setAttribute('data-room-preview', '1');
    btn.innerHTML = '🏠 ' + t('room_preview_cta', 'Smart Room Preview — divarda gör');
    btn.addEventListener('click', function () { open(product); });
    host.appendChild(btn);
    return btn;
  }

  global.NexoraRoomPreview = {
    isTvProduct: isTvProduct,
    open: open,
    close: close,
    mountButton: mountButton,
    parseInches: parseInches
  };
})(typeof window !== 'undefined' ? window : global);
