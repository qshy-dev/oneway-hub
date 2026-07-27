import { useEffect, useRef } from 'react';

/**
 * Soft radial glow that follows the cursor. Fixed-position, pointer-events
 * none, low z-index so it sits behind content. Uses the accent CSS variable so
 * it respects the site color setting. Fades out when the mouse is idle.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let idleTimer: number | undefined;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        el.style.opacity = '1';
      });
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        el.style.opacity = '0';
      }, 1400);
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 opacity-0 transition-opacity duration-700 ease-out"
      style={{
        width: 260,
        height: 260,
        marginLeft: -130,
        marginTop: -130,
        background: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.05) 0%, rgba(var(--accent-rgb), 0.015) 40%, transparent 70%)',
        willChange: 'transform, opacity',
      }}
    />
  );
}
