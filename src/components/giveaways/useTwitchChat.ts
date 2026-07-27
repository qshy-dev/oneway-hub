import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatterRole, LogEntry, LogType } from './types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

interface UseTwitchChatOptions {
  onMessage: (msg: ChatMessage) => void;
  onLog: (text: string, type?: LogType) => void;
  t: (key: string, ...args: string[]) => string;
}

let msgIdCounter = 0;

function parseRoles(tags: Record<string, string>): ChatterRole[] {
  const roles: ChatterRole[] = [];
  const badges = tags['badges'] ?? '';
  const badgeSet = new Set(badges.split(',').map((b) => b.split('/')[0]));
  if (badgeSet.has('broadcaster')) roles.push('broadcaster');
  if (tags['mod'] === '1' || badgeSet.has('moderator')) roles.push('mod');
  if (badgeSet.has('vip')) roles.push('vip');
  if (tags['subscriber'] === '1' || badgeSet.has('subscriber')) roles.push('subscriber');
  return roles;
}

function parseIrcMessage(line: string): ChatMessage | null {
  if (!line.startsWith('@')) return null;
  const spaceIdx = line.indexOf(' ');
  if (spaceIdx === -1) return null;
  const tagsPart = line.slice(1, spaceIdx);
  const rest = line.slice(spaceIdx + 1);

  const tags: Record<string, string> = {};
  for (const pair of tagsPart.split(';')) {
    const [k, v] = pair.split('=');
    tags[k] = v ?? '';
  }

  const match = rest.match(/^:\S+ PRIVMSG #\S+ :([\s\S]*)$/);
  if (!match) return null;

  const nickMatch = rest.match(/^:(\w+)!\w+@\w+/);
  const username = nickMatch ? nickMatch[1] : '';
  if (!username) return null;

  const text = match[1].replace(/\r$/, '');
  const userId = tags['user-id'] || username.toLowerCase();
  const displayName = tags['display-name'] || username;
  const color = tags['color'] || '#bf7fff';
  const roles = parseRoles(tags);

  return {
    id: `m${msgIdCounter++}`,
    userId,
    username,
    displayName,
    color,
    text,
    timestamp: Date.now(),
    roles,
  };
}

export function useTwitchChat({ onMessage, onLog, t }: UseTwitchChatOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [channel, setChannel] = useState<string>('');
  const [viewers, setViewers] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const channelRef = useRef<string>('');
  const shouldConnectRef = useRef(false);
  const queueRef = useRef<ChatMessage[]>([]);
  const flushingRef = useRef(false);
  const viewersTimerRef = useRef<number | null>(null);

  const fetchViewers = useCallback(async (chan: string) => {
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-viewers?channel=${encodeURIComponent(chan)}&_=${Date.now()}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data.viewers === 'number') {
        setViewers(data.viewers);
        setLive(!!data.live);
      }
    } catch {
      /* ignore — viewer count is best-effort */
    }
  }, []);

  const flush = useCallback(() => {
    flushingRef.current = true;
    const batch = queueRef.current;
    queueRef.current = [];
    flushingRef.current = false;
    for (const msg of batch) {
      handleMessageRef.current(msg);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    setTimeout(() => {
      flushingRef.current = false;
      flush();
    }, 0);
  }, [flush]);

  const handleMessageRef = useRef(onMessage);
  handleMessageRef.current = onMessage;
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const ws = wsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try { ws.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
  }, []);

  const connectInternal = useCallback((chan: string) => {
    cleanup();
    setStatus(s => (s === 'disconnected' ? 'connecting' : 'reconnecting'));
    onLogRef.current(t('gw_log_connecting', chan), 'event');

    const ws = new WebSocket(TWITCH_IRC_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send('NICK justinfan' + Math.floor(Math.random() * 99999).toString().padStart(5, '0'));
      ws.send('JOIN #' + chan);
      reconnectAttemptRef.current = 0;
      setStatus('connected');
      onLogRef.current(t('gw_log_connected', chan), 'event');
      fetchViewers(chan);
      viewersTimerRef.current = window.setInterval(() => fetchViewers(chan), 60000);
    };

    ws.onmessage = (event) => {
      const data = String(event.data);
      const lines = data.split('\n');
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith('PING')) {
          ws.send('PONG :tmi.twitch.tv');
          continue;
        }
        const msg = parseIrcMessage(line);
        if (msg) {
          queueRef.current.push(msg);
          scheduleFlush();
        }
      }
    };

    ws.onerror = () => {
      onLogRef.current(t('gw_log_ws_error'), 'error');
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (viewersTimerRef.current) { clearInterval(viewersTimerRef.current); viewersTimerRef.current = null; }
      if (!shouldConnectRef.current) {
        setStatus('disconnected');
        setViewers(null);
        setLive(false);
        return;
      }
      const attempt = reconnectAttemptRef.current++;
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
      setStatus('reconnecting');
      onLogRef.current(t('gw_log_reconnecting', String(Math.round(delay / 1000))), 'event');
      reconnectTimerRef.current = window.setTimeout(() => {
        if (shouldConnectRef.current) connectInternal(channelRef.current);
      }, delay);
    };
  }, [cleanup, scheduleFlush]);

  const connect = useCallback((chan: string) => {
    const normalized = chan.trim().toLowerCase().replace(/^#/, '');
    if (!normalized) return;
    channelRef.current = normalized;
    setChannel(normalized);
    shouldConnectRef.current = true;
    reconnectAttemptRef.current = 0;
    connectInternal(normalized);
  }, [connectInternal]);

  const disconnect = useCallback(() => {
    shouldConnectRef.current = false;
    if (viewersTimerRef.current) { clearInterval(viewersTimerRef.current); viewersTimerRef.current = null; }
    cleanup();
    setStatus('disconnected');
    setChannel('');
    setViewers(null);
    setLive(false);
    channelRef.current = '';
    onLogRef.current(t('gw_log_disconnected'), 'event');
  }, [cleanup, onLog, t]);

  useEffect(() => {
    return () => {
      shouldConnectRef.current = false;
      if (viewersTimerRef.current) clearInterval(viewersTimerRef.current);
      cleanup();
    };
  }, [cleanup]);

  const refreshViewers = useCallback(() => {
    if (channelRef.current) fetchViewers(channelRef.current);
  }, [fetchViewers]);

  return { status, channel, connect, disconnect, viewers, live, refreshViewers };
}
