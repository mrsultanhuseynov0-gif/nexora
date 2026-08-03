/**
 * NEXORA Compare — visual product comparison
 */
(function () {
  'use strict';

  const KEY = 'nexora-compare';
  const MAX = 3;
  let allProducts = [];
  let selected = [];

  function loadSelected() {
    const fromUrl = (NexoraApp.getQueryParam('ids') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    if (fromUrl.length) {
      selected = fromUrl.slice(0, MAX);
      saveSelected();
      return;
    }
    selected = NexoraApp.storageGet(KEY, []).slice(0, MAX);
  }

  function saveSelected() {
    NexoraApp.storageSet(KEY, selected);
    try {
      const qs = selected.length ? '?ids=' + encodeURIComponent(selected.join(',')) : '';
      history.replaceState(null, '', window.location.pathname + qs);
    } catch (e) { /* ignore */ }
  }

  function toggle(id) {
    const i = selected.indexOf(id);
    if (i >= 0) {
      selected.splice(i, 1);
    } else {
      if (selected.length >= MAX) {
        if (typeof NexoraToast !== 'undefined') NexoraToast.info('Maksimum ' + MAX + ' məhsul');
        return;
      }
      selected.push(id);
    }
    saveSelected();
    paint();
  }

  function remove(id) {
    selected = selected.filter(function (x) { return x !== id; });
    saveSelected();
    paint();
  }

  function productsById(ids) {
    return ids.map(function (id) {
      return allProducts.find(function (p) { return p.id === id; });
    }).filter(Boolean);
  }

  function winFlags(list, getter, preferLow) {
    const vals = list.map(getter);
    const best = preferLow ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
    return vals.map(function (v) { return v === best; });
  }

  function renderSlots() {
    const el = document.getElementById('compareSlots');
    if (!el) return;
    const list = productsById(selected);
    let html = '';
    for (let i = 0; i < MAX; i++) {
      const p = list[i];
      if (p) {
        const fb = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&h=400&q=80';
        const img = NexoraApp.productImage(p) || fb;
        html +=
          '<div class="compare-slot is-filled">' +
            '<button type="button" class="compare-slot-x" data-remove="' + p.id + '" aria-label="' +
              (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('remove') : 'Sil') + '">×</button>' +
            '<div class="compare-slot-thumb" style="background:' + (p.gradient || '#222') + '">' +
              '<img src="' + img + '" alt="" loading="lazy" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + fb + '\';}">' +
            '</div>' +
            '<div class="compare-slot-meta">' +
              '<div class="compare-slot-brand">' + (p.brand || '') + '</div>' +
              '<div class="compare-slot-name">' + p.name + '</div>' +
            '</div>' +
          '</div>';
      } else {
        html +=
          '<div class="compare-slot is-empty">' +
            '<span class="compare-slot-plus">+</span>' +
            '<span>Slot ' + (i + 1) + '</span>' +
          '</div>';
      }
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () { remove(btn.getAttribute('data-remove')); });
    });
  }

  function renderPicker(q) {
    const el = document.getElementById('comparePicker');
    if (!el) return;
    q = (q || '').trim().toLowerCase();
    let list = allProducts.slice();
    if (q) {
      list = list.filter(function (p) {
        return (p.name + ' ' + p.brand + ' ' + p.sku).toLowerCase().indexOf(q) >= 0;
      });
    }
    const limit = window.matchMedia('(max-width: 700px)').matches ? 18 : 36;
    list = list.slice(0, limit);
    el.innerHTML = list.map(function (p) {
      const active = selected.indexOf(p.id) >= 0;
      const fb = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&h=400&q=80';
      const img = NexoraApp.productImage(p) || fb;
      return (
        '<button type="button" class="compare-pick-card' + (active ? ' is-active' : '') + '" data-pick="' + p.id + '">' +
          '<span class="compare-pick-thumb" style="background:' + (p.gradient || '#222') + '">' +
            '<img src="' + img + '" alt="" loading="lazy" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + fb + '\';}">' +
            (active ? '<span class="compare-pick-check">✓</span>' : '') +
          '</span>' +
          '<span class="compare-pick-body">' +
            '<span class="compare-pick-brand">' + (p.brand || '') + '</span>' +
            '<span class="compare-pick-name">' + p.name + '</span>' +
            '<span class="compare-pick-price">' + NexoraApp.formatPrice(p.price) + '</span>' +
          '</span>' +
        '</button>'
      );
    }).join('') || '<p class="text-muted">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('no_results') : 'Nəticə tapılmadı.') + '</p>';

    el.querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () { toggle(btn.getAttribute('data-pick')); });
    });
  }

  function renderBoard() {
    const el = document.getElementById('compareBoard');
    if (!el) return;
    const list = productsById(selected);
    if (list.length < 2) {
      el.innerHTML =
        '<div class="compare-empty">' +
          '<p class="heading-3 mb-2">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('compare_empty') : 'Hələ boşdur') + '</p>' +
          '<p class="text-muted mb-0">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('compare_need') : 'Müqayisə üçün ən azı 2 məhsul lazımdır.') + '</p>' +
        '</div>';
      return;
    }

    const priceWins = winFlags(list, function (p) { return p.price; }, true);
    const ratingWins = winFlags(list, function (p) { return Number(p.rating) || 0; }, false);
    const stockWins = winFlags(list, function (p) { return Number(p.stock) || 0; }, false);

    const rows = [
      {
        label: 'Qiymət',
        cells: list.map(function (p, i) {
          return '<td class="' + (priceWins[i] ? 'is-best' : '') + '"><span class="compare-price">' +
            NexoraApp.formatPrice(p.price) + '</span>' +
            (p.oldPrice ? '<span class="price-old">' + NexoraApp.formatPrice(p.oldPrice) + '</span>' : '') +
            (priceWins[i] ? '<span class="compare-best-tag">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('best_price') : 'Ən ucuz') + '</span>' : '') +
            '</td>';
        })
      },
      {
        label: 'Reytinq',
        cells: list.map(function (p, i) {
          return '<td class="' + (ratingWins[i] ? 'is-best' : '') + '">' +
            NexoraApp.starsHTML(p.rating) +
            '<div class="text-sm mt-1">' + (p.rating || 0) + ' · ' + (p.reviews || 0) + ' rəy</div>' +
            (ratingWins[i] ? '<span class="compare-best-tag">' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('best_rating') : 'Ən yüksək') + '</span>' : '') +
            '</td>';
        })
      },
      {
        label: 'Stok',
        cells: list.map(function (p, i) {
          const ok = NexoraApp.isInStock(p);
          return '<td class="' + (stockWins[i] ? 'is-best' : '') + '">' +
            '<span style="color:' + (ok ? 'var(--color-success)' : 'var(--color-error)') + '">' +
            (ok ? (p.stock + ' ədəd') : 'Bitib') + '</span></td>';
        })
      },
      {
        label: 'Kateqoriya',
        cells: list.map(function (p) {
          return '<td>' + (p.category || '—') + (p.subcategory ? ' / ' + p.subcategory : '') + '</td>';
        })
      },
      {
        label: 'Ekran',
        cells: list.map(function (p) {
          return '<td>' + ((p.specs && (p.specs.Ekran || p.specs.Screen)) || '—') + '</td>';
        })
      },
      {
        label: 'Batareya',
        cells: list.map(function (p) {
          return '<td>' + ((p.specs && p.specs.Batareya) || '—') + '</td>';
        })
      },
      {
        label: 'Kamera',
        cells: list.map(function (p) {
          return '<td>' + ((p.specs && p.specs.Kamera) || '—') + '</td>';
        })
      },
      {
        label: 'Performans',
        cells: list.map(function (p) {
          return '<td>' + ((p.specs && (p.specs.Prosessor || p.specs.CPU || p.specs.Yaddaş)) || '—') + '</td>';
        })
      },
      {
        label: 'Zəmanət',
        cells: list.map(function (p) {
          return '<td>' + ((p.specs && p.specs.Zəmanət) || '12 ay') + '</td>';
        })
      }
    ];

    el.innerHTML =
      '<div class="compare-board-inner">' +
        '<div class="compare-cols" style="--cols:' + list.length + '">' +
          list.map(function (p) {
            const img = NexoraApp.productImage(p);
            return (
              '<article class="compare-col">' +
                '<div class="compare-col-media" style="background:' + (p.gradient || '#111') + '">' +
                  (img ? '<img src="' + img + '" alt="' + String(p.name).replace(/"/g, '&quot;') + '">' : '') +
                '</div>' +
                '<p class="compare-col-brand">' + (p.brand || '') + '</p>' +
                '<h2 class="compare-col-title"><a href="product.html?id=' + p.id + '">' + p.name + '</a></h2>' +
                '<div class="compare-col-actions">' +
                  '<button type="button" class="btn btn-primary btn-sm" data-add="' + p.id + '">' +
                    (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('add_cart') : 'Səbətə at') + '</button>' +
                  '<a class="btn btn-outline btn-sm" href="product.html?id=' + p.id + '">Ətraflı</a>' +
                '</div>' +
              '</article>'
            );
          }).join('') +
        '</div>' +
        '<div class="compare-table-scroll">' +
          '<table class="compare-matrix">' +
            '<tbody>' +
              rows.map(function (r) {
                return '<tr><th scope="row">' + r.label + '</th>' + r.cells.join('') + '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';

    el.querySelectorAll('[data-add]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await NexoraCart.add(btn.getAttribute('data-add'), 1);
          NexoraToast.success(typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('added_cart') : 'Səbətə əlavə olundu');
          NexoraApp.updateBadges();
        } catch (e) {
          NexoraToast.error(e.message || 'Xəta');
        }
      });
    });
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  function paint() {
    renderSlots();
    renderPicker(document.getElementById('compareSearch') && document.getElementById('compareSearch').value);
    renderBoard();
  }

  async function boot() {
    if (!document.getElementById('compareBoard')) return;
    allProducts = await NexoraApp.loadProducts();
    loadSelected();
    paint();
    if (typeof NexoraI18n !== 'undefined') NexoraI18n.apply(document);
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await boot();
    const search = document.getElementById('compareSearch');
    if (search) {
      search.addEventListener('input', NexoraApp.debounce(function () {
        renderPicker(search.value);
      }, 180));
    }
    const clearBtn = document.getElementById('clearCompare');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        selected = [];
        saveSelected();
        paint();
      });
    }
  });
  window.addEventListener('nexora:lang-change', function () {
    paint();
    if (typeof NexoraI18n !== 'undefined') NexoraI18n.apply(document);
  });
})();
