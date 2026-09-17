import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface DailyStat {
  stat_date: string;
  hours_streamed: number;
  streams_count: number;
  peak_viewers: number;
  avg_viewers: number;
  total_messages: number;
  unique_chatters: number;
}

export function useChannelCalendar(userId: string | null, days = 90) {
  const [daysData, setDaysData] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = async () => {
    if (!userId) { setDaysData([]); return; }
    setLoading(true);
    setError(null);
    try {
      const since = new Date();
      since.setDate(since.getDate() - days + 1);
      const sinceStr = since.toISOString().slice(0, 10);
      const [streamRes, chatRes] = await Promise.all([
        supabase.from('twitch_stream_daily_stats').select('stat_date, hours_streamed, streams_count, peak_viewers, avg_viewers, total_messages, unique_chatters').eq('user_id', userId).gte('stat_date', sinceStr).order('stat_date', { ascending: true }),
        supabase.from('twitch_chat_daily_stats').select('stat_date, total_messages, unique_chatters').eq('user_id', userId).gte('stat_date', sinceStr).order('stat_date', { ascending: true }),
      ]);
      const chatMap = new Map<string, DailyStat>();
      for (const c of chatRes.data ?? []) {
        chatMap.set(c.stat_date, {
          stat_date: c.stat_date,
          hours_streamed: 0,
          streams_count: 0,
          peak_viewers: 0,
          avg_viewers: 0,
          total_messages: Number(c.total_messages) || 0,
          unique_chatters: Number(c.unique_chatters) || 0,
        });
      }
      const merged: DailyStat[] = (streamRes.data ?? []).map((s: Record<string, unknown>) => {
        const chat = chatMap.get(s.stat_date as string);
        return {
          stat_date: String(s.stat_date),
          hours_streamed: Number(s.hours_streamed) || 0,
          streams_count: Number(s.streams_count) || 0,
          peak_viewers: Number(s.peak_viewers) || 0,
          avg_viewers: Number(s.avg_viewers) || 0,
total_messages: chat?.total_messages ?? (Number(s.total_messages) || 0),
        unique_chatters: chat?.unique_chatters ?? (Number(s.unique_chatters) || 0),
        };
      });
      for (const [date, chat] of chatMap) {
        if (!merged.some((m) => m.stat_date === date)) merged.push(chat);
      }
      merged.sort((a, b) => a.stat_date.localeCompare(b.stat_date));
      setDaysData(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar');
      setDaysData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCalendar(); }, [userId, days]);

  return { days: daysData, loading, error, refetch: fetchCalendar };
}