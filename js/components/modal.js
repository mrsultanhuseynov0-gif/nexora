/**
 * NEXORA Modal Component
 */
const NexoraModal = (function () {
  'use strict';

  let activeModal = null;
  let backdrop = null;

  function createBackdrop() {
    if (backdrop) return backdrop;
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    backdrop.addEventListener('click', function () {
      if (activeModal) close(activeModal);
    });

    return backdrop;
  }

  function getModalElement(modal) {
    if (typeof modal === 'string') {
      return document.querySelector(modal);
    }
    return modal;
  }

  function open(modal, options = {}) {
    const el = getModalElement(modal);
    if (!el) return;

    if (activeModal && activeModal !== el) {
      close(activeModal, { silent: true });
    }

    activeModal = el;
    const bd = createBackdrop();

    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');

    if (!el.querySelector('.modal-dialog')) {
      wrapContent(el);
    }

    requestAnimationFrame(function () {
      bd.classList.add('is-active');
      el.classList.add('is-active');
      document.body.classList.add('modal-open');
    });

    const focusTarget = el.querySelector('[data-modal-focus]') ||
      el.querySelector('.modal-close') ||
      el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');

    if (focusTarget) {
      setTimeout(function () {
        focusTarget.focus();
      }, 100);
    }

    if (options.onOpen && typeof options.onOpen === 'function') {
      options.onOpen(el);
    }

    bindCloseTriggers(el);
    bindEscapeKey(el);
  }

  function close(modal, options = {}) {
    const el = getModalElement(modal) || activeModal;
    if (!el) return;

    el.classList.remove('is-active');

    if (backdrop) {
      backdrop.classList.remove('is-active');
    }

    document.body.classList.remove('modal-open');

    if (activeModal === el) {
      activeModal = null;
    }

    if (options.onClose && typeof options.onClose === 'function') {
      options.onClose(el);
    }
  }

  function wrapContent(el) {
    const content = el.innerHTML;
    el.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h2 class="modal-title"></h2>
          <button type="button" class="modal-close" aria-label="Bağla" data-modal-close>
            <span class="icon icon-md" data-icon="close"></span>
          </button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer"></div>
      </div>
    `;
  }

  function bindCloseTriggers(el) {
    el.querySelectorAll('[data-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        close(el);
      });
    });
  }

  function bindEscapeKey(el) {
    function handler(e) {
      if (e.key === 'Escape' && activeModal === el) {
        close(el);
        document.removeEventListener('keydown', handler);
      }
    }
    document.addEventListener('keydown', handler);
  }

  function confirm(options = {}) {
    const {
      title = 'Təsdiq',
      message = 'Bu əməliyyatı təsdiq edirsiniz?',
      confirmText = 'Təsdiq et',
      cancelText = 'Ləğv et',
      type = 'warning',
      onConfirm = null,
      onCancel = null
    } = options;

    const iconMap = {
      success: 'checkCircle',
      error: 'xCircle',
      warning: 'alertTriangle',
      info: 'info'
    };

    const modalId = 'modal-confirm-' + Date.now();
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'modal modal-confirm';
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-sm">
        <div class="modal-body">
          <div class="modal-confirm-icon ${type}">
            <span class="icon icon-xl" data-icon="${iconMap[type] || 'alertTriangle'}"></span>
          </div>
          <h3 class="modal-confirm-title">${title}</h3>
          <p class="modal-confirm-text">${message}</p>
        </div>
        <div class="modal-footer modal-footer-center">
          <button type="button" class="btn btn-outline" data-modal-close>${cancelText}</button>
          <button type="button" class="btn btn-primary" data-confirm>${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    if (typeof NexoraIcons !== 'undefined') {
      NexoraIcons.init();
    }

    modal.querySelector('[data-confirm]').addEventListener('click', function () {
      close(modal);
      modal.remove();
      if (onConfirm) onConfirm();
    });

    modal.querySelector('[data-modal-close]').addEventListener('click', function () {
      modal.remove();
      if (onCancel) onCancel();
    });

    open(modal);
    return modal;
  }

  function init() {
    document.querySelectorAll('[data-modal-open]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        const target = trigger.getAttribute('data-modal-open');
        open(target);
      });
    });

    document.querySelectorAll('.modal').forEach(function (modal) {
      bindCloseTriggers(modal);
    });
  }

  return {
    open,
    close,
    confirm,
    init
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NexoraModal;
}
