import type { Crosshair } from 'csgo-sharecode';

export function buildConVars(ch: Crosshair): string {
  return [
    `cl_crosshairstyle "${ch.style}"`,
    `cl_crosshairsize "${ch.length}"`,
    `cl_crosshairthickness "${ch.thickness}"`,
    `cl_crosshairgap "${ch.gap}"`,
    `cl_crosshair_drawoutline "${ch.outlineEnabled ? 1 : 0}"`,
    `cl_crosshair_outlinethickness "${ch.outline}"`,
    `cl_crosshaircolor "${ch.color}"`,
    `cl_crosshaircolor_r "${ch.red}"`,
    `cl_crosshaircolor_g "${ch.green}"`,
    `cl_crosshaircolor_b "${ch.blue}"`,
    `cl_crosshairalpha "${ch.alpha}"`,
    `cl_crosshairusealpha "${ch.alphaEnabled ? 1 : 0}"`,
    `cl_crosshair_t "${ch.tStyleEnabled ? 1 : 0}"`,
    `cl_crosshairdot "${ch.centerDotEnabled ? 1 : 0}"`,
  ].join('\n');
}
