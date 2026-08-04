/**
 * NEXORA Product detail — variants, reviews, WA, social proof, gallery
 */
(function () {
  'use strict';

  let galleryTimer = null;

  function defaultVariants(product) {
    if (product.variants && product.variants.length) return product.variants;
    if (product.category === 'fashion' || product.category === 'sports') {
      return [
        { name: 'Ölçü', options: ['S', 'M', 'L', 'XL'] },
        { name: 'Rəng', options: ['Qara', 'Ağ', 'Qırmızı'] }
      ];
    }
    return [];
  }

  function viewersFor(id) {
    let n = 0;
    for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
    return 4 + (n % 19);
  }

  async function init() {
    const root = document.getElementById('productDetail');
    if (!root) return;

    await NexoraApp.loadSiteSettings();
    const id = NexoraApp.getQueryParam('id');
    const products = await NexoraApp.loadProducts();
    const product = products.find(function (p) { return p.id === id; });

    if (!product) {
      const tt = function (k, fb) {
        return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(k) : (fb || k);
      };
      root.innerHTML = '<div class="empty-state"><h2>' + tt('product_not_found', 'Məhsul tapılmadı') + '</h2>' +
        '<a class="btn btn-primary mt-4" href="products.html">' + tt('browse_products', 'Kataloqa qayıt') + '</a></div>';
      window.dispatchEvent(new CustomEvent('product-detail:ready'));
      return;
    }

    document.title = product.name + ' | NEXORA';
    const stockOk = NexoraApp.isInStock(product);
    const variants = defaultVariants(product);
    const selected = {};
    variants.forEach(function (v) { selected[v.name] = v.options[0]; });

    const images = (product.images && product.images.length
      ? product.images
      : [{ src: product.image, gradient: product.gradient, alt: product.name }]
    ).map(function (img) {
      return {
        src: NexoraApp.resolveMediaUrl(img.src || img.url || product.image || ''),
        alt: img.alt || product.name,
        gradient: img.gradient || product.gradient || '#111'
      };
    });

    let galleryIndex = 0;

    function galleryMainHTML(img) {
      const fallback = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&h=1200&q=80';
      const src = img.src || fallback;
      return '<img class="gallery-main-img is-fade" src="' + src + '" alt="' +
        String(img.alt || '').replace(/"/g, '&quot;') + '" id="galleryMainImg" ' +
        'onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + fallback + '\';}">';
    }

    function thumbStyle(img) {
      if (img.src) {
        return 'background-image:url(' + JSON.stringify(img.src) + ');background-size:cover;background-position:center';
      }
      return 'background:' + img.gradient;
    }

    function variantLabel() {
      return variants.map(function (v) { return v.name + ': ' + selected[v.name]; }).join(', ');
    }

    function waMessage() {
      return 'Salam! ' + product.name + ' (' + (product.sku || product.id) + ')' +
        (variants.length ? ' — ' + variantLabel() : '') +
        ' sifariş etmək istəyirəm. Qiymət: ' + NexoraApp.formatPrice(product.price, product.currency);
    }

    const crumb = document.getElementById('productCrumb');
    if (crumb) {
      crumb.innerHTML =
        '<a href="../index.html">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('home') : 'Ana səhifə') +
        '</a><span class="breadcrumb-sep">/</span>' +
        '<a href="products.html">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('products') : 'Məhsullar') +
        '</a><span class="breadcrumb-sep">/</span>' +
        '<span>' + product.name + '</span>';
    }

    const variantHTML = variants.length
      ? '<div class="product-variants mb-4">' + variants.map(function (v) {
          return '<div class="mb-3"><div class="text-sm mb-2"><strong>' + v.name + '</strong></div>' +
            '<div class="variant-options" data-variant-name="' + v.name + '">' +
            v.options.map(function (opt, i) {
              return '<button type="button" class="variant-chip' + (i === 0 ? ' is-active' : '') +
                '" data-variant-opt="' + opt + '">' + opt + '</button>';
            }).join('') + '</div></div>';
        }).join('') + '</div>'
      : '';

    root.innerHTML =
      '<div class="product-detail">' +
        '<div>' +
          '<div class="gallery-main has-image" id="galleryMain" style="background:' +
            (images[0].gradient || product.gradient) + '" data-zoom>' +
            galleryMainHTML(images[0]) +
          '</div>' +
          '<div class="gallery-thumbs" id="galleryThumbs">' +
            images.map(function (img, i) {
              const tSrc = img.src || '';
              return '<button type="button" class="gallery-thumb' + (i === 0 ? ' is-active' : '') +
                '" style="' + thumbStyle(img) + '" data-thumb="' + i + '" aria-label="' +
                String(img.alt || '').replace(/"/g, '&quot;') + '">' +
                (tSrc
                  ? '<img src="' + tSrc + '" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block">'
                  : '') +
                '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div>' +
          '<p class="product-info-brand">' + product.brand + '</p>' +
          '<h1 class="product-info-title">' + product.name + '</h1>' +
          '<p class="product-info-sku">SKU: ' + (product.sku || product.id) + '</p>' +
          '<p class="text-sm text-muted mb-3" id="socialProof">Bu gün <strong>' +
            viewersFor(product.id) + '</strong> nəfər bu məhsula baxır</p>' +
          '<div class="mb-4">' + NexoraApp.starsHTML(product.rating) +
            '<span class="rating-count">(' + (product.reviews || 0) + ' rəy)</span></div>' +
          '<div class="product-info-price">' +
            '<span class="price price-lg">' + NexoraApp.formatPrice(product.price, product.currency) + '</span>' +
            (product.oldPrice ? '<span class="price-old">' + NexoraApp.formatPrice(product.oldPrice, product.currency) + '</span>' : '') +
          '</div>' +
          '<p class="text-sm mb-4" style="color:' + (stockOk ? 'var(--color-success)' : 'var(--color-error)') + '">' +
            (stockOk
              ? ((typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('in_stock') : 'Stokda var') +
                ' (' + product.stock + ' ' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('pieces') : 'ədəd') + ')')
              : (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('out_of_stock') : 'Stokda yoxdur')) + '</p>' +
          '<p class="mb-4" style="color:var(--color-text-muted)">' + (product.description || '') + '</p>' +
          variantHTML +
          '<div class="flex items-center gap-4 mb-4 flex-wrap">' +
            '<div class="input-quantity">' +
              '<button type="button" data-qty-minus aria-label="Azalt">−</button>' +
              '<input type="number" class="input-quantity-value" id="qtyInput" value="1" min="1" max="' + (product.stock || 1) + '">' +
              '<button type="button" data-qty-plus aria-label="Artır">+</button>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-lg" id="addCartBtn"' + (stockOk ? '' : ' disabled') + '>' +
              (stockOk
                ? (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('add_cart') : 'Səbətə at')
                : (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('out_of_stock') : 'Stokda yoxdur')) +
            '</button>' +
            '<button type="button" class="btn btn-outline btn-lg" id="wishBtn" data-wishlist-toggle="' + product.id + '"' +
              ' aria-label="' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('wishlist') : 'Seçilmişlər') + '">' +
              '<span class="icon icon-sm" data-icon="heart"></span></button>' +
          '</div>' +
          '<div class="flex gap-2 flex-wrap mb-4">' +
            '<a class="btn btn-primary" id="waOrderBtn" target="_blank" rel="noopener" href="' +
              NexoraApp.whatsappLink(waMessage()) + '">' +
              (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('wa_order') : 'WhatsApp sifariş') + '</a>' +
            '<a class="btn btn-outline" target="_blank" rel="noopener" href="' +
              NexoraApp.telegramLink(waMessage()) + '">Telegram</a>' +
          '</div>' +
          '<div class="flex gap-2 flex-wrap">' +
            (product.tags || []).map(function (tg) {
              return '<span class="badge badge-outline">' + tg + '</span>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="product-tabs">' +
        '<div class="tabs-nav">' +
          '<button type="button" class="tab-btn is-active" data-tab="desc">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('description') : 'Təsvir') + '</button>' +
          '<button type="button" class="tab-btn" data-tab="specs">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('specs') : 'Xüsusiyyətlər') + '</button>' +
          '<button type="button" class="tab-btn" data-tab="reviews">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('reviews') : 'Rəylər') + '</button>' +
        '</div>' +
        '<div class="tab-panel is-active" data-panel="desc"><p>' + (product.description || '') + '</p></div>' +
        '<div class="tab-panel" data-panel="specs">' +
          '<table class="specs-table"><tbody>' +
            Object.keys(product.specs || {}).map(function (k) {
              var esc = (typeof NexoraSecurity !== 'undefined' && NexoraSecurity.escapeHtml)
                ? NexoraSecurity.escapeHtml
                : function (s) { return String(s == null ? '' : s)
                    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;'); };
              return '<tr><th>' + esc(k) + '</th><td>' + esc(product.specs[k]) + '</td></tr>';
            }).join('') +
          '</tbody></table></div>' +
        '<div class="tab-panel" data-panel="reviews" id="reviewsPanel"></div>' +
      '</div>' +
      '<section class="section" style="padding-left:0;padding-right:0">' +
        '<h2 class="section-title mb-6">' +
          (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('related') : 'Oxşar məhsullar') + '</h2>' +
        '<div class="product-grid" id="relatedProducts"></div>' +
      '</section>';

    function setGallery(i) {
      galleryIndex = i;
      const main = document.getElementById('galleryMain');
      if (main && main._p360 && main._p360.isActive()) main._p360.exit();
      const img = images[i];
      main.style.background = img.gradient;
      // Preserve 360 badge if present
      const badge = main.querySelector('[data-p360-btn]');
      main.innerHTML = galleryMainHTML(img);
      if (badge) main.appendChild(badge);
      const el = document.getElementById('galleryMainImg');
      if (el) {
        el.classList.remove('is-fade');
        void el.offsetWidth;
        el.classList.add('is-fade');
      }
      document.querySelectorAll('.gallery-thumb').forEach(function (t, idx) {
        t.classList.toggle('is-active', idx === i);
      });
    }

    document.querySelectorAll('[data-thumb]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setGallery(parseInt(btn.getAttribute('data-thumb'), 10));
      });
    });

    // Auto-advance gallery lightly (clear previous timer on re-init / lang change)
    if (galleryTimer) {
      clearInterval(galleryTimer);
      galleryTimer = null;
    }
    if (images.length > 1) {
      galleryTimer = setInterval(function () {
        if (document.hidden) return;
        setGallery((galleryIndex + 1) % images.length);
      }, 5000);
    }

    document.querySelectorAll('[data-variant-name]').forEach(function (group) {
      const name = group.getAttribute('data-variant-name');
      group.querySelectorAll('[data-variant-opt]').forEach(function (chip) {
        chip.addEventListener('click', function () {
          group.querySelectorAll('.variant-chip').forEach(function (c) { c.classList.remove('is-active'); });
          chip.classList.add('is-active');
          selected[name] = chip.getAttribute('data-variant-opt');
          const wa = document.getElementById('waOrderBtn');
          if (wa) wa.href = NexoraApp.whatsappLink(waMessage());
        });
      });
    });

    const galleryMain = document.getElementById('galleryMain');
    if (typeof NexoraProduct360 !== 'undefined') {
      NexoraProduct360.mount(galleryMain, product, images);
      galleryMain.addEventListener('product-360:enter', function () {
        if (galleryTimer) {
          clearInterval(galleryTimer);
          galleryTimer = null;
        }
      });
      galleryMain.addEventListener('product-360:exit', function () {
        if (!galleryTimer && images.length > 1) {
          galleryTimer = setInterval(function () {
            if (document.hidden) return;
            setGallery((galleryIndex + 1) % images.length);
          }, 5000);
        }
      });
    }

    galleryMain.addEventListener('click', function (e) {
      if (galleryMain.classList.contains('is-360')) return;
      if (e.target.closest && e.target.closest('[data-p360-btn]')) return;
      if (typeof NexoraModal === 'undefined') return;
      let lightbox = document.getElementById('productLightbox');
      if (!lightbox) {
        lightbox = document.createElement('div');
        lightbox.id = 'productLightbox';
        lightbox.className = 'modal';
        document.body.appendChild(lightbox);
      }
      const activeImg = document.getElementById('galleryMainImg');
      const src = activeImg ? activeImg.src : (images[0] && images[0].src);
      lightbox.innerHTML =
        '<div class="modal-dialog modal-dialog-lg">' +
          '<div class="modal-header"><h2 class="modal-title">' + product.name + '</h2>' +
          '<button type="button" class="modal-close" data-modal-close aria-label="Bağla">' +
          '<span class="icon icon-md" data-icon="close"></span></button></div>' +
          '<div class="modal-body">' +
            (src
              ? '<img src="' + src + '" alt="" style="width:100%;max-height:70vh;object-fit:contain;border-radius:12px;background:#111">'
              : '') +
          '</div></div>';
      if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
      NexoraModal.open(lightbox);
    });

    const qtyGroup = root.querySelector('.input-quantity');
    if (qtyGroup) {
      const input = qtyGroup.querySelector('.input-quantity-value');
      qtyGroup.querySelector('[data-qty-minus]').addEventListener('click', function () {
        input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
      });
      qtyGroup.querySelector('[data-qty-plus]').addEventListener('click', function () {
        input.value = Math.min(product.stock || 99, (parseInt(input.value, 10) || 1) + 1);
      });
    }

    document.getElementById('addCartBtn').addEventListener('click', async function () {
      const qty = parseInt(document.getElementById('qtyInput').value, 10) || 1;
      try {
        await NexoraCart.add(product.id, qty, selected);
        NexoraToast.success(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('added_cart') : 'Səbətə əlavə olundu');
        NexoraApp.updateBadges();
      } catch (e) {
        if (e && e.code === 'AUTH_REQUIRED') return;
        NexoraToast.error(e.message || 'Xəta');
      }
    });

    NexoraApp.bindProductActions(root);

    root.querySelectorAll('[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tab = btn.getAttribute('data-tab');
        root.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        root.querySelectorAll('[data-panel]').forEach(function (p) {
          p.classList.toggle('is-active', p.getAttribute('data-panel') === tab);
        });
      });
    });

    function renderReviews() {
      const reviews = product.reviewList || [];
      const reviewsPanel = document.getElementById('reviewsPanel');
      if (!reviewsPanel) return;
      const esc = function (s) {
        return typeof NexoraSecurity !== 'undefined' ? NexoraSecurity.escapeHtml(s) : String(s || '');
      };
      reviewsPanel.innerHTML =
        (reviews.length
          ? reviews.map(function (r) {
              return '<div class="review-item"><div class="review-header"><strong>' + esc(r.user) + '</strong>' +
                NexoraApp.starsHTML(r.rating) + '<span class="text-xs text-muted">' + esc(r.date) + '</span></div>' +
                '<p class="text-sm">' + esc(r.text) + '</p></div>';
            }).join('')
          : '<p class="text-muted mb-4">Hələ rəy yoxdur.</p>') +
        '<form id="reviewForm" class="card mt-4"><div class="card-body">' +
          '<h3 class="card-title">Rəy yaz</h3>' +
          '<div class="form-row">' +
            '<div class="form-group"><label class="form-label">Ad</label><input class="input" id="revUser" required></div>' +
            '<div class="form-group"><label class="form-label">Reytinq</label>' +
              '<select class="input" id="revRating"><option value="5">5</option><option value="4">4</option>' +
              '<option value="3">3</option><option value="2">2</option><option value="1">1</option></select></div>' +
          '</div>' +
          '<div class="form-group"><label class="form-label">Şərh</label><textarea class="input" id="revText" rows="3" required></textarea></div>' +
          '<div class="form-group"><label class="form-label">Foto URL (opsional)</label><input class="input" id="revPhoto" placeholder="https://..."></div>' +
          '<button type="submit" class="btn btn-primary">Göndər</button>' +
        '</div></form>';

      document.getElementById('reviewForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const list = await NexoraApp.loadProducts();
        const p = list.find(function (x) { return x.id === product.id; });
        if (!p) return;
        p.reviewList = p.reviewList || [];
        const rating = Number(document.getElementById('revRating').value) || 5;
        const photoRaw = document.getElementById('revPhoto').value.trim();
        const entry = {
          user: document.getElementById('revUser').value.trim().slice(0, 60),
          rating: rating,
          date: new Date().toISOString().slice(0, 10),
          text: document.getElementById('revText').value.trim().slice(0, 1000),
          photo: typeof NexoraSecurity !== 'undefined'
            ? NexoraSecurity.sanitizeUrl(photoRaw)
            : (photoRaw.indexOf('http') === 0 ? photoRaw : '')
        };
        p.reviewList.unshift(entry);
        const sum = p.reviewList.reduce(function (s, r) { return s + (r.rating || 0); }, 0);
        p.reviews = p.reviewList.length;
        p.rating = Math.round((sum / p.reviewList.length) * 10) / 10;
        NexoraApp.storageSet('nexora-products', list);
        product.reviewList = p.reviewList;
        product.reviews = p.reviews;
        product.rating = p.rating;
        NexoraToast.success('Rəy əlavə olundu');
        renderReviews();
      });
    }
    renderReviews();

    const related = products
      .filter(function (p) { return p.id !== product.id; })
      .map(function (p) {
        let score = 0;
        if (p.category === product.category) score += 3;
        if (p.brandId === product.brandId || p.brand === product.brand) score += 2;
        const tags = product.tags || [];
        (p.tags || []).forEach(function (t) { if (tags.indexOf(t) >= 0) score += 1; });
        return { p: p, score: score };
      })
      .filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 4)
      .map(function (x) { return x.p; });

    const relatedEl = document.getElementById('relatedProducts');
    if (relatedEl) {
      relatedEl.innerHTML = related.map(function (p) { return NexoraApp.productCardHTML(p); }).join('');
      NexoraApp.bindProductActions(relatedEl);
    }

    const oldSticky = document.querySelector('.product-sticky-cta');
    if (oldSticky) oldSticky.remove();
    const sticky = document.createElement('div');
    sticky.className = 'product-sticky-cta';
    sticky.innerHTML =
      '<span class="price">' + NexoraApp.formatPrice(product.price, product.currency) + '</span>' +
      '<button type="button" class="btn btn-primary" id="stickyAddCart"' +
        (stockOk ? '' : ' disabled') + '>' +
        (stockOk
          ? (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('add_cart') : 'Səbətə at')
          : (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('sold_out') : 'Bitib')) + '</button>';
    document.body.appendChild(sticky);
    const stickyBtn = document.getElementById('stickyAddCart');
    if (stickyBtn) {
      stickyBtn.addEventListener('click', function () {
        const main = document.getElementById('addCartBtn');
        if (main) main.click();
      });
    }

    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
    window.dispatchEvent(new CustomEvent('product-detail:ready'));
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('nexora:lang-change', init);
})();
