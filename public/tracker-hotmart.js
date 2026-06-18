(function () {
  'use strict';

  var COOKIE_NAME = 'ab_s1';
  var COOKIE_DAYS = 7;
  var PARAM_NAME = 'xcod';

  function injectXcod(s1) {
    document.querySelectorAll('a[href*="pay.hotmart.com"]').forEach(function (link) {
      try {
        var url = new URL(link.href);
        url.searchParams.set(PARAM_NAME, s1);
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
      saveCookie(s1);
    } else {
      s1 = readCookie();
    }

    if (!s1) return;

    injectXcod(s1);

    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(function () {
        injectXcod(s1);
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
