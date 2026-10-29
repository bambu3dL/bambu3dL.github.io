// Applica tema e lingua salvati prima del primo paint, per evitare il flash.
// Resta fuori dai moduli: è uno script classico, bloccante e senza dipendenze.
(function () {
  var KEY_PREFIX = 'stampe3d:';
  function read(name) {
    var raw = null;
    try {
      raw = window.localStorage.getItem(KEY_PREFIX + name) || window.sessionStorage.getItem(KEY_PREFIX + name);
    } catch (e) { return null; }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (parsed.exp && parsed.exp < Date.now()) return null;
      return parsed.v;
    } catch (e) { return null; }
  }
  var root = document.documentElement;
  var theme = read('theme');
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.setAttribute('data-theme', theme);
  var lang = read('lang');
  if (lang !== 'it' && lang !== 'en') {
    lang = (navigator.language || 'it').toLowerCase().indexOf('it') === 0 ? 'it' : 'en';
  }
  root.setAttribute('lang', lang);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#ebebed' : '#141311');
})();
