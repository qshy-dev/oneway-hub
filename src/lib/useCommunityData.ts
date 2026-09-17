import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface CommunityFollower {
  id: string;
  username: string;
  displayName: string | null;
  followedAt: string | null;
}

export function useCommunityData(userId: string | null) {
  const [followers, setFollowers] = useState<CommunityFollower[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunity = async () => {
    if (!userId) { setFollowers([]); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: profile } = await supabase.rpc('get_public_profile', { p_username: null, p_user_id: userId });
      if (!profile?.twitch_id) { setFollowers([]); return; }
      const { data, error: err } = await supabase.rpc('get_chat_message_stats', { p_streamer_twitch_id: profile.twitch_id });
      if (err) throw err;
      const rows: CommunityFollower[] = (data ?? []).map((c: Record<string, unknown>) => ({
        id: String(c.chatter_twitch_id),
        username: String(c.chatter_twitch_username ?? c.chatter_twitch_id),
        displayName: c.chatter_display_name as string | null,
        followedAt: c.last_seen_at as string | null,
      }));
      setFollowers(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load community');
      setFollowers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCommunity(); }, [userId]);

  return { followers, loading, error, refetch: fetchCommunity };
}
