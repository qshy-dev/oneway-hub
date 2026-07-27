import { useEffect } from 'react';

/**
 * Proximity-based parallax. For every element carrying a `.parallax-*` class,
 * we measure the distance from the cursor to the element's center. While the
 * cursor is within `RADIUS` of an element, that element drifts away from the
 * cursor by up to its `depth` (in px); outside the radius it settles back to rest.
 *
 * This keeps the effect local — only the part of the page the user is actually
 * near comes alive, instead of the whole site shifting at once.
 */
const RADIUS = 180;

const DEPTHS: Record<string, number> = {
  'parallax-logo': 1.4,
  'parallax-btn': 0.6,
  'parallax-card': 2.2,
};

export function useParallax() {
  useEffect(() => {
    let raf = 0;
    let mx = -9999;
    let my = -9999;

    const apply = () => {
      raf = 0;
      const els = document.querySelectorAll<HTMLElement>('.parallax');
      els.forEach((el) => {
        let depth = 0;
        for (const cls of el.classList) {
          if (DEPTHS[cls] !== undefined) {
            depth = DEPTHS[cls];
            break;
          }
        }
        if (!depth) return;

        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.hypot(dx, dy);

        if (dist >= RADIUS) {
          if (el.style.transform) el.style.transform = '';
          return;
        }
        const k = depth / RADIUS;
        el.style.transform = `translate3d(${Math.round(-dx * k)}px, ${Math.round(-dy * k)}px, 0)`;
      });
    };

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);
}
