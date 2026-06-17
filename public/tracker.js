(function () {
  'use strict';

  var COOKIE_NAME = 'ab_s1';
  var COOKIE_DAYS = 7;

  function injectS1(s1) {
    var selectors = [
      'a[href*="pay.kiwify.com.br"]',
      'a[href*="checkout.kiwify.com.br"]',
    ].join(',');

    document.querySelectorAll(selectors).forEach(function (link) {
      try {
        var url = new URL(link.href);
        url.searchParams.set('s1', s1);
        link.href = url.toString();
      } catch (_) {}
    });
  }

  function saveCookie(value) {
    var expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; SameSite=Lax';
  }

  function readCookie() {
    var match = document.cookie.match('(?:^|; )' + COOKIE_NAME + '=([^;]*)');
    return match ? decodeURIComponent(match[1]) : null;
  }

  function run() {
    var params = new URLSearchParams(window.location.search);
    var s1 = params.get('s1');

    if (s1) {
      saveCookie(s1); // persist for return visits
    } else {
      s1 = readCookie(); // fallback: visitor returned without param in URL
    }

    if (!s1) return;

    injectS1(s1);

    // Watch for dynamically added links (e.g. popups, modals)
    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        injectS1(s1);
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
