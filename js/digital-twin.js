/**
 * NEXORA Digital Twin — rəqəmsal nüsxə: alınan cihazların şəxsi platforması
 */
const NexoraDigitalTwin = (function () {
  'use strict';

  var cache = { twins: [], selectedId: null, products: [] };

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined'
      ? NexoraSecurity.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function deviceType(product, name) {
    var sub = (product && product.subcategory) || '';
    var blob = ((product && product.name) || name || '') + ' ' + sub;
    blob = blob.toLowerCase();
    if (sub === 'smartphones' || /iphone|galaxy|pixel|smartfon|telefon/.test(blob)) return 'phone';
    if (sub === 'laptops' || /laptop|noutbuk|macbook|notebook|rog|thinkpad|latitude/.test(blob)) return 'laptop';
    if (sub === 'tv' || /monitor|tv\b/.test(blob)) return 'display';
    if (sub === 'printers' || /printer|laserjet/.test(blob)) return 'printer';
    return 'other';
  }

  function typeMeta(type) {
    if (type === 'phone') return { icon: '📱', label: 'Smartfon' };
    if (type === 'laptop') return { icon: '💻', label: 'Noutbuk' };
    if (type === 'display') return { icon: '🖥', label: 'Ekran' };
    if (type === 'printer') return { icon: '🖨', label: 'Printer' };
    return { icon: '📦', label: 'Cihaz' };
  }

  function deriveImei(serial) {
    var h = 0;
    var s = String(serial || 'NX');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var body = String(h) + String((h * 7) >>> 0);
    return ('35' + body.replace(/\D/g, '') + '0000000000000').slice(0, 15);
  }

  function supportLinks(brand, type) {
    var b = String(brand || '').toLowerCase();
    if (type === 'laptop') {
      if (/asus|rog/.test(b)) {
        return [
          { label: 'ASUS Driver & Utility', href: 'https://www.asus.com/support/download-center/' },
          { label: 'BIOS / Firmware', href: 'https://www.asus.com/support/download-center/' }
        ];
      }
      if (/lenovo|thinkpad/.test(b)) {
        return [
          { label: 'Lenovo Vantage / Drivers', href: 'https://pcsupport.lenovo.com/' },
          { label: 'BIOS yeniləmələri', href: 'https://pcsupport.lenovo.com/' }
        ];
      }
      if (/dell|latitude|xps/.test(b)) {
        return [
          { label: 'Dell SupportAssist', href: 'https://www.dell.com/support/' },
          { label: 'BIOS yeniləmələri', href: 'https://www.dell.com/support/' }
        ];
      }
      if (/apple|macbook/.test(b)) {
        return [
          { label: 'macOS Software Update', href: 'https://support.apple.com/macos' },
          { label: 'Apple Support', href: 'https://support.apple.com/' }
        ];
      }
      if (/hp|elitebook|probook/.test(b)) {
        return [
          { label: 'HP Support', href: 'https://support.hp.com/' },
          { label: 'BIOS / Firmware', href: 'https://support.hp.com/' }
        ];
      }
      return [
        { label: 'İstehsalçı dəstək mərkəzi', href: 'https://www.google.com/search?q=' + encodeURIComponent((brand || '') + ' drivers') },
        { label: 'BIOS / Firmware', href: 'https://www.google.com/search?q=' + encodeURIComponent((brand || '') + ' BIOS update') }
      ];
    }
    if (type === 'phone') {
      if (/apple|iphone/.test(b)) {
        return [{ label: 'iOS yeniləmələri', href: 'https://support.apple.com/iphone' }];
      }
      if (/samsung|galaxy/.test(b)) {
        return [{ label: 'Samsung Members / Software', href: 'https://www.samsung.com/support/' }];
      }
      return [{ label: 'Sistem yeniləmələri', href: 'https://www.google.com/search?q=' + encodeURIComponent((brand || '') + ' software update') }];
    }
    return [];
  }

  function warrantyStatusMeta(status) {
    if (status === 'expired') return { label: 'Bitib', cls: 'badge-dark' };
    if (status === 'expiring') return { label: 'Bitmək üzrə', cls: 'badge-warning' };
    return { label: 'Aktiv', cls: 'badge-primary' };
  }

  function daysLabel(daysLeft) {
    if (daysLeft < 0) return Math.abs(daysLeft) + ' gün əvvəl bitib';
    if (daysLeft === 0) return 'Bu gün bitir';
    return 'Bitməsinə ' + daysLeft + ' gün qalıb';
  }

  function upgradeSuggestions(product, type, ownedIds) {
    if (!product) return [];
    var all = cache.products || [];
    var brand = String(product.brandId || product.brand || '').toLowerCase();
    var price = Number(product.price) || 0;

    if (type === 'phone') {
      return all.filter(function (p) {
        if (ownedIds[p.id]) return false;
        if (p.subcategory !== 'smartphones') return false;
        var sameBrand = String(p.brandId || p.brand || '').toLowerCase() === brand;
        return sameBrand && (Number(p.price) || 0) > price * 0.95;
      }).sort(function (a, b) { return (b.price || 0) - (a.price || 0); }).slice(0, 3);
    }

    if (type === 'laptop') {
      var upgrades = all.filter(function (p) {
        if (ownedIds[p.id]) return false;
        var n = (p.name || '').toLowerCase();
        return /ssd|nvme|ram|yaddaş|memory|ddr/i.test(n) ||
          (p.subcategory === 'laptops' && String(p.brandId || '').toLowerCase() === brand && (p.price || 0) > price);
      }).slice(0, 4);
      return upgrades;
    }

    return all.filter(function (p) {
      return !ownedIds[p.id] && p.category === product.category && p.brandId === product.brandId;
    }).slice(0, 3);
  }

  function buildTwins(warranties, history, products) {
    cache.products = products || [];
    var byId = {};
    (products || []).forEach(function (p) { byId[p.id] = p; });

    var tickets = (history && history.tickets) || [];
    var repairs = (history && history.repairs) || [];
    var purchases = (history && history.purchases) || [];

    var seen = {};
    var twins = [];

    function pushFrom(w, extra) {
      extra = extra || {};
      var key = w.id || (w.productId + '|' + (w.serial || '') + '|' + (w.orderId || ''));
      if (seen[key]) return;
      seen[key] = true;
      var product = byId[w.productId] || null;
      var name = w.productName || w.name || (product && product.name) || 'Cihaz';
      var type = deviceType(product, name);
      var meta = typeMeta(type);
      twins.push({
        twinId: String(w.id || key),
        warrantyId: w.id || null,
        productId: w.productId || null,
        orderId: w.orderId || extra.orderId || null,
        serial: w.serial || extra.serial || '—',
        sku: w.sku || (product && product.sku) || '',
        productName: name,
        brand: w.brand || (product && product.brand) || '',
        deviceType: type,
        typeLabel: meta.label,
        icon: meta.icon,
        product: product,
        purchasedAt: w.startAt || w.start || extra.purchasedAt || null,
        warranty: {
          months: w.months || 12,
          startAt: w.startAt || w.start || null,
          endAt: w.endAt || w.end || null,
          daysLeft: typeof w.daysLeft === 'number' ? w.daysLeft : null,
          status: w.status || 'active'
        },
        tickets: tickets.filter(function (t) {
          return t.warrantyId === w.id || t.productId === w.productId;
        }),
        repairs: repairs.filter(function (r) {
          return r.warrantyId === w.id || r.productId === w.productId;
        })
      });
    }

    (warranties || []).forEach(function (w) { pushFrom(w); });

    purchases.forEach(function (row) {
      if (row.warranty) {
        pushFrom(Object.assign({}, row.warranty, {
          productId: row.productId || (row.warranty && row.warranty.productId),
          productName: row.productName,
          brand: row.brand,
          serial: row.serial || (row.warranty && row.warranty.serial),
          orderId: row.orderId
        }), { purchasedAt: row.purchasedAt });
      } else if (row.productId) {
        pushFrom({
          id: 'twin_purchase_' + (row.id || row.productId),
          productId: row.productId,
          productName: row.productName,
          brand: row.brand,
          sku: row.sku,
          serial: row.serial || ('NX-PUR-' + String(row.productId).slice(-4).toUpperCase()),
          orderId: row.orderId,
          startAt: row.purchasedAt,
          status: 'active',
          daysLeft: 365
        }, { purchasedAt: row.purchasedAt });
      }
    });

    twins.sort(function (a, b) {
      return String(b.purchasedAt || '').localeCompare(String(a.purchasedAt || ''));
    });
    cache.twins = twins;
    return twins;
  }

  function miniProduct(p) {
    if (!p) return '';
    var href = 'product.html?id=' + encodeURIComponent(p.id);
    var thumb = NexoraApp.productThumbHTML(p, 'dt-mini-thumb');
    return '<a class="dt-mini" href="' + href + '">' + thumb +
      '<span><strong>' + esc(p.name) + '</strong>' +
      '<span class="price">' + NexoraApp.formatPrice(p.price, p.currency) + '</span></span></a>';
  }

  async function renderDetail(twin) {
    var detail = document.getElementById('dtDetail');
    if (!detail || !twin) return;

    var product = twin.product;
    var wMeta = warrantyStatusMeta(twin.warranty.status);
    var owned = {};
    cache.twins.forEach(function (t) { if (t.productId) owned[t.productId] = true; });

    var accessories = [];
    if (product && typeof NexoraSmart !== 'undefined' && NexoraSmart.suggestBundle) {
      try {
        var bundle = await NexoraSmart.suggestBundle(product);
        accessories = (bundle.items || []).slice(0, 4);
      } catch (e) { accessories = []; }
    }

    var upgrades = upgradeSuggestions(product, twin.deviceType, owned);
    var links = supportLinks(twin.brand || (product && product.brand), twin.deviceType);

    var thumb = product
      ? NexoraApp.productThumbHTML(product, 'dt-hero-thumb')
      : '<div class="dt-hero-thumb dt-hero-fallback">' + twin.icon + '</div>';

    var identityRows = '';
    if (twin.deviceType === 'phone') {
      identityRows =
        '<div class="dt-kv"><span>IMEI</span><strong>' + esc(deriveImei(twin.serial)) + '</strong></div>' +
        '<div class="dt-kv"><span>Seriya</span><strong>' + esc(twin.serial) + '</strong></div>' +
        '<div class="dt-kv"><span>Batareya</span><strong class="dt-soon">Gələcək inteqrasiya' +
          '<span class="badge badge-dark ml-2">Soon</span></strong></div>';
    } else if (twin.deviceType === 'laptop') {
      identityRows =
        '<div class="dt-kv"><span>Seriya nömrəsi</span><strong>' + esc(twin.serial) + '</strong></div>' +
        '<div class="dt-kv"><span>SKU</span><strong>' + esc(twin.sku || '—') + '</strong></div>' +
        '<div class="dt-kv"><span>BIOS / Driver</span><strong class="dt-soon">İstehsalçı linkləri aşağıda</strong></div>';
    } else {
      identityRows =
        '<div class="dt-kv"><span>Seriya</span><strong>' + esc(twin.serial) + '</strong></div>' +
        '<div class="dt-kv"><span>SKU</span><strong>' + esc(twin.sku || '—') + '</strong></div>';
    }

    var invoiceHtml = twin.orderId
      ? '<div class="dt-doc">' +
          '<div><strong>Faktura / sifariş</strong><div class="text-sm text-muted">' + esc(twin.orderId) + '</div></div>' +
          '<div class="flex gap-2 flex-wrap">' +
            '<button type="button" class="btn btn-outline btn-sm" data-dt-go="orders">Sifarişə bax</button>' +
            '<a class="btn btn-ghost btn-sm" href="track.html?id=' + encodeURIComponent(twin.orderId) + '">İzlə</a>' +
          '</div></div>'
      : '<div class="dt-doc"><div><strong>Faktura</strong><div class="text-sm text-muted">Sifariş əlaqəsi yoxdur</div></div></div>';

    var warrantyHtml =
      '<div class="dt-doc">' +
        '<div><strong>Zəmanət</strong>' +
          '<div class="text-sm text-muted">' + esc(daysLabel(twin.warranty.daysLeft == null ? 0 : twin.warranty.daysLeft)) +
          ' · <span class="badge ' + wMeta.cls + '">' + esc(wMeta.label) + '</span></div>' +
          '<div class="text-sm text-muted">' + esc(twin.warranty.startAt || '—') + ' → ' + esc(twin.warranty.endAt || '—') + '</div>' +
        '</div>' +
        '<div class="flex gap-2 flex-wrap">' +
          (twin.warrantyId
            ? '<button type="button" class="btn btn-primary btn-sm" data-dt-warranty-pdf="' + esc(twin.warrantyId) + '">PDF zəmanət</button>'
            : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-dt-go="warranty">Warranty Center</button>' +
        '</div></div>';

    var serviceCount = twin.tickets.length + twin.repairs.length;
    var serviceHtml =
      '<div class="dt-doc">' +
        '<div><strong>Servis</strong>' +
          '<div class="text-sm text-muted">' +
            (serviceCount
              ? (twin.tickets.length + ' müraciət · ' + twin.repairs.length + ' təmir')
              : 'Servis qeydi yoxdur') +
          '</div></div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-dt-go="service">Servis tarixçəsi</button>' +
      '</div>';

    var accHtml = accessories.length
      ? '<div class="dt-mini-row">' + accessories.map(function (h) {
          var p = h.product;
          var href = 'product.html?id=' + encodeURIComponent(p.id);
          return '<a class="dt-mini" href="' + href + '">' +
            NexoraApp.productThumbHTML(p, 'dt-mini-thumb') +
            '<span><span class="dt-acc-label">' + esc(h.label || 'Aksessuar') + '</span>' +
            '<strong>' + esc(p.name) + '</strong>' +
            '<span class="price">' + NexoraApp.formatPrice(p.price, p.currency) + '</span></span></a>';
        }).join('') + '</div>'
      : '<p class="text-muted text-sm mb-0">Uyğun aksesuar tapılmadı.</p>';

    var upHtml = upgrades.length
      ? '<div class="dt-mini-row">' + upgrades.map(miniProduct).join('') + '</div>'
      : '<p class="text-muted text-sm mb-0">Hazırda yeniləmə tövsiyəsi yoxdur.</p>';

    var linksHtml = links.length
      ? '<ul class="dt-links">' + links.map(function (L) {
          return '<li><a href="' + esc(L.href) + '" target="_blank" rel="noopener">' + esc(L.label) + '</a></li>';
        }).join('') + '</ul>'
      : '<p class="text-muted text-sm mb-0">Əlavə link yoxdur.</p>';

    var upgradeTitle = twin.deviceType === 'laptop'
      ? 'Uyğun RAM və SSD / yeniləmələr'
      : 'Təklif olunan yeniləmələr';

    detail.innerHTML =
      '<article class="dt-detail-card">' +
        '<header class="dt-detail-head">' +
          thumb +
          '<div>' +
            '<div class="text-sm text-muted">' + twin.icon + ' ' + esc(twin.typeLabel) +
              (twin.brand ? ' · ' + esc(twin.brand) : '') + '</div>' +
            '<h3 class="dt-detail-title">' + esc(twin.productName) + '</h3>' +
            (product
              ? '<a class="btn btn-ghost btn-sm mt-2" href="product.html?id=' + encodeURIComponent(product.id) + '">Kataloqda bax</a>'
              : '') +
          '</div>' +
        '</header>' +
        '<div class="dt-kv-grid">' + identityRows + '</div>' +
        '<div class="dt-docs">' + invoiceHtml + warrantyHtml + serviceHtml + '</div>' +
        (twin.deviceType === 'laptop' || twin.deviceType === 'phone'
          ? '<section class="dt-block"><h4 class="dt-block-title">Driverlər və yeniləmələr</h4>' + linksHtml + '</section>'
          : '') +
        '<section class="dt-block"><h4 class="dt-block-title">Aksesuarlar</h4>' + accHtml + '</section>' +
        '<section class="dt-block"><h4 class="dt-block-title">' + esc(upgradeTitle) + '</h4>' + upHtml + '</section>' +
      '</article>';

    detail.querySelectorAll('[data-dt-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (typeof window.__nexoraShowAccountPanel === 'function') {
          window.__nexoraShowAccountPanel(btn.getAttribute('data-dt-go'));
        }
      });
    });

    detail.querySelectorAll('[data-dt-warranty-pdf]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var id = btn.getAttribute('data-dt-warranty-pdf');
        try {
          if (typeof NexoraApi !== 'undefined' && NexoraApi.downloadWarrantyPdf) {
            var blob = await NexoraApi.downloadWarrantyPdf(id);
            if (typeof NexoraApi.downloadBlob === 'function') {
              NexoraApi.downloadBlob(blob, 'NEXORA_Zemanet_' + id + '.pdf');
            } else {
              var a = document.createElement('a');
              var href = URL.createObjectURL(blob);
              a.href = href;
              a.download = 'NEXORA_Zemanet_' + id + '.pdf';
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
            }
            NexoraToast.success('PDF zəmanət yükləndi');
          } else {
            NexoraToast.info('PDF üçün API serverə qoşulun');
          }
        } catch (err) {
          NexoraToast.error(err.message || 'PDF alınmadı');
        }
      });
    });
  }

  function renderList() {
    var list = document.getElementById('dtList');
    if (!list) return;
    var twins = cache.twins;
    if (!twins.length) {
      list.innerHTML =
        '<div class="card"><div class="card-body">' +
          '<p class="mb-3">Hələ rəqəmsal əkiz yoxdur. Sifariş verdikdə cihazlarınız burada görünəcək.</p>' +
          '<a class="btn btn-primary" href="products.html">Kataloqa keç</a>' +
        '</div></div>';
      document.getElementById('dtDetail').innerHTML =
        '<p class="text-muted">Cihaz seçin — Digital Twin detalları burada açılacaq.</p>';
      return;
    }

    list.innerHTML = twins.map(function (t) {
      var active = t.twinId === cache.selectedId ? ' is-active' : '';
      var wMeta = warrantyStatusMeta(t.warranty.status);
      return '<button type="button" class="dt-list-item' + active + '" data-twin-id="' + esc(t.twinId) + '">' +
        '<span class="dt-list-icon" aria-hidden="true">' + t.icon + '</span>' +
        '<span class="dt-list-body">' +
          '<strong>' + esc(t.productName) + '</strong>' +
          '<span class="text-sm text-muted">' + esc(t.serial) + '</span>' +
        '</span>' +
        '<span class="badge ' + wMeta.cls + '">' + esc(wMeta.label) + '</span>' +
      '</button>';
    }).join('');

    list.querySelectorAll('[data-twin-id]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectTwin(btn.getAttribute('data-twin-id'));
      });
    });
  }

  function findTwin(id) {
    if (!id) return null;
    return cache.twins.find(function (t) {
      return t.twinId === id || t.warrantyId === id || t.productId === id;
    }) || null;
  }

  function selectTwin(id) {
    var twin = findTwin(id) || cache.twins[0];
    if (!twin) return;
    cache.selectedId = twin.twinId;
    renderList();
    renderDetail(twin);
  }

  async function render(opts) {
    opts = opts || {};
    var root = document.getElementById('digitalTwinRoot');
    if (!root) return;

    var summary = document.getElementById('dtSummary');
    if (summary) summary.innerHTML = '<span class="text-muted">Yüklənir…</span>';

    var products = [];
    try { products = await NexoraApp.loadProducts(); } catch (e) { products = []; }

    var warranties = opts.warranties || [];
    if (!warranties.length) {
      try {
        if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken && NexoraApi.getToken()) {
          var res = await NexoraApi.myWarranties();
          warranties = res.warranties || [];
        }
      } catch (e2) { /* ignore */ }
    }
    if (!warranties.length && opts.orders && typeof NexoraSmart !== 'undefined') {
      warranties = NexoraSmart.warrantiesFromOrders(opts.orders);
    }

    var history = opts.history || null;
    if (!history) {
      try {
        if (typeof NexoraApi !== 'undefined' && NexoraApi.serviceHistory && NexoraApi.getToken()) {
          history = await NexoraApi.serviceHistory();
        }
      } catch (e3) { history = null; }
    }

    var twins = buildTwins(warranties, history, products);
    var phones = twins.filter(function (t) { return t.deviceType === 'phone'; }).length;
    var laptops = twins.filter(function (t) { return t.deviceType === 'laptop'; }).length;

    if (summary) {
      summary.innerHTML =
        '<div class="warranty-stat"><span class="warranty-stat-n">' + twins.length + '</span><span>Cihaz</span></div>' +
        '<div class="warranty-stat is-ok"><span class="warranty-stat-n">' + phones + '</span><span>Smartfon</span></div>' +
        '<div class="warranty-stat"><span class="warranty-stat-n">' + laptops + '</span><span>Noutbuk</span></div>' +
        '<div class="warranty-stat is-warn"><span class="warranty-stat-n">' +
          twins.filter(function (t) { return t.warranty.status === 'expiring'; }).length +
        '</span><span>Bitmək üzrə</span></div>';
    }

    if (opts.selectId) {
      var hit = findTwin(opts.selectId);
      cache.selectedId = hit ? hit.twinId : opts.selectId;
    }
    if (!cache.selectedId && twins.length) cache.selectedId = twins[0].twinId;

    renderList();
    var selected = findTwin(cache.selectedId) || twins[0];
    if (selected) {
      cache.selectedId = selected.twinId;
      await renderDetail(selected);
    }
  }

  return {
    render: render,
    selectTwin: selectTwin,
    getTwins: function () { return cache.twins.slice(); }
  };
})();
