/**
 * NEXORA Cart page UI — includes share-cart link flow
 */
(function () {
  'use strict';

  var pendingShare = null;

  function tt(key, fallback) {
    return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(key) : (fallback || key);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function variantAttr(item) {
    if (!item.variant) return '';
    try {
      return encodeURIComponent(JSON.stringify(item.variant));
    } catch (e) {
      return '';
    }
  }

  function parseVariant(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      return null;
    }
  }

  function checkoutCtaHTML() {
    var loggedIn = typeof NexoraAccount !== 'undefined' && NexoraAccount.isLoggedIn && NexoraAccount.isLoggedIn();
    if (loggedIn) {
      return '<a href="checkout.html" class="btn btn-primary w-full" id="cartCheckoutBtn">' + tt('checkout') + '</a>';
    }
    var authUrl = typeof NexoraAccount !== 'undefined' && NexoraAccount.promptLogin
      ? NexoraAccount.promptLogin({ redirect: false, tab: 'register', next: NexoraApp.pageUrl('checkout.html') })
      : 'account.html?tab=register';
    return '<a href="' + esc(authUrl) + '" class="btn btn-primary w-full" id="cartCheckoutBtn">' +
      tt('auth_to_checkout', 'Sifariş üçün qeydiyyat / giriş') + '</a>' +
      '<p class="text-xs text-muted mt-2 text-center">Qonaqlar yalnız məhsullara baxa bilər</p>';
  }

  function absoluteCartUrl(query) {
    var path = location.pathname.replace(/[^/]+$/, 'cart.html');
    return location.origin + path + (query || '');
  }

  function getShareTokenFromUrl() {
    try {
      var params = new URLSearchParams(location.search || '');
      return params.get('share') || params.get('c') || '';
    } catch (e) {
      return '';
    }
  }

  function clearShareQuery() {
    try {
      var url = absoluteCartUrl('');
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  async function ensureShareBanner() {
    var token = getShareTokenFromUrl();
    var host = document.getElementById('cartShareBanner');
    if (!host) return;
    if (!token) {
      host.hidden = true;
      host.innerHTML = '';
      pendingShare = null;
      return;
    }
    try {
      pendingShare = await NexoraCart.previewShared(token);
      var lines = pendingShare.items;
      var sum = lines.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
      host.hidden = false;
      host.innerHTML =
        '<div class="cart-share-banner">' +
          '<div class="cart-share-banner-top">' +
            '<div>' +
              '<p class="cart-share-kicker">' + esc(tt('share_cart_received', 'Paylaşılan səbət')) + '</p>' +
              '<h2 class="cart-share-title">' + lines.length + ' ' + esc(tt('share_cart_products', 'məhsul')) +
                ' · ' + esc(NexoraApp.formatPrice(sum)) + '</h2>' +
              '<p class="text-sm text-muted mb-0">' +
                esc(tt('share_cart_hint', 'Bu linkdəki məhsulları öz səbətinizə əlavə edin və ya əvəz edin.')) +
                (pendingShare.missing
                  ? ' (' + pendingShare.missing + ' ' + esc(tt('share_cart_missing', 'məhsul tapılmadı')) + ')'
                  : '') +
              '</p>' +
            '</div>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="shareBannerDismiss" aria-label="Bağla">' +
              '<span class="icon icon-sm" data-icon="close"></span></button>' +
          '</div>' +
          '<ul class="cart-share-preview">' +
            lines.slice(0, 6).map(function (i) {
              return '<li><strong>' + esc(i.qty) + '×</strong> ' + esc(i.displayName || i.name) +
                (!i.inStock ? ' <span class="text-error text-xs">(' + esc(tt('sold_out')) + ')</span>' : '') +
                '</li>';
            }).join('') +
            (lines.length > 6 ? '<li class="text-muted">+' + (lines.length - 6) + ' …</li>' : '') +
          '</ul>' +
          '<div class="cart-share-banner-actions">' +
            '<button type="button" class="btn btn-primary" id="shareImportReplace">' +
              esc(tt('share_cart_replace', 'Səbəti əvəz et')) + '</button>' +
            '<button type="button" class="btn btn-outline" id="shareImportMerge">' +
              esc(tt('share_cart_merge', 'Mövcud səbətə əlavə et')) + '</button>' +
          '</div>' +
        '</div>';

      document.getElementById('shareBannerDismiss').addEventListener('click', function () {
        clearShareQuery();
        host.hidden = true;
        host.innerHTML = '';
        pendingShare = null;
      });
      document.getElementById('shareImportReplace').addEventListener('click', function () {
        NexoraCart.importShared(pendingShare.raw, 'replace');
        clearShareQuery();
        NexoraToast.success(tt('share_cart_imported', 'Paylaşılan səbət yükləndi'));
        pendingShare = null;
        host.hidden = true;
        host.innerHTML = '';
        render();
      });
      document.getElementById('shareImportMerge').addEventListener('click', function () {
        NexoraCart.importShared(pendingShare.raw, 'merge');
        clearShareQuery();
        NexoraToast.success(tt('share_cart_merged', 'Məhsullar səbətə əlavə olundu'));
        pendingShare = null;
        host.hidden = true;
        host.innerHTML = '';
        render();
      });
      if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
    } catch (e) {
      host.hidden = false;
      host.innerHTML =
        '<div class="cart-share-banner is-error">' +
          '<p class="mb-2"><strong>' + esc(tt('share_cart_invalid', 'Paylaşım linki etibarsızdır')) + '</strong></p>' +
          '<p class="text-sm text-muted mb-3">' + esc(e.message || '') + '</p>' +
          '<button type="button" class="btn btn-outline btn-sm" id="shareBannerDismiss">' +
            esc(tt('close', 'Bağla')) + '</button></div>';
      var dismiss = document.getElementById('shareBannerDismiss');
      if (dismiss) {
        dismiss.addEventListener('click', function () {
          clearShareQuery();
          host.hidden = true;
          host.innerHTML = '';
        });
      }
    }
  }

  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  function bindShareControls() {
    var copyBtn = document.getElementById('cartShareCopy');
    var nativeBtn = document.getElementById('cartShareNative');
    var waBtn = document.getElementById('cartShareWa');
    var input = document.getElementById('cartShareLink');

    async function currentLink() {
      var link = NexoraCart.createShareLink();
      if (!link) throw new Error(tt('cart_empty', 'Səbət boşdur'));
      // Normalize to absolute URL for current origin
      if (link.indexOf('http') !== 0) {
        var token = link.split('share=')[1] || '';
        link = absoluteCartUrl('?share=' + token);
      } else if (link.indexOf(location.origin) !== 0) {
        var q = link.split('?')[1] || '';
        link = absoluteCartUrl(q ? ('?' + q) : '');
      }
      if (input) input.value = link;
      return link;
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async function () {
        try {
          var link = await currentLink();
          await copyText(link);
          NexoraToast.success(tt('share_cart_copied', 'Səbət linki kopyalandı'));
        } catch (e) {
          NexoraToast.error(e.message || tt('share_cart_fail', 'Paylaşmaq alınmadı'));
        }
      });
    }

    if (nativeBtn) {
      if (!navigator.share) {
        nativeBtn.hidden = true;
      } else {
        nativeBtn.addEventListener('click', async function () {
          try {
            var link = await currentLink();
            await navigator.share({
              title: 'NEXORA — ' + tt('share_cart', 'Səbəti paylaş'),
              text: tt('share_cart_text', 'NEXORA səbətimə bax:'),
              url: link
            });
          } catch (e) {
            if (e && e.name === 'AbortError') return;
            NexoraToast.error(e.message || tt('share_cart_fail', 'Paylaşmaq alınmadı'));
          }
        });
      }
    }

    if (waBtn) {
      waBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        try {
          var link = await currentLink();
          var msg = tt('share_cart_text', 'NEXORA səbətimə bax:') + '\n' + link;
          window.open(NexoraApp.whatsappLink(msg), '_blank');
        } catch (err) {
          NexoraToast.error(err.message || tt('share_cart_fail', 'Paylaşmaq alınmadı'));
        }
      });
    }
  }

  function sharePanelHTML(link) {
    return (
      '<div class="cart-share-panel mt-4">' +
        '<div class="cart-share-panel-head">' +
          '<span class="icon icon-sm" data-icon="share"></span>' +
          '<div>' +
            '<strong>' + esc(tt('share_cart', 'Səbəti paylaş')) + '</strong>' +
            '<p class="text-xs text-muted mb-0">' +
              esc(tt('share_cart_desc', 'Linki dostunuza göndərin — bir kliklə eyni məhsulları görəcək.')) +
            '</p>' +
          '</div>' +
        '</div>' +
        '<div class="cart-share-link-row">' +
          '<input type="text" class="input" id="cartShareLink" readonly value="' + esc(link) +
            '" aria-label="' + esc(tt('share_cart', 'Səbəti paylaş')) + '">' +
          '<button type="button" class="btn btn-primary" id="cartShareCopy">' +
            esc(tt('copy_link', 'Linki kopyala')) + '</button>' +
        '</div>' +
        '<div class="cart-share-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" id="cartShareNative">' +
            '<span class="icon icon-sm" data-icon="share"></span> ' + esc(tt('share', 'Paylaş')) +
          '</button>' +
          '<a href="#" class="btn btn-outline btn-sm" id="cartShareWa">' +
            esc(tt('share_cart_wa', 'WhatsApp ilə göndər')) + '</a>' +
        '</div>' +
      '</div>'
    );
  }

  async function render() {
    const listEl = document.getElementById('cartItems');
    const summaryEl = document.getElementById('cartSummary');
    if (!listEl || !summaryEl) return;

    await ensureShareBanner();

    const totals = await NexoraCart.getTotals();

    if (!totals.items.length) {
      listEl.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state-icon"><span class="icon icon-2xl" data-icon="cart"></span></div>' +
          '<h2>' + tt('cart_empty', 'Səbət boşdur') + '</h2>' +
          '<p class="text-muted mb-4">' + tt('cart_empty_hint') + '</p>' +
          '<a href="products.html" class="btn btn-primary">' + tt('browse_products') + '</a>' +
        '</div>';
      summaryEl.innerHTML = '';
      if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
      return;
    }

    const fallback = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&h=400&q=80';
    var shareLink = absoluteCartUrl('?share=' + encodeURIComponent(NexoraCart.encodeSharePayload(NexoraCart.getItems())));

    listEl.innerHTML = totals.items.map(function (item) {
      const v = variantAttr(item);
      const img = NexoraApp.productImage(item) || fallback;
      return (
        '<div class="cart-item" data-id="' + item.id + '" data-variant="' + v + '">' +
          '<div class="cart-item-thumb" style="background:' + (item.gradient || '#222') + '">' +
            '<img src="' + img + '" alt="' + String(item.name).replace(/"/g, '&quot;') +
              '" loading="lazy" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + fallback + '\';}">' +
          '</div>' +
          '<div>' +
            '<a href="product.html?id=' + item.id + '" class="card-product-name" style="display:block;margin-bottom:4px">' + (item.displayName || item.name) + '</a>' +
            '<div class="text-sm text-muted mb-2">' + item.brand + ' · ' + NexoraApp.formatPrice(item.price, item.currency) + '</div>' +
            '<div class="input-quantity">' +
              '<button type="button" data-qty-minus data-id="' + item.id + '" data-variant="' + v + '">−</button>' +
              '<input type="number" class="input-quantity-value" value="' + item.qty + '" min="1" max="' + (item.stock || 99) +
                '" data-qty-input="' + item.id + '" data-variant="' + v + '">' +
              '<button type="button" data-qty-plus data-id="' + item.id + '" data-variant="' + v + '">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-item-actions text-right">' +
            '<div class="price mb-2">' + NexoraApp.formatPrice(item.price * item.qty, item.currency) + '</div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-remove="' + item.id + '" data-variant="' + v + '">' +
              '<span class="icon icon-sm" data-icon="trash"></span> ' + tt('remove') + '</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    summaryEl.innerHTML =
      '<h3 class="card-title mb-4">' + tt('order_summary') + '</h3>' +
      '<div class="summary-row"><span>' + tt('subtotal') + '</span><span>' + NexoraApp.formatPrice(totals.subtotal) + '</span></div>' +
      '<div class="summary-row"><span>' + tt('discount') + '</span><span>−' + NexoraApp.formatPrice(totals.discount) + '</span></div>' +
      '<div class="summary-row"><span>' + tt('vat') + '</span><span>' + NexoraApp.formatPrice(totals.tax) + '</span></div>' +
      '<div class="summary-row"><span>' + tt('shipping') + '</span><span>' +
        (totals.shipping === 0 ? tt('free') : NexoraApp.formatPrice(totals.shipping)) + '</span></div>' +
      '<div class="summary-total"><span>' + tt('total') + '</span><span>' + NexoraApp.formatPrice(totals.total) + '</span></div>' +
      '<p class="text-xs text-muted mt-2 mb-4">' + totals.freeShippingMin + ' ' + tt('free_ship_from') + '</p>' +
      '<div class="flex gap-2 mb-4">' +
        '<input type="text" class="input" id="couponInput" placeholder="' + tt('coupon') + '" value="' +
          (totals.coupon ? totals.coupon.code : '') + '">' +
        '<button type="button" class="btn btn-outline" id="applyCoupon">' + tt('apply') + '</button>' +
      '</div>' +
      (totals.coupon
        ? '<p class="text-sm mb-4" style="color:var(--color-success)">' + tt('coupon') + ': ' + totals.coupon.description + '</p>'
        : '') +
      checkoutCtaHTML() +
      '<a href="#" class="btn btn-outline w-full mt-2" id="cartWhatsApp">' + tt('wa_order') + '</a>' +
      sharePanelHTML(shareLink);

    bind();
    bindShareControls();
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  function bind() {
    document.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        NexoraCart.remove(btn.getAttribute('data-remove'), parseVariant(btn.getAttribute('data-variant')));
        render();
        NexoraToast.info(tt('item_removed'));
      });
    });
    document.querySelectorAll('[data-qty-minus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const variant = parseVariant(btn.getAttribute('data-variant'));
        const items = NexoraCart.getItems();
        const item = items.find(function (i) {
          return i.id === id && JSON.stringify(i.variant || null) === JSON.stringify(variant);
        }) || items.find(function (i) { return i.id === id; });
        if (item) NexoraCart.setQty(id, Math.max(1, item.qty - 1), variant);
        render();
      });
    });
    document.querySelectorAll('[data-qty-plus]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const variant = parseVariant(btn.getAttribute('data-variant'));
        const items = NexoraCart.getItems();
        const item = items.find(function (i) {
          return i.id === id && JSON.stringify(i.variant || null) === JSON.stringify(variant);
        }) || items.find(function (i) { return i.id === id; });
        if (item) NexoraCart.setQty(id, item.qty + 1, variant);
        render();
      });
    });
    document.querySelectorAll('[data-qty-input]').forEach(function (input) {
      input.addEventListener('change', function () {
        NexoraCart.setQty(
          input.getAttribute('data-qty-input'),
          parseInt(input.value, 10) || 1,
          parseVariant(input.getAttribute('data-variant'))
        );
        render();
      });
    });
    const applyBtn = document.getElementById('applyCoupon');
    if (applyBtn) {
      applyBtn.addEventListener('click', async function () {
        const code = (document.getElementById('couponInput').value || '').trim();
        try {
          await NexoraCart.applyCoupon(code);
          NexoraToast.success(tt('coupon_applied', 'Kupon tətbiq olundu'));
          render();
        } catch (e) {
          NexoraToast.error(e.message || 'Error');
        }
      });
    }
    const wa = document.getElementById('cartWhatsApp');
    if (wa) {
      wa.addEventListener('click', async function (e) {
        e.preventDefault();
        if (typeof NexoraAccount !== 'undefined' && NexoraAccount.requireShopAuth) {
          try {
            await NexoraAccount.requireShopAuth({
              message: 'Sifariş vermək üçün qeydiyyat / giriş lazımdır'
            });
          } catch (err) {
            return;
          }
        }
        const totals = await NexoraCart.getTotals();
        const lines = totals.items.map(function (i) {
          return i.qty + '× ' + (i.displayName || i.name);
        }).join('\n');
        const msg = tt('wa_hello', 'Salam!') + ' ' + tt('cart') + ':\n' + lines + '\n' +
          tt('total') + ': ' + NexoraApp.formatPrice(totals.total);
        window.open(NexoraApp.whatsappLink(msg), '_blank');
      });
    }
    NexoraApp.updateBadges();
  }

  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('nexora:lang-change', render);
})();
