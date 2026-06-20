/**
 * motion.ts — Expressive-but-sober motion module
 *
 * Features:
 *   1. Scroll-reveal: IntersectionObserver on [data-reveal] and [data-reveal-group]
 *   2. Parallax: rAF-throttled vertical translate on [data-parallax]
 *   3. Counter: count-up on [data-count] numbers (hero stats)
 *
 * Guarded by:
 *   - prefers-reduced-motion: reveals fire immediately, parallax/counters skip
 *   - Touch devices: parallax disabled (performance + UX)
 */

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isTouch =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/* ── 1. Scroll Reveal ─────────────────────────────────────── */

function initReveal(): void {
  if (prefersReduced) {
    // Skip animation — make everything visible immediately
    document.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-group], [data-reveal-cinematic]').forEach((el) => {
      el.classList.add('is-visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  document.querySelectorAll('[data-reveal], [data-reveal-group]').forEach((el) => {
    observer.observe(el);
  });

  // Cinematic reveals are always above-the-fold (page-load heroes).
  // The IntersectionObserver's threshold doesn't fire reliably for elements
  // that are already fully visible at load, so we fire them directly.
  requestAnimationFrame(() => {
    document.querySelectorAll<HTMLElement>('[data-reveal-cinematic]').forEach((el) => {
      el.classList.add('is-visible');
    });
  });
}

/* ── 2. Parallax ──────────────────────────────────────────── */

function initParallax(): void {
  if (prefersReduced || isTouch) return;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>('[data-parallax]')
  );
  if (elements.length === 0) return;

  let ticking = false;

  function updateParallax(): void {
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;

      // Only run when element is near the viewport
      if (rect.bottom < -vh || rect.top > vh * 2) return;

      const factor = parseFloat(el.dataset.parallax ?? '0.06');
      // Centre the effect: 0 at viewport midpoint, ± at edges
      const relativePos = (rect.top + rect.height / 2) / vh - 0.5;
      const offset = relativePos * factor * vh;

      el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateParallax);
      ticking = true;
    }
  }, { passive: true });

  // Initial paint
  updateParallax();
}

/* ── 3. Counter ───────────────────────────────────────────── */

function initCounters(): void {
  const counters = Array.from(
    document.querySelectorAll<HTMLElement>('[data-count]')
  );
  if (counters.length === 0) return;

  if (prefersReduced) {
    // Show final values immediately
    counters.forEach((el) => {
      const target = parseInt(el.dataset.count ?? '0', 10);
      const suffix = el.dataset.suffix ?? '';
      el.textContent = `${target.toLocaleString('es-CL')}${suffix}`;
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);

        const target = parseInt(el.dataset.count ?? '0', 10);
        const suffix = el.dataset.suffix ?? '';
        const duration = 1200; // ms
        const start = performance.now();

        function tick(now: number): void {
          const elapsed = Math.min(now - start, duration);
          // Ease-out cubic
          const progress = 1 - Math.pow(1 - elapsed / duration, 3);
          const current = Math.round(progress * target);
          el.textContent = `${current.toLocaleString('es-CL')}${suffix}`;
          if (elapsed < duration) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((el) => observer.observe(el));
}

/* ── Bootstrap ────────────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initReveal();
    initParallax();
    initCounters();
  });
} else {
  initReveal();
  initParallax();
  initCounters();
}
