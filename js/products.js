/**
 * NEXORA Products listing — filter, sort, pagination
 */
(function () {
  'use strict';

  const PAGE_SIZE = 8;
  let allProducts = [];
  let categories = [];
  let brands = [];
  let page = 1;

  function stateFromURL() {
    const p = new URLSearchParams(window.location.search);
    const brands = p.getAll('brand').length
      ? p.getAll('brand')
      : (p.get('brand') ? p.get('brand').split(',').filter(Boolean) : []);
    return {
      cat: p.get('cat') || '',
      brands: brands,
      q: p.get('q') || '',
      filter: p.get('filter') || '',
      sort: p.get('sort') || 'newest',
      min: p.get('min') || '',
      max: p.get('max') || '',
      inStock: p.get('stock') === '1',
      view: p.get('view') === 'list' ? 'list' : 'grid',
      page: parseInt(p.get('page') || '1', 10) || 1
    };
  }

  function writeURL(state) {
    const p = new URLSearchParams();
    Object.keys(state).forEach(function (k) {
      if (k === 'brands') {
        (state.brands || []).forEach(function (b) { p.append('brand', b); });
        return;
      }
      if (state[k] === '' || state[k] === false || (k === 'page' && state[k] === 1) ||
          (k === 'sort' && state[k] === 'newest') || (k === 'view' && state[k] === 'grid')) return;
      p.set(k, state[k] === true ? '1' : String(state[k]));
    });
    const qs = p.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  }

  function filtered(state) {
    let list = allProducts.slice();

    if (state.cat) list = list.filter(function (p) { return p.category === state.cat; });
    if (state.brands && state.brands.length) {
      list = list.filter(function (p) {
        return state.brands.some(function (b) {
          return p.brandId === b || NexoraSearch.normalize(p.brand) === NexoraSearch.normalize(b);
        });
      });
    }
    if (state.filter === 'new') list = list.filter(function (p) { return p.isNew; });
    if (state.filter === 'sale') list = list.filter(function (p) { return p.oldPrice && p.oldPrice > p.price; });
    if (state.inStock) list = list.filter(function (p) { return NexoraApp.isInStock(p); });
    if (state.min) list = list.filter(function (p) { return p.price >= Number(state.min); });
    if (state.max) list = list.filter(function (p) { return p.price <= Number(state.max); });
    if (state.q) {
      list = list.filter(function (p) { return NexoraSearch.scoreProduct(p, state.q) > 0; });
    }

    switch (state.sort) {
      case 'price-asc': list.sort(function (a, b) { return a.price - b.price; }); break;
      case 'price-desc': list.sort(function (a, b) { return b.price - a.price; }); break;
      case 'rating': list.sort(function (a, b) { return b.rating - a.rating; }); break;
      case 'popular': list.sort(function (a, b) {
        return (b.reviews || 0) * (b.rating || 0) - (a.reviews || 0) * (a.rating || 0);
      }); break;
      case 'name': list.sort(function (a, b) { return a.name.localeCompare(b.name, 'az'); }); break;
      default: list.sort(function (a, b) { return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0); });
    }
    return list;
  }

  function renderFilters(state) {
    const catEl = document.getElementById('filterCategories');
    const brandEl = document.getElementById('filterBrands');
    if (catEl) {
      catEl.innerHTML = '<label class="form-check"><input type="radio" name="cat" value="" ' + (!state.cat ? 'checked' : '') + '> <span>Hamısı</span></label>' +
        categories.map(function (c) {
          return '<label class="form-check"><input type="radio" name="cat" value="' + c.id + '" ' +
            (state.cat === c.id ? 'checked' : '') + '> <span>' +
            (typeof NexoraI18n !== 'undefined' ? NexoraI18n.categoryName(c.id, c.name) : c.name) +
            '</span></label>';
        }).join('');
    }
    if (brandEl) {
      const selected = state.brands || [];
      brandEl.innerHTML = brands.map(function (b) {
        return '<label class="form-check"><input type="checkbox" name="brand" value="' + b.id + '" ' +
          (selected.indexOf(b.id) !== -1 ? 'checked' : '') + '> <span>' + b.name + '</span></label>';
      }).join('');
    }

    const min = document.getElementById('filterMin');
    const max = document.getElementById('filterMax');
    const stock = document.getElementById('filterStock');
    const sort = document.getElementById('filterSort');
    if (min) min.value = state.min;
    if (max) max.value = state.max;
    if (stock) stock.checked = state.inStock;
    if (sort) sort.value = state.sort;

    document.querySelectorAll('[data-view-mode]').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-view-mode') === (state.view || 'grid'));
    });
  }

  function renderGrid(list, state) {
    const grid = document.getElementById('productsGrid');
    const meta = document.getElementById('productsMeta');
    const pager = document.getElementById('productsPager');
    if (!grid) return;

    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(Math.max(1, state.page), pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const view = state.view === 'list' ? 'list' : 'grid';

    grid.classList.toggle('product-grid--list', view === 'list');
    if (meta) {
      meta.removeAttribute('data-i18n');
      meta.textContent = total + ' ' + (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('products_count') : 'məhsul');
    }

    if (!slice.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><p>' +
        (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('no_results') : 'Məhsul tapılmadı') + '</p></div>';
    } else {
      grid.innerHTML = slice.map(function (p) { return NexoraApp.productCardHTML(p); }).join('');
      NexoraApp.bindProductActions(grid);
    }

    if (pager) {
      let html = '<button type="button" class="pagination-btn" data-page="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>' +
        '<span class="icon icon-sm" data-icon="chevronLeft"></span></button>';
      for (let i = 1; i <= pages; i++) {
        html += '<button type="button" class="pagination-btn' + (i === page ? ' is-active' : '') + '" data-page="' + i + '">' + i + '</button>';
      }
      html += '<button type="button" class="pagination-btn" data-page="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>' +
        '<span class="icon icon-sm" data-icon="chevronRight"></span></button>';
      pager.innerHTML = html;
      pager.querySelectorAll('[data-page]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          apply(Object.assign(readForm(), { page: parseInt(btn.getAttribute('data-page'), 10) }));
        });
      });
    }

    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
  }

  function readForm() {
    const cat = (document.querySelector('input[name="cat"]:checked') || {}).value || '';
    const brandChecked = Array.prototype.map.call(
      document.querySelectorAll('input[name="brand"]:checked'),
      function (el) { return el.value; }
    );
    const activeView = document.querySelector('[data-view-mode].is-active');
    return {
      cat: cat,
      brands: brandChecked,
      q: NexoraApp.getQueryParam('q') || '',
      filter: NexoraApp.getQueryParam('filter') || '',
      sort: (document.getElementById('filterSort') || {}).value || 'newest',
      min: (document.getElementById('filterMin') || {}).value || '',
      max: (document.getElementById('filterMax') || {}).value || '',
      inStock: !!(document.getElementById('filterStock') || {}).checked,
      view: activeView ? activeView.getAttribute('data-view-mode') : 'grid',
      page: 1
    };
  }

  function apply(state) {
    writeURL(state);
    renderFilters(state);
    renderGrid(filtered(state), state);
  }

  async function init() {
    if (!document.getElementById('productsGrid')) return;
    var loaded = await Promise.all([
      NexoraApp.loadProducts(),
      NexoraApp.loadCategories(),
      NexoraApp.loadBrands()
    ]);
    allProducts = loaded[0];
    categories = loaded[1];
    brands = loaded[2];

    const state = stateFromURL();
    renderFilters(state);
    renderGrid(filtered(state), state);

    const form = document.getElementById('filtersForm');
    if (form) {
      form.addEventListener('change', function () { apply(readForm()); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        apply(readForm());
      });
    }
    const sortEl = document.getElementById('filterSort');
    if (sortEl) {
      sortEl.addEventListener('change', function () { apply(readForm()); });
    }
    const reset = document.getElementById('filtersReset');
    if (reset) {
      reset.addEventListener('click', function () {
        apply({ cat: '', brands: [], q: '', filter: '', sort: 'newest', min: '', max: '', inStock: false, view: 'grid', page: 1 });
      });
    }

    document.querySelectorAll('[data-view-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const next = Object.assign(readForm(), {
          view: btn.getAttribute('data-view-mode'),
          page: stateFromURL().page || 1
        });
        apply(next);
      });
    });

    function setFiltersOpen(open) {
      const sheet = document.getElementById('catalogFilters');
      const backdrop = document.querySelector('.filters-backdrop');
      if (sheet) sheet.classList.toggle('is-open', open);
      if (backdrop) {
        backdrop.hidden = !open;
        backdrop.classList.toggle('is-open', open);
      }
      document.body.classList.toggle('filters-open', open);
    }

    document.querySelectorAll('[data-filters-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { setFiltersOpen(true); });
    });
    document.querySelectorAll('[data-filters-close]').forEach(function (el) {
      el.addEventListener('click', function () { setFiltersOpen(false); });
    });
    if (form) {
      form.addEventListener('submit', function () { setFiltersOpen(false); });
      form.addEventListener('change', function () {
        if (window.matchMedia('(max-width: 768px)').matches) {
          /* keep sheet open while tweaking; close on submit/reset */
        }
      });
    }
    if (reset) {
      reset.addEventListener('click', function () {
        setTimeout(function () { setFiltersOpen(false); }, 0);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('nexora:lang-change', function () {
    if (!document.getElementById('productsGrid')) return;
    if (typeof NexoraI18n !== 'undefined') NexoraI18n.apply(document);
    init();
  });
})();
