/**
 * NEXORA Smart UI — wheel, wishlist alerts, inject PDP extras when present
 */
(function () {
  'use strict';

  function ensureWheel() {
    if (typeof NexoraSmart === 'undefined') return;
    if (NexoraSmart.hasSpunWheel()) return;
    if (document.getElementById('nexoraWheelModal')) return;

    const modal = document.createElement('div');
    modal.id = 'nexoraWheelModal';
    modal.className = 'modal';
    const tt = function (k) {
      return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(k) : k;
    };
    modal.innerHTML =
      '<div class="modal-dialog modal-dialog-sm">' +
        '<div class="modal-header"><h2 class="modal-title">' + tt('wheel_title') + '</h2>' +
        '<button type="button" class="modal-close" data-wheel-close aria-label="' + tt('close') + '">' +
        '<span class="icon icon-md" data-icon="close"></span></button></div>' +
        '<div class="modal-body text-center">' +
          '<p class="mb-4">' + tt('wheel_text') + '</p>' +
          '<div class="wheel-disc" id="wheelDisc" aria-hidden="true"></div>' +
          '<p class="mt-3 mb-3" id="wheelResult" hidden></p>' +
          '<button type="button" class="btn btn-primary w-full" id="spinWheelBtn">' + tt('wheel_spin') + '</button>' +
        '</div></div>';
    document.body.appendChild(modal);
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();

    function close() {
      if (typeof NexoraModal !== 'undefined') {
        NexoraModal.close(modal);
      } else {
        modal.classList.remove('is-active', 'is-open');
        document.body.classList.remove('modal-open');
        const bd = document.querySelector('.modal-backdrop');
        if (bd) bd.classList.remove('is-active');
      }
    }

    function open() {
      if (typeof NexoraModal !== 'undefined') {
        NexoraModal.open(modal);
      } else {
        let bd = document.querySelector('.modal-backdrop');
        if (!bd) {
          bd = document.createElement('div');
          bd.className = 'modal-backdrop';
          document.body.appendChild(bd);
        }
        bd.classList.add('is-active');
        modal.classList.add('is-active');
        document.body.classList.add('modal-open');
      }
    }

    modal.querySelector('[data-wheel-close]').addEventListener('click', function () {
      localStorage.setItem('nexora-wheel-done', '1');
      close();
    });
    document.getElementById('spinWheelBtn').addEventListener('click', function () {
      const btn = this;
      btn.disabled = true;
      const disc = document.getElementById('wheelDisc');
      disc.classList.add('is-spinning');
      setTimeout(function () {
        const prize = NexoraSmart.spinWheel();
        disc.classList.remove('is-spinning');
        const res = document.getElementById('wheelResult');
        res.hidden = false;
        res.innerHTML = prize.type === 'none'
          ? 'Bu dəfə boş gəldi — yenə də alış-verişə davam!'
          : ('Qazandın: <strong>' + prize.label + '</strong> — kupon səbətə tətbiq oluna bilər.');
        btn.textContent = 'Bağla';
        btn.disabled = false;
        btn.onclick = function () {
          localStorage.setItem('nexora-wheel-done', '1');
          close();
        };
        if (typeof NexoraToast !== 'undefined') NexoraToast.success(prize.label);
      }, 2200);
    });

    open();
  }

  async function wishlistAlerts() {
    if (typeof NexoraSmart === 'undefined' || typeof NexoraToast === 'undefined') return;
    try {
      const alerts = await NexoraSmart.checkWishlistAlerts();
      alerts.slice(0, 2).forEach(function (a) {
        NexoraToast.info(a.message);
      });
    } catch (e) { /* ignore */ }
  }

  function boot() {
    setTimeout(ensureWheel, 1200);
    setTimeout(wishlistAlerts, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
