/* THE BRIEF — shared header.
   Usage (load WITHOUT defer in <head> so the theme applies before paint):
     <script src="../assets/header.js"></script>
     ...
     <brief-header current="energy" root="../"></brief-header>
   `root` is the relative path from the page to the site root (default "./").
   `current` is one of: home, media, economy, econ, energy, tax, spend, jobs.
*/
(function () {
  // Apply theme immediately (before first paint) to avoid a flash.
  var stored = null;
  try { stored = localStorage.getItem('brief-theme'); } catch (e) {}
  var dark = stored ? stored === 'dark'
    : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

  var NAV = [
    ['media',   'Media',   'media/'],
    ['economy', 'Economy', 'economy/'],
    ['econ',    'Data',    'econ/'],
    ['energy',  'Energy',  'energy/'],
    ['tax',     'Tax',     'tax/'],
    ['spend',   'Spend',   'spend/'],
    ['jobs',    'Jobs',    'jobs/']
  ];

  class BriefHeader extends HTMLElement {
    connectedCallback() {
      var root = this.getAttribute('root') || './';
      var current = this.getAttribute('current') || '';
      var links = NAV.map(function (n) {
        var cur = n[0] === current ? ' aria-current="page"' : '';
        return '<a href="' + root + n[2] + '"' + cur + '>' + n[1] + '</a>';
      }).join('');
      this.innerHTML =
        '<div class="bh"><div class="bh-inner">' +
        '<a class="bh-wordmark" href="' + root + '">THE BRIEF<span class="tick">.</span></a>' +
        '<nav class="bh-nav" aria-label="Sections">' + links + '</nav>' +
        '<button class="bh-theme" type="button" aria-label="Toggle dark mode" title="Toggle dark mode"></button>' +
        '</div></div>';
      var btn = this.querySelector('.bh-theme');
      function paint() {
        btn.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾';
      }
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('brief-theme', next); } catch (e) {}
        paint();
        window.dispatchEvent(new CustomEvent('brief-theme-change', { detail: { theme: next } }));
      });
      paint();
    }
  }
  if (!customElements.get('brief-header')) {
    customElements.define('brief-header', BriefHeader);
  }
})();
