import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChannelHistoryEntry {
  id: string;
  type: 'stream' | 'video';
  title: string;
  game_name: string | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  peak_viewers: number | null;
  avg_viewers: number | null;
  view_count: number | null;
  url: string | null;
}

export function useChannelHistory(userId: string | null, limit = 30) {
  const [entries, setEntries] = useState<ChannelHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!userId) { setEntries([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('twitch_stream_sessions')
        .select('id, twitch_stream_id, started_at, ended_at, game_name, title, peak_viewers, avg_viewers, type')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (err) throw err;
      const rows: ChannelHistoryEntry[] = (data ?? []).map((s: Record<string, unknown>) => ({
        id: String(s.id),
        type: 'stream',
        title: String(s.title ?? ''),
        game_name: s.game_name as string | null,
        started_at: String(s.started_at),
        ended_at: s.ended_at as string | null,
        duration_sec: s.ended_at ? Math.round((new Date(s.ended_at as string).getTime() - new Date(s.started_at as string).getTime()) / 1000) : null,
        peak_viewers: s.peak_viewers as number | null,
        avg_viewers: s.avg_viewers as number | null,
        view_count: null,
        url: null,
      }));
      setEntries(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, [userId, limit]);

  return { entries, loading, error, refetch: fetchHistory };
}