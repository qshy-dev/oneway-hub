import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, type Profile } from "./supabase";
import { callEdge } from "./edge";
export interface AnalyticsSnapshot {
  updated_at: string;
  channel: {
    title?: string;
    game_name?: string;
    broadcaster_language?: string;
    tags?: string[];
  } | null;
  stream: {
    title: string;
    game_name: string;
    viewer_count: number;
    started_at: string;
  } | null;
  followers: number | null;
  subscribers: number | null;
  videos: {
    id: string;
    title: string;
    url: string;
    thumbnail_url: string;
    created_at: string;
    duration: string;
    view_count: number;
  }[];
  clips: {
    id: string;
    title: string;
    url: string;
    thumbnail_url: string;
    view_count: number;
    creator_name: string;
  }[];
  schedule: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    canceled_until: string | null;
    category?: { name: string };
  }[];
  warnings: string[];
}
export interface AnalyticsSession {
  id: string;
  title: string | null;
  game_name: string | null;
  started_at: string;
  ended_at: string | null;
  peak_viewers: number | null;
  avg_viewers: number | null;
  viewer_samples: number;
  last_observed_at: string | null;
}
export interface AnalyticsSummary {
  followers: number | null;
  avg_viewers_30d: number | null;
  peak_viewers_30d: number | null;
  hours_streamed_30d: number | null;
  streams_30d: number;
  chatters_30d: number | null;
  messages_30d: number | null;
}
const inFlight = new Map<string, Promise<AnalyticsSnapshot>>();
export function useChannelAnalytics(profile: Profile | null, owner: boolean) {
  const id = profile?.id;
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const current = generation.current;
    if (!owner) {
      const { data, error } = await supabase.rpc(
        "get_public_channel_analytics",
        { p_user_id: id },
      );
      if (current !== generation.current) return;
      if (error) setError("Публичная статистика временно недоступна.");
      else {
        setSnapshot(data?.snapshot ?? null);
        setSummary(data?.summary ?? null);
        setSessions(data?.sessions ?? []);
      }
      setLoading(false);
      return;
    }
    const results = await Promise.all([
      supabase
        .from("channel_analytics")
        .select("snapshot")
        .eq("user_id", id)
        .maybeSingle(),
      supabase.rpc("get_twitch_channel_stats_30d", { p_user_id: id }),
      supabase
        .from("twitch_stream_sessions")
        .select(
          "id,title,game_name,started_at,ended_at,peak_viewers,avg_viewers,viewer_samples,last_observed_at",
        )
        .eq("user_id", id)
        .gte("started_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("started_at", { ascending: false })
        .limit(100),
    ]);
    if (current !== generation.current) return;
    const [snap, stats, streams] = results;
    if (!snap.error) setSnapshot(snap.data?.snapshot ?? null);
    if (!stats.error)
      setSummary(
        Array.isArray(stats.data) ? (stats.data[0] ?? null) : stats.data,
      );
    if (!streams.error) setSessions(streams.data ?? []);
    if (results.some((r) => r.error))
      setError(
        "Часть сохранённых данных недоступна. Проверьте установку обновлений сервера.",
      );
    setLoading(false);
  }, [id, owner]);
  const refresh = useCallback(async () => {
    if (!owner || !id) return;
    const current = generation.current;
    setSyncing(true);
    setError(null);
    try {
      let promise = inFlight.get(id);
      if (!promise) {
        promise = callEdge<AnalyticsSnapshot>("twitch-channel-sync").finally(
          () => inFlight.delete(id),
        );
        inFlight.set(id, promise);
      }
      const result = await promise;
      if (current !== generation.current) return;
      setSnapshot(result);
      await load();
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error ? e.message : "Не удалось обновить статистику.",
        );
    } finally {
      if (current === generation.current) setSyncing(false);
    }
  }, [id, owner, load]);
  useEffect(() => {
    const current = ++generation.current;
    setSnapshot(null);
    setSummary(null);
    setSessions([]);
    setError(null);
    setLoading(true);
    void load();
    return () => {
      generation.current = current + 1;
    };
  }, [load]);
  useEffect(() => {
    if (!owner || !id) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [id, owner, refresh]);
  return { snapshot, summary, sessions, loading, syncing, error, refresh };
}
