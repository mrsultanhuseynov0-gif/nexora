/**
 * Enhances product detail with bundle, history, warehouses, tips, QR, configurator
 */
(function () {
  'use strict';

  async function enhance() {
    const root = document.getElementById('productDetail');
    if (!root || typeof NexoraSmart === 'undefined') return;
    if (!document.getElementById('addCartBtn') && !root.querySelector('.empty-state')) return;
    const id = NexoraApp.getQueryParam('id');
    if (!id) return;
    const products = await NexoraApp.loadProducts();
    const product = products.find(function (p) { return p.id === id; });
    if (!product) return;

    root.querySelectorAll('.smart-pdp').forEach(function (el) { el.remove(); });
    document.querySelectorAll('.room-preview-quick').forEach(function (el) { el.remove(); });
    if (typeof NexoraRoomPreview !== 'undefined') NexoraRoomPreview.close();

    NexoraSmart.trackView(product.id);
    const live = NexoraSmart.liveStats(product);
    const warehouses = NexoraSmart.warehouses(product);
    const tips = NexoraSmart.aiTips(product);
    const history = NexoraSmart.priceHistory(product, 60);
    const bundle = await NexoraSmart.suggestBundle(product);
    const config = NexoraSmart.configuratorOptions(product);

    const panel = document.createElement('div');
    panel.className = 'smart-pdp mt-8';
    panel.innerHTML =
      '<div class="card mb-4"><div class="card-body">' +
        '<p class="text-sm mb-2">Son 24 saatda <strong>' + live.ordered24h + '</strong> dəfə sifariş edilib · ' +
        'Hazırda <strong>' + live.viewing + '</strong> nəfər baxır</p>' +
        '<div class="warehouse-list">' + warehouses.map(function (w) {
          return '<div class="warehouse-row"><span>' + w.city + '</span><strong>' + w.qty + ' ədəd</strong></div>';
        }).join('') + '</div>' +
      '</div></div>' +

      '<div class="card mb-4"><div class="card-body">' +
        '<h3 class="card-title">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('smart_tips') : 'AI məsləhətlər') + '</h3>' +
        '<ul class="smart-tips">' + tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
      '</div></div>' +

      '<div class="card mb-4"><div class="card-body">' +
        '<h3 class="card-title">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('price_history') : 'Qiymət tarixçəsi (60 gün)') + '</h3>' +
        '<canvas id="priceHistoryChart" class="price-chart"></canvas>' +
        '<p class="text-xs text-muted mt-2">Demo qrafik — trend göstəricisi.</p>' +
      '</div></div>' +

      (config ? (
        '<div class="card mb-4"><div class="card-body">' +
          '<h3 class="card-title">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('configurator') : 'Məhsul konfiquratoru') + '</h3>' +
          '<div id="configGroups"></div>' +
          '<p class="mt-4">Yekun qiymət: <strong id="configPrice">' + NexoraApp.formatPrice(product.price) + '</strong></p>' +
          '<button type="button" class="btn btn-primary" id="configAddCart">Konfiqurasiya ilə səbətə at</button>' +
        '</div></div>'
      ) : '') +

      '<div class="card mb-4"><div class="card-body">' +
        '<h3 class="card-title">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('smart_bundle') : 'Smart Bundle — birlikdə al') + '</h3>' +
        '<p class="text-sm text-muted mb-3">Paketlənmiş endirim: <strong>−' +
          NexoraApp.formatPrice(bundle.discount) + '</strong> (≈8%)</p>' +
        '<div class="bundle-list" id="bundleList"></div>' +
        '<div class="flex gap-2 flex-wrap mt-4">' +
          '<button type="button" class="btn btn-primary" id="bundleAddAll">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('add_all') : 'Hamısını səbətə at') + '</button>' +
          '<button type="button" class="btn btn-outline" id="addToCompareBtn">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('compare_add') : 'Müqayisəyə əlavə et') + '</button>' +
          '<a class="btn btn-ghost" href="compare.html?ids=' + encodeURIComponent(
            [product.id].concat(bundle.items.map(function (h) { return h.product.id; })).slice(0, 3).join(',')
          ) + '">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('open_compare') : 'Müqayisəni aç') + '</a>' +
        '</div>' +
        '<p class="text-sm mt-3">Paket qiyməti: <strong>' + NexoraApp.formatPrice(bundle.bundlePrice) + '</strong></p>' +
      '</div></div>' +

      '<div class="card mb-4"><div class="card-body">' +
        '<h3 class="card-title mb-3">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('qr_code') : 'QR kod') + '</h3>' +
        '<div class="qr-chat-grid">' +
          '<div class="qr-chat-card">' +
            '<img class="qr-chat-img" src="' + NexoraSmart.qrUrl(product.id) + '" alt="Məhsul QR" width="150" height="150">' +
            '<strong>Məhsul linki</strong>' +
            '<p class="text-sm text-muted mb-2">Skana et — məhsul səhifəsi açılsın</p>' +
            '<button type="button" class="btn btn-outline btn-sm" id="qrCopyLink">Linki kopyala</button>' +
          '</div>' +
          '<div class="qr-chat-card">' +
            '<img class="qr-chat-img" src="' + NexoraSmart.whatsappQrUrl(product) + '" alt="WhatsApp sohbet QR" width="150" height="150">' +
            '<strong>WhatsApp sohbet</strong>' +
            '<p class="text-sm text-muted mb-2">Skana et — bu məhsul haqqında yaz</p>' +
            '<a class="btn btn-primary btn-sm" id="qrOpenWa" href="' + NexoraSmart.whatsappChatUrl(product) +
              '" target="_blank" rel="noopener">Söhbətə başla</a>' +
          '</div>' +
        '</div>' +
      '</div></div>';

    root.appendChild(panel);

    const copyLinkBtn = document.getElementById('qrCopyLink');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', async function () {
        const link = NexoraSmart.productShareUrl(product.id);
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(link);
          } else {
            const ta = document.createElement('textarea');
            ta.value = link;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
          }
          NexoraToast.success('Link kopyalandı');
        } catch (e) {
          NexoraToast.info(link);
        }
      });
    }

    const canvas = document.getElementById('priceHistoryChart');
    if (canvas) NexoraSmart.renderPriceChart(canvas, history);

    const bundleList = document.getElementById('bundleList');
    if (bundleList) {
      bundleList.innerHTML =
        '<div class="bundle-item"><strong>Əsas:</strong> ' + product.name + ' — ' + NexoraApp.formatPrice(product.price) + '</div>' +
        bundle.items.map(function (h) {
          return '<div class="bundle-item"><span class="badge badge-outline">' + h.label + '</span> ' +
            h.product.name + ' — ' + NexoraApp.formatPrice(h.product.price) + '</div>';
        }).join('');
    }

    const addAll = document.getElementById('bundleAddAll');
    if (addAll) {
      addAll.addEventListener('click', async function () {
        try {
          await NexoraCart.add(product.id, 1);
          for (let i = 0; i < bundle.items.length; i++) {
            try { await NexoraCart.add(bundle.items[i].product.id, 1); } catch (e) { /* skip */ }
          }
          NexoraToast.success('Paket səbətə əlavə olundu (−' + NexoraApp.formatPrice(bundle.discount) + ')');
          NexoraApp.updateBadges();
        } catch (e) {
          NexoraToast.error(e.message || 'Xəta');
        }
      });
    }

    const cmpBtn = document.getElementById('addToCompareBtn');
    if (cmpBtn) {
      cmpBtn.addEventListener('click', function () {
        const key = 'nexora-compare';
        let ids = NexoraApp.storageGet(key, []);
        if (ids.indexOf(product.id) === -1) {
          if (ids.length >= 3) ids = ids.slice(1);
          ids.push(product.id);
          NexoraApp.storageSet(key, ids);
        }
        NexoraToast.success('Müqayisəyə əlavə olundu');
        cmpBtn.textContent = 'Müqayisədədir →';
        cmpBtn.onclick = function () {
          window.location.href = 'compare.html?ids=' + encodeURIComponent(ids.join(','));
        };
      });
    }

    if (config) {
      const selections = {};
      config.groups.forEach(function (g) { selections[g.id] = g.options[0].id; });
      const groupsEl = document.getElementById('configGroups');
      groupsEl.innerHTML = config.groups.map(function (g) {
        return '<div class="mb-3"><div class="text-sm mb-2"><strong>' + g.label + '</strong></div>' +
          '<div class="variant-options" data-cfg="' + g.id + '">' +
          g.options.map(function (o, i) {
            return '<button type="button" class="variant-chip' + (i === 0 ? ' is-active' : '') +
              '" data-opt="' + o.id + '">' + o.label +
              (o.delta ? ' (+' + o.delta + '₼)' : '') + '</button>';
          }).join('') + '</div></div>';
      }).join('');

      function refreshPrice() {
        const r = NexoraSmart.configPrice(config.base, selections, config.groups);
        document.getElementById('configPrice').textContent = NexoraApp.formatPrice(r.total);
        return r;
      }

      groupsEl.querySelectorAll('[data-cfg]').forEach(function (group) {
        const gid = group.getAttribute('data-cfg');
        group.querySelectorAll('[data-opt]').forEach(function (chip) {
          chip.addEventListener('click', function () {
            group.querySelectorAll('.variant-chip').forEach(function (c) { c.classList.remove('is-active'); });
            chip.classList.add('is-active');
            selections[gid] = chip.getAttribute('data-opt');
            refreshPrice();
          });
        });
      });

      document.getElementById('configAddCart').addEventListener('click', async function () {
        const r = refreshPrice();
        try {
          await NexoraCart.add(product.id, 1, { config: r.labels.join(' | '), priceOverride: r.total });
          NexoraToast.success('Konfiqurasiya səbətə əlavə olundu');
          NexoraApp.updateBadges();
        } catch (e) {
          NexoraToast.error(e.message || 'Xəta');
        }
      });
    }

    // Smart Room Preview — TVs only
    if (typeof NexoraRoomPreview !== 'undefined' && NexoraRoomPreview.isTvProduct(product)) {
      let host = document.getElementById('roomPreviewHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'roomPreviewHost';
        host.className = 'room-preview-host card mb-4';
        host.innerHTML =
          '<div class="card-body">' +
            '<h3 class="card-title">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('room_preview_title') : 'Smart Room Preview') + '</h3>' +
            '<p class="text-sm text-muted mb-3">' +
              (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('room_preview_desc') : 'Telefon kamerası ilə otağı göstərin — TV-nin divarda necə görünəcəyini yoxlayın.') +
            '</p>' +
          '</div>';
        panel.insertBefore(host, panel.firstChild);
        const cartBtn = document.getElementById('addCartBtn');
        if (cartBtn && cartBtn.parentElement && !cartBtn.parentElement.querySelector('[data-room-preview]')) {
          const quick = document.createElement('div');
          quick.className = 'room-preview-quick';
          cartBtn.parentElement.appendChild(quick);
          NexoraRoomPreview.mountButton(product, quick);
        }
      }
      const body = host.querySelector('.card-body') || host;
      NexoraRoomPreview.mountButton(product, body);
    }
  }

  document.addEventListener('product-detail:ready', enhance);
  window.addEventListener('nexora:lang-change', function () {
    // product-detail re-renders then fires product-detail:ready
  });
  document.addEventListener('DOMContentLoaded', function () {
    // Fallback if ready event was missed (slow network)
    setTimeout(function () {
      if (!document.querySelector('.smart-pdp') && document.getElementById('addCartBtn')) enhance();
    }, 1500);
  });
})();
