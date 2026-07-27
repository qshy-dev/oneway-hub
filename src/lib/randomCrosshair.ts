import { encodeCrosshair, type Crosshair } from 'csgo-sharecode';

export function randomCrosshair(): Crosshair {
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    gap: r1(r(-5, 5)),
    outline: r1(r(0, 3)),
    red: Math.floor(Math.random() * 256),
    green: Math.floor(Math.random() * 256),
    blue: Math.floor(Math.random() * 256),
    alpha: Math.floor(Math.random() * 256),
    splitDistance: 3,
    followRecoil: false,
    fixedCrosshairGap: 3,
    color: Math.floor(Math.random() * 6),
    outlineEnabled: Math.random() > 0.4,
    innerSplitAlpha: 0.1,
    outerSplitAlpha: 1,
    splitSizeRatio: 1,
    thickness: r1(r(0, 3)),
    centerDotEnabled: Math.random() > 0.6,
    deployedWeaponGapEnabled: false,
    alphaEnabled: Math.random() > 0.3,
    tStyleEnabled: Math.random() > 0.8,
    style: 4,
    length: r1(r(0, 15)),
  };
}

export function crosshairToCode(ch: Crosshair): string {
  try {
    return encodeCrosshair(ch);
  } catch {
    return '';
  }
}

export function randomCrosshairCode(): { code: string; crosshair: Crosshair } {
  const ch = randomCrosshair();
  return { code: crosshairToCode(ch), crosshair: ch };
}
