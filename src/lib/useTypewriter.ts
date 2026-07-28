import { useEffect, useRef, useState } from 'react';

/**
 * Reveals `text` one character at a time, like a typewriter.
 *
 * With probability 1/`typoChance`, before revealing a real character it first
 * types a random neighboring-key typo, pauses briefly, deletes it, then
 * continues with the correct character. Returns the currently displayed
 * string and whether the animation has finished.
 */
export function useTypewriter(text: string, opts?: { typoChance?: number; speed?: number; restartKey?: number }) {
  const { typoChance = 10, speed = 65, restartKey = 0 } = opts ?? {};
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    setDisplay('');
    setDone(false);
    idxRef.current = 0;

    let cancelled = false;
    let timer: number | undefined;

    const neighbors: Record<string, string> = {
      a: 'sqz', b: 'vngh', c: 'xvdf', d: 'serfcx', e: 'wrdxs', f: 'drtgcv',
      g: 'ftyhbv', h: 'gyujnb', i: 'ujko', j: 'uikmhn', k: 'ijolm', l: 'kop',
      m: 'njk', n: 'bhjm', o: 'iklp', p: 'ol', q: 'wa', r: 'edft', s: 'awdez',
      t: 'rfgy', u: 'yhji', v: 'cfgb', w: 'qase', x: 'zsdc', y: 'tghu', z: 'asx',
    };

    const step = () => {
      if (cancelled) return;
      const i = idxRef.current;
      if (i >= text.length) {
        setDone(true);
        return;
      }
      const ch = text[i];

      // Decide whether to make a typo on this character (1/typoChance).
      const lower = ch.toLowerCase();
      const eligible = /[a-zа-яё]/i.test(ch) && neighbors[lower];
      const makeTypo = eligible && Math.random() * typoChance < 1;

      if (makeTypo) {
        const pool = neighbors[lower];
        const typo = pool[Math.floor(Math.random() * pool.length)];
        const typoCh = ch === lower ? typo : typo.toUpperCase();
        setDisplay((d) => d + typoCh);
        timer = window.setTimeout(() => {
          if (cancelled) return;
          setDisplay((d) => d.slice(0, -1));
          timer = window.setTimeout(() => {
            if (cancelled) return;
            setDisplay((d) => d + ch);
            idxRef.current = i + 1;
            timer = window.setTimeout(step, speed);
          }, speed);
        }, 140);
      } else {
        setDisplay((d) => d + ch);
        idxRef.current = i + 1;
        timer = window.setTimeout(step, speed);
      }
    };

    timer = window.setTimeout(step, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, typoChance, speed, restartKey]);

  return { display, done };
}
