import { useEffect, useRef, useState } from 'react';

/**
 * Reveals `text` one character at a time, like a typewriter.
 *
 * Before starting, the cursor may "blink" as if the typist paused to think:
 *  - 1/10 chance: cursor blinks once (off → on → off → on), then typing starts.
 *  - 1/20 chance: cursor blinks twice, then typing starts.
 *
 * With probability 1/`typoChance`, before revealing a real character it first
 * types a random neighboring-key typo, pauses briefly, deletes it, then
 * continues with the correct character. Returns the currently displayed
 * string, whether the animation has finished, and whether the cursor is
 * currently in the "thinking" blink phase (so the UI can show a blinking
 * cursor even though no text is typed yet).
 */
export function useTypewriter(text: string, opts?: { typoChance?: number; speed?: number; restartKey?: number }) {
  const { typoChance = 10, speed = 65, restartKey = 0 } = opts ?? {};
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);
  const [thinking, setThinking] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    setDisplay('');
    setDone(false);
    setThinking(false);
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
        setThinking(false);
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

    // Decide whether to do a "thinking" pause before typing starts.
    // 1/20 chance → blink twice, 1/10 chance → blink once, otherwise start immediately.
    const roll = Math.random() * 20;
    let blinks = 0;
    if (roll < 1) blinks = 2;
    else if (roll < 2) blinks = 1;

    const startTyping = () => {
      setThinking(false);
      timer = window.setTimeout(step, 150);
    };

    if (blinks > 0) {
      setThinking(true);
      // Each blink: cursor goes off for ~400ms, then on for ~400ms.
      let remaining = blinks;
      const blinkOnce = () => {
        if (cancelled) return;
        if (remaining <= 0) {
          startTyping();
          return;
        }
        remaining -= 1;
        // Cursor "off" phase
        timer = window.setTimeout(() => {
          if (cancelled) return;
          // Cursor "on" phase
          timer = window.setTimeout(blinkOnce, 400);
        }, 400);
      };
      timer = window.setTimeout(blinkOnce, 300);
    } else {
      timer = window.setTimeout(step, 250);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, typoChance, speed, restartKey]);

  return { display, done, thinking };
}
