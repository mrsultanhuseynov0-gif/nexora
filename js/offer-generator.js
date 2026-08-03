/**
 * NEXORA PDF Offer Generator — one-click professional price offer
 */
(function () {
  'use strict';

  var DRAFT_KEY = 'nexora-offer-draft';
  var state = {
    lines: [],
    products: [],
    apiOk: false,
    isBusiness: false,
    searchHit: null
  };

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined'
      ? NexoraSecurity.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function money(n) {
    return typeof NexoraApp !== 'undefined'
      ? NexoraApp.formatPrice(n)
      : (Number(n) || 0).toFixed(2) + ' ₼';
  }

  function findProduct(id) {
    return state.products.find(function (p) { return p.id === id; }) || null;
  }

  function upsertLine(productId, qty, meta) {
    meta = meta || {};
    var q = Math.min(500, Math.max(1, Number(qty) || 1));
    var existing = state.lines.find(function (L) { return L.productId === productId; });
    if (existing) {
      existing.qty = q;
      return;
    }
    var p = findProduct(productId);
    state.lines.push({
      productId: productId,
      qty: q,
      name: (p && p.name) || meta.name || productId,
      sku: (p && p.sku) || meta.sku || '',
      unitPrice: p ? Number(p.price) || 0 : Number(meta.unitPrice) || 0
    });
  }

  function calcLocalTotals() {
    var subtotal = state.lines.reduce(function (s, L) {
      return s + (Number(L.unitPrice) || 0) * (Number(L.qty) || 0);
    }, 0);
    subtotal = Math.round(subtotal * 100) / 100;
    var discountPercent = subtotal >= 200 ? 8 : 0;
    var discount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
    var taxable = Math.max(subtotal - discount, 0);
    var tax = Math.round(taxable * 0.18 * 100) / 100;
    var total = Math.round((taxable + tax) * 100) / 100;
    return { subtotal: subtotal, discount: discount, discountPercent: discountPercent, tax: tax, total: total };
  }

  function renderLines() {
    var el = document.getElementById('ogLines');
    var totBox = document.getElementById('ogTotals');
    if (!el) return;

    if (!state.lines.length) {
      el.innerHTML = '<p class="text-muted">Hələ məhsul yoxdur — səbətdən, Office Builder-dən və ya axtarışdan əlavə edin.</p>';
      if (totBox) totBox.hidden = true;
      return;
    }

    el.innerHTML = state.lines.map(function (L, idx) {
      var line = (Number(L.unitPrice) || 0) * (Number(L.qty) || 0);
      return '<div class="og-line" data-idx="' + idx + '">' +
        '<div class="og-line-main">' +
          '<strong>' + esc(L.name) + '</strong>' +
          '<div class="text-sm text-muted">' + esc(L.sku || L.productId) + '</div>' +
        '</div>' +
        '<div class="og-line-qty">' +
          '<input type="number" class="input input-sm" min="1" max="500" value="' + esc(L.qty) + '" data-og-qty="' + idx + '">' +
        '</div>' +
        '<div class="og-line-price">' +
          '<div class="text-sm text-muted">' + money(L.unitPrice) + '</div>' +
          '<strong>' + money(line) + '</strong>' +
        '</div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-og-remove="' + idx + '" aria-label="Sil">✕</button>' +
      '</div>';
    }).join('');

    el.querySelectorAll('[data-og-qty]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var i = Number(inp.getAttribute('data-og-qty'));
        if (state.lines[i]) {
          state.lines[i].qty = Math.min(500, Math.max(1, Number(inp.value) || 1));
          renderLines();
        }
      });
    });
    el.querySelectorAll('[data-og-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.getAttribute('data-og-remove'));
        state.lines.splice(i, 1);
        renderLines();
      });
    });

    var t = calcLocalTotals();
    if (totBox) {
      totBox.hidden = false;
      document.getElementById('ogSub').textContent = money(t.subtotal);
      document.getElementById('ogDisc').textContent =
        (t.discountPercent ? ('-' + money(t.discount) + ' (' + t.discountPercent + '%)') : '—');
      document.getElementById('ogTax').textContent = money(t.tax);
      document.getElementById('ogGrand').textContent = money(t.total);
    }
  }

  function loadDraft() {
    try {
      var raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      var draft = JSON.parse(raw);
      sessionStorage.removeItem(DRAFT_KEY);
      if (draft.title && document.getElementById('ogTitle')) {
        document.getElementById('ogTitle').value = draft.title;
      }
      if (draft.notes && document.getElementById('ogNotes')) {
        document.getElementById('ogNotes').value = draft.notes;
      }
      if (draft.companyName && document.getElementById('ogCompany')) {
        document.getElementById('ogCompany').value = draft.companyName;
      }
      (draft.items || []).forEach(function (it) {
        var id = it.productId || it.id;
        if (id) upsertLine(id, it.qty, it);
      });
    } catch (e) { /* ignore */ }
  }

  function importCart() {
    if (typeof NexoraCart === 'undefined') {
      NexoraToast.error('Səbət yüklənməyib');
      return;
    }
    var items = NexoraCart.getItems();
    if (!items.length) {
      NexoraToast.info('Səbət boşdur');
      return;
    }
    items.forEach(function (it) {
      upsertLine(it.productId || it.id, it.qty, {
        name: it.name,
        sku: it.sku,
        unitPrice: it.price
      });
    });
    renderLines();
    NexoraToast.success(items.length + ' sətir səbətdən götürüldü');
  }

  function payload() {
    return {
      companyName: document.getElementById('ogCompany').value.trim(),
      voen: document.getElementById('ogVoen').value.trim(),
      contactPerson: document.getElementById('ogContact').value.trim(),
      contactPhone: document.getElementById('ogPhone').value.trim(),
      contactEmail: document.getElementById('ogEmail').value.trim(),
      legalAddress: document.getElementById('ogAddress').value.trim(),
      title: document.getElementById('ogTitle').value.trim() || 'Qiymət təklifi',
      notes: document.getElementById('ogNotes').value.trim(),
      save: !!(document.getElementById('ogSave') && document.getElementById('ogSave').checked),
      items: state.lines.map(function (L) {
        return { productId: L.productId, qty: L.qty };
      })
    };
  }

  async function downloadPdf(e) {
    if (e) e.preventDefault();
    if (!state.lines.length) {
      NexoraToast.error('Ən azı bir məhsul əlavə edin');
      return;
    }
    var body = payload();
    if (!body.companyName || body.companyName.length < 2) {
      NexoraToast.error('Şirkət adı tələb olunur');
      document.getElementById('ogCompany').focus();
      return;
    }
    if (!state.apiOk) {
      NexoraToast.error('API serverə qoşulun (port 8787)');
      return;
    }

    var btn = document.getElementById('ogPdfBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'PDF hazırlanır…';
    }
    try {
      var file = await NexoraApi.businessOfferPdf(body);
      NexoraApi.downloadBlob(file.blob, file.filename);
      NexoraToast.success('PDF təklif yükləndi');
    } catch (err) {
      NexoraToast.error(err.message || 'PDF alınmadı');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'PDF təklifi yüklə';
      }
    }
  }

  function bindSearch() {
    var input = document.getElementById('ogSearch');
    var box = document.getElementById('ogSearchResults');
    if (!input || !box) return;

    var run = NexoraApp.debounce(function () {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) {
        box.hidden = true;
        box.innerHTML = '';
        state.searchHit = null;
        return;
      }
      var hits = state.products.filter(function (p) {
        var blob = (p.name + ' ' + (p.sku || '') + ' ' + (p.brand || '')).toLowerCase();
        return blob.indexOf(q) >= 0;
      }).slice(0, 8);
      if (!hits.length) {
        box.hidden = false;
        box.innerHTML = '<div class="text-sm text-muted p-2">Nəticə yoxdur</div>';
        return;
      }
      box.hidden = false;
      box.innerHTML = hits.map(function (p) {
        return '<button type="button" class="og-search-item" data-pid="' + esc(p.id) + '">' +
          '<span>' + esc(p.name) + '</span>' +
          '<strong>' + money(p.price) + '</strong></button>';
      }).join('');
      box.querySelectorAll('[data-pid]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.searchHit = btn.getAttribute('data-pid');
          input.value = (findProduct(state.searchHit) || {}).name || '';
          box.hidden = true;
        });
      });
    }, 200);

    input.addEventListener('input', run);

    document.getElementById('ogAddBtn').addEventListener('click', function () {
      var id = state.searchHit;
      if (!id) {
        var q = input.value.trim().toLowerCase();
        var hit = state.products.find(function (p) {
          return (p.name || '').toLowerCase() === q || (p.sku || '').toLowerCase() === q;
        });
        id = hit && hit.id;
      }
      if (!id) {
        NexoraToast.info('Siyahıdan məhsul seçin');
        return;
      }
      var qty = Number(document.getElementById('ogQty').value) || 1;
      upsertLine(id, qty);
      state.searchHit = null;
      input.value = '';
      document.getElementById('ogQty').value = '1';
      renderLines();
    });
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.getElementById('offerForm')) return;

    try {
      state.products = await NexoraApp.loadProducts();
    } catch (e) {
      state.products = [];
    }

    loadDraft();
    renderLines();
    bindSearch();

    document.getElementById('offerForm').addEventListener('submit', downloadPdf);
    document.getElementById('ogFromCart').addEventListener('click', importCart);

    try {
      state.apiOk = await NexoraApi.ensureApi();
    } catch (e2) {
      state.apiOk = false;
    }
    var hint = document.getElementById('ogApiHint');
    if (hint) {
      hint.textContent = state.apiOk
        ? 'API hazırdır — bir kliklə peşəkar PDF yüklənir.'
        : 'API offline — serveri 8787 portunda işə salın.';
      hint.classList.toggle('text-danger', !state.apiOk);
    }

    try {
      if (state.apiOk && NexoraApi.getToken && NexoraApi.getToken()) {
        var me = await NexoraApi.businessMe().catch(function () { return null; });
        if (me && me.profile) {
          state.isBusiness = true;
          document.getElementById('ogSaveWrap').hidden = false;
          if (!document.getElementById('ogCompany').value) {
            document.getElementById('ogCompany').value = me.profile.companyName || '';
            document.getElementById('ogVoen').value = me.profile.voen || '';
            document.getElementById('ogContact').value = me.profile.contactPerson || '';
            document.getElementById('ogPhone').value = me.profile.contactPhone || '';
            document.getElementById('ogEmail').value = me.profile.contactEmail || '';
            document.getElementById('ogAddress').value = me.profile.legalAddress || '';
          }
        }
      }
    } catch (e3) { /* ignore */ }

    var params = new URLSearchParams(location.search);
    if (params.get('from') === 'cart') importCart();
  });
})();
