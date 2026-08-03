/**
 * NEXORA Toast Notification Component
 */
const NexoraToast = (function () {
  'use strict';

  const containers = {};
  const defaultOptions = {
    position: 'top-right',
    duration: 4000,
    closable: true,
    showProgress: true
  };

  const iconMap = {
    success: 'checkCircle',
    error: 'xCircle',
    warning: 'alertTriangle',
    info: 'info',
    primary: 'bell'
  };

  function getContainer(position) {
    if (containers[position]) return containers[position];

    const container = document.createElement('div');
    container.className = `toast-container toast-container-${position}`;
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
    containers[position] = container;
    return container;
  }

  function show(message, options = {}) {
    const opts = { ...defaultOptions, ...options };
    const {
      title,
      type = 'info',
      position,
      duration,
      closable,
      showProgress,
      action
    } = opts;

    const container = getContainer(position);
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const iconName = iconMap[type] || 'info';
    let iconHtml = '';

    if (typeof NexoraIcons !== 'undefined') {
      iconHtml = NexoraIcons.create(iconName, { size: 'md' });
    }

    let actionHtml = '';
    if (action && action.text) {
      actionHtml = `<div class="toast-action">
        <button type="button" class="btn btn-ghost btn-xs" data-toast-action>${action.text}</button>
      </div>`;
    }

    let closeHtml = '';
    if (closable) {
      closeHtml = `<button type="button" class="toast-close" aria-label="Bağla">
        <span class="icon icon-sm" data-icon="close"></span>
      </button>`;
    }

    let progressHtml = '';
    if (showProgress && duration > 0) {
      progressHtml = `<div class="toast-progress" style="animation-duration: ${duration}ms"></div>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconHtml}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
        ${actionHtml}
      </div>
      ${closeHtml}
      ${progressHtml}
    `;

    container.appendChild(toast);

    if (typeof NexoraIcons !== 'undefined') {
      toast.querySelectorAll('[data-icon]').forEach(function (el) {
        const name = el.getAttribute('data-icon');
        el.outerHTML = NexoraIcons.create(name, { size: el.classList.contains('icon-sm') ? 'sm' : 'md' });
      });
    }

    requestAnimationFrame(function () {
      toast.classList.add('is-visible');
    });

    if (closable) {
      toast.querySelector('.toast-close').addEventListener('click', function () {
        dismiss(toast);
      });
    }

    if (action && action.onClick) {
      toast.querySelector('[data-toast-action]').addEventListener('click', function () {
        action.onClick();
        dismiss(toast);
      });
    }

    if (duration > 0) {
      setTimeout(function () {
        dismiss(toast);
      }, duration);
    }

    return toast;
  }

  function dismiss(toast) {
    if (!toast || toast.classList.contains('is-hiding')) return;

    toast.classList.remove('is-visible');
    toast.classList.add('is-hiding');

    setTimeout(function () {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  function success(message, options = {}) {
    return show(message, { ...options, type: 'success' });
  }

  function error(message, options = {}) {
    return show(message, { ...options, type: 'error', duration: options.duration || 6000 });
  }

  function warning(message, options = {}) {
    return show(message, { ...options, type: 'warning' });
  }

  function info(message, options = {}) {
    return show(message, { ...options, type: 'info' });
  }

  function primary(message, options = {}) {
    return show(message, { ...options, type: 'primary' });
  }

  function clear(position) {
    if (position && containers[position]) {
      containers[position].innerHTML = '';
    } else {
      Object.values(containers).forEach(function (container) {
        container.innerHTML = '';
      });
    }
  }

  return {
    show,
    success,
    error,
    warning,
    info,
    primary,
    dismiss,
    clear
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NexoraToast;
}
