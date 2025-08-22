// FireWeb Studio - main interactions and visuals
(function() {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  // Intersection reveal for [data-animate]
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  $$('[data-animate]').forEach(el => io.observe(el));

  // Mobile nav toggle
  const navToggle = $('.nav-toggle');
  const navLinks = $('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    // Close menu on link click
    navLinks.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Card hover glow follows mouse (sets --mx var)
  $$('.card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100; // percent
      card.style.setProperty('--mx', `${x}%`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.removeProperty('--mx');
    });
  });

  // Canvas fire background
  // Removed canvas-based fire effect (replaced with CSS-based .fire)
  // Removed global overlay embers and cursor sparks (CSS-based .fire in use)
})();
