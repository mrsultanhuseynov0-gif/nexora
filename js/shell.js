/**
 * NEXORA Shell — settings-driven header/footer + i18n chrome
 */
const NexoraShell = (function () {
  'use strict';

  let site = null;

  function t(key) {
    return typeof NexoraI18n !== 'undefined' ? NexoraI18n.t(key) : key;
  }

  function logoHTML(href) {
    const name = (site && (site.logoText || site.brandName)) || 'NEXORA';
    if (site && site.logoImage) {
      return '<a href="' + href + '" class="site-logo site-logo-img"><img src="' +
        NexoraApp.resolveMediaUrl(site.logoImage) + '" alt="' + name.replace(/"/g, '&quot;') +
        '" style="height:28px;width:auto;display:block"></a>';
    }
    return '<a href="' + href + '" class="site-logo">' + name + '</a>';
  }

  function navItems() {
    const b = NexoraApp.getBasePath();
    let items = (site && site.nav && site.nav.length)
      ? site.nav.filter(function (n) { return n.visible !== false; }).slice()
      : [
          { id: 'home', label: 'Ana səhifə', href: 'index.html' },
          { id: 'products', label: 'Məhsullar', href: 'pages/products.html' },
          { id: 'categories', label: 'Kateqoriyalar', href: 'pages/categories.html' },
          { id: 'campaigns', label: 'Kampaniyalar', href: 'pages/campaigns.html' },
          { id: 'lookbook', label: 'Lookbook', href: 'pages/lookbook.html' },
          { id: 'consultant', label: 'AI Məsləhətçi', href: 'pages/consultant.html' },
          { id: 'office_builder', label: 'Office Builder', href: 'pages/office-builder.html' },
          { id: 'offer_generator', label: 'PDF Offer', href: 'pages/offer-generator.html' },
          { id: 'compare', label: 'Müqayisə', href: 'pages/compare.html' },
          { id: 'brands', label: 'Brendlər', href: 'pages/brands.html' },
          { id: 'news', label: 'Xəbərlər', href: 'pages/news.html' },
          { id: 'about', label: 'Haqqımızda', href: 'pages/about.html' },
          { id: 'contact', label: 'Əlaqə', href: 'pages/contact.html' },
          { id: 'faq', label: 'FAQ', href: 'pages/faq.html' },
          { id: 'track', label: 'Sifariş izlə', href: 'pages/track.html' }
        ];
    // Staff/Business panels stay off the public nav on purpose
    items = items.filter(function (n) {
      return n.id !== 'business' && n.id !== 'admin';
    });
    return items.map(function (n) {
      const label = typeof NexoraI18n !== 'undefined' ? NexoraI18n.navLabel(n.id, n.label) : n.label;
      return { id: n.id, label: label, href: NexoraApp.url(n.href || 'index.html') };
    });
  }

  function langSwitcherHTML() {
    const lang = typeof NexoraI18n !== 'undefined' ? NexoraI18n.getLang() : 'az';
    return (
      '<select class="input lang-switch" data-lang-switch aria-label="' + t('lang') + '" style="width:auto;min-width:64px;padding:4px 8px;font-size:12px">' +
        '<option value="az"' + (lang === 'az' ? ' selected' : '') + '>AZ</option>' +
        '<option value="ru"' + (lang === 'ru' ? ' selected' : '') + '>RU</option>' +
        '<option value="en"' + (lang === 'en' ? ' selected' : '') + '>EN</option>' +
      '</select>'
    );
  }

  var PRIMARY_NAV_IDS = {
    home: 1, products: 1, categories: 1, campaigns: 1,
    consultant: 1, office_builder: 1, offer_generator: 1
  };

  function headerHTML() {
    const b = NexoraApp.getBasePath();
    const nav = navItems();
    const primary = [];
    const more = [];
    nav.forEach(function (n) {
      if (PRIMARY_NAV_IDS[n.id]) primary.push(n);
      else more.push(n);
    });
    return (
      '<div class="promo-bar" id="promoBar" hidden></div>' +
      '<header class="site-header">' +
        '<div class="container header-top">' +
          '<button type="button" class="nav-toggle" data-nav-toggle aria-label="' + t('menu') + '">' +
            '<span class="icon icon-md" data-icon="menu"></span>' +
          '</button>' +
          logoHTML(b + 'index.html') +
          '<div class="header-search" data-header-search>' +
            '<form class="form-search" action="' + b + 'pages/search.html" method="get" role="search">' +
              '<span class="form-search-icon icon icon-sm" data-icon="search" aria-hidden="true"></span>' +
              '<input type="search" name="q" class="input" placeholder="' + t('search_ph') + '" autocomplete="off" enterkeyhint="search" data-live-search>' +
              '<button type="submit" class="btn btn-primary btn-sm">' + t('search_btn') + '</button>' +
            '</form>' +
            '<div class="header-search-results" data-search-results></div>' +
          '</div>' +
          '<div class="header-actions">' +
            '<span class="header-desktop-only">' + langSwitcherHTML() + '</span>' +
            '<button type="button" class="header-action" data-mobile-search-toggle aria-label="' + t('search_btn') + '">' +
              '<span class="icon icon-md" data-icon="search"></span>' +
            '</button>' +
            '<a href="' + b + 'pages/wishlist.html" class="header-action header-desktop-only" aria-label="' + t('wishlist') + '">' +
              '<span class="icon icon-md" data-icon="heart"></span>' +
              '<span class="header-badge" data-wishlist-badge data-count="0"></span>' +
            '</a>' +
            '<a href="' + b + 'pages/cart.html" class="header-action header-desktop-only" aria-label="' + t('cart') + '">' +
              '<span class="icon icon-md" data-icon="cart"></span>' +
              '<span class="header-badge" data-cart-badge data-count="0"></span>' +
            '</a>' +
            '<a href="' + b + 'pages/account.html" class="header-action header-desktop-only" aria-label="' + t('account') + '">' +
              '<span class="icon icon-md" data-icon="user"></span>' +
            '</a>' +
            '<button type="button" class="header-action header-desktop-only" data-theme-toggle aria-label="' + t('theme') + '">' +
              '<span class="icon icon-md" data-icon="moon"></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<nav class="site-nav" aria-label="Əsas naviqasiya">' +
          '<div class="container site-nav-inner">' +
            primary.map(function (n) {
              return '<a class="nav-link" href="' + n.href + '" data-nav="' + n.id + '">' + n.label + '</a>';
            }).join('') +
            (more.length
              ? '<div class="nav-more" data-nav-more>' +
                  '<button type="button" class="nav-link nav-more-btn" data-nav-more-toggle aria-expanded="false">' +
                    (typeof NexoraI18n !== 'undefined' ? NexoraI18n.t('more') : 'Daha çox') +
                    ' <span aria-hidden="true">▾</span></button>' +
                  '<div class="nav-more-menu" hidden>' +
                    more.map(function (n) {
                      return '<a class="nav-more-link" href="' + n.href + '" data-nav="' + n.id + '">' + n.label + '</a>';
                    }).join('') +
                  '</div></div>'
              : '') +
          '</div>' +
        '</nav>' +
      '</header>' +
      '<div class="mobile-nav" data-mobile-nav>' +
        '<div class="mobile-nav-backdrop" data-nav-close></div>' +
        '<div class="mobile-nav-panel">' +
          '<div class="flex justify-between items-center mb-6">' +
            '<span class="site-logo">' + ((site && site.logoText) || 'NEXORA') + '</span>' +
            '<button type="button" class="icon-btn" data-nav-close aria-label="Bağla">' +
              '<span class="icon icon-md" data-icon="close"></span>' +
            '</button>' +
          '</div>' +
          '<p class="text-sm text-muted mb-4">' + ((site && site.tagline) || t('shop')) + '</p>' +
          '<div class="mobile-nav-tools mb-4">' +
            langSwitcherHTML() +
            '<button type="button" class="btn btn-outline btn-sm" data-theme-toggle aria-label="' + t('theme') + '">' +
              '<span class="icon icon-sm" data-icon="moon"></span>' +
            '</button>' +
          '</div>' +
          nav.map(function (n) {
            return '<a class="mobile-nav-link" href="' + n.href + '">' + n.label + '</a>';
          }).join('') +
          '<a class="mobile-nav-link" href="' + b + 'pages/wishlist.html">' + t('wishlist') + '</a>' +
          '<a class="mobile-nav-link" href="' + b + 'pages/cart.html">' + t('cart') + '</a>' +
          '<a class="mobile-nav-link" href="' + b + 'pages/account.html">' + t('account') + '</a>' +
        '</div>' +
      '</div>'
    );
  }

  function tabbarHTML() {
    const b = NexoraApp.getBasePath();
    return (
      '<nav class="mobile-tabbar" aria-label="Mobil naviqasiya">' +
        '<a class="mobile-tab" href="' + b + 'index.html" data-tab="home">' +
          '<span class="icon icon-sm" data-icon="home"></span><span>' + shortLabel(t('home')) + '</span></a>' +
        '<a class="mobile-tab" href="' + b + 'pages/products.html" data-tab="shop">' +
          '<span class="icon icon-sm" data-icon="grid"></span><span>' + t('shop') + '</span></a>' +
        '<a class="mobile-tab" href="' + b + 'pages/cart.html" data-tab="cart">' +
          '<span class="icon icon-sm" data-icon="cart"></span><span>' + t('cart') + '</span>' +
          '<span class="mobile-tab-badge" data-cart-badge data-count="0"></span></a>' +
        '<a class="mobile-tab" href="' + b + 'pages/wishlist.html" data-tab="wish">' +
          '<span class="icon icon-sm" data-icon="heart"></span><span>' + shortLabel(t('wishlist')) + '</span>' +
          '<span class="mobile-tab-badge" data-wishlist-badge data-count="0"></span></a>' +
        '<a class="mobile-tab" href="' + b + 'pages/account.html" data-tab="account">' +
          '<span class="icon icon-sm" data-icon="user"></span><span>' + t('account') + '</span></a>' +
      '</nav>'
    );
  }

  function shortLabel(text) {
    if (!text) return '';
    const first = text.split(/[\s/]/)[0];
    return first.length > 10 ? first.slice(0, 9) : first;
  }

  function markActiveTab() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    let key = 'home';
    if (path.includes('cart')) key = 'cart';
    else if (path.includes('wishlist')) key = 'wish';
    else if (path.includes('account')) key = 'account';
    else if (
      path.includes('product') || path.includes('categor') ||
      path.includes('search') || path.includes('brand') || path.includes('campaign') ||
      path.includes('lookbook') || path.includes('compare') || path.includes('consultant') ||
      path.includes('office-builder') || path.includes('offer-generator')
    ) key = 'shop';
    document.querySelectorAll('[data-tab]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-tab') === key);
    });
  }

  function footerHTML() {
    const b = NexoraApp.getBasePath();
    const year = new Date().getFullYear();
    const brand = (site && (site.logoText || site.brandName)) || 'NEXORA';
    const lang = typeof NexoraI18n !== 'undefined' ? NexoraI18n.getLang() : 'az';
    const desc = (lang === 'az' && site && site.footer && site.footer.desc)
      ? site.footer.desc
      : t('footer_desc');
    const fb = (site && site.footer && site.footer.facebook) || 'https://facebook.com';
    const ig = (site && site.footer && site.footer.instagram) || 'https://instagram.com';
    const yt = (site && site.footer && site.footer.youtube) || 'https://youtube.com';
    return (
      '<footer class="site-footer">' +
        '<div class="container">' +
          '<div class="footer-main">' +
            '<div>' +
              '<a href="' + b + 'index.html" class="footer-brand">' + brand + '</a>' +
              '<p class="footer-desc">' + desc + '</p>' +
              '<div class="footer-social">' +
                '<a href="' + fb + '" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><span class="icon icon-sm" data-icon="facebook"></span></a>' +
                '<a href="' + ig + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><span class="icon icon-sm" data-icon="instagram"></span></a>' +
                '<a href="' + yt + '" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><span class="icon icon-sm" data-icon="youtube"></span></a>' +
              '</div></div>' +
            '<div><h4 class="footer-title">' + t('shop') + '</h4><ul class="footer-links">' +
              '<li><a href="' + b + 'pages/products.html">' + t('products') + '</a></li>' +
              '<li><a href="' + b + 'pages/categories.html">' + t('categories') + '</a></li>' +
              '<li><a href="' + b + 'pages/lookbook.html">' + t('lookbook') + '</a></li>' +
              '<li><a href="' + b + 'pages/campaigns.html">' + t('campaigns') + '</a></li>' +
              '<li><a href="' + b + 'pages/news.html">' + t('news') + '</a></li>' +
            '</ul></div>' +
            '<div><h4 class="footer-title">' + t('support') + '</h4><ul class="footer-links">' +
              '<li><a href="' + b + 'pages/faq.html">' + t('faq') + '</a></li>' +
              '<li><a href="' + b + 'pages/contact.html">' + t('contact') + '</a></li>' +
              '<li><a href="' + b + 'pages/track.html">' + t('track') + '</a></li>' +
              '<li><a href="' + b + 'pages/cart.html">' + t('cart') + '</a></li>' +
            '</ul></div>' +
            '<div><h4 class="footer-title">' + t('company') + '</h4><ul class="footer-links">' +
              '<li><a href="' + b + 'pages/about.html">' + t('about') + '</a></li>' +
              '<li><a href="' + b + 'pages/contact.html">' + t('contact') + '</a></li>' +
            '</ul></div>' +
          '</div>' +
          '<div class="footer-bottom">' +
            '<span class="footer-copy" data-staff-entry title="">© ' + year + ' ' + brand + '</span>' +
            '<span>' + t('footer_tag') + '</span>' +
          '</div></div></footer>'
    );
  }

  function openStaffPortal() {
    const b = NexoraApp.getBasePath();
    let modal = document.getElementById('nexoraStaffPortal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'nexoraStaffPortal';
      modal.className = 'modal';
      document.body.appendChild(modal);
    }
    modal.innerHTML =
      '<div class="modal-dialog" style="max-width:420px">' +
        '<div class="modal-header"><h2 class="modal-title">Staff</h2>' +
          '<button type="button" class="modal-close" data-modal-close aria-label="Bağla">' +
            '<span class="icon icon-md" data-icon="close"></span></button></div>' +
        '<div class="modal-body">' +
          '<p class="text-sm text-muted mb-4">Daxili giriş — adi müştərilər üçün deyil.</p>' +
          '<div class="flex flex-col gap-2">' +
            '<a class="btn btn-primary w-full" href="' + b + 'pages/admin/index.html">Admin CMS</a>' +
            '<a class="btn btn-outline w-full" href="' + b + 'pages/business.html">Business Panel</a>' +
          '</div>' +
        '</div></div>';
    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
    if (typeof NexoraModal !== 'undefined') NexoraModal.open(modal);
    else modal.hidden = false;
  }

  function bindStaffEntry() {
    const el = document.querySelector('[data-staff-entry]');
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    let taps = 0;
    let timer = null;
    el.style.cursor = 'default';
    el.addEventListener('click', function (e) {
      e.preventDefault();
      taps += 1;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { taps = 0; }, 2500);
      if (taps >= 7) {
        taps = 0;
        openStaffPortal();
      }
    });
    // Keyboard: Alt + Shift + S
    document.addEventListener('keydown', function (e) {
      if (e.altKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        openStaffPortal();
      }
    });
  }

  function markActiveNav() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    let key = 'home';
    if (path.includes('products') || path.includes('product.html')) key = 'products';
    else if (path.includes('categories')) key = 'categories';
    else if (path.includes('lookbook')) key = 'lookbook';
    else if (path.includes('campaigns')) key = 'campaigns';
    else if (path.includes('brands')) key = 'brands';
    else if (path.includes('news')) key = 'news';
    else if (path.includes('about')) key = 'about';
    else if (path.includes('contact')) key = 'contact';
    else if (path.includes('faq')) key = 'faq';
    else if (path.includes('track')) key = 'track';
    else if (path.includes('office-builder')) key = 'office_builder';
    else if (path.includes('offer-generator')) key = 'offer_generator';
    else if (path.includes('consultant')) key = 'consultant';
    else if (path.includes('business')) key = 'business';
    else if (path.includes('search')) key = 'products';
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-nav') === key);
    });
  }

  async function loadPromo() {
    const bar = document.getElementById('promoBar');
    if (!bar) return;
    if (site && site.promoBar && site.promoBar.enabled && site.promoBar.text) {
      bar.hidden = false;
      bar.innerHTML = site.promoBar.text +
        (site.promoBar.linkText
          ? ' <a href="' + NexoraApp.url(site.promoBar.link || 'pages/campaigns.html') + '">' + site.promoBar.linkText + '</a>'
          : '');
      return;
    }
    try {
      const data = await NexoraApp.loadCampaigns();
      if (!data.promoBar) return;
      bar.hidden = false;
      bar.innerHTML = data.promoBar.text +
        ' <a href="' + NexoraApp.url(data.promoBar.link) + '">' + data.promoBar.linkText + '</a>';
    } catch (e) { /* optional */ }
  }

  function setMobileNavOpen(open) {
    const mobile = document.querySelector('[data-mobile-nav]');
    if (!mobile) return;
    mobile.classList.toggle('is-open', open);
    document.body.classList.toggle('mobile-nav-open', open);
  }

  function bindNav() {
    document.querySelectorAll('[data-nav-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () { setMobileNavOpen(true); });
    });
    document.querySelectorAll('[data-nav-close]').forEach(function (el) {
      el.addEventListener('click', function () { setMobileNavOpen(false); });
    });
    document.querySelectorAll('.mobile-nav-link').forEach(function (link) {
      link.addEventListener('click', function () { setMobileNavOpen(false); });
    });
    const searchBox = document.querySelector('[data-header-search]');
    document.querySelectorAll('[data-mobile-search-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!searchBox) return;
        const open = !searchBox.classList.contains('is-mobile-visible');
        searchBox.classList.toggle('is-mobile-visible', open);
        setMobileNavOpen(false);
        if (open) {
          const input = searchBox.querySelector('[data-live-search]');
          if (input) setTimeout(function () { input.focus(); }, 50);
        }
      });
    });
    document.querySelectorAll('[data-nav-more-toggle]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest('[data-nav-more]');
        if (!wrap) return;
        const menu = wrap.querySelector('.nav-more-menu');
        const open = menu && menu.hasAttribute('hidden');
        document.querySelectorAll('.nav-more-menu').forEach(function (m) { m.setAttribute('hidden', ''); });
        document.querySelectorAll('[data-nav-more-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
        if (open && menu) {
          menu.removeAttribute('hidden');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-nav-more]')) return;
      document.querySelectorAll('.nav-more-menu').forEach(function (m) { m.setAttribute('hidden', ''); });
      document.querySelectorAll('[data-nav-more-toggle]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
    });
    document.querySelectorAll('[data-lang-switch]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        if (typeof NexoraI18n !== 'undefined') {
          NexoraI18n.setLang(sel.value);
          mount().then(function () {
            NexoraI18n.apply(document);
          });
        }
      });
    });
  }

  function bindLiveSearch() {
    const input = document.querySelector('[data-live-search]');
    const results = document.querySelector('[data-search-results]');
    if (!input || !results || typeof NexoraSearch === 'undefined') return;

    const run = NexoraApp.debounce(async function () {
      const q = input.value.trim();
      if (q.length < 2) {
        results.classList.remove('is-open');
        results.innerHTML = '';
        return;
      }
      const detailed = typeof NexoraSearch.searchDetailed === 'function'
        ? await NexoraSearch.searchDetailed(q, 6)
        : { products: await NexoraSearch.search(q, 6), didYouMean: null };
      const hits = detailed.products || [];
      if (!hits.length) {
        results.innerHTML =
          '<div class="p-4 text-sm text-muted">' + t('no_results') +
          (detailed.didYouMean
            ? '<div class="mt-2">' + t('did_you_mean') + ' <a href="' +
              NexoraApp.pageUrl('search.html?q=' + encodeURIComponent(detailed.didYouMean)) + '"><strong>' +
              detailed.didYouMean + '</strong></a></div>'
            : '') +
          '</div>';
        results.classList.add('is-open');
        return;
      }
      const fb = 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=200&h=200&q=80';
      const dym = detailed.didYouMean
        ? '<div class="search-result-dym">🎯 ' + t('did_you_mean') + ' <strong>' + detailed.didYouMean + '</strong>' +
          ' <span class="text-muted">(' + q + ')</span></div>'
        : '';
      results.innerHTML = dym + hits.map(function (p) {
        const thumb = NexoraApp.productImage(p) || fb;
        return '<a class="search-result-item" href="' + NexoraApp.pageUrl('product.html?id=' + p.id) + '">' +
          '<div class="search-result-thumb" style="background:' + (p.gradient || '#333') + '">' +
            '<img src="' + thumb + '" alt="" loading="lazy" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=\'' + fb + '\';}">' +
          '</div>' +
          '<div class="search-result-meta">' +
            '<div class="search-result-name">' + p.name + '</div>' +
            '<div class="search-result-price">' + NexoraApp.formatPrice(p.price, p.currency) + '</div>' +
          '</div></a>';
      }).join('') +
        '<a class="search-result-item" href="' + NexoraApp.pageUrl('search.html?q=' + encodeURIComponent(q)) + '">' +
          '<strong>' + t('all_results') + '</strong></a>';
      results.classList.add('is-open');
    }, 220);

    input.addEventListener('input', run);
    input.addEventListener('focus', run);
    document.addEventListener('click', function (e) {
      if (!e.target.closest('[data-header-search]')) results.classList.remove('is-open');
    });
  }

  function ensureHeadAssets() {
    const base = NexoraApp.getBasePath();
    if (!document.querySelector('link[rel="icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/svg+xml';
      icon.href = base + 'assets/icons/favicon.svg';
      document.head.appendChild(icon);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const apple = document.createElement('link');
      apple.rel = 'apple-touch-icon';
      apple.href = base + 'assets/icons/apple-touch-icon.png';
      document.head.appendChild(apple);
    }
    if (!document.querySelector('meta[property="og:site_name"]')) {
      const og = document.createElement('meta');
      og.setAttribute('property', 'og:site_name');
      og.content = 'NEXORA';
      document.head.appendChild(og);
    }
  }

  async function mount() {
    site = await NexoraApp.loadSiteSettings();
    NexoraApp.applySiteTheme(site);
    ensureHeadAssets();

    const headerMount = document.getElementById('site-header');
    const footerMount = document.getElementById('site-footer');
    if (headerMount) headerMount.innerHTML = headerHTML();
    if (footerMount) footerMount.innerHTML = footerHTML();

    const oldTab = document.querySelector('.mobile-tabbar');
    if (oldTab) oldTab.remove();
    document.body.insertAdjacentHTML('beforeend', tabbarHTML());

    if (typeof NexoraIcons !== 'undefined') NexoraIcons.init();
    markActiveNav();
    markActiveTab();
    bindNav();
    bindLiveSearch();
    bindStaffEntry();
    loadPromo();
    NexoraApp.updateBadges();
    NexoraApp.initAuthUI();
    document.dispatchEvent(new CustomEvent('nexora:shell-ready'));
  }

  function boot() {
    if (document.getElementById('site-header') || document.getElementById('site-footer')) {
      mount();
    }
  }

  return { mount: mount, headerHTML: headerHTML, footerHTML: footerHTML, tabbarHTML: tabbarHTML, boot: boot };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', NexoraShell.boot);
} else {
  NexoraShell.boot();
}
