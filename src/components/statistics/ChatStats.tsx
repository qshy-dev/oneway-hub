import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Play, Square } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type ChatMessage } from '@/components/giveaways/types';
import { useTwitchChat, type ConnectionStatus } from '@/components/giveaways/useTwitchChat';

interface LiveChatter {
  userId: string;
  username: string;
  displayName: string;
  color: string;
  count: number;
  lastSeen: number;
  emotes: Record<string, number>;
}

interface HistoricalChatter {
  chatter_twitch_id: string;
  chatter_twitch_username: string | null;
  chatter_display_name: string | null;
  message_count: number;
  last_seen_at: string | null;
  top_7tv_emotes: Record<string, number>;
}

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const UPLOAD_INTERVAL_MS = 30000;
const statusMeta: Record<ConnectionStatus, { labelKey: string; color: string; dot: string }> = {
  disconnected: { labelKey: 'gw_status_disconnected', color: 'text-red-400', dot: 'bg-red-500' },
  connecting: { labelKey: 'gw_status_connecting', color: 'text-ink-300', dot: 'bg-ink-400' },
  connected: { labelKey: 'gw_status_connected', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  reconnecting: { labelKey: 'gw_status_reconnecting', color: 'text-amber-400', dot: 'bg-amber-500' },
};

function countEmojis(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const matches = text.match(EMOJI_PATTERN);
  if (!matches) return out;
  for (const m of matches) out[m] = (out[m] || 0) + 1;
  return out;
}

let channelEmoteCache: Record<string, boolean> | null = null;
async function loadChannelSevenTv(channel: string): Promise<Record<string, boolean>> {
  if (channelEmoteCache) return channelEmoteCache;
  const map: Record<string, boolean> = {};
  try {
    const r = await fetch('https://7tv.io/v3/emote-sets/global');
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j?.emotes)) for (const e of j.emotes) if (e?.name) map[e.name.toLowerCase()] = true;
    }
  } catch { /* ignore */ }
  try {
    const r = await fetch(`https://7tv.io/v3/users/twitch/${encodeURIComponent(channel)}`);
    if (r.ok) {
      const j = await r.json();
      const sets = j?.emote_sets;
      if (sets) for (const key of Object.keys(sets)) {
        const arr = sets[key]?.emotes;
        if (Array.isArray(arr)) for (const e of arr) if (e?.name) map[e.name.toLowerCase()] = true;
      }
    }
  } catch { /* ignore */ }
  channelEmoteCache = map;
  return map;
}

interface UploadItems {
  chatter_twitch_id: string;
  chatter_twitch_username: string;
  chatter_display_name: string;
  message_count: number;
  last_seen_at: string;
  top_7tv_emotes: Record<string, number>;
}

interface UploadEmojiItems {
  chatter_twitch_id: string;
  emoji: string;
  is_7tv: boolean;
  count: number;
}

async function uploadStats(token: string, streamerTwitchId: string, items: UploadItems[], emojiItems: UploadEmojiItems[]) {
  try {
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/record-chat-stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, streamer_twitch_id: streamerTwitchId, items, emoji_items: emojiItems }),
    });
  } catch { /* best-effort */ }
}

export function ChatStats() {
  const { t } = useI18n();
  const { profile, user, session } = useAuth();
  const [channelInput, setChannelInput] = useState(profile?.twitch_username ?? '');
  const [connectedChannel, setConnectedChannel] = useState('');
  const [, setLiveChatters] = useState<LiveChatter[]>([]);
  const [, setHistorical] = useState<HistoricalChatter[]>([]);
  const [, setHistLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [, setSevenTvReady] = useState(false);
  const [liveMessageCount, setLiveMessageCount] = useState(0);

  const liveMapRef = useRef<Map<string, LiveChatter>>(new Map());
  const connectedChannelRef = useRef('');
  const sevenTvRef = useRef<Record<string, boolean> | null>(null);

  const handleMessage = useCallback((msg: ChatMessage) => {
    setLiveMessageCount((c) => c + 1);
    const map = liveMapRef.current;
    let s = map.get(msg.userId);
    if (!s) {
      s = { userId: msg.userId, username: msg.username, displayName: msg.displayName, color: msg.color, count: 0, lastSeen: msg.timestamp, emotes: {} };
      map.set(msg.userId, s);
    }
    s.count++;
    s.lastSeen = msg.timestamp;
    if (msg.displayName) s.displayName = msg.displayName;
    if (msg.color) s.color = msg.color;
    const emojis = countEmojis(msg.text);
    for (const [e, c] of Object.entries(emojis)) s.emotes[e] = (s.emotes[e] || 0) + c;
    const seven = sevenTvRef.current;
    if (seven) {
      for (const w of msg.text.split(/\s+/)) {
        const key = w.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (key && seven[key]) s.emotes['7tv:' + key] = (s.emotes['7tv:' + key] || 0) + 1;
      }
    }
  }, []);

  const liveRefreshRef = useRef(handleMessage);
  liveRefreshRef.current = handleMessage;
  useEffect(() => {
    const iv = setInterval(() => {
      const map = liveMapRef.current;
      if (map.size === 0) return;
      setLiveChatters([...map.values()].sort((a, b) => b.count - a.count));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const chat = useTwitchChat({
    onMessage: (m) => liveRefreshRef.current(m),
    onLog: () => {},
    t,
  });

  useEffect(() => {
    const chan = connectedChannelRef.current;
    if (!chan) return;
    setSevenTvReady(false);
    loadChannelSevenTv(chan).then((m) => { sevenTvRef.current = m; setSevenTvReady(true); });
  }, [connectedChannel]);

  useEffect(() => {
    if (profile?.twitch_username && !connectedChannelRef.current) {
      setChannelInput(profile.twitch_username);
    }
  }, [profile?.twitch_username]);

  const loadHistorical = useCallback(async (twitchId: string | null) => {
    const { supabase } = await import('@/lib/supabase');
    if (!twitchId) return;
    setHistLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_chat_message_stats', { p_streamer_twitch_id: twitchId });
      if (!error && Array.isArray(data)) {
        const rows = data.map((r: HistoricalChatter) => ({ ...r, message_count: Number(r.message_count) || 0 }));
        setHistorical(rows.sort((a, b) => b.message_count - a.message_count));
      }
    } finally {
      setHistLoading(false);
    }
  }, []);

  const connectChannel = useCallback(async () => {
    const chan = channelInput.trim().toLowerCase().replace(/^#/, '');
    if (!chan || !user) return;
    setSessionToken(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-game-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ game_id: 'chatstats' }),
      });
      const data = await res.json();
      if (data?.token) setSessionToken(data.token);
    } catch { /* token optional */ }
    connectedChannelRef.current = chan;
    setConnectedChannel(chan);
    chat.connect(chan);
    loadHistorical(profile?.twitch_id ?? null);
  }, [chat, channelInput, profile?.twitch_id, user]);

  const disconnectChannel = useCallback(() => {
    chat.disconnect();
    connectedChannelRef.current = '';
    setConnectedChannel('');
    liveMapRef.current.clear();
    setLiveChatters([]);
    setLiveMessageCount(0);
  }, [chat]);

  useEffect(() => {
    if (!connectedChannel || !sessionToken || !profile?.twitch_id) return;
    const iv = setInterval(() => {
      const map = liveMapRef.current;
      if (map.size === 0) return;
      const items: UploadItems[] = [...map.values()].map((s) => ({
        chatter_twitch_id: s.userId,
        chatter_twitch_username: s.username,
        chatter_display_name: s.displayName,
        message_count: s.count,
        last_seen_at: new Date(s.lastSeen).toISOString(),
        top_7tv_emotes: s.emotes,
      }));
      const emojiItems: UploadEmojiItems[] = [...map.values()].flatMap((s) =>
        Object.entries(s.emotes).map(([emoji, count]) => ({
          chatter_twitch_id: s.userId,
          emoji: emoji.startsWith('7tv:') ? emoji.slice(4) : emoji,
          is_7tv: emoji.startsWith('7tv:'),
          count,
        }))
      );
      void uploadStats(sessionToken, profile.twitch_id!, items, emojiItems);
    }, UPLOAD_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [connectedChannel, sessionToken, profile?.twitch_id]);

  const m = statusMeta[chat.status] ?? statusMeta.disconnected;
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/30 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${m.dot} ${chat.status === 'reconnecting' || chat.status === 'connecting' ? 'animate-pulse' : ''}`} />
        <span className={`text-sm font-medium ${m.color}`}>{t(m.labelKey)}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/50 px-3 py-1.5">
          <MessageCircle className="h-4 w-4 text-ink-400" />
          <span className="text-sm font-bold text-ink-100 tabular-nums">{liveMessageCount.toLocaleString()}</span>
        </div>
        {connectedChannel ? (
          <button onClick={disconnectChannel} className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/20">
            <Square className="h-4 w-4" /> {t('chatstats_stop')}
          </button>
        ) : (
          <button onClick={connectChannel} className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-semibold text-ink-100 transition hover:border-accent-500/50 hover:text-accent-400">
            <Play className="h-4 w-4" /> {t('chatstats_start')}
          </button>
        )}
      </div>

      {!connectedChannel && (
        <div className="mb-4 flex items-center gap-2">
          <input
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            placeholder={t('chatstats_channel_placeholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') connectChannel(); }}
            className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none"
          />
        </div>
      )}

      {!connectedChannel && (
        <p className="text-sm text-ink-500">{t('chatstats_connect_hint')}</p>
      )}
    </div>
  );
}