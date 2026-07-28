import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug, Play, Square, Trash2, Trophy, RefreshCw, ScrollText,
  Wifi, WifiOff, Loader2, Eye, EyeOff, ChevronDown, Timer,
  Users, SlidersHorizontal,
} from 'lucide-react';
import { useTwitchChat, type ConnectionStatus } from './useTwitchChat';
import { StatsCards } from './StatsCards';
import { ChatFeed } from './ChatFeed';
import { ParticipantTable } from './ParticipantTable';
import { GiveawayRoulette } from './GiveawayRoulette';
import { LogsPanel } from './LogsPanel';
import { HistoryPanel } from './HistoryPanel';
import { ParticipantModal } from './ParticipantModal';
import { GiveawaySettingsModal } from './GiveawaySettingsModal';
import { useI18n } from '@/i18n';
import {
  getMode, modeList,
  type GiveawayModeId, type Participant, type ChatMessage,
  type LogEntry, type LogType, type GiveawayHistoryEntry,
  type RoleWeights,
  DEFAULT_ROLE_WEIGHTS,
} from './types';

type Phase = 'setup' | 'ready' | 'collecting' | 'finished';

const TIMER_PRESETS = [30, 60, 120, 300, 600];

const statusMeta: Record<ConnectionStatus, { labelKey: string; color: string; dot: string }> = {
  disconnected: { labelKey: 'gw_status_disconnected', color: 'text-red-400', dot: 'bg-red-500' },
  connecting: { labelKey: 'gw_status_connecting', color: 'text-ink-300', dot: 'bg-ink-400' },
  connected: { labelKey: 'gw_status_connected', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  reconnecting: { labelKey: 'gw_status_reconnecting', color: 'text-amber-400', dot: 'bg-amber-500' },
};

let logIdCounter = 0;

export function Giveaways() {
  const { t } = useI18n();
  const [channel, setChannel] = useState(() => localStorage.getItem('gw_channel') ?? '');
  const [modeId, setModeId] = useState<GiveawayModeId>(() => (localStorage.getItem('gw_mode_id') as GiveawayModeId) || 'keyword');
  const [config, setConfig] = useState<Record<string, string | number | boolean>>(() => {
    const init: Record<string, string | number | boolean> = {};
    for (const m of modeList) for (const f of m.fields) init[f.key] = f.default;
    const savedKeyword = localStorage.getItem('gw_keyword');
    if (savedKeyword != null) init.keyword = savedKeyword;
    const savedMatchType = localStorage.getItem('gw_match_type');
    if (savedMatchType != null) init.matchType = savedMatchType;
    const savedTargetMode = localStorage.getItem('gw_target_mode');
    if (savedTargetMode != null) init.targetMode = savedTargetMode;
    return init;
  });
  const [useTimer, setUseTimer] = useState(false);
  const [timerSec, setTimerSec] = useState(60);
  const [customTimer, setCustomTimer] = useState('');
  const [showManualTarget, setShowManualTarget] = useState(false);
  const [showRandomTarget, setShowRandomTarget] = useState(false);

  const [phase, setPhase] = useState<Phase>('setup');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messageCount, setMessageCount] = useState(0);
  const [msgPerSec, setMsgPerSec] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [history, setHistory] = useState<GiveawayHistoryEntry[]>(() => loadHistory());
  const [spinSignal, setSpinSignal] = useState(0);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [chatFeed, setChatFeed] = useState<ChatMessage[]>([]);
  const [participantFeed, setParticipantFeed] = useState<ChatMessage[]>([]);
  const [livePulse, setLivePulse] = useState(0);
  const [modalParticipant, setModalParticipant] = useState<Participant | null>(null);
  const [modalIsWinner, setModalIsWinner] = useState(false);
  const [autoStartTimer, setAutoStartTimer] = useState(false);
  const [newGiveawayConfirm, setNewGiveawayConfirm] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [rerollConfirm, setRerollConfirm] = useState(false);
  const [excludedWinnerIds, setExcludedWinnerIds] = useState<Set<string>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roleWeights, setRoleWeights] = useState<RoleWeights>(() => {
    try {
      const saved = localStorage.getItem('gw_role_weights');
      if (saved) return { ...DEFAULT_ROLE_WEIGHTS, ...JSON.parse(saved) } as RoleWeights;
    } catch { /* ignore */ }
    return DEFAULT_ROLE_WEIGHTS;
  });
  const roleWeightsRef = useRef(roleWeights);
  roleWeightsRef.current = roleWeights;
  const saveRoleWeights = useCallback((w: RoleWeights) => {
    setRoleWeights(w);
    localStorage.setItem('gw_role_weights', JSON.stringify(w));
  }, []);

  const participantsMap = useRef<Map<string, Participant>>(new Map());
  const collectStartRef = useRef<number>(0);
  const collectEndRef = useRef<number>(0);
  const timerRafRef = useRef<number | null>(null);
  const msgWindowRef = useRef<number[]>([]);
  const phaseRef = useRef<Phase>('setup');
  phaseRef.current = phase;
  const configRef = useRef(config);
  configRef.current = config;

  const addLog = useCallback((text: string, type: LogType = 'message') => {
    setLogs((prev) => [...prev, { id: `l${logIdCounter++}`, type, text, timestamp: Date.now() }].slice(-1000));
  }, []);

  const { status, channel: connectedChannel, connect, disconnect, viewers, live, refreshViewers } = useTwitchChat({
    onMessage: (msg: ChatMessage) => {
      msgWindowRef.current.push(msg.timestamp);
      setChatFeed((prev) => [...prev, msg].slice(-300));
      setLivePulse((p) => p + 1);
      const mode = getMode(modeIdRef.current);
      mode.handleMessage(msg, {
        config: configRef.current,
        addParticipant: (m) => {
          const existing = participantsMap.current.get(m.userId);
          if (existing) {
            existing.messageCount += 1;
            if (m.roles.length > 0) {
              const set = new Set(existing.roles);
              m.roles.forEach((r) => set.add(r));
              existing.roles = Array.from(set);
            }
            setMessageCount((c) => c + 1);
            setParticipantFeed((prev) => [...prev, m]);
            return existing;
          }
          const p: Participant = {
            id: m.userId,
            username: m.username,
            displayName: m.displayName,
            color: m.color || '#bf7fff',
            avatarUrl: `https://unavatar.io/twitch/${encodeURIComponent(m.username)}`,
            firstSeenAt: m.timestamp,
            messageCount: 1,
            roles: m.roles,
          };
          participantsMap.current.set(m.userId, p);
          setParticipants((prev) => [...prev, p]);
          setMessageCount((c) => c + 1);
          setParticipantFeed((prev) => [...prev, m]);
          addLog(t('gw_log_new_participant', p.displayName), 'participant');
          return p;
        },
        isCollecting: () => phaseRef.current === 'collecting',
        log: addLog,
        declareWinner: (p) => {
          setWinner(p);
          collectEndRef.current = Date.now();
          setPhase('finished');
          pendingWinnerRef.current = p;
          setModalParticipant(p);
          setModalIsWinner(true);
          setAutoStartTimer(true);
          addLog(t('gw_log_winner', p.displayName), 'event');
        },
        t,
      });
    },
    onLog: addLog,
    t,
  });

  const modeIdRef = useRef(modeId);
  modeIdRef.current = modeId;

  // msg/sec calculation every second
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      const cutoff = now - 1000;
      const win = msgWindowRef.current;
      while (win.length > 0 && win[0] < cutoff) win.shift();
      setMsgPerSec(win.length);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // countdown timer
  useEffect(() => {
    if (phase !== 'collecting' || !useTimer) return;
    let raf = 0;
    const tick = () => {
      const end = collectStartRef.current + timerSec * 1000;
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        stopCollecting();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, useTimer, timerSec]);

  const totalTimerSec = useTimer
    ? (customTimer ? Math.max(1, parseInt(customTimer, 10) || 0) : timerSec)
    : 0;
  const timerLabel = phase === 'collecting' && useTimer
    ? formatTime(remaining)
    : useTimer ? formatTime(totalTimerSec) : '∞';

  const handleConnect = () => {
    const ch = channel.trim().toLowerCase().replace(/^#/, '');
    if (!ch) return;
    connect(ch);
    setPhase('ready');
  };

  const handleDisconnect = () => {
    setDisconnectConfirm(true);
  };

  const confirmDisconnect = () => {
    setDisconnectConfirm(false);
    disconnect();
    setPhase('setup');
    resetState();
  };

  const startCollecting = () => {
    if (status !== 'connected') return;
    const resuming = phaseRef.current === 'finished' && participants.length > 0;
    const mode = getMode(modeId);
    let cfg = config;
    if (mode.onCollectStart) {
      cfg = mode.onCollectStart(config);
      setConfig(cfg);
    }
    if (!resuming) {
      participantsMap.current.clear();
      setParticipants([]);
      setMessageCount(0);
      setWinner(null);
      setChatFeed([]);
      setParticipantFeed([]);
      setLivePulse(0);
      setExcludedWinnerIds(new Set());
      setShowRandomTarget(false);
      msgWindowRef.current = [];
    } else {
      setWinner(null);
      setExcludedWinnerIds(new Set());
      setShowRandomTarget(false);
    }
    collectStartRef.current = Date.now();
    setRemaining(totalTimerSec);
    setPhase('collecting');
    addLog(resuming ? t('gw_log_collect_resume') : t('gw_log_collect_start'), 'event');
  };

  const stopCollecting = () => {
    if (phaseRef.current !== 'collecting') return;
    collectEndRef.current = Date.now();
    setPhase('finished');
    addLog(t('gw_log_collect_stop'), 'event');
  };

  const resetState = () => {
    participantsMap.current.clear();
    setParticipants([]);
    setMessageCount(0);
    setMsgPerSec(0);
    setWinner(null);
    setChatFeed([]);
    setParticipantFeed([]);
    setLivePulse(0);
    setExcludedWinnerIds(new Set());
    setPhase('setup');
  };

  const clearParticipants = () => {
    participantsMap.current.clear();
    setParticipants([]);
    setMessageCount(0);
    setChatFeed([]);
    setParticipantFeed([]);
    setLivePulse(0);
    msgWindowRef.current = [];
    addLog(t('gw_log_cleared'), 'event');
  };

  const pickWinner = () => {
    if (participants.length === 0) return;
    if (phaseRef.current === 'collecting') {
      collectEndRef.current = Date.now();
      setPhase('finished');
      addLog(t('gw_log_collect_stop'), 'event');
    }
    setSpinSignal((s) => s + 1);
  };

  const pendingWinnerRef = useRef<Participant | null>(null);

  const commitWinnerToHistory = (p: Participant) => {
    const dur = Math.round((collectEndRef.current - collectStartRef.current) / 1000);
    const entry: GiveawayHistoryEntry = {
      id: `h${Date.now()}`,
      date: Date.now(),
      mode: modeId,
      modeLabel: t(modeId === 'keyword' ? 'gw_mode_keyword' : 'gw_mode_guess_number'),
      participants: participants.length,
      messages: messageCount,
      winner: p.displayName,
      durationSec: dur,
    };
    const next = [entry, ...history].slice(0, 100);
    setHistory(next);
    saveHistory(next);
    addLog(t('gw_log_winner', p.displayName), 'event');
  };

  const onRouletteResult = (p: Participant | null) => {
    if (!p) return;
    setWinner(p);
    pendingWinnerRef.current = p;
    setModalParticipant(p);
    setModalIsWinner(true);
    setAutoStartTimer(true);
  };

  const onWinnerResponded = () => {
    const p = pendingWinnerRef.current;
    if (p) commitWinnerToHistory(p);
  };

  const newGiveaway = () => {
    if (phase === 'collecting' || (phase === 'finished' && participants.length > 0)) {
      setNewGiveawayConfirm(true);
      return;
    }
    resetState();
    pendingWinnerRef.current = null;
    setModalParticipant(null);
    setModalIsWinner(false);
    setAutoStartTimer(false);
    setPhase(status === 'connected' ? 'ready' : 'setup');
  };

  const confirmNewGiveaway = () => {
    setNewGiveawayConfirm(false);
    resetState();
    pendingWinnerRef.current = null;
    setModalParticipant(null);
    setModalIsWinner(false);
    setAutoStartTimer(false);
    setPhase(status === 'connected' ? 'ready' : 'setup');
  };

  const reroll = () => {
    const current = pendingWinnerRef.current;
    if (current) {
      setExcludedWinnerIds((prev) => {
        const next = new Set(prev).add(current.id);
        // If excluding would leave no participants, reset exclusions so roulette can still spin
        if (participants.length - next.size <= 0) return new Set();
        return next;
      });
    }
    pendingWinnerRef.current = null;
    setModalParticipant(null);
    setModalIsWinner(false);
    setAutoStartTimer(false);
    setWinner(null);
    setSpinSignal((s) => s + 1);
  };

  const requestReroll = () => {
    setRerollConfirm(true);
  };

  const confirmReroll = () => {
    setRerollConfirm(false);
    reroll();
  };

  const openParticipantModal = (p: Participant) => {
    setModalParticipant(p);
    setModalIsWinner(false);
    setAutoStartTimer(false);
  };

  const closeModal = () => {
    pendingWinnerRef.current = null;
    setModalParticipant(null);
    setModalIsWinner(false);
    setAutoStartTimer(false);
  };

  const connected = status === 'connected';
  const manualTargetValid = (() => {
    if (modeId !== 'guessNumber' || String(config.targetMode ?? 'random') !== 'manual') return true;
    const v = Number(config.manualTarget);
    return config.manualTarget !== '' && Number.isFinite(v) && v >= Number(config.min ?? 1) && v <= Number(config.max ?? 500);
  })();
  const canStart = connected && (phase === 'ready' || phase === 'finished') && manualTargetValid;
  const canStop = phase === 'collecting';
  const canPick = (phase === 'collecting' || phase === 'finished') && participants.length > 0 && !winner;
  const canNewGiveaway = connected && (phase === 'collecting' || phase === 'finished' || (chatFeed.length > 0 || participants.length > 0));

  const mode = getMode(modeId);
  const modeFields = mode.config.fields;

  return (
    <div className="flex flex-col gap-6">
      {/* Twitch channel connection */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">{t('gw_channel')}</label>
            <div className="flex gap-2">
              <input
                value={channel}
                onChange={(e) => { setChannel(e.target.value); localStorage.setItem('gw_channel', e.target.value); }}
                onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                placeholder={t('gw_channel_placeholder')}
                disabled={connected}
                className="flex h-[42px] flex-1 rounded-lg border border-ink-800 bg-ink-950 px-3 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none disabled:opacity-50"
              />
              {connected ? (
                <button
                  onClick={() => setDisconnectConfirm(true)}
                  className="flex h-[42px] items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/40 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-900/40"
                >
                  <WifiOff className="h-4 w-4" /> {t('gw_disconnect')}
                </button>
              ) : (
                <ControlButton icon={Plug} label={t('gw_connect')} onClick={handleConnect} disabled={!channel.trim() || status === 'connecting'} />
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <StatusBadge status={status} channel={connectedChannel} viewers={viewers} live={live} onRefreshViewers={refreshViewers} />
            <button
              onClick={() => setLogsOpen(true)}
              className="flex h-[42px] items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/70 px-3 text-sm font-medium text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
            >
              <ScrollText className="h-4 w-4" /> {t('gw_logs')}
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
        <ControlButton icon={Play} label={t('gw_start')} onClick={startCollecting} disabled={!canStart} variant="success" />
        <ControlButton icon={Square} label={t('gw_stop')} onClick={stopCollecting} disabled={!canStop} variant="danger" />
        <ControlButton icon={Trophy} label={t('gw_pick_winner')} onClick={pickWinner} disabled={!canPick} />
        <ControlButton icon={Trash2} label={t('gw_clear_participants')} onClick={() => setClearConfirm(true)} disabled={phase === 'collecting' || participants.length === 0} />
        <ControlButton icon={RefreshCw} label={t('gw_new_giveaway')} onClick={newGiveaway} disabled={!canNewGiveaway} />
        <ControlButton icon={SlidersHorizontal} label={t('gw_giveaway_settings')} onClick={() => setSettingsOpen(true)} />
      </div>

      {/* Giveaway mode configuration */}
      <div className="flex flex-col gap-4 rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">{t('gw_mode')}</label>
            <div className="relative">
              <select
                value={modeId}
                onChange={(e) => { const v = e.target.value as GiveawayModeId; setModeId(v); localStorage.setItem('gw_mode_id', v); }}
                disabled={phase === 'collecting'}
                className="flex h-[42px] w-full appearance-none items-center rounded-lg border border-ink-800 bg-ink-950 px-3 pr-9 text-sm text-ink-200 focus:border-accent-500 focus:outline-none disabled:opacity-50"
              >
                {modeList.map((m) => (
                  <option key={m.id} value={m.id}>{t(m.id === 'keyword' ? 'gw_mode_keyword' : 'gw_mode_guess_number')}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            </div>
          </div>
        </div>

        {/* Mode config fields */}
        <AnimatePresence>
          <motion.div
            key={modeId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-4 overflow-hidden"
          >
            {modeFields.map((f) => {
              if (f.key === 'manualTarget' && String(config.targetMode ?? 'random') !== 'manual') return null;
              const isManualTarget = f.key === 'manualTarget';
              const manualVal = Number(config.manualTarget);
              const minVal = Number(config.min ?? 1);
              const maxVal = Number(config.max ?? 500);
              const manualOutOfRange = isManualTarget
                && String(config.targetMode ?? 'random') === 'manual'
                && config.manualTarget !== ''
                && config.manualTarget != null
                && (!Number.isFinite(manualVal) || manualVal < minVal || manualVal > maxVal);
              return (
                <div key={f.key} className="min-w-[160px] flex-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-500">{t(f.key === 'keyword' ? 'gw_field_keyword' : f.key === 'matchType' ? 'gw_field_match_type' : f.key === 'min' ? 'gw_field_min' : f.key === 'max' ? 'gw_field_max' : f.key === 'targetMode' ? 'gw_field_target_number' : f.key === 'manualTarget' ? 'gw_field_manual_target' : f.label)}</label>
                  {f.type === 'select' ? (
                    <select
                      value={String(config[f.key] ?? f.default)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConfig((c) => ({ ...c, [f.key]: val }));
                        if (f.key === 'matchType') localStorage.setItem('gw_match_type', val);
                        if (f.key === 'targetMode') localStorage.setItem('gw_target_mode', val);
                      }}
                      disabled={phase === 'collecting'}
                      className="flex h-[42px] w-full appearance-none items-center rounded-lg border border-ink-800 bg-ink-950 px-3 text-sm text-ink-200 focus:border-accent-500 focus:outline-none disabled:opacity-50"
                    >
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>{
                          f.key === 'matchType'
                            ? t(o.value === 'exact' ? 'gw_match_exact' : 'gw_match_contains')
                            : f.key === 'targetMode'
                              ? t(o.value === 'random' ? 'gw_target_random' : 'gw_target_manual')
                              : o.label
                        }</option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <button
                      onClick={() => setConfig((c) => ({ ...c, [f.key]: !c[f.key] }))}
                      disabled={phase === 'collecting'}
                      className="flex h-[42px] w-full items-center gap-2 rounded-lg border border-ink-800 bg-ink-950 px-3 text-sm text-ink-200 disabled:opacity-50"
                    >
                      <span className={`h-4 w-4 rounded border ${config[f.key] ? 'bg-accent-500 border-accent-500' : 'border-ink-700'}`} />
                      {config[f.key] ? t('gw_yes') : t('gw_no')}
                    </button>
                  ) : (
                    <div className="relative">
                      <input
                        type={f.type === 'password' ? (showManualTarget ? 'text' : 'password') : f.type === 'number' ? 'number' : 'text'}
                        value={String(config[f.key] ?? '')}
                        onChange={(e) => {
                          const val = f.type === 'number' ? Number(e.target.value) : e.target.value;
                          setConfig((c) => ({ ...c, [f.key]: val }));
                          if (f.key === 'keyword') localStorage.setItem('gw_keyword', String(val));
                          if (f.key === 'matchType') localStorage.setItem('gw_match_type', String(val));
                        }}
                        placeholder={f.key === 'keyword' ? t('gw_field_keyword_placeholder') : f.key === 'manualTarget' ? t('gw_field_manual_target_placeholder') : f.placeholder}
                        disabled={phase === 'collecting'}
                        className={`flex h-[42px] w-full items-center rounded-lg border bg-ink-950 px-3 text-sm text-ink-200 placeholder:text-ink-600 focus:outline-none disabled:opacity-50 ${
                          manualOutOfRange
                            ? 'border-red-500/60 focus:border-red-500'
                            : 'border-ink-800 focus:border-accent-500'
                        }`}
                      />
                      {f.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShowManualTarget((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300"
                        >
                          {showManualTarget ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  )}
                  {manualOutOfRange && (
                    <p className="mt-1.5 text-xs font-medium text-red-400">
                      {t('gw_manual_target_out_of_range', String(minVal), String(maxVal))}
                    </p>
                  )}
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Random target reveal (guess number / random mode) */}
        {modeId === 'guessNumber' && String(config.targetMode ?? 'random') === 'random' && (phase === 'collecting' || phase === 'finished') && (
          <div className="flex items-center gap-3 rounded-lg border border-ink-800/60 bg-ink-900/50 px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">{t('gw_target_number')}</span>
            <span className="font-mono text-lg font-bold tabular-nums text-ink-100">
              {showRandomTarget ? (config._randomTarget != null ? String(config._randomTarget) : '—') : '• • •'}
            </span>
            <button
              type="button"
              onClick={() => setShowRandomTarget((s) => !s)}
              className="ml-auto flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200"
            >
              {showRandomTarget ? <><EyeOff className="h-3.5 w-3.5" /> {t('gw_hide')}</> : <><Eye className="h-3.5 w-3.5" /> {t('gw_show')}</>}
            </button>
          </div>
        )}

        {/* Timer config */}
        <div className="flex flex-wrap items-end gap-4 border-t border-ink-800/60 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseTimer((v) => !v)}
              className={`flex h-[42px] items-center gap-2 rounded-lg border border-ink-800 px-4 text-sm font-medium transition ${
                useTimer ? 'border-accent-500/50 bg-accent-500/15 text-accent-300' : 'bg-ink-950 text-ink-400 hover:text-ink-200'
              }`}
            >
              <Timer className="h-4 w-4" /> {t('gw_timer')}: {useTimer ? t('gw_timer_on') : t('gw_timer_off')}
            </button>
          </div>
          {useTimer && (
            <div className="flex flex-wrap items-center gap-2">
              {TIMER_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setTimerSec(s); setCustomTimer(''); }}
                  disabled={phase === 'collecting'}
                  className={`flex h-[42px] items-center rounded-lg border border-ink-800 px-3 text-sm transition disabled:opacity-50 ${
                    timerSec === s && !customTimer ? 'border-accent-500/50 bg-accent-500/15 text-accent-300' : 'bg-ink-950 text-ink-400 hover:text-ink-200'
                  }`}
                >
                  {formatTime(s)}
                </button>
              ))}
              <input
                type="number"
                value={customTimer}
                onChange={(e) => setCustomTimer(e.target.value)}
                placeholder={t('gw_custom_seconds')}
                disabled={phase === 'collecting'}
                className="h-[42px] w-28 rounded-lg border border-ink-800 bg-ink-950 px-3 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatsCards
        participants={participants.length}
        messages={messageCount}
        msgPerSec={msgPerSec}
        timerLabel={timerLabel}
      />

      {/* Roulette / result */}
      <AnimatePresence>
        {modeId !== 'guessNumber' && (phase === 'finished' || winner) && participants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <GiveawayRoulette
              participants={participants}
              spinSignal={spinSignal}
              onResult={onRouletteResult}
              roleWeights={roleWeights}
              excludedIds={excludedWinnerIds}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat + Participants side by side */}
      <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
          <ChatFeed messages={chatFeed} connected={connected} livePulse={livePulse} />
        </div>
        <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
          <ParticipantTable participants={participants} onSelectParticipant={openParticipantModal} channel={connectedChannel} onParticipantsUpdate={setParticipants} />
        </div>
      </div>

      {/* History */}
      <HistoryPanel history={history} onClear={() => { setHistory([]); saveHistory([]); }} />

      <LogsPanel open={logsOpen} onClose={() => setLogsOpen(false)} logs={logs} />

      {/* New giveaway confirmation */}
      {newGiveawayConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setNewGiveawayConfirm(false)}
        >
          <div
            className="animate-fade-in relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-center text-lg font-bold text-ink-100">{t('gw_new_giveaway_confirm_title')}</h3>
            <p className="mb-6 text-center text-sm text-ink-400">{t('gw_new_giveaway_confirm_desc')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmNewGiveaway}
                className="w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-bold text-ink-100 shadow-lg transition hover:bg-accent-400"
              >
                {t('gw_new_giveaway_confirm')}
              </button>
              <button
                onClick={() => setNewGiveawayConfirm(false)}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
              >
                {t('gw_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear participants confirmation */}
      {clearConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setClearConfirm(false)}
        >
          <div
            className="animate-fade-in relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-center text-lg font-bold text-ink-100">{t('gw_clear_confirm_title')}</h3>
            <p className="mb-6 text-center text-sm text-ink-400">{t('gw_clear_confirm_desc')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setClearConfirm(false); clearParticipants(); }}
                className="w-full rounded-lg bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-400"
              >
                {t('gw_clear_confirm')}
              </button>
              <button
                onClick={() => setClearConfirm(false)}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
              >
                {t('gw_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disconnect confirmation */}
      {disconnectConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setDisconnectConfirm(false)}
        >
          <div
            className="animate-fade-in relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-center text-lg font-bold text-ink-100">{t('gw_disconnect_confirm_title')}</h3>
            <p className="mb-6 text-center text-sm text-ink-400">{t('gw_disconnect_confirm_desc')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmDisconnect}
                className="w-full rounded-lg bg-red-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-red-400"
              >
                {t('gw_disconnect_confirm')}
              </button>
              <button
                onClick={() => setDisconnectConfirm(false)}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
              >
                {t('gw_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reroll confirmation */}
      {rerollConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setRerollConfirm(false)}
        >
          <div
            className="animate-fade-in relative w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-center text-lg font-bold text-ink-100">{t('gw_pm_reroll_confirm_title')}</h3>
            <p className="mb-6 text-center text-sm text-ink-400">{t('gw_pm_reroll_confirm_desc')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmReroll}
                className="w-full rounded-lg bg-accent-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-accent-400"
              >
                {t('gw_pm_reroll_confirm')}
              </button>
              <button
                onClick={() => setRerollConfirm(false)}
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-4 py-3 text-sm font-medium text-ink-300 transition hover:bg-ink-700 hover:text-ink-100"
              >
                {t('gw_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ParticipantModal
        participant={modalParticipant}
        messages={chatFeed}
        isWinner={modalIsWinner}
        canReroll={modalIsWinner && participants.length - excludedWinnerIds.size > 0}
        onReroll={requestReroll}
        onClose={closeModal}
        autoStartTimer={autoStartTimer}
        onResponded={onWinnerResponded}
        channel={connectedChannel || channel.trim().replace(/^#/, '').toLowerCase()}
        onFollowsUpdate={(username, follows) => {
          setParticipants((prev) => prev.map((p) => p.username === username ? { ...p, followsChannel: follows } : p));
        }}
      />

      <GiveawaySettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        weights={roleWeights}
        onSave={saveRoleWeights}
      />
    </div>
  );
}

function StatusBadge({ status, channel, viewers, live, onRefreshViewers }: { status: ConnectionStatus; channel: string; viewers: number | null; live: boolean; onRefreshViewers: () => void }) {
  const { t } = useI18n();
  const m = statusMeta[status];
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    onRefreshViewers();
    setTimeout(() => setRefreshing(false), 800);
  };
  return (
    <div className="flex h-[42px] items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/70 px-3">
      <span className={`h-2.5 w-2.5 rounded-full ${m.dot} ${status === 'reconnecting' || status === 'connecting' ? 'animate-pulse' : ''}`} />
      <span className={`text-sm font-medium ${m.color}`}>{t(m.labelKey)}</span>
      {channel && status === 'connected' && (
        <span className="text-xs text-ink-500">{channel}</span>
      )}
      {channel && status === 'connected' && viewers !== null && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Обновить количество зрителей"
          className="group ml-1 flex items-center gap-1 rounded-md border border-ink-700/60 bg-ink-950/60 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-200 transition hover:border-accent-500/50 hover:bg-ink-800/80 hover:text-accent-200 active:scale-95 disabled:opacity-60"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-red-500 animate-pulse' : 'bg-ink-600'}`} />
          {viewers.toLocaleString()}
          <RefreshCw className={`h-3 w-3 text-ink-400 transition group-hover:text-accent-300 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );
}

function ControlButton({
  icon: Icon, label, onClick, disabled, variant = 'default',
}: {
  icon: typeof Play; label: string; onClick: () => void; disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'accent' | 'success' | 'gold';
}) {
  const styles = {
    default: 'border-ink-700 bg-ink-800/60 text-ink-100 hover:bg-ink-700/60',
    primary: 'border-ink-700 bg-ink-800/60 text-ink-100 hover:bg-ink-700/60',
    danger: 'border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40',
    accent: 'border-ink-700 bg-ink-800/60 text-ink-100 hover:bg-ink-700/60',
    success: 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40',
    gold: 'border-amber-900/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[42px] items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const HISTORY_KEY = 'giveaway_history_v1';
function loadHistory(): GiveawayHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GiveawayHistoryEntry[];
  } catch {
    return [];
  }
}
function saveHistory(h: GiveawayHistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch { /* ignore */ }
}
