/**
 * NEXORA Cart — localStorage cart + totals
 */
const NexoraCart = (function () {
  'use strict';

  const KEY = 'nexora-cart';
  const COUPON_KEY = 'nexora-cart-coupon';
  const SHIPPING_FLAT = 5;
  const FREE_SHIPPING_MIN = 100;
  const TAX_RATE = 0.18;

  function getItems() {
    return NexoraApp.storageGet(KEY, []);
  }

  function save(items) {
    NexoraApp.storageSet(KEY, items);
    NexoraApp.updateBadges();
    window.dispatchEvent(new CustomEvent('nexora:cart-change'));
  }

  function count() {
    return getItems().reduce(function (sum, i) { return sum + (i.qty || 0); }, 0);
  }

  function variantKey(variant) {
    if (!variant || typeof variant !== 'object') return '';
    return Object.keys(variant).sort().map(function (k) {
      return k + '=' + variant[k];
    }).join('|');
  }

  function tt(key, fallback) {
    return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(key) : (fallback || key);
  }

  async function add(productId, qty, variant) {
    qty = qty || 1;
    const products = await NexoraApp.loadProducts();
    const product = products.find(function (p) { return p.id === productId; });
    if (!product) throw new Error(tt('product_not_found', 'Məhsul tapılmadı'));
    if (typeof NexoraApp.isInStock === 'function' ? !NexoraApp.isInStock(product) : !product.inStock) {
      throw new Error(tt('sold_out', 'Stokda yoxdur'));
    }

    const vKey = variantKey(variant);
    const items = getItems();
    const existing = items.find(function (i) {
      return i.id === productId && variantKey(i.variant) === vKey;
    });
    if (existing) {
      existing.qty = Math.min((existing.qty || 1) + qty, product.stock || 99);
    } else {
      items.push({ id: productId, qty: qty, variant: variant || null });
    }
    save(items);
    if (typeof NexoraApi !== 'undefined' && NexoraApi.trackAnalytics) {
      NexoraApi.trackAnalytics({ type: 'cart', productId: productId, qty: qty });
    }
    if (typeof NexoraApp !== 'undefined') {
      const cartStats = NexoraApp.storageGet('nexora-cart-stats', {});
      cartStats[productId] = (cartStats[productId] || 0) + qty;
      NexoraApp.storageSet('nexora-cart-stats', cartStats);
    }
    return items;
  }

  function remove(productId, variant) {
    const vKey = typeof variant === 'string' ? variant : variantKey(variant);
    save(getItems().filter(function (i) {
      if (i.id !== productId) return true;
      // If no variant specified, remove all lines for this product
      if (variant === undefined || variant === null) return false;
      return variantKey(i.variant) !== vKey;
    }));
  }

  function setQty(productId, qty, variant) {
    const items = getItems();
    const vKey = typeof variant === 'string' ? variant : variantKey(variant);
    const item = items.find(function (i) {
      if (i.id !== productId) return false;
      if (variant === undefined || variant === null) return true;
      return variantKey(i.variant) === vKey;
    });
    if (!item) return;
    if (qty <= 0) {
      remove(productId, item.variant);
      return;
    }
    item.qty = qty;
    save(items);
  }

  function clear() {
    save([]);
    localStorage.removeItem(COUPON_KEY);
  }

  function getCoupon() {
    return NexoraApp.storageGet(COUPON_KEY, null);
  }

  function setCoupon(coupon) {
    if (coupon) NexoraApp.storageSet(COUPON_KEY, coupon);
    else localStorage.removeItem(COUPON_KEY);
  }

  async function applyCoupon(code) {
    const data = await NexoraApp.fetchJSON('data/coupons.json');
    const coupon = (data.coupons || []).find(function (c) {
      return c.code.toUpperCase() === String(code || '').toUpperCase();
    });
    if (!coupon) throw new Error(tt('coupon_not_found', 'Kupon tapılmadı'));
    const totals = await getTotals();
    if (totals.subtotal < (coupon.minOrder || 0)) {
      throw new Error(tt('coupon_min_order', 'Minimum sifariş') + ': ' + NexoraApp.formatPrice(coupon.minOrder));
    }
    setCoupon(coupon);
    return coupon;
  }

  async function getDetailedItems() {
    const products = await NexoraApp.loadProducts();
    return getItems().map(function (item) {
      const product = products.find(function (p) { return p.id === item.id; });
      if (!product) return null;
      const vLabel = item.variant
        ? Object.keys(item.variant).map(function (k) { return item.variant[k]; }).join(' / ')
        : '';
      const price = (item.variant && item.variant.priceOverride) ? Number(item.variant.priceOverride) : product.price;
      const cfg = item.variant && item.variant.config ? String(item.variant.config) : '';
      return Object.assign({}, product, {
        qty: item.qty,
        price: price,
        variant: item.variant || null,
        variantLabel: vLabel || cfg,
        displayName: product.name + (cfg ? ' [' + cfg + ']' : (vLabel ? ' (' + vLabel + ')' : ''))
      });
    }).filter(Boolean);
  }

  async function getTotals() {
    const items = await getDetailedItems();
    const subtotal = items.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    const coupon = getCoupon();
    let discount = 0;
    let freeShipping = false;

    if (coupon) {
      if (coupon.type === 'percent') discount = subtotal * (coupon.value / 100);
      else if (coupon.type === 'fixed') discount = coupon.value;
      else if (coupon.type === 'shipping') freeShipping = true;
    }

    discount = Math.min(discount, subtotal);
    const taxable = Math.max(0, subtotal - discount);
    const tax = Math.round(taxable * TAX_RATE * 100) / 100;
    const shipping = (freeShipping || subtotal >= FREE_SHIPPING_MIN) ? 0 : (subtotal > 0 ? SHIPPING_FLAT : 0);
    const total = taxable + tax + shipping;

    return {
      items,
      subtotal,
      discount,
      tax,
      shipping,
      total,
      coupon,
      freeShippingMin: FREE_SHIPPING_MIN
    };
  }

  /* ---------- Share cart as link ---------- */

  function toBase64Url(str) {
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(str) {
    var b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return decodeURIComponent(escape(atob(b64)));
  }

  function encodeSharePayload(items) {
    var compact = (items || []).slice(0, 40).map(function (item) {
      var row = { i: item.id, q: Math.max(1, parseInt(item.qty, 10) || 1) };
      if (item.variant && typeof item.variant === 'object' && Object.keys(item.variant).length) {
        row.v = item.variant;
      }
      return row;
    });
    return toBase64Url(JSON.stringify({ v: 1, items: compact }));
  }

  function decodeSharePayload(token) {
    try {
      var data = JSON.parse(fromBase64Url(token));
      if (!data || !Array.isArray(data.items)) return null;
      return data.items.map(function (row) {
        if (!row || !row.i) return null;
        return {
          id: String(row.i),
          qty: Math.max(1, Math.min(99, parseInt(row.q, 10) || 1)),
          variant: row.v && typeof row.v === 'object' ? row.v : null
        };
      }).filter(Boolean);
    } catch (e) {
      return null;
    }
  }

  function createShareLink(items) {
    var list = items || getItems();
    if (!list.length) return '';
    var token = encodeSharePayload(list);
    var base = '';
    try {
      base = NexoraApp.pageUrl('cart.html');
      if (base.indexOf('http') !== 0 && typeof location !== 'undefined') {
        base = location.origin + (base.charAt(0) === '/' ? base : ('/' + base.replace(/^\.\.\//, '')));
        // Prefer absolute from current cart page
        if (location.pathname.indexOf('/pages/') !== -1) {
          base = location.origin + location.pathname.replace(/[^/]+$/, 'cart.html');
        }
      }
    } catch (e) {
      base = (typeof location !== 'undefined' ? location.origin : '') + '/pages/cart.html';
    }
    return base.split('?')[0].split('#')[0] + '?share=' + encodeURIComponent(token);
  }

  async function previewShared(token) {
    var shared = decodeSharePayload(token);
    if (!shared || !shared.length) {
      var err = new Error(tt('share_cart_invalid', 'Paylaşım linki etibarsızdır'));
      throw err;
    }
    var products = await NexoraApp.loadProducts();
    var lines = [];
    var missing = 0;
    shared.forEach(function (item) {
      var product = products.find(function (p) { return p.id === item.id; });
      if (!product) {
        missing += 1;
        return;
      }
      var vLabel = item.variant
        ? Object.keys(item.variant).map(function (k) {
          if (k === 'priceOverride' || k === 'config') return '';
          return item.variant[k];
        }).filter(Boolean).join(' / ')
        : '';
      var cfg = item.variant && item.variant.config ? String(item.variant.config) : '';
      lines.push({
        id: item.id,
        qty: item.qty,
        variant: item.variant,
        name: product.name,
        displayName: product.name + (cfg ? ' [' + cfg + ']' : (vLabel ? ' (' + vLabel + ')' : '')),
        brand: product.brand,
        price: (item.variant && item.variant.priceOverride) ? Number(item.variant.priceOverride) : product.price,
        image: typeof NexoraApp.productImage === 'function' ? NexoraApp.productImage(product) : product.image,
        inStock: typeof NexoraApp.isInStock === 'function' ? NexoraApp.isInStock(product) : product.inStock
      });
    });
    if (!lines.length) {
      throw new Error(tt('share_cart_empty_result', 'Linkdəki məhsullar tapılmadı'));
    }
    return { items: lines, missing: missing, raw: shared };
  }

  function importShared(sharedItems, mode) {
    mode = mode === 'merge' ? 'merge' : 'replace';
    var incoming = (sharedItems || []).map(function (item) {
      return {
        id: item.id,
        qty: Math.max(1, parseInt(item.qty, 10) || 1),
        variant: item.variant || null
      };
    });
    if (!incoming.length) return getItems();

    if (mode === 'replace') {
      save(incoming);
      return incoming;
    }

    var items = getItems().slice();
    incoming.forEach(function (inc) {
      var vKey = variantKey(inc.variant);
      var existing = items.find(function (i) {
        return i.id === inc.id && variantKey(i.variant) === vKey;
      });
      if (existing) {
        existing.qty = Math.min(99, (existing.qty || 1) + inc.qty);
      } else {
        items.push(inc);
      }
    });
    save(items);
    return items;
  }

  return {
    getItems,
    count,
    add,
    remove,
    setQty,
    clear,
    getCoupon,
    setCoupon,
    applyCoupon,
    getDetailedItems,
    getTotals,
    encodeSharePayload,
    decodeSharePayload,
    createShareLink,
    previewShared,
    importShared,
    SHIPPING_FLAT,
    FREE_SHIPPING_MIN,
    TAX_RATE
  };
})();
