/**
 * NEXORA Wishlist page
 */
(function () {
  'use strict';

  async function render() {
    const el = document.getElementById('wishlistGrid');
    if (!el) return;

    const products = await NexoraWishlist.getProducts();
    const meta = document.getElementById('wishlistMeta');
    if (meta) {
      meta.textContent = products.length + ' ' +
        (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('products_count') : 'məhsul');
    }

    if (!products.length) {
      el.innerHTML = '<div class="empty-state" style="grid-column:1/-1">' +
        '<div class="empty-state-icon"><span class="icon icon-2xl" data-icon="heart"></span></div>' +
        '<h2>' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('wishlist_empty') : 'Seçilmişlər boşdur') + '</h2>' +
        '<a href="products.html" class="btn btn-primary mt-4">' +
          (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('browse_products') : 'Məhsullara bax') + '</a></div>';
      if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
      return;
    }

    el.innerHTML = products.map(function (p) {
      return (
        '<div class="wishlist-item">' +
          NexoraApp.productCardHTML(p) +
          '<button type="button" class="btn btn-outline btn-sm w-full mt-2" data-wish-remove="' + p.id + '">' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('remove') : 'Sil') + '</button>' +
        '</div>'
      );
    }).join('');

    NexoraApp.bindProductActions(el);
    el.querySelectorAll('[data-wish-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        NexoraWishlist.remove(btn.getAttribute('data-wish-remove'));
        render();
      });
    });
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof NexoraWishlist !== 'undefined' && NexoraWishlist.importSharedIds()) {
      if (typeof NexoraToast !== 'undefined') {
        NexoraToast.success(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('added_wish') : 'Paylaşılan seçilmişlər əlavə olundu');
      }
    }

    render();

    const moveBtn = document.getElementById('wishToCart');
    if (moveBtn) {
      moveBtn.addEventListener('click', async function () {
        await NexoraWishlist.moveAllToCart();
        NexoraToast.success(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('added_cart') : 'Məhsullar səbətə köçürüldü');
        render();
      });
    }

    const shareBtn = document.getElementById('wishShare');
    if (shareBtn) {
      shareBtn.addEventListener('click', async function () {
        const link = NexoraWishlist.shareLink();
        try {
          if (navigator.clipboard) await navigator.clipboard.writeText(link);
          NexoraToast.success(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('share') : 'Paylaşım linki kopyalandı');
        } catch (e) {
          NexoraToast.info(link);
        }
      });
    }
  });
  window.addEventListener('nexora:lang-change', render);
})();
