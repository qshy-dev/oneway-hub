import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export type UserEvent = {
  id: string;
  type: 'auction' | 'giveaway';
  name: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

export type KnownUser = {
  id: string;
  username: string;
  win_count: number;
};

export function useUserEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setKnownUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [eventsRes, knownRes] = await Promise.all([
      supabase
        .from('user_events')
        .select('id, type, name, data, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_known_users')
        .select('id, username, win_count')
        .eq('user_id', user.id)
        .order('win_count', { ascending: false }),
    ]);
    if (eventsRes.error) {
      console.error('Failed to load user events:', eventsRes.error.message);
    } else {
      setEvents((eventsRes.data as UserEvent[]) ?? []);
    }
    if (knownRes.error) {
      console.error('Failed to load known users:', knownRes.error.message);
    } else {
      setKnownUsers((knownRes.data as KnownUser[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const addEvent = useCallback(async (type: 'auction' | 'giveaway', name: string | null, data: Record<string, unknown>) => {
    if (!user) return;
    const { data: inserted, error } = await supabase
      .from('user_events')
      .insert({ type, name, data })
      .select('id, type, name, data, created_at')
      .maybeSingle();
    if (error) {
      console.error('Failed to save event:', error.message);
      return;
    }
    if (inserted) {
      setEvents((prev) => [inserted as UserEvent, ...prev]);
    }
  }, [user]);

  const upsertParticipants = useCallback(async (usernames: string[]) => {
    if (!user || usernames.length === 0) return;
    const rows = usernames.map((u) => ({ user_id: user.id, username: u }));
    const { error } = await supabase
      .from('user_known_users')
      .upsert(rows, { onConflict: 'user_id,username', ignoreDuplicates: true });
    if (error) {
      console.error('Failed to upsert participants:', error.message);
    }
  }, [user]);

  const incrementWinner = useCallback(async (username: string) => {
    if (!user || !username) return;
    const { error: upsertError } = await supabase
      .from('user_known_users')
      .upsert(
        { user_id: user.id, username, win_count: 0 },
        { onConflict: 'user_id,username', ignoreDuplicates: true },
      );
    if (upsertError) {
      console.error('Failed to upsert winner:', upsertError.message);
      return;
    }
    const { error: rpcError } = await supabase.rpc('increment_win_count', {
      p_user_id: user.id,
      p_username: username,
    });
    if (rpcError) {
      console.error('Failed to increment win count:', rpcError.message);
      return;
    }
    setKnownUsers((prev) => {
      const existing = prev.find((u) => u.username === username);
      if (existing) {
        return prev.map((u) => (u.username === username ? { ...u, win_count: u.win_count + 1 } : u));
      }
      return [{ id: '', username, win_count: 1 }, ...prev];
    });
  }, [user]);

  const clearAllData = useCallback(async () => {
    if (!user) return;
    const [eventsDel, knownDel] = await Promise.all([
      supabase.from('user_events').delete().eq('user_id', user.id),
      supabase.from('user_known_users').delete().eq('user_id', user.id),
    ]);
    if (eventsDel.error) throw eventsDel.error;
    if (knownDel.error) throw knownDel.error;
    setEvents([]);
    setKnownUsers([]);
  }, [user]);

  return { events, knownUsers, loading, addEvent, upsertParticipants, incrementWinner, refetch: fetchEvents, clearAllData };
}
