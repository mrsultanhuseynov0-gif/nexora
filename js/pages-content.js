/**
 * Apply admin-editable page content (about / contact / faq)
 */
(function () {
  'use strict';

  async function apply() {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    let key = null;
    if (path.includes('about')) key = 'about';
    else if (path.includes('contact')) key = 'contact';
    else if (path.includes('faq')) key = 'faq';
    if (!key) return;

    const site = await NexoraApp.loadSiteSettings();
    const page = (site.pages && site.pages[key]) || {};
    const titleEl = document.querySelector('.page-hero h1');
    const subEl = document.querySelector('.page-hero .section-subtitle');
    if (titleEl && page.title) titleEl.textContent = page.title;
    if (subEl && page.subtitle) subEl.textContent = page.subtitle;
    if (page.body) {
      const prose = document.querySelector('.content-prose') || document.querySelector('[data-page-body]');
      if (prose) {
        prose.innerHTML = page.body.split(/\n\n+/).map(function (block) {
          return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
        }).join('');
      }
    }
    if (page.title) document.title = page.title + ' | NEXORA';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
