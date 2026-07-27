import { decodeCrosshairShareCode, type Crosshair } from 'csgo-sharecode';

const PRESET_COLORS: Record<number, { r: number; g: number; b: number }> = {
  0: { r: 255, g: 0, b: 0 },      // Red
  1: { r: 0, g: 255, b: 0 },      // Green
  2: { r: 255, g: 255, b: 0 },    // Yellow
  3: { r: 0, g: 153, b: 255 },    // Blue
  4: { r: 0, g: 255, b: 255 },    // Cyan
  5: { r: 0, g: 0, b: 0 },        // Custom (overwritten by RGB)
};

function resolveColor(ch: Crosshair): { r: number; g: number; b: number } {
  if (ch.color === 5) return { r: ch.red, g: ch.green, b: ch.blue };
  return PRESET_COLORS[ch.color] ?? { r: ch.red, g: ch.green, b: ch.blue };
}

// Exact CS2 pixel conversion formulas (from cs2util.com)
function thicknessToPx(thickness: number): number {
  return Math.max(1, Math.floor((thickness + 0.2222) / 0.4444));
}
function lengthToPx(length: number): number {
  return Math.floor((length + 0.2222) / 0.4445);
}
function gapToPx(gap: number, style: number): number {
  let x = (gap < 0 ? -Math.floor(-gap) : Math.floor(gap)) + 4;
  if (style !== 2) {
    x += 1;
  }
  return x;
}
function outlineToPx(outline: number): number {
  return Math.max(1, Math.floor(outline));
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  crosshair: Crosshair;
  className?: string;
  background?: 'dark' | 'light' | 'transparent';
}

export function CrosshairPreview({
  crosshair: ch,
  className,
  background = 'dark',
}: Props) {
  const { r, g, b } = resolveColor(ch);
  const alpha = (ch.alphaEnabled ? ch.alpha : 200) / 255;
  const color = `rgba(${r}, ${g}, ${b}, ${alpha})`;

  const f = thicknessToPx(ch.thickness);
  const lenPx = lengthToPx(ch.length);
  const gapPx = gapToPx(ch.gap, ch.style);
  const outlinePx = ch.outlineEnabled ? outlineToPx(ch.outline) : 0;

  // Center at (0,0) in SVG coordinates
  const yLeft = -Math.floor(f / 2);
  const wTop = -Math.floor(f / 2);

  const rects: Rect[] = [];
  // Right
  rects.push({ x: yLeft + f + gapPx, y: wTop, w: lenPx, h: f });
  // Left
  rects.push({ x: yLeft - gapPx - lenPx, y: wTop, w: lenPx, h: f });
  // Top (skip if T-style)
  if (!ch.tStyleEnabled) {
    rects.push({ x: yLeft, y: wTop - gapPx - lenPx, w: f, h: lenPx });
  }
  // Bottom
  rects.push({ x: yLeft, y: wTop + f + gapPx, w: f, h: lenPx });
  // Center dot
  if (ch.centerDotEnabled) {
    rects.push({ x: yLeft, y: wTop, w: f, h: f });
  }

  const bgFill =
    background === 'dark' ? '#131316' : background === 'light' ? '#e5e5e5' : 'none';

  const viewSize = 120;
  const outlineOffset = outlinePx * 0.5;

  return (
    <svg
      viewBox={`${-viewSize / 2} ${-viewSize / 2} ${viewSize} ${viewSize}`}
      className={className}
      style={{ display: 'block' }}
    >
      {background !== 'transparent' && (
        <rect
          x={-viewSize / 2}
          y={-viewSize / 2}
          width={viewSize}
          height={viewSize}
          fill={bgFill}
        />
      )}

      {/* Outline */}
      {outlinePx > 0 && ch.outlineEnabled && (
        <g fill="none" stroke="#000" strokeWidth={outlinePx}>
          {rects.map((rect, i) => (
            <rect
              key={`o-${i}`}
              x={rect.x - outlineOffset}
              y={rect.y - outlineOffset}
              width={rect.w + outlinePx}
              height={rect.h + outlinePx}
            />
          ))}
        </g>
      )}

      {/* Crosshair fill */}
      <g fill={color}>
        {rects.map((rect, i) => (
          <rect
            key={`f-${i}`}
            x={rect.x}
            y={rect.y}
            width={rect.w}
            height={rect.h}
          />
        ))}
      </g>
    </svg>
  );
}

interface CodePreviewProps {
  code: string;
  className?: string;
  background?: 'dark' | 'light' | 'transparent';
}

export function CrosshairCodePreview({
  code,
  className,
  background,
}: CodePreviewProps) {
  let ch: Crosshair | null = null;
  try {
    ch = decodeCrosshairShareCode(code);
  } catch {
    // invalid code
  }

  if (!ch) {
    return (
      <div
        className={`flex items-center justify-center bg-ink-800 text-ink-500 text-sm ${className ?? ''}`}
      >
        Invalid code
      </div>
    );
  }

  return (
    <CrosshairPreview
      crosshair={ch}
      className={className}
      background={background}
    />
  );
}
