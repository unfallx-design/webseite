/* Hell/Dunkel vor dem ersten Zeichnen setzen, damit beim Laden nichts aufblitzt.
   Ohne eigene Wahl folgt die Seite der Einstellung des Geräts. */
(function () {
  var light = false;
  try {
    var t = localStorage.getItem('ux-theme');
    light = t ? t === 'light' : !!(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  } catch (e) {
    light = !!(window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  }
  if (light) document.documentElement.classList.add('gx-light');
})();
