/**
 * NEXORA Business Panel — B2B company account, bulk order, quote & contract PDFs
 */
(function () {
  'use strict';

  var state = {
    profile: null,
    settings: { discountPercent: 8, minTotal: 200 },
    lines: [],
    quotes: [],
    contracts: [],
    products: []
  };

  function esc(s) {
    return typeof NexoraSecurity !== 'undefined'
      ? NexoraSecurity.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function money(n) {
    return typeof NexoraApp !== 'undefined' ? NexoraApp.formatPrice(n) : (Number(n) || 0) + ' ₼';
  }

  function downloadBlob(blob, filename) {
    var a = document.createElement('a');
    var href = URL.createObjectURL(blob);
    a.href = href;
    a.download = filename || 'nexora-download.bin';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(href); }, 1500);
  }

  async function saveDownload(promise, kindLabel) {
    NexoraToast.info((kindLabel || 'Fayl') + ' hazırlanır…');
    var file = await promise;
    var blob = file.blob || file;
    var name = file.filename || ('nexora-' + Date.now() + '.bin');
    downloadBlob(blob, name);
    NexoraToast.success((kindLabel || 'Fayl') + ' yükləndi: ' + name);
    return file;
  }

  function statusBadge(status) {
    var s = String(status || 'draft');
    var cls = 'badge badge-primary';
    if (s === 'signed' || s === 'accepted' || s === 'active') cls = 'badge badge-success';
    else if (s === 'rejected' || s === 'cancelled' || s === 'expired') cls = 'badge badge-error';
    else if (s === 'sent') cls = 'badge badge-warning';
    return '<span class="' + cls + '">' + esc(s) + '</span>';
  }

  function showPanel(name) {
    document.querySelectorAll('.biz-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-biz-panel') === name);
    });
    document.querySelectorAll('[data-biz-nav]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-biz-nav') === name);
    });
  }

  function linesPayload() {
    return state.lines.map(function (l) {
      return { productId: l.productId, qty: l.qty };
    });
  }

  function localTotals() {
    var subtotal = state.lines.reduce(function (s, l) {
      return s + (l.unitPrice * l.qty);
    }, 0);
    var min = state.settings.minTotal || 200;
    var pct = subtotal >= min ? (state.settings.discountPercent || 8) : 0;
    var discount = Math.round(subtotal * pct) / 100;
    var taxable = Math.max(subtotal - discount, 0);
    var tax = Math.round(taxable * 0.18 * 100) / 100;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      discount: discount,
      discountPercent: pct,
      tax: tax,
      total: Math.round((taxable + tax) * 100) / 100
    };
  }

  function renderBanner() {
    var el = document.getElementById('bizBanner');
    if (!el || !state.profile) return;
    el.innerHTML =
      '<div class="card-body flex justify-between flex-wrap gap-3 items-center">' +
        '<div><div class="text-sm text-muted">Şirkət hesabı</div>' +
          '<strong class="heading-3 mb-0">' + esc(state.profile.companyName) + '</strong>' +
          (state.profile.voen ? '<div class="text-sm text-muted">VÖEN: ' + esc(state.profile.voen) + '</div>' : '') +
        '</div>' +
        '<div class="text-sm">B2B endirim: <strong>' + esc(state.settings.discountPercent) +
          '%</strong> · min. ' + money(state.settings.minTotal) + '</div>' +
      '</div>';
  }

  function renderBulk() {
    var list = document.getElementById('bizBulkLines');
    var totalsEl = document.getElementById('bizBulkTotals');
    if (!list) return;
    if (!state.lines.length) {
      list.innerHTML = '<p class="text-muted">Hələ məhsul əlavə edilməyib.</p>';
    } else {
      list.innerHTML =
        '<div class="biz-table-wrap"><table class="biz-table"><thead><tr>' +
          '<th>Məhsul</th><th>Qiymət</th><th>Say</th><th>Cəm</th><th></th>' +
        '</tr></thead><tbody>' +
        state.lines.map(function (l, idx) {
          return '<tr>' +
            '<td><strong>' + esc(l.name) + '</strong><div class="text-xs text-muted">' + esc(l.sku) + '</div></td>' +
            '<td>' + money(l.unitPrice) + '</td>' +
            '<td><input type="number" class="input" style="width:80px" min="1" value="' +
              esc(l.qty) + '" data-biz-qty="' + idx + '"></td>' +
            '<td>' + money(l.unitPrice * l.qty) + '</td>' +
            '<td><button type="button" class="btn btn-ghost btn-sm" data-biz-remove="' + idx + '">Sil</button></td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    var t = localTotals();
    totalsEl.innerHTML =
      '<div class="biz-totals-grid">' +
        '<div><span>Ara cəm</span><strong>' + money(t.subtotal) + '</strong></div>' +
        '<div><span>B2B endirim (' + t.discountPercent + '%)</span><strong>−' + money(t.discount) + '</strong></div>' +
        '<div><span>ƏDV 18%</span><strong>' + money(t.tax) + '</strong></div>' +
        '<div class="is-total"><span>Yekun</span><strong>' + money(t.total) + '</strong></div>' +
      '</div>';

    list.querySelectorAll('[data-biz-qty]').forEach(function (input) {
      input.addEventListener('change', function () {
        var i = parseInt(input.getAttribute('data-biz-qty'), 10);
        state.lines[i].qty = Math.max(1, parseInt(input.value, 10) || 1);
        renderBulk();
      });
    });
    list.querySelectorAll('[data-biz-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.lines.splice(parseInt(btn.getAttribute('data-biz-remove'), 10), 1);
        renderBulk();
      });
    });
  }

  function renderQuotes() {
    var el = document.getElementById('bizQuotesList');
    if (!el) return;
    if (!state.quotes.length) {
      el.innerHTML = '<p class="text-muted">Təklif yoxdur. Toplu səbətdən «PDF təklif yarat» basın.</p>';
      return;
    }
    el.innerHTML = state.quotes.map(function (q) {
      var items = (q.items || []).length;
      return '<div class="card mb-3"><div class="card-body">' +
        '<div class="flex justify-between flex-wrap gap-2 items-start">' +
          '<div><strong>' + esc(q.title) + '</strong>' +
            '<div class="text-sm text-muted mt-1">№ ' + esc(q.id) + ' · ' +
            esc(String(q.createdAt || '').slice(0, 10)) +
            ' · keçərlilik: ' + esc(String(q.validUntil || '').slice(0, 10)) +
            ' · ' + items + ' məhsul</div></div>' +
          '<div class="text-right">' + statusBadge(q.status) +
            '<div class="mt-1"><strong>' + money(q.totals && q.totals.total) + '</strong></div></div>' +
        '</div>' +
        '<div class="flex gap-2 flex-wrap mt-3">' +
          '<button type="button" class="btn btn-primary btn-sm" data-quote-pdf="' + esc(q.id) + '">PDF yüklə</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-quote-xls="' + esc(q.id) + '">Excel yüklə</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-quote-contract="' + esc(q.id) + '">Müqavilə yarat</button>' +
        '</div>' +
      '</div></div>';
    }).join('');

    el.querySelectorAll('[data-quote-pdf]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await saveDownload(NexoraApi.businessQuotePdf(btn.getAttribute('data-quote-pdf')), 'PDF təklif');
        } catch (e) {
          NexoraToast.error(e.message || 'PDF xətası');
        }
      });
    });
    el.querySelectorAll('[data-quote-xls]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await saveDownload(NexoraApi.businessQuoteExcel(btn.getAttribute('data-quote-xls')), 'Excel təklif');
        } catch (e) {
          NexoraToast.error(e.message || 'Excel xətası');
        }
      });
    });
    el.querySelectorAll('[data-quote-contract]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await NexoraApi.businessCreateContract({ quoteId: btn.getAttribute('data-quote-contract') });
          NexoraToast.success('Müqavilə yaradıldı — PDF-i «Müqavilələr» bölməsindən yükləyin');
          await refreshLists();
          showPanel('contracts');
        } catch (e) {
          NexoraToast.error(e.message || 'Xəta');
        }
      });
    });
  }

  function renderContracts() {
    var el = document.getElementById('bizContractsList');
    if (!el) return;
    if (!state.contracts.length) {
      el.innerHTML = '<p class="text-muted">Müqavilə yoxdur. Təklifdən müqavilə yaradın.</p>';
      return;
    }
    el.innerHTML =
      '<div class="biz-contract-legend text-sm text-muted mb-3">' +
        'Status axını: <strong>draft</strong> → <strong>sent</strong> → <strong>signed</strong> → <strong>active</strong>. ' +
        'PDF peşəkar formatdadır — yüklənəndə fayl adında şirkət və müqavilə № görünür.' +
      '</div>' +
      state.contracts.map(function (c) {
        var total = c.body && c.body.totals ? c.body.totals.total : null;
        var itemCount = c.body && c.body.items ? c.body.items.length : 0;
        return '<div class="card mb-3"><div class="card-body">' +
          '<div class="flex justify-between flex-wrap gap-2 items-start">' +
            '<div><strong>' + esc(c.title) + '</strong>' +
              '<div class="text-sm text-muted mt-1">№ ' + esc(c.id) +
              (c.quoteId ? ' · təklif: ' + esc(c.quoteId) : '') +
              ' · ' + itemCount + ' məhsul · ' + esc(String(c.createdAt || '').slice(0, 10)) +
              '</div></div>' +
            '<div class="text-right">' + statusBadge(c.status) +
              (total != null ? '<div class="mt-1"><strong>' + money(total) + '</strong></div>' : '') +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-sm mt-3" data-contract-pdf="' + esc(c.id) +
            '">PDF müqavilə yüklə</button>' +
        '</div></div>';
      }).join('');

    el.querySelectorAll('[data-contract-pdf]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await saveDownload(NexoraApi.businessContractPdf(btn.getAttribute('data-contract-pdf')), 'PDF müqavilə');
        } catch (e) {
          NexoraToast.error(e.message || 'PDF xətası');
        }
      });
    });
  }

  function fillProfileForm() {
    var p = state.profile || {};
    var map = {
      pfCompany: p.companyName,
      pfVoen: p.voen,
      pfPerson: p.contactPerson,
      pfPhone: p.contactPhone,
      pfEmail: p.contactEmail,
      pfBank: p.bankName,
      pfAddress: p.legalAddress,
      pfAccount: p.bankAccount
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = map[id] || '';
    });
  }

  async function refreshLists() {
    var q = await NexoraApi.businessQuotes();
    var c = await NexoraApi.businessContracts();
    state.quotes = q.quotes || [];
    state.contracts = c.contracts || [];
    renderQuotes();
    renderContracts();
  }

  async function enterDash() {
    if (typeof NexoraApi === 'undefined') {
      throw new Error('API yüklənməyib — səhifəni yeniləyin');
    }
    var alive = await NexoraApi.ensureApi();
    if (!alive) {
      throw new Error('API serverə qoşula bilmədi. Backend URL-i yoxlayın (PUBLIC_API_URL / config.json).');
    }
    if (!NexoraApi.getToken()) {
      throw new Error('Giriş sessiyası yoxdur — yenidən daxil olun');
    }
    var me = await NexoraApi.businessMe();
    if (!me.profile) {
      document.getElementById('bizGate').hidden = false;
      document.getElementById('bizDash').hidden = true;
      if (typeof NexoraToast !== 'undefined') {
        NexoraToast.info('Şirkət profili tələb olunur — «Şirkət qeydiyyatı» tabına keçin');
      }
      return false;
    }
    state.profile = me.profile;
    state.settings = me.settings || state.settings;
    document.getElementById('bizGate').hidden = true;
    document.getElementById('bizDash').hidden = false;
    renderBanner();
    fillProfileForm();
    renderBulk();
    try {
      await refreshLists();
    } catch (e) {
      console.warn('Business lists', e);
    }
    try {
      if (!state.products.length) {
        state.products = await NexoraApp.loadProducts();
      }
    } catch (e2) { /* optional */ }
    return true;
  }

  function bindProductSearch() {
    var input = document.getElementById('bizProductSearch');
    var hits = document.getElementById('bizProductHits');
    if (!input || !hits) return;
    var run = NexoraApp.debounce(async function () {
      var q = input.value.trim();
      if (q.length < 2) {
        hits.innerHTML = '';
        return;
      }
      if (!state.products.length) state.products = await NexoraApp.loadProducts();
      var list = typeof NexoraSearch !== 'undefined'
        ? await NexoraSearch.search(q, 8)
        : state.products.filter(function (p) {
          return (p.name + p.brand + p.sku).toLowerCase().indexOf(q.toLowerCase()) !== -1;
        }).slice(0, 8);
      hits.innerHTML = list.map(function (p) {
        return '<button type="button" class="biz-hit" data-add-product="' + esc(p.id) + '">' +
          '<strong>' + esc(p.name) + '</strong>' +
          '<span>' + money(p.price) + '</span></button>';
      }).join('') || '<p class="text-sm text-muted">Nəticə yoxdur</p>';
      hits.querySelectorAll('[data-add-product]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-add-product');
          var p = state.products.find(function (x) { return x.id === id; });
          if (!p) return;
          var existing = state.lines.find(function (l) { return l.productId === id; });
          if (existing) existing.qty += 1;
          else {
            state.lines.push({
              productId: p.id,
              sku: p.sku || p.id,
              name: p.name,
              unitPrice: Number(p.price) || 0,
              qty: 1
            });
          }
          NexoraToast.success('Əlavə olundu: ' + p.name);
          renderBulk();
        });
      });
    }, 220);
    input.addEventListener('input', run);
  }

  async function boot() {
    // Ensure API base is resolved (split frontend/API hosting)
    if (typeof NexoraApi !== 'undefined' && NexoraApi.ensureApi) {
      await NexoraApi.ensureApi();
    }

    var gate = document.getElementById('bizGate');
    var dash = document.getElementById('bizDash');
    if (!gate || !dash) return;

    document.querySelectorAll('[data-biz-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-biz-tab]').forEach(function (b) {
          b.classList.remove('is-active', 'btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('is-active', 'btn-primary');
        btn.classList.remove('btn-outline');
        document.getElementById('bizLoginForm').hidden = btn.getAttribute('data-biz-tab') !== 'login';
        document.getElementById('bizRegisterForm').hidden = btn.getAttribute('data-biz-tab') !== 'register';
      });
    });

    document.querySelectorAll('[data-biz-nav]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPanel(btn.getAttribute('data-biz-nav'));
      });
    });

    document.getElementById('bizLoginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = e.target.querySelector('[type="submit"]');
      var email = (document.getElementById('bizLoginEmail').value || '').trim();
      var password = document.getElementById('bizLoginPassword').value || '';
      if (!email || !password) {
        NexoraToast.error('E-poçt və şifrə daxil edin');
        return;
      }
      if (btn) btn.disabled = true;
      try {
        var alive = await NexoraApi.ensureApi();
        if (!alive) {
          throw new Error('API işləmir. Backend-i işə salın və ya PUBLIC_API_URL / config.json yoxlayın.');
        }
        // JWT login only — local account seed has no business@ user
        var api = await NexoraApi.login(email, password);
        if (!api || !api.token) throw new Error('Token alınmadı — şifrəni yoxlayın (Business1234)');
        var ok = await enterDash();
        if (ok) NexoraToast.success('Business Panelə xoş gəldiniz');
        else NexoraToast.info('Giriş oldu, amma şirkət profili yoxdur — qeydiyyat tabına keçin');
      } catch (err) {
        console.error('Business login', err);
        var msg = (err && err.message) || 'Giriş alınmadı';
        if (/yanlış|401|Unauthorized/i.test(msg)) {
          msg = 'Email və ya şifrə yanlışdır. Demo: business@nexora.az / Business1234';
        }
        NexoraToast.error(msg);
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    document.getElementById('bizRegisterForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        var email = document.getElementById('bizRegEmail').value;
        var password = document.getElementById('bizRegPassword').value;
        // register personal then attach business profile
        try {
          await NexoraApi.register({
            email: email,
            password: password,
            name: document.getElementById('bizRegPerson').value,
            phone: document.getElementById('bizRegPhone').value
          });
        } catch (regErr) {
          // maybe exists — try login
          await NexoraApi.login(email, password);
        }
        if (NexoraApi.getToken) { /* token set by login/register */ }
        await NexoraAccount.login(email, password).catch(function () { /* api session ok */ });
        await NexoraApi.businessRegister({
          companyName: document.getElementById('bizRegCompany').value,
          voen: document.getElementById('bizRegVoen').value,
          contactPerson: document.getElementById('bizRegPerson').value,
          contactPhone: document.getElementById('bizRegPhone').value,
          contactEmail: email,
          legalAddress: document.getElementById('bizRegAddress').value
        });
        await enterDash();
        NexoraToast.success('Şirkət hesabı yaradıldı');
      } catch (err) {
        NexoraToast.error(err.message || 'Qeydiyyat alınmadı');
      }
    });

    document.getElementById('bizLogout').addEventListener('click', async function () {
      await NexoraAccount.logout();
      if (typeof NexoraApi !== 'undefined') NexoraApi.clearToken();
      state.profile = null;
      state.lines = [];
      gate.hidden = false;
      dash.hidden = true;
    });

    document.getElementById('bizPlaceOrder').addEventListener('click', async function () {
      if (!state.lines.length) {
        NexoraToast.info('Əvvəlcə məhsul əlavə edin');
        return;
      }
      try {
        var res = await NexoraApi.businessBulkOrder({ items: linesPayload(), notes: 'Business Panel toplu sifariş' });
        NexoraToast.success('Sifariş qəbul edildi: ' + res.order.id);
        state.lines = [];
        renderBulk();
        window.location.href = 'track.html?id=' + encodeURIComponent(res.order.id) +
          '&email=' + encodeURIComponent((state.profile && state.profile.contactEmail) || '');
      } catch (err) {
        NexoraToast.error(err.message || 'Sifariş alınmadı');
      }
    });

    document.getElementById('bizMakeQuote').addEventListener('click', async function () {
      if (!state.lines.length) {
        NexoraToast.info('Əvvəlcə məhsul əlavə edin');
        return;
      }
      try {
        var res = await NexoraApi.businessCreateQuote({
          title: 'Təklif — ' + (state.profile.companyName || 'B2B'),
          items: linesPayload()
        });
        NexoraToast.success('Təklif yaradıldı — PDF və Excel yüklənir');
        await refreshLists();
        showPanel('quotes');
        await saveDownload(NexoraApi.businessQuotePdf(res.quote.id), 'PDF təklif');
      } catch (err) {
        NexoraToast.error(err.message || 'Təklif yaradılmadı');
      }
    });

    document.getElementById('bizProfileForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      try {
        var res = await NexoraApi.businessSaveProfile({
          companyName: document.getElementById('pfCompany').value,
          voen: document.getElementById('pfVoen').value,
          contactPerson: document.getElementById('pfPerson').value,
          contactPhone: document.getElementById('pfPhone').value,
          contactEmail: document.getElementById('pfEmail').value,
          bankName: document.getElementById('pfBank').value,
          legalAddress: document.getElementById('pfAddress').value,
          bankAccount: document.getElementById('pfAccount').value
        });
        state.profile = res.profile;
        renderBanner();
        NexoraToast.success('Profil yadda saxlanıldı');
      } catch (err) {
        NexoraToast.error(err.message || 'Yadda saxlanılmadı');
      }
    });

    bindProductSearch();

    // Status line + auto-enter
    var statusEl = document.getElementById('bizApiStatus');
    try {
      var alive = await NexoraApi.ensureApi();
      if (statusEl) {
        statusEl.textContent = alive
          ? ('API: ' + (NexoraApi.getBase() || location.origin))
          : 'API offline — backend URL-i yoxlayın';
        statusEl.className = 'text-xs mt-3 mb-0 ' + (alive ? 'text-muted' : 'text-error');
      }
      if (alive && NexoraApi.getToken()) {
        await enterDash();
      }
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = e.message || 'API xətası';
        statusEl.className = 'text-xs mt-3 mb-0 text-error';
      }
    }

    // Prefill demo credentials on this staff page
    var emailEl = document.getElementById('bizLoginEmail');
    var passEl = document.getElementById('bizLoginPassword');
    if (emailEl && !emailEl.value) emailEl.value = 'business@nexora.az';
    if (/[?&]dev=1\b/.test(location.search || '') && passEl && !passEl.value) {
      passEl.value = 'Business1234';
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
