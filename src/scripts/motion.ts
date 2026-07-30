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

// UIUX-11: a canary for BaseLayout's reveal failsafe — as soon as this module
// actually executes (regardless of what happens after), mark the document so
// the inline failsafe script knows not to force-reveal everything.
if (typeof document !== 'undefined') {
  document.documentElement.setAttribute('data-motion-ready', '');
}

const reducedMotionQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;

let prefersReduced = reducedMotionQuery?.matches ?? false;

// JS-L8 fix: the preference was previously only read once at load. If the
// user flips it mid-session, respect the change immediately in the direction
// that matters for vestibular safety (motion turning ON reduced) — reveal any
// still-hidden elements and stop the parallax transform. Going the other way
// (reduced → full motion) doesn't retroactively re-enable effects that were
// never initialized; that's a missed enhancement, not a safety concern.
reducedMotionQuery?.addEventListener('change', (e) => {
  prefersReduced = e.matches;
  if (!prefersReduced) return;
  document
    .querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-group], [data-reveal-cinematic]')
    .forEach((el) => el.classList.add('is-visible'));
  document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
    el.style.transform = '';
  });
});

const isTouch =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/* ── 1. Scroll Reveal ─────────────────────────────────────── */

function initReveal(): void {
  if (prefersReduced) {
    // Skip animation — make everything visible immediately
    document
      .querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-group], [data-reveal-cinematic]')
      .forEach((el) => {
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

  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (elements.length === 0) return;

  let ticking = false;

  function updateParallax(): void {
    // JS-L8: bail if the OS preference flipped to reduced-motion after this
    // listener was already attached — the 'change' handler above resets the
    // transform once, but a later scroll event would otherwise reapply it.
    if (prefersReduced) return;
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

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    },
    { passive: true }
  );

  // Initial paint
  updateParallax();
}

/* ── 3. Counter ───────────────────────────────────────────── */

function initCounters(): void {
  const counters = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
  if (counters.length === 0) return;

  if (prefersReduced) {
    // Show final values immediately
    counters.forEach((el) => {
      const target = parseInt(el.dataset.count ?? '0', 10);
      const suffix = el.dataset.suffix ?? '';
      el.textContent = `${target.toLocaleString('es-CL')}${suffix}`;
      el.style.visibility = 'visible';
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

        // UIUX-L12 fix: reveal right as the count-up's first frame is about
        // to paint, so the browser never shows the SSR-baked final value
        // (kept hidden via motion.css's `html.js [data-count]` rule) before
        // the animation jumps down to 0 to start counting up.
        el.style.visibility = 'visible';

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
