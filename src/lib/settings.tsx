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

export type Theme = 'dark' | 'light';

function getLogoColor(theme: Theme): string {
  return theme === 'dark' ? '#ffffff' : '#000000';
}

function createLogoSvg(color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="142" y="112" width="64" height="288" fill="${color}"/><path d="M248 112h74l116 144-116 144h-74l116-144z" fill="${color}"/></svg>`;
}

function applyFavicon(theme: Theme) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.href = `data:image/svg+xml,${encodeURIComponent(createLogoSvg(getLogoColor(theme)))}`;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
  applyFavicon(theme);
}

applyTheme('dark');

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  // Validate input: 3 or 6 hex digits, optionally prefixed with '#'
  const cleanHex = hex.replace('#', '').toLowerCase();
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/.test(cleanHex)) {
    return { r: 145, g: 70, b: 255 };
  }
  const full =
    cleanHex.length === 3
      ? cleanHex
          .split('')
          .map((c) => c + c)
          .join('')
      : cleanHex;
  const n = parseInt(full, 16);
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
  theme: Theme;
}

interface SettingsCtx {
  prefs: AppPrefs;
  loading: boolean;
  setIncludeRandom: (v: boolean) => void;
  setIncludeOwn: (v: boolean) => void;
  setOwnCode: (v: string | null) => void;
  setAccentColor: (v: string) => void;
  setTheme: (v: Theme) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

function loadPrefs(): AppPrefs {
  const defaults: AppPrefs = {
    includeRandom: true,
    includeOwn: false,
    ownCode: null,
    accentColor: DEFAULT_COLOR,
    theme: 'dark',
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
      theme: parsed.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return defaults;
  }
}

function savePrefs(p: AppPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<AppPrefs>({
    includeRandom: true,
    includeOwn: false,
    ownCode: null,
    accentColor: DEFAULT_COLOR,
    theme: 'dark',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const p = loadPrefs();
    setPrefs(p);
    applyAccent(p.accentColor);
    applyTheme(p.theme);
    setLoading(false);
  }, []);

  const patch = useCallback((p: Partial<AppPrefs>) => {
    setPrefs((prev) => {
      const next: AppPrefs = {
        includeRandom: p.includeRandom ?? prev.includeRandom,
        includeOwn: p.includeOwn ?? prev.includeOwn,
        ownCode: p.ownCode !== undefined ? p.ownCode : prev.ownCode,
        accentColor: p.accentColor ?? prev.accentColor,
        theme: p.theme ?? prev.theme,
      };
      // Only trigger DOM side-effects when the value actually changed
      if (next.accentColor !== prev.accentColor) applyAccent(next.accentColor);
      if (next.theme !== prev.theme) applyTheme(next.theme);
      savePrefs(next);
      return next;
    });
  }, []);

  const setIncludeRandom = useCallback((v: boolean) => patch({ includeRandom: v }), [patch]);
  const setIncludeOwn = useCallback((v: boolean) => patch({ includeOwn: v }), [patch]);
  const setOwnCode = useCallback((v: string | null) => patch({ ownCode: v }), [patch]);
  const setAccentColor = useCallback((v: string) => patch({ accentColor: v }), [patch]);
  const setTheme = useCallback((v: Theme) => patch({ theme: v }), [patch]);

  return (
    <Ctx.Provider
      value={{ prefs, loading, setIncludeRandom, setIncludeOwn, setOwnCode, setAccentColor, setTheme }}
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
