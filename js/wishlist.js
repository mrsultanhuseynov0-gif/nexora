/**
 * NEXORA Wishlist — localStorage
 */
const NexoraWishlist = (function () {
  'use strict';

  const KEY = 'nexora-wishlist';

  function getIds() {
    return NexoraApp.storageGet(KEY, []);
  }

  function save(ids) {
    NexoraApp.storageSet(KEY, ids);
    NexoraApp.updateBadges();
    window.dispatchEvent(new CustomEvent('nexora:wishlist-change'));
  }

  function count() {
    return getIds().length;
  }

  function has(id) {
    return getIds().indexOf(id) !== -1;
  }

  function add(id) {
    if (typeof NexoraAccount !== 'undefined' && NexoraAccount.isLoggedIn && !NexoraAccount.isLoggedIn()) {
      if (NexoraAccount.promptLogin) {
        NexoraAccount.promptLogin({
          message: 'Seçilmişlərə əlavə etmək üçün qeydiyyat / giriş lazımdır'
        });
      }
      throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
    }
    const ids = getIds();
    if (ids.indexOf(id) === -1) {
      ids.push(id);
      save(ids);
    }
    return true;
  }

  function remove(id) {
    save(getIds().filter(function (x) { return x !== id; }));
  }

  function toggle(id) {
    if (typeof NexoraAccount !== 'undefined' && NexoraAccount.isLoggedIn && !NexoraAccount.isLoggedIn()) {
      if (NexoraAccount.promptLogin) {
        NexoraAccount.promptLogin({
          message: 'Seçilmişlərə əlavə etmək üçün qeydiyyat / giriş lazımdır'
        });
      }
      throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
    }
    if (has(id)) {
      remove(id);
      return false;
    }
    add(id);
    return true;
  }

  async function getProducts() {
    const products = await NexoraApp.loadProducts();
    const ids = getIds();
    return ids.map(function (id) {
      return products.find(function (p) { return p.id === id; });
    }).filter(Boolean);
  }

  async function moveAllToCart() {
    const ids = getIds().slice();
    for (let i = 0; i < ids.length; i++) {
      try {
        await NexoraCart.add(ids[i], 1);
      } catch (e) { /* skip OOS */ }
    }
    save([]);
  }

  function shareLink() {
    const ids = getIds();
    const page = 'wishlist.html' + (ids.length ? '?ids=' + encodeURIComponent(ids.join(',')) : '');
    try {
      return new URL(NexoraApp.pageUrl(page), window.location.href).href;
    } catch (e) {
      return NexoraApp.pageUrl(page);
    }
  }

  function importSharedIds() {
    const raw = NexoraApp.getQueryParam('ids');
    if (!raw) return false;
    if (typeof NexoraAccount !== 'undefined' && NexoraAccount.isLoggedIn && !NexoraAccount.isLoggedIn()) {
      if (NexoraAccount.promptLogin) {
        NexoraAccount.promptLogin({
          message: 'Seçilmişləri saxlamaq üçün qeydiyyat / giriş lazımdır'
        });
      }
      return false;
    }
    const incoming = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (!incoming.length) return false;
    const merged = getIds().slice();
    incoming.forEach(function (id) {
      if (merged.indexOf(id) === -1) merged.push(id);
    });
    save(merged);
    return true;
  }

  return {
    getIds,
    count,
    has,
    add,
    remove,
    toggle,
    getProducts,
    moveAllToCart,
    shareLink,
    importSharedIds
  };
})();
