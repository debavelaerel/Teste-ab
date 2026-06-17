(function () {
  'use strict';

  function injectUtm(utmContent) {
    var selectors = [
      'a[href*="pay.kiwify.com.br"]',
      'a[href*="checkout.kiwify.com.br"]',
    ].join(',');

    document.querySelectorAll(selectors).forEach(function (link) {
      try {
        var url = new URL(link.href);
        url.searchParams.set('utm_content', utmContent);
        link.href = url.toString();
      } catch (_) {}
    });
  }

  function run() {
    var params = new URLSearchParams(window.location.search);
    var utmContent = params.get('utm_content');
    if (!utmContent) return;

    // Inject into existing links
    injectUtm(utmContent);

    // Watch for dynamically added links (e.g. popups, modals)
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        injectUtm(utmContent);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
