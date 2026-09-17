import { useCallback, useEffect, useRef, useState } from 'react';
import type { BotChatMessage, BotChannel, BotConfig, BotConnectionStatus, BotLog, ChattersResponse, ViewerInfo } from './types';
import type { ChatterRole } from '../giveaways/types';

const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 15000, 30000];

interface UseBotChatOptions {
  token: string | null;
  onMessage: (msg: BotChatMessage) => void;
  onLog: (log: BotLog) => void;
  onStatusChange?: (status: BotConnectionStatus) => void;
  onViewerCountChange?: (channelName: string, info: ViewerInfo) => void;
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

function parseIrcMessage(line: string): BotChatMessage | null {
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

  const match = rest.match(/^:\S+ PRIVMSG #(\S+) :([\s\S]*)$/);
  if (!match) return null;

  const channelName = match[1];
  const text = match[2].replace(/\r$/, '');

  const nickMatch = rest.match(/^:(\w+)!\w+@\w+/);
  const username = nickMatch ? nickMatch[1] : '';
  if (!username) return null;

  const badges = (tags['badges'] ?? '').split(',').filter(Boolean);
  const roles = parseRoles(tags);
  const userId = tags['user-id'] || username.toLowerCase();
  const displayName = tags['display-name'] || username;
  const color = tags['color'] || null;

  return {
    id: `m${msgIdCounter++}`,
    channelId: channelName,
    channelName,
    userId,
    username,
    displayName,
    color,
    text,
    badges,
    roles,
    timestamp: Date.now(),
  };
}

function buildPongLine(line: string): string | null {
  if (line.startsWith('PING')) {
    const match = line.match(/^PING :(.*)$/);
    return match ? `PONG :${match[1]}` : 'PONG :tmi.twitch.tv';
  }
  return null;
}

export function useBotChat({ token, onMessage, onLog, onStatusChange, onViewerCountChange, t }: UseBotChatOptions) {
  const [status, setStatus] = useState<BotConnectionStatus>('disconnected');
  const [channels, setChannels] = useState<BotChannel[]>([]);
  const [connectedChannels, setConnectedChannels] = useState<Set<string>>(new Set());
  const [viewers, setViewers] = useState<Record<string, ViewerInfo>>({});
  const [authStatus, setAuthStatus] = useState<'unauthorized' | 'authorized' | 'checking' | 'error'>('checking');
  const [botInfo, setBotInfo] = useState<BotConfig | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldConnectRef = useRef(false);
  const viewersTimerRef = useRef<number | null>(null);
  const statusRef = useRef<BotConnectionStatus>('disconnected');
  statusRef.current = status;

  const setStatusAll = useCallback((s: BotConnectionStatus) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  const apiHeaders = useCallback(() => ({
    Authorization: `Bearer ${token ?? ''}`,
  }), [token]);

  const fetchBotConfig = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-auth?action=check`,
        { headers: apiHeaders() },
      );

      if (!res.ok) {
        setAuthStatus('error');
        return null;
      }

      const data = await res.json();
      if (!data.connected) {
        setAuthStatus('unauthorized');
        return null;
      }

      setBotInfo({
        connected: true,
        bot_username: data.bot_username,
        bot_twitch_user_id: data.bot_twitch_user_id,
        bot_display_name: data.bot_display_name,
        access_token: data.access_token,
        scopes: data.scopes,
      });

      setAuthStatus('authorized');
      return data;
    } catch (e) {
      console.error('Bot config fetch error:', e);
      setAuthStatus('error');
      return null;
    }
  }, [apiHeaders]);

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-auth?action=channels`,
        { headers: apiHeaders() },
      );

      if (!res.ok) {
        onLog({ id: `l${msgIdCounter++}`, type: 'error', text: t('bot_channels_load_error'), timestamp: Date.now() });
        return [];
      }

      const data = await res.json();
      const channelList: BotChannel[] = data.channels ?? [];
      setChannels(channelList);
      onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_channels_loaded', String(channelList.length)), timestamp: Date.now() });
      return channelList;
    } catch (e) {
      console.error('Channel load error:', e);
      onLog({ id: `l${msgIdCounter++}`, type: 'error', text: t('bot_channels_load_error'), timestamp: Date.now() });
      return [];
    }
  }, [apiHeaders, onLog, t]);

  const fetchViewers = useCallback(async (chan: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-chat?action=viewers&channel=${encodeURIComponent(chan)}`,
        {
          headers: apiHeaders(),
          cache: 'no-store',
        },
      );
      if (!res.ok) return;
      const data = await res.json();
      const info: ViewerInfo = { channel: chan, live: !!data.live, viewers: data.viewers ?? 0 };
      setViewers((prev) => ({ ...prev, [chan]: info }));
      onViewerCountChange?.(chan, info);
    } catch {
      // ignore — viewer count is best-effort
    }
  }, [apiHeaders, onViewerCountChange]);

  const fetchChatters = useCallback(async (broadcasterId: string): Promise<ChattersResponse[]> => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-chat?action=get_chatters&broadcaster_id=${encodeURIComponent(broadcasterId)}`,
        {
          headers: apiHeaders(),
          cache: 'no-store',
        },
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.chatters ?? [];
    } catch {
      return [];
    }
  }, [apiHeaders]);

  const sendChatMessage = useCallback(async (channelName: string, message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(`PRIVMSG #${channelName} :${message}`);
      return true;
    }
    return false;
  }, []);

  const sendMessageViaHelix = useCallback(async (channelId: string, message: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-chat?action=send`,
        {
          method: 'POST',
          headers: {
            ...apiHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            broadcaster_id: channelId,
            message,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        onLog({ id: `l${msgIdCounter++}`, type: 'error', text: t('bot_send_error', data.error ?? ''), timestamp: Date.now() });
      } else {
        onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_sent', message), timestamp: Date.now() });
      }
      return res.ok;
    } catch (e) {
      onLog({ id: `l${msgIdCounter++}`, type: 'error', text: t('bot_send_error', String(e)), timestamp: Date.now() });
      return false;
    }
  }, [apiHeaders, onLog, t]);

  const processCommand = useCallback(async (msg: BotChatMessage) => {
    if (!msg.text.startsWith('!')) return;

    const command = msg.text.slice(1).split(/[\s]/)[0].toLowerCase();

    onLog({
      id: `l${msgIdCounter++}`,
      type: 'command',
      text: t('bot_command_received', msg.text, msg.displayName),
      timestamp: Date.now(),
    });

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-command`,
        {
          method: 'POST',
          headers: {
            ...apiHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            command,
            message: msg.text,
            channelId: msg.channelId,
            channelName: msg.channelName,
            userId: msg.userId,
            username: msg.username,
            displayName: msg.displayName,
            roles: msg.roles,
          }),
        },
      );

      const data = await res.json();

      if (data.output) {
        console.log(`[Bot] Command output for ${command}:`, data.output);
        onLog({
          id: `l${msgIdCounter++}`,
          type: 'message',
          text: t('bot_command_output', data.output),
          timestamp: Date.now(),
        });
      }

      if (data.reply) {
        await sendChatMessage(msg.channelName, data.reply);
      }
    } catch (e) {
      console.error('Command processing error:', e);
      onLog({
        id: `l${msgIdCounter++}`,
        type: 'error',
        text: t('bot_command_error', String(e)),
        timestamp: Date.now(),
      });
    }
  }, [apiHeaders, onLog, sendChatMessage, t]);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current != null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (viewersTimerRef.current) {
      clearInterval(viewersTimerRef.current);
      viewersTimerRef.current = null;
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

  const connectInternal = useCallback(() => {
    if (!botInfo?.access_token || !botInfo?.bot_username) return;

    cleanup();
    setStatusAll(statusRef.current === 'disconnected' ? 'connecting' : 'reconnecting');
    onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_log_connecting'), timestamp: Date.now() });

    const ws = new WebSocket(TWITCH_IRC_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
      ws.send(`PASS oauth:${botInfo.access_token}`);
      ws.send(`NICK ${botInfo.bot_username}`);

      reconnectAttemptRef.current = 0;
      setStatusAll('connected');
      onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_log_connected', botInfo.bot_username), timestamp: Date.now() });

      const channelsToJoin = channels.filter((c) => c.enabled).map((c) => c.channel_name);
      for (const chan of channelsToJoin) {
        ws.send(`JOIN #${chan}`);
        setConnectedChannels((prev) => new Set([...prev, chan]));
        fetchViewers(chan);
      }

      if (channelsToJoin.length > 0) {
        viewersTimerRef.current = window.setInterval(() => {
          for (const chan of channelsToJoin) {
            fetchViewers(chan);
          }
        }, 60000);
      }
    };

    ws.onmessage = (event) => {
      const data = String(event.data);
      const lines = data.split('\n');
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;

        if (line.startsWith('PING')) {
          const pong = buildPongLine(line);
          if (pong) ws.send(pong);
          continue;
        }

        const msg = parseIrcMessage(line);
        if (msg) {
          const matchedChannel = channels.find((c) => c.channel_name === msg.channelName);
          msg.channelId = matchedChannel?.twitch_channel_id ?? msg.channelName;

          onMessage(msg);

          if (msg.text.startsWith('!')) {
            processCommand(msg);
          }
        }
      }
    };

    ws.onerror = () => {
      onLog({ id: `l${msgIdCounter++}`, type: 'error', text: t('bot_log_ws_error'), timestamp: Date.now() });
    };

    ws.onclose = () => {
      wsRef.current = null;
      setConnectedChannels(new Set());
      if (viewersTimerRef.current) { clearInterval(viewersTimerRef.current); viewersTimerRef.current = null; }
      if (!shouldConnectRef.current) {
        setStatusAll('disconnected');
        return;
      }
      const attempt = reconnectAttemptRef.current++;
      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
      setStatusAll('reconnecting');
      onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_log_reconnecting', String(Math.round(delay / 1000))), timestamp: Date.now() });
      reconnectTimerRef.current = window.setTimeout(() => {
        if (shouldConnectRef.current) connectInternal();
      }, delay);
    };
  }, [botInfo, channels, cleanup, setStatusAll, onLog, onMessage, processCommand, t, fetchViewers]);

  const connect = useCallback(async (channelName: string) => {
    const normalized = channelName.trim().toLowerCase().replace(/^#/, '');
    if (!normalized || !botInfo?.access_token) return;

    try {
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-auth?action=channels`,
        {
          method: 'POST',
          headers: {
            ...apiHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel_name: normalized,
          }),
        },
      );
    } catch (e) {
      console.error('Failed to add channel:', e);
    }

    setChannels((prev) => {
      if (prev.some((c) => c.channel_name === normalized)) return prev;
      return [
        ...prev,
        { id: '', twitch_channel_id: '', channel_name: normalized, enabled: true, created_at: new Date().toISOString() },
      ];
    });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(`JOIN #${normalized}`);
      setConnectedChannels((prev) => new Set([...prev, normalized]));
      fetchViewers(normalized);
    }

    onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_joined_channel', normalized), timestamp: Date.now() });
  }, [botInfo?.access_token, apiHeaders, fetchViewers, onLog, t]);

  const disconnect = useCallback((channelName?: string) => {
    if (channelName) {
      const normalized = channelName.trim().toLowerCase().replace(/^#/, '');
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(`PART #${normalized}`);
      }
      setConnectedChannels((prev) => {
        const next = new Set(prev);
        next.delete(normalized);
        return next;
      });
      onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_left_channel', normalized), timestamp: Date.now() });
    } else {
      shouldConnectRef.current = false;
      cleanup();
      setStatusAll('disconnected');
      onLog({ id: `l${msgIdCounter++}`, type: 'event', text: t('bot_log_disconnected'), timestamp: Date.now() });
    }
  }, [cleanup, setStatusAll, onLog, t]);

  const connectAll = useCallback(() => {
    if (!botInfo) return;
    shouldConnectRef.current = true;
    connectInternal();
  }, [botInfo, connectInternal]);

  const disconnectAll = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const refreshViewers = useCallback(() => {
    for (const chan of Array.from(connectedChannels)) {
      fetchViewers(chan);
    }
  }, [fetchViewers, connectedChannels]);

  const initiateBotAuth = useCallback(async () => {
    if (!token) {
      onLog({ id: `l${msgIdCounter++}`, type: 'error', text: 'Сначала войдите в аккаунт через Twitch', timestamp: Date.now() });
      return;
    }
    try {
      const returnTo = window.location.href;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twitch-bot-auth?action=oauth_url&return_to=${encodeURIComponent(returnTo)}`,
        { headers: apiHeaders() },
      );
      const data = await res.json();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        onLog({ id: `l${msgIdCounter++}`, type: 'error', text: data.error ?? t('bot_auth_error'), timestamp: Date.now() });
      }
    } catch (e) {
      onLog({ id: `l${msgIdCounter++}`, type: 'error', text: String(e), timestamp: Date.now() });
    }
  }, [apiHeaders, onLog, t, token]);

  useEffect(() => {
    if (!token) {
      setAuthStatus('unauthorized');
      return;
    }
    fetchBotConfig();
    loadChannels();
  }, [fetchBotConfig, loadChannels, token]);

  useEffect(() => {
    if (botInfo?.connected && channels.some((c) => c.enabled) && !shouldConnectRef.current) {
      connectAll();
    }
  }, [botInfo?.connected, channels, connectAll]);

  useEffect(() => {
    return () => {
      shouldConnectRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    channels,
    connectedChannels: Array.from(connectedChannels),
    viewers,
    authStatus,
    botInfo,
    connect,
    disconnect,
    connectAll,
    disconnectAll,
    sendMessage: sendChatMessage,
    sendViaHelix: sendMessageViaHelix,
    refreshViewers,
    fetchChatters,
    loadChannels,
    fetchBotConfig,
    initiateBotAuth,
  };
}
