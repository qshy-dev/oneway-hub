import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

const DEFAULT_COLOR = '#9146ff';
const STORAGE_KEY = 'cw_app_settings_v1';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace('#', '');
  const full =
    m.length === 3
      ? m
          .split('')
          .map((c) => c + c)
          .join('')
      : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 145, g: 70, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function shade(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  if (factor >= 0) {
    return rgbToHex(
      r + (255 - r) * factor,
      g + (255 - g) * factor,
      b + (255 - b) * factor,
    );
  }
  const f = 1 + factor;
  return rgbToHex(r * f, g * f, b * f);
}

function channels(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

function applyAccent(hex: string) {
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-300', channels(shade(hex, 0.28)));
  root.style.setProperty('--accent-400', channels(shade(hex, 0.12)));
  root.style.setProperty('--accent-500', channels(hex));
  root.style.setProperty('--accent-600', channels(shade(hex, -0.14)));
  root.style.setProperty('--accent-700', channels(shade(hex, -0.28)));
  root.style.setProperty('--accent-rgb', channels(hex).replace(/ /g, ', '));
}

applyAccent(DEFAULT_COLOR);

export interface AppPrefs {
  includeRandom: boolean;
  includeOwn: boolean;
  ownCode: string | null;
  accentColor: string;
}

interface SettingsCtx {
  prefs: AppPrefs;
  loading: boolean;
  setIncludeRandom: (v: boolean) => void;
  setIncludeOwn: (v: boolean) => void;
  setOwnCode: (v: string | null) => void;
  setAccentColor: (v: string) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

function loadPrefs(): AppPrefs {
  const defaults: AppPrefs = {
    includeRandom: false,
    includeOwn: false,
    ownCode: null,
    accentColor: DEFAULT_COLOR,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      includeRandom: Boolean(parsed.includeRandom),
      includeOwn: Boolean(parsed.includeOwn),
      ownCode: parsed.ownCode ?? null,
      accentColor: parsed.accentColor || DEFAULT_COLOR,
    };
  } catch {
    return defaults;
  }
}

function savePrefs(p: AppPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPrefs>({
    includeRandom: false,
    includeOwn: false,
    ownCode: null,
    accentColor: DEFAULT_COLOR,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = loadPrefs();
    setPrefs(p);
    applyAccent(p.accentColor);
    setLoading(false);
  }, []);

  const patch = useCallback((p: Partial<AppPrefs>) => {
    setPrefs((prev) => {
      const next: AppPrefs = {
        includeRandom: p.includeRandom ?? prev.includeRandom,
        includeOwn: p.includeOwn ?? prev.includeOwn,
        ownCode: p.ownCode !== undefined ? p.ownCode : prev.ownCode,
        accentColor: p.accentColor ?? prev.accentColor,
      };
      if (p.accentColor) applyAccent(p.accentColor);
      savePrefs(next);
      return next;
    });
  }, []);

  const setIncludeRandom = useCallback((v: boolean) => patch({ includeRandom: v }), [patch]);
  const setIncludeOwn = useCallback((v: boolean) => patch({ includeOwn: v }), [patch]);
  const setOwnCode = useCallback((v: string | null) => patch({ ownCode: v }), [patch]);
  const setAccentColor = useCallback((v: string) => patch({ accentColor: v }), [patch]);

  return (
    <Ctx.Provider
      value={{ prefs, loading, setIncludeRandom, setIncludeOwn, setOwnCode, setAccentColor }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
