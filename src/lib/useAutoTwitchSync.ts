import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTwitchChannelSync, useEventSubManage } from '@/lib/useTwitchChannelStats';

export interface AutoSyncState {
  lastSync: number | null;
  syncing: boolean;
  error: string | null;
}

/**
 * Runs `twitch-channel-sync` + auto-subscribes to EventSub on a timer.
 * Designed to be silent — no UI chrome, no manual buttons.
 */
export function useAutoTwitchSync(enabled: boolean, intervalMs = 60000) {
  const { user, profile, refreshProfile } = useAuth();
  const { sync, loading: syncLoading } = useTwitchChannelSync();
  const { subscribe, loading: subLoading } = useEventSubManage();
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSync = useCallback(async () => {
    if (!enabled || !user || !profile?.twitch_username) return;
    try {
      await sync();
      // Auto-subscribe to EventSub if not already enabled
      if (!profile?.twitch_eventsub_enabled) {
        try {
          await subscribe();
          await refreshProfile();
        } catch {
          /* EventSub subscription is best-effort; don't fail the whole sync */
        }
      }
      setLastSync(Date.now());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    }
  }, [enabled, user, profile?.twitch_username, profile?.twitch_eventsub_enabled, sync, subscribe, refreshProfile]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Initial sync after a short delay so the page renders first
    const initialTimer = window.setTimeout(() => {
      if (!cancelled) runSync();
    }, 1500);
    const id = window.setInterval(() => {
      if (!cancelled) runSync();
    }, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
      clearInterval(id);
    };
  }, [enabled, runSync, intervalMs]);

  return { lastSync, syncing: syncLoading || subLoading, error } as AutoSyncState;
}