import { useCallback, useEffect, useState } from 'react';
import { PRO_CROSSHAIRS } from '@/data/proCrosshairs';

export interface UserCrosshair {
  id: string;
  player: string;
  code: string;
  archived: boolean;
  include_in_roulette: boolean;
  created_at: string;
}

const STORAGE_KEY = 'cw_user_crosshairs_v5';

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function seed(): UserCrosshair[] {
  const base = Date.now();
  return PRO_CROSSHAIRS.map((p, i) => ({
    id: uid(),
    player: p.player,
    code: p.code,
    archived: false,
    include_in_roulette: true,
    created_at: new Date(base - i * 1000).toISOString(),
  }));
}

function loadRows(): UserCrosshair[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      return s;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('bad');
    return parsed as UserCrosshair[];
  } catch {
    const s = seed();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
    return s;
  }
}

function saveRows(rows: UserCrosshair[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch {}
}

export function useUserCrosshairs() {
  const [rows, setRows] = useState<UserCrosshair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRows(loadRows());
    setLoading(false);
  }, []);

  const persist = useCallback((next: UserCrosshair[]) => {
    setRows(next);
    saveRows(next);
  }, []);

  const add = useCallback((player: string, code: string) => {
    const row: UserCrosshair = {
      id: uid(),
      player,
      code,
      archived: false,
      include_in_roulette: true,
      created_at: new Date().toISOString(),
    };
    setRows((prev) => {
      const next = [row, ...prev];
      saveRows(next);
      return next;
    });
  }, []);

  const archive = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, archived: true } : r));
      saveRows(next);
      return next;
    });
  }, []);

  const restore = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, archived: false } : r));
      saveRows(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      saveRows(next);
      return next;
    });
  }, []);

  const setRoulette = useCallback((id: string, v: boolean) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, include_in_roulette: v } : r));
      saveRows(next);
      return next;
    });
  }, []);

  const reload = useCallback(() => {
    setRows(loadRows());
  }, []);

  const resetToDefault = useCallback(() => {
    const s = seed();
    setRows(s);
    saveRows(s);
  }, []);

  return { rows, loading, add, archive, restore, remove, setRoulette, reload, resetToDefault };
}
