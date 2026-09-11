(() => {
  'use strict';
  const header = document.querySelector('.ux-header');
  if (!header) return;
  const button = document.getElementById('ux-more-toggle');
  const panel = document.getElementById('ux-more');
  if (button && panel) {
    const close = () => { button.setAttribute('aria-expanded', 'false'); panel.hidden = true; };
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    });
    document.addEventListener('click', e => { if (!header.contains(e.target)) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) { close(); button.focus(); }
    });
    header.addEventListener('focusout', e => { if (e.relatedTarget && !header.contains(e.relatedTarget)) close(); });
    panel.addEventListener('click', e => { if (e.target.closest('a')) close(); });
    window.addEventListener('resize', () => { if (innerWidth <= 1080) close(); });
  }
  const markCurrent = () => {
    const links = [...header.querySelectorAll('.ux-primary-nav>a')];
    links.forEach(link => link.removeAttribute('aria-current'));
    if (location.hostname === 'gutachten.unfallx.com') {
      header.querySelector('[data-area="gutachten"]')?.setAttribute('aria-current', 'page');
    } else if (document.body.classList.contains('home-experience')) {
      const hash = location.hash || '#start';
      links.find(link => new URL(link.href).hash === hash)?.setAttribute('aria-current', 'location');
    }
  };
  markCurrent();
  window.addEventListener('hashchange', markCurrent);
})();
