// Ingresso delle sezioni allo scroll: ogni elemento marcato data-reveal si alza e compare quando entra in vista.
// Il contenuto è visibile di default: se manca IntersectionObserver o l'utente riduce il movimento, non si nasconde nulla.
export function observeReveals(root) {
  const items = [...root.querySelectorAll('[data-reveal]')];
  if (items.length === 0) return () => {};
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

  items.forEach((item) => {
    item.classList.add('will-reveal');
    observer.observe(item);
  });
  return () => observer.disconnect();
}
