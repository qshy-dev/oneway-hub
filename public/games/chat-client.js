/* ChatClient — minimal Twitch IRC client for browser-source game pages.
 * Connects anonymously to Twitch IRC, parses PRIVMSG, and dispatches chat
 * commands. Also tracks per-chatter message counts and 7TV emote usage for
 * later upload to the server.
 */
(function (global) {
  const TWITCH_IRC_URL = 'wss://irc-ws.chat.twitch.tv:443';

  class ChatClient {
    constructor(options) {
      this.channel = (options.channel || '').replace(/^#/, '').toLowerCase();
      this.command = (options.command || '').trim().toLowerCase();
      this.onCommand = options.onCommand || (() => {});
      this.onMessage = options.onMessage || (() => {});
      this.onStatus = options.onStatus || (() => {});
      this.gameToken = options.gameToken || '';
      this.streamerTwitchId = options.streamerTwitchId || '';
      this.ws = null;
      this.reconnectTimer = null;
      this.shouldConnect = false;
      this.msgCount = 0;
      this.chatterStats = new Map(); // userId -> {username, displayName, color, count, lastSeen, emotes}
      this._sevenTvCache = null;
      this._sevenTvPromise = null;
    }

    connect() {
      this.shouldConnect = true;
      this._open();
    }

    disconnect() {
      this.shouldConnect = false;
      if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
      if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
      this.onStatus('disconnected');
    }

    _open() {
      if (!this.shouldConnect || !this.channel) return;
      this.onStatus('connecting');
      const ws = new WebSocket(TWITCH_IRC_URL);
      this.ws = ws;
      ws.onopen = () => {
        ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');
        ws.send('NICK justinfan' + Math.floor(Math.random() * 99999));
        ws.send('JOIN #' + this.channel);
        this.onStatus('connected');
        this._loadSevenTv();
      };
      ws.onmessage = (ev) => {
        const lines = String(ev.data).split('\n');
        for (const raw of lines) {
          const line = raw.trim();
          if (!line) continue;
          if (line.startsWith('PING')) { ws.send('PONG :tmi.twitch.tv'); continue; }
          this._handleLine(line);
        }
      };
      ws.onerror = () => { this.onStatus('error'); };
      ws.onclose = () => {
        this.ws = null;
        if (!this.shouldConnect) { this.onStatus('disconnected'); return; }
        this.onStatus('reconnecting');
        this.reconnectTimer = setTimeout(() => this._open(), 3000);
      };
    }

    _handleLine(line) {
      if (!line.startsWith('@')) return;
      const spaceIdx = line.indexOf(' ');
      if (spaceIdx === -1) return;
      const tagsPart = line.slice(1, spaceIdx);
      const rest = line.slice(spaceIdx + 1);
      const tags = {};
      for (const pair of tagsPart.split(';')) {
        const idx = pair.indexOf('=');
        if (idx === -1) { tags[pair] = ''; continue; }
        tags[pair.slice(0, idx)] = pair.slice(idx + 1);
      }
      const privMatch = rest.match(/^:(\w+)!\w+@\w+\.twitch\.tv PRIVMSG #\S+ :([\s\S]*)$/);
      if (!privMatch) return;
      const username = privMatch[1];
      const text = privMatch[2].replace(/\r$/, '');
      const userId = tags['user-id'] || username.toLowerCase();
      const displayName = tags['display-name'] || username;
      const color = tags['color'] || '#bf7fff';
      this.msgCount++;
      this._trackChatter(userId, username, displayName, color, text);
      const msg = { userId, username, displayName, color, text, timestamp: Date.now() };
      this.onMessage(msg);
      if (this.command && text.toLowerCase().startsWith(this.command)) {
        this.onCommand(msg);
      }
    }

    _trackChatter(userId, username, displayName, color, text) {
      let s = this.chatterStats.get(userId);
      if (!s) {
        s = { userId, username, displayName, color, count: 0, lastSeen: Date.now(), emotes: {} };
        this.chatterStats.set(userId, s);
      }
      s.count++;
      s.lastSeen = Date.now();
      if (displayName) s.displayName = displayName;
      if (color) s.color = color;
      this._countSevenTvEmotes(text, s);
    }

    async _loadSevenTv() {
      if (this._sevenTvPromise) return this._sevenTvPromise;
      this._sevenTvPromise = (async () => {
        try {
          const map = {};
          // global emotes
          try {
            const r = await fetch('https://7tv.io/v3/emote-sets/global');
            if (r.ok) {
              const j = await r.json();
              const emotes = j?.emotes;
              if (Array.isArray(emotes)) {
                for (const e of emotes) {
                  if (e?.name) map[e.name.toLowerCase()] = true;
                }
              }
            }
          } catch (e) {}
          // channel emotes
          if (this.channel) {
            try {
              const r = await fetch('https://7tv.io/v3/users/twitch/' + encodeURIComponent(this.channel));
              if (r.ok) {
                const j = await r.json();
                const sets = j?.emote_sets;
                if (sets) {
                  for (const key of Object.keys(sets)) {
                    const arr = sets[key]?.emotes;
                    if (Array.isArray(arr)) {
                      for (const e of arr) {
                        if (e?.name) map[e.name.toLowerCase()] = true;
                      }
                    }
                  }
                }
              }
            } catch (e) {}
          }
          this._sevenTvCache = map;
        } catch (e) {
          this._sevenTvCache = {};
        }
      })();
      return this._sevenTvPromise;
    }

    _countSevenTvEmotes(text, stats) {
      if (!this._sevenTvCache) return;
      const words = text.split(/\s+/);
      for (const w of words) {
        const key = w.toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (key && this._sevenTvCache[key]) {
          stats.emotes[key] = (stats.emotes[key] || 0) + 1;
        }
      }
    }

    async uploadChatStats() {
      if (!this.gameToken || !this.streamerTwitchId || this.chatterStats.size === 0) return;
      const items = [];
      for (const s of this.chatterStats.values()) {
        items.push({
          streamer_twitch_id: this.streamerTwitchId,
          chatter_twitch_id: s.userId,
          chatter_twitch_username: s.username,
          chatter_display_name: s.displayName,
          message_count: s.count,
          last_seen_at: s.lastSeen,
          top_7tv_emotes: s.emotes,
        });
      }
      try {
        await fetch('/functions/v1/record-chat-stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this.gameToken, streamer_twitch_id: this.streamerTwitchId, items }),
        });
      } catch (e) {}
    }

    async sendGameResult(payload) {
      if (!this.gameToken) return;
      try {
        await fetch('/functions/v1/record-game-result', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this.gameToken, ...payload }),
        });
      } catch (e) {}
    }
  }

  global.ChatClient = ChatClient;
})(window);