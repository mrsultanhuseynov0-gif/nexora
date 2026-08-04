/**
 * NEXORA Checkout — creates order + payment via API
 */
(function () {
  'use strict';

  async function guardCheckoutAuth() {
    if (typeof NexoraAccount === 'undefined' || !NexoraAccount.requireShopAuth) return true;
    try {
      await NexoraAccount.requireShopAuth({
        message: 'Sifariş vermək üçün qeydiyyat / giriş lazımdır',
        next: location.pathname + location.search
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function renderSummary() {
    const el = document.getElementById('checkoutSummary');
    if (!el) return;
    const totals = await NexoraCart.getTotals();

    function tt(k) {
      return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(k) : k;
    }

    if (!totals.items.length) {
      el.innerHTML = '<p class="text-muted">' + tt('cart_empty') +
        '. <a href="products.html">' + tt('browse_products') + '</a></p>';
      document.getElementById('checkoutForm').hidden = true;
      return;
    }

    el.innerHTML =
      totals.items.map(function (i) {
        return '<div class="summary-row"><span>' + (i.displayName || i.name) + ' ×' + i.qty + '</span><span>' +
          NexoraApp.formatPrice(i.price * i.qty) + '</span></div>';
      }).join('') +
      '<div class="summary-row mt-4"><span>' + tt('subtotal') + '</span><span>' + NexoraApp.formatPrice(totals.subtotal) + '</span></div>' +
      '<div class="summary-row"><span>' + tt('discount') + '</span><span>−' + NexoraApp.formatPrice(totals.discount) + '</span></div>' +
      '<div class="summary-row"><span>' + tt('vat') + '</span><span>' + NexoraApp.formatPrice(totals.tax) + '</span></div>' +
      '<div class="summary-row"><span>' + tt('shipping') + '</span><span>' +
        (totals.shipping === 0 ? tt('free') : NexoraApp.formatPrice(totals.shipping)) + '</span></div>' +
      '<div class="summary-total"><span>' + tt('total') + '</span><span>' + NexoraApp.formatPrice(totals.total) + '</span></div>';
  }

  async function fillFromSession() {
    if (typeof NexoraAccount === 'undefined') return;
    const user = await NexoraAccount.getCurrentUser();
    if (!user) return;
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (el && val) el.value = val;
    };
    set('shipName', user.name);
    set('shipEmail', user.email);
    set('shipPhone', user.phone);
    const addr = (user.addresses || []).find(function (a) { return a.isDefault; }) || (user.addresses || [])[0];
    if (addr) {
      set('shipCity', addr.city);
      set('shipDistrict', addr.district);
      set('shipAddress', addr.address);
      set('shipPostal', addr.postalCode);
      set('billName', addr.fullName);
      set('billAddress', addr.address + ', ' + addr.city);
    }
  }

  async function loadPaymentLabels() {
    try {
      const res = await fetch('/api/payments/config');
      if (!res.ok) return;
      const data = await res.json();
      const cfg = data.payment || {};
      const cardLabel = document.querySelector('input[name="paymentMethod"][value="card"]');
      if (cardLabel && cardLabel.parentElement) {
        const span = cardLabel.parentElement.querySelector('.form-check-label');
        if (span) {
          span.textContent = cfg.mode === 'sandbox'
            ? 'Kart (Visa / Mastercard) — sandbox test'
            : 'Kart (Visa / Mastercard)';
        }
      }
      // Show transfer option if enabled
      const cash = document.querySelector('input[name="paymentMethod"][value="cash"]');
      if (cfg.methods && cfg.methods.transfer && cash && cash.parentElement) {
        const wrap = cash.parentElement.parentElement;
        if (wrap && !document.querySelector('input[name="paymentMethod"][value="transfer"]')) {
          const label = document.createElement('label');
          label.className = 'form-check mb-3';
          label.innerHTML =
            '<input type="radio" name="paymentMethod" value="transfer" class="form-check-input">' +
            '<span class="form-check-label">Bank köçürməsi</span>';
          cash.parentElement.insertAdjacentElement('afterend', label);
        }
      }
      const hint = document.getElementById('cardFields');
      if (hint && cfg.sandboxHint && !document.getElementById('sandboxPayHint')) {
        const p = document.createElement('p');
        p.id = 'sandboxPayHint';
        p.className = 'text-xs text-muted mt-2';
        p.textContent = cfg.sandboxHint + ' · Kartı checkout-da yox, ödəniş səhifəsində daxil edəcəksiniz.';
        hint.appendChild(p);
      }
    } catch (e) { /* offline */ }
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!document.getElementById('checkoutForm')) return;
    if (!(await guardCheckoutAuth())) return;
    if (typeof NexoraAccount !== 'undefined') await NexoraAccount.seedUsers();
    await renderSummary();
    await fillFromSession();
    await loadPaymentLabels();

    // Prefill ?ref= from URL
    var urlRef = new URLSearchParams(window.location.search).get('ref');
    if (urlRef && document.getElementById('referralCode')) {
      document.getElementById('referralCode').value = urlRef;
    }

    var referralOk = null;
    async function checkReferral() {
      var input = document.getElementById('referralCode');
      var status = document.getElementById('referralStatus');
      if (!input || !status) return;
      var code = input.value.trim();
      if (!code) {
        referralOk = null;
        status.hidden = true;
        return;
      }
      try {
        var totals = await NexoraCart.getTotals();
        var headers = { 'Content-Type': 'application/json' };
        if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken()) {
          headers.Authorization = 'Bearer ' + NexoraApi.getToken();
        }
        var emailEl = document.getElementById('shipEmail');
        var res = await fetch('/api/referrals/validate', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            code: code,
            email: emailEl ? emailEl.value.trim() : '',
            subtotal: totals.subtotal || 0
          })
        });
        var data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Kod etibarsızdır');
        referralOk = data;
        status.hidden = false;
        status.style.color = '#1b7a3d';
        status.textContent = data.message + (data.discount ? (' · −' + NexoraApp.formatPrice(data.discount)) : '');
      } catch (err) {
        referralOk = null;
        status.hidden = false;
        status.style.color = '#c62828';
        status.textContent = err.message || 'Xəta';
      }
    }

    var checkBtn = document.getElementById('referralCheckBtn');
    if (checkBtn) checkBtn.addEventListener('click', checkReferral);
    var refInput = document.getElementById('referralCode');
    if (refInput) {
      refInput.addEventListener('change', checkReferral);
      if (refInput.value) checkReferral();
    }

    // Show referral credit if logged in
    (async function () {
      try {
        if (typeof NexoraApi === 'undefined' || !NexoraApi.getToken()) return;
        var mine = await NexoraApi.myReferral();
        var credit = mine && mine.referral && mine.referral.credit;
        if (credit > 0) {
          var wrap = document.getElementById('creditWrap');
          var label = document.getElementById('creditLabel');
          if (wrap && label) {
            wrap.hidden = false;
            label.textContent = 'Referral balansını istifadə et (' + NexoraApp.formatPrice(credit) + ')';
            document.getElementById('useReferralCredit').dataset.max = String(credit);
          }
        }
      } catch (e) { /* ignore */ }
    })();

    document.querySelectorAll('[name="paymentMethod"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        const cardFields = document.getElementById('cardFields');
        if (cardFields) {
          // Card details collected on secure payment page
          cardFields.hidden = true;
        }
      });
    });
    const cardFields = document.getElementById('cardFields');
    if (cardFields) cardFields.hidden = true;

    const same = document.getElementById('sameAsShipping');
    if (same) {
      same.addEventListener('change', function () {
        document.getElementById('billingFields').hidden = this.checked;
      });
    }

    document.getElementById('checkoutForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const totals = await NexoraCart.getTotals();
      if (!totals.items.length) {
        NexoraToast.error(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('cart_empty') : 'Səbət boşdur');
        return;
      }

      const method = (document.querySelector('[name="paymentMethod"]:checked') || {}).value || 'card';
      const submitBtn = document.querySelector('#checkoutForm button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      var refCode = (document.getElementById('referralCode') || {}).value || '';
      refCode = String(refCode).trim();
      var creditCb = document.getElementById('useReferralCredit');
      var useCredit = creditCb && creditCb.checked ? Number(creditCb.dataset.max || 0) : 0;

      const payload = {
        paymentMethod: method === 'installment' ? 'installment' : method,
        couponCode: (totals.coupon && (totals.coupon.code || totals.coupon)) || '',
        referralCode: refCode,
        useReferralCredit: useCredit,
        customer: {
          name: document.getElementById('shipName').value.trim(),
          email: document.getElementById('shipEmail').value.trim(),
          phone: document.getElementById('shipPhone').value.trim(),
          city: document.getElementById('shipCity').value.trim(),
          district: document.getElementById('shipDistrict').value.trim(),
          address: document.getElementById('shipAddress').value.trim(),
          postalCode: document.getElementById('shipPostal').value.trim()
        },
        items: totals.items.map(function (i) {
          return { productId: i.id, qty: i.qty, variant: i.variant || null };
        }),
        notes: ''
      };

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (typeof NexoraApi !== 'undefined' && NexoraApi.getToken()) {
          headers.Authorization = 'Bearer ' + NexoraApi.getToken();
        }
        const res = await fetch('/api/payments/checkout', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Sifariş yaradılmadı');

        // Keep local copy for track page offline fallback
        try {
          const localOrder = {
            id: data.order.id,
            userId: null,
            email: payload.customer.email,
            status: method === 'card' || method === 'installment' ? 'Gözləmədə' : 'Təsdiqləndi',
            paymentMethod: method,
            paymentStatus: method === 'card' ? 'Ödəniş gözlənilir' : (method === 'cash' ? 'Nağd' : 'Köçürmə gözlənilir'),
            paymentId: data.payment.paymentId,
            shipping: payload.customer,
            items: data.order.items,
            subtotal: data.order.totals.subtotal,
            discount: data.order.totals.discount,
            tax: data.order.totals.tax,
            shippingCost: data.order.totals.shipping,
            total: data.order.totals.total,
            coupon: payload.couponCode,
            referralCode: payload.referralCode,
            createdAt: new Date().toISOString()
          };
          if (typeof NexoraAccount !== 'undefined' && NexoraAccount.saveOrder) {
            NexoraAccount.saveOrder(localOrder);
          }
        } catch (e) { /* ignore */ }

        NexoraCart.clear();
        NexoraApp.updateBadges();

        if (data.payment && data.payment.payUrl && (method === 'card' || method === 'installment' || method === 'transfer')) {
          window.location.href = data.payment.payUrl;
          return;
        }

        // Cash / no pay URL — success screen
        document.getElementById('checkoutForm').hidden = true;
        document.getElementById('checkoutSummary').hidden = true;
        const done = document.getElementById('checkoutSuccess');
        done.hidden = false;
        const trackUrl = 'track.html?id=' + encodeURIComponent(data.order.id) +
          '&email=' + encodeURIComponent(payload.customer.email);
        done.innerHTML =
          '<div class="empty-state">' +
            '<div class="empty-state-icon" style="color:var(--color-success)">' +
              '<span class="icon icon-2xl" data-icon="checkCircle"></span></div>' +
            '<h2>Sifariş qəbul olundu!</h2>' +
            '<p class="text-muted mb-2">Sifariş nömrəsi: <strong>' + data.order.id + '</strong></p>' +
            '<p class="text-muted mb-4">' + (data.payment.message || 'Nağd ödəniş çatdırılma zamanı.') + '</p>' +
            '<div class="flex gap-3 justify-center flex-wrap">' +
              '<a href="' + trackUrl + '" class="btn btn-primary">Sifarişi izlə</a>' +
              '<a href="products.html" class="btn btn-ghost">Alış-verişə davam</a>' +
            '</div></div>';
        if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
        NexoraToast.success('Sifariş yaradıldı');
      } catch (err) {
        NexoraToast.error(err.message || 'Xəta');
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });
})();
