(() => {
  'use strict';
  const page = document.querySelector('.home-experience');
  if (!page) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  const connection = navigator.connection;
  const animations = new Set();
  const seen = new WeakSet();
  const scenes = [...page.querySelectorAll('[data-home-scene]')];
  const device = page.querySelector('.real-devices');
  let frame = 0;
  let point;
  const allowed = () => !reduced.matches && !connection?.saveData && !document.hidden;
  const resetDevice = () => {
    cancelAnimationFrame(frame); frame = 0; point = null;
    device?.style.removeProperty('--device-rx');
    device?.style.removeProperty('--device-ry');
  };
  const sync = () => {
    page.classList.toggle('home-motion-on', allowed());
    if (!allowed()) {
      animations.forEach(animation => animation.cancel());
      animations.clear(); resetDevice();
    }
  };
  // Animate into a visible resting state; script failure never hides text or links.
  const reveal = (element, delay = 0) => {
    if (seen.has(element)) return;
    seen.add(element);
    if (!allowed() || !element.animate) return;
    const animation = element.animate([
      { opacity: .15, transform: 'translateY(22px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 700, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    animations.add(animation);
    animation.onfinish = animation.oncancel = () => animations.delete(animation);
  };
  if ('IntersectionObserver' in window) {
    const sceneObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      entry.target.classList.toggle('is-home-visible', entry.isIntersecting);
      if (!entry.isIntersecting && entry.target.id === 'start') resetDevice();
    }), { threshold: 0 });
    scenes.forEach(scene => sceneObserver.observe(scene));
    const revealObserver = new IntersectionObserver(entries => {
      let delay = 0;
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        reveal(entry.target, delay); delay = Math.min(delay + 75, 225);
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .08 });
    page.querySelectorAll('[data-home-reveal]').forEach(element => revealObserver.observe(element));
  }
  sync();
  const intro = page.querySelector('[data-home-intro]');
  if (intro && intro.getBoundingClientRect().bottom > 0 && intro.getBoundingClientRect().top < innerHeight) {
    [...intro.children].forEach((element, index) => reveal(element, Math.min(index * 70, 280)));
  }
  // Only the complete device composition tilts; the original screen captures stay aligned.
  device?.addEventListener('pointermove', event => {
    if (!allowed() || !pointer.matches || event.pointerType === 'touch') return;
    point = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!point || !allowed()) return;
      const rect = device.getBoundingClientRect();
      const x = Math.max(-.5, Math.min(.5, (point.x - rect.left) / rect.width - .5));
      const y = Math.max(-.5, Math.min(.5, (point.y - rect.top) / rect.height - .5));
      device.style.setProperty('--device-rx', `${-y * 3}deg`);
      device.style.setProperty('--device-ry', `${x * 3}deg`);
    });
  }, { passive: true });
  device?.addEventListener('pointerleave', resetDevice);
  pointer.addEventListener('change', resetDevice);
  reduced.addEventListener('change', sync);
  connection?.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', resetDevice);
})();
