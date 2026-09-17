import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChannelStats30d {
  followers: number;
  avg_viewers_30d: number;
  peak_viewers_30d: number;
  hours_streamed_30d: number;
  streams_30d: number;
  chatters_30d: number;
  messages_30d: number;
  total_viewers_30d: number;
}

export interface StreamSession {
  id: string;
  twitch_stream_id: string;
  started_at: string;
  ended_at: string | null;
  game_id: string | null;
  game_name: string | null;
  title: string | null;
  tags: string[] | null;
  type: string | null;
  is_mature: boolean;
  peak_viewers: number | null;
  avg_viewers: number | null;
  total_chatters: number | null;
  total_messages: number | null;
  total_emojis: number | null;
}

export interface VideoInfo {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: string;
  duration: string;
}

export function useChannelStats30d(userId: string | null) {
  const [stats, setStats] = useState<ChannelStats30d | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) { setStats(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('get_twitch_channel_stats_30d', { p_user_id: userId });
      if (err) throw err;
      const result = Array.isArray(data) ? data[0] : data;
      setStats(result as ChannelStats30d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load channel stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useStreamSessions(userId: string | null, limit = 20) {
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!userId) { setSessions([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('twitch_stream_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (err) throw err;
      setSessions((data as StreamSession[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stream sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [userId, limit]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}

export function useTwitchChannelSync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-channel-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = await res.json();
      setLastResult(json);
      return json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to sync';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { sync, loading, error, lastResult };
}

export function useEventSubManage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-eventsub-manage?action=subscribe`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = await res.json();
      setResult(json);
      return json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to subscribe';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-eventsub-manage?action=unsubscribe`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = await res.json();
      setResult(json);
      return json;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to unsubscribe';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { subscribe, unsubscribe, loading, error, result };
}