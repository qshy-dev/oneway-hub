import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface GameStats {
  total_games: number;
  wins: number;
  total_score: number;
  best_score: number;
  avg_score: number;
  best_duration_ms: number;
  games_by_game: Record<string, number>;
}

export interface ChatStreamerInfo {
  twitch_id: string;
  username: string;
  messages: number;
  last_seen: string;
}

export interface ChatOverview {
  total_messages: number;
  streamers_count: number;
  top_streamer_twitch_id: string | null;
  top_streamer_username: string | null;
  top_streamer_messages: number;
  last_seen_at: string | null;
  streamers: ChatStreamerInfo[];
}

export interface EmojiInfo {
  emoji: string;
  count: number;
  is_7tv: boolean;
}

export interface EmojiStats {
  total_emoji_uses: number;
  unique_emojis: number;
  top_emoji: string | null;
  top_emoji_count: number;
  top_7tv_emote: string | null;
  top_7tv_count: number;
  emojis: EmojiInfo[];
}

export function useGameStats(chatterTwitchId: string | null) {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!chatterTwitchId) { setStats(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('get_user_game_stats', { p_chatter_twitch_id: chatterTwitchId });
      if (err) throw err;
      const result = Array.isArray(data) ? data[0] : data;
      setStats(result as GameStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load game stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [chatterTwitchId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useChatOverview(chatterTwitchId: string | null) {
  const [overview, setOverview] = useState<ChatOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!chatterTwitchId) { setOverview(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('get_user_chat_overview', { p_chatter_twitch_id: chatterTwitchId });
      if (err) throw err;
      const result = Array.isArray(data) ? data[0] : data;
      setOverview(result as ChatOverview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chat overview');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [chatterTwitchId]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  return { overview, loading, error, refetch: fetchOverview };
}

export function useEmojiStats(chatterTwitchId: string | null) {
  const [stats, setStats] = useState<EmojiStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!chatterTwitchId) { setStats(null); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('get_user_emoji_stats', { p_chatter_twitch_id: chatterTwitchId });
      if (err) throw err;
      const result = Array.isArray(data) ? data[0] : data;
      setStats(result as EmojiStats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load emoji stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [chatterTwitchId]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
