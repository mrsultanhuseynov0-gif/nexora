/**
 * NEXORA Main JavaScript
 * Initializes design system components
 */
(function () {
  'use strict';

  function applySavedTheme() {
    const savedTheme = localStorage.getItem('nexora-theme');
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  function updateThemeIcons() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const iconName = theme === 'dark' ? 'sun' : 'moon';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (toggle) {
      if (typeof NexoraIcons !== 'undefined') {
        toggle.innerHTML = NexoraIcons.create(iconName, { size: 'md' });
      }
    });
  }

  function initThemeToggle() {
    applySavedTheme();
    updateThemeIcons();

    if (document.documentElement._nexoraThemeBound) return;
    document.documentElement._nexoraThemeBound = true;

    document.addEventListener('click', function (e) {
      const toggle = e.target.closest('[data-theme-toggle]');
      if (!toggle) return;
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';

      if (next === 'light') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('nexora-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('nexora-theme', 'dark');
      }
      updateThemeIcons();
    });

    document.addEventListener('nexora:shell-ready', updateThemeIcons);
  }

  function initQuantityInputs() {
    document.querySelectorAll('.input-quantity').forEach(function (group) {
      const input = group.querySelector('.input-quantity-value');
      const btnMinus = group.querySelector('[data-qty-minus]');
      const btnPlus = group.querySelector('[data-qty-plus]');
      const min = parseInt(input.getAttribute('min') || '1', 10);
      const max = parseInt(input.getAttribute('max') || '999', 10);

      if (btnMinus) {
        btnMinus.addEventListener('click', function () {
          const val = parseInt(input.value, 10) || min;
          if (val > min) {
            input.value = val - 1;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }

      if (btnPlus) {
        btnPlus.addEventListener('click', function () {
          const val = parseInt(input.value, 10) || min;
          if (val < max) {
            input.value = val + 1;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
    });
  }

  function initPasswordToggle() {
    document.querySelectorAll('[data-password-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = document.querySelector(btn.getAttribute('data-password-toggle'));
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        if (typeof NexoraIcons !== 'undefined') {
          btn.innerHTML = NexoraIcons.create(isPassword ? 'eyeOff' : 'eye', { size: 'sm' });
        }
      });
    });
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });

          document.querySelectorAll('.ds-nav a').forEach(function (link) {
            link.classList.remove('is-active');
          });
          if (this.closest('.ds-nav')) {
            this.classList.add('is-active');
          }
        }
      });
    });
  }

  function initDemoButtons() {
    const demoModalBtn = document.querySelector('[data-demo-modal]');
    if (demoModalBtn) {
      demoModalBtn.addEventListener('click', function () {
        NexoraModal.open('#demoModal');
      });
    }

    const demoConfirmBtn = document.querySelector('[data-demo-confirm]');
    if (demoConfirmBtn) {
      demoConfirmBtn.addEventListener('click', function () {
        NexoraModal.confirm({
          title: 'Silmək istəyirsiniz?',
          message: 'Bu əməliyyat geri qaytarıla bilməz. Davam etmək istəyirsiniz?',
          type: 'warning',
          confirmText: 'Bəli, sil',
          cancelText: 'Xeyr',
          onConfirm: function () {
            NexoraToast.success('Əməliyyat uğurla tamamlandı!');
          }
        });
      });
    }

    document.querySelectorAll('[data-demo-toast]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const type = btn.getAttribute('data-demo-toast');
        const messages = {
          success: 'Sifarişiniz uğurla yaradıldı!',
          error: 'Xəta baş verdi. Yenidən cəhd edin.',
          warning: 'Stokda yalnız 3 ədəd qalıb.',
          info: 'Yeni kampaniya başladı!',
          primary: 'NEXORA-ya xoş gəldiniz!'
        };

        if (NexoraToast[type]) {
          NexoraToast[type](messages[type] || messages.info, {
            title: type.charAt(0).toUpperCase() + type.slice(1)
          });
        }
      });
    });
  }

  function registerPWA() {
    if (!('serviceWorker' in navigator)) return;
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    const swUrl = path.includes('/pages/admin')
      ? '../../sw.js'
      : (path.includes('/pages/') ? '../sw.js' : 'sw.js');
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(swUrl).then(function (reg) {
        if (reg && reg.update) reg.update();
      }).catch(function () { /* optional */ });
    });
  }

  function init() {
    if (typeof NexoraIcons !== 'undefined') {
      NexoraIcons.init();
    }

    if (typeof NexoraModal !== 'undefined') {
      NexoraModal.init();
    }

    initThemeToggle();
    initQuantityInputs();
    initPasswordToggle();
    initSmoothScroll();
    initDemoButtons();
    registerPWA();

    document.documentElement.classList.add('nexora-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
