import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, RotateCcw,
  Plus, Search, Gavel, Disc, Archive, Trash2, Save, X, Clock, History as HistoryIcon, ListOrdered,
  ScrollText, Minus, Pin, PinOff,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import type { Lot, Bid, HistoryEntry, ArchivedAuction } from './types';
import { RulesEditor } from './RulesEditor';

const DEFAULT_CS = 30 * 60 * 100;        // 30 min in centiseconds
const HH_MM_SS_THRESHOLD = 60 * 60 * 100; // >= 60 min → show HH:MM:SS
const LS_KEY = 'auction-state-v1';
const LS_ARCHIVE_KEY = 'auction-archive-v1';
const LS_RULES_KEY = 'auction-rules-v1';

const DEFAULT_RULES_HTML = `<div style="text-align:center"><strong><span style="font-size:20px">Образец</span></strong></div><h3><strong>Возможности редактора</strong></h3><ul><li>У вас есть множество функций, чтобы сделать вид правил именно таким, как вы хотите:</li><li><strong>Различное</strong> <em>форматирование текста</em></li><li>Изменение размера шрифта</li><li>Цвет <span style="color:#ef4444">текста</span> и <span style="background-color:#ef4444">его фон</span></li></ul>`;

type SavedState = {
  name: string;
  lots: Lot[];
  bids: Bid[];
  history: HistoryEntry[];
  csLeft: number;
};

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedState>;
      return {
        name: parsed.name ?? '',
        lots: parsed.lots ?? [],
        bids: parsed.bids ?? [],
        history: parsed.history ?? [],
        csLeft: parsed.csLeft ?? DEFAULT_CS,
      };
    }
  } catch { /* ignore */ }
  return { name: '', lots: [], bids: [], history: [], csLeft: DEFAULT_CS };
}

function loadArchive(): ArchivedAuction[] {
  try {
    const raw = localStorage.getItem(LS_ARCHIVE_KEY);
    if (raw) return JSON.parse(raw) as ArchivedAuction[];
  } catch { /* ignore */ }
  return [];
}

function loadRules(): string {
  try {
    return localStorage.getItem(LS_RULES_KEY) ?? DEFAULT_RULES_HTML;
  } catch { return DEFAULT_RULES_HTML; }
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function pad2(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/* ---- Inline-editable timer digit segment ---- */
type SegmentProps = {
  value: number;
  max: number;
  onChange: (v: number) => void;
  onAdjust: (deltaCs: number) => void;
  stepCs: number;
  disabled?: boolean;
  color: string;
  label: string;
};

function TimerSegment({ value, max, onChange, onAdjust, stepCs, disabled, color, label }: SegmentProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(0, n)));
    setEditing(false);
    setDraft('');
  };

  const startEdit = () => {
    if (disabled) return;
    setDraft(pad2(value));
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const handleWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    onAdjust(delta * stepCs);
  };

  return editing ? (
    <input
      ref={inputRef}
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(draft);
        if (e.key === 'Escape') { setEditing(false); setDraft(''); }
      }}
      className="w-[3ch] bg-transparent text-center focus:outline-none"
      style={{ font: 'inherit', color: 'inherit' }}
      maxLength={3}
    />
  ) : (
    <span
      onClick={startEdit}
      onWheel={handleWheel}
      title={disabled ? undefined : 'Click or scroll to edit'}
      className={`flex flex-col items-center cursor-${disabled ? 'default' : 'text'} select-none tabular-nums transition-opacity ${!disabled ? 'hover:opacity-70' : ''}`}
      style={{ color }}
    >
      {pad2(value)}
      <span className="mt-1 text-[9px] font-medium uppercase tracking-wider opacity-50" style={{ color: '#94a3b8' }}>
        {label}
      </span>
    </span>
  );
}

/* ---- Main component ---- */
export function Auction({ tab }: { tab: 'auction' | 'wheel' }) {
  const { t } = useI18n();
  const saved = useMemo(loadState, []);
  const [name, setName] = useState(saved.name);
  const [lots, setLots] = useState<Lot[]>(saved.lots);
  const [bids, setBids] = useState<Bid[]>(saved.bids);
  const [history, setHistory] = useState<HistoryEntry[]>(saved.history);
  const [csLeft, setCsLeft] = useState<number>(saved.csLeft);
  const [running, setRunning] = useState(false);
  const [newLotName, setNewLotName] = useState('');
  const [newLotPrice, setNewLotPrice] = useState('');
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState('');
  const [addSumId, setAddSumId] = useState<string | null>(null);
  const [addSumValue, setAddSumValue] = useState('');
  const [sideTab, setSideTab] = useState<'bids' | 'history'>('bids');
  const [newAuctionModal, setNewAuctionModal] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState('');
  const [archiveModal, setArchiveModal] = useState(false);
  const [archive, setArchive] = useState<ArchivedAuction[]>(loadArchive);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveSort, setArchiveSort] = useState<'date' | 'name'>('date');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState<string>(loadRules);
  const tickRef = useRef<number | null>(null);

  // Timer display mode: HH:MM:SS when >= 60 min, else MM:SS:CS
  // Switch to HH:MM:SS once time exceeds 59m 59s 99cs
  const useHHMMSS = csLeft >= HH_MM_SS_THRESHOLD;

  const hours = Math.floor(csLeft / 360000);
  const minutesHH = Math.floor((csLeft % 360000) / 6000);
  const secsHH = Math.floor((csLeft % 6000) / 100);

  const minutesMM = Math.floor(csLeft / 6000);
  const secsMM = Math.floor((csLeft % 6000) / 100);
  const csMM = csLeft % 100;

  const timerColor = csLeft === 0 ? '#f87171' : running ? 'rgb(var(--accent-400))' : '#f1f5f9';

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ name, lots, bids, history, csLeft }));
  }, [name, lots, bids, history, csLeft]);

  useEffect(() => {
    localStorage.setItem(LS_ARCHIVE_KEY, JSON.stringify(archive));
  }, [archive]);

  useEffect(() => {
    localStorage.setItem(LS_RULES_KEY, rules);
  }, [rules]);

  // Timer tick — timestamp-based for accuracy (setInterval drifts at 10ms)
  useEffect(() => {
    if (!running) return;
    const startMs = Date.now();
    const startCs = csLeft;
    const id = window.setInterval(() => {
      const elapsedCs = Math.floor((Date.now() - startMs) / 10); // ms → centiseconds
      const remaining = Math.max(0, startCs - elapsedCs);
      setCsLeft(remaining);
      if (remaining <= 0) setRunning(false);
    }, 31);
    tickRef.current = id;
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const addHistory = useCallback((text: string) => {
    setHistory((h) => [{ id: uid(), text, ts: Date.now() }, ...h].slice(0, 200));
  }, []);

  const addLot = useCallback(() => {
    const trimmed = newLotName.trim();
    if (!trimmed) return;
    const price = parseInt(newLotPrice, 10) || 0;
    const lot: Lot = { id: uid(), name: trimmed, price, order: lots.length };
    setLots((l) => [...l, lot]);
    addHistory(t('auction_log_lot_added').replace('{0}', trimmed));
    setNewLotName('');
    setNewLotPrice('');
  }, [newLotName, newLotPrice, lots.length, addHistory, t]);

  const renameLot = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLots((l) => {
      const lot = l.find((x) => x.id === id);
      if (!lot) return l;
      addHistory(t('auction_log_lot_renamed').replace('{0}', lot.name).replace('{1}', trimmed));
      return l.map((x) => (x.id === id ? { ...x, name: trimmed } : x));
    });
    setRenamingId(null);
  }, [addHistory, t]);

  const changePrice = useCallback((id: string, newPrice: string) => {
    const price = parseInt(newPrice, 10) || 0;
    setLots((l) => {
      const lot = l.find((x) => x.id === id);
      if (!lot) return l;
      addHistory(t('auction_log_lot_price').replace('{0}', lot.name).replace('{1}', String(lot.price)).replace('{2}', String(price)));
      return l.map((x) => (x.id === id ? { ...x, price } : x));
    });
    setEditingPriceId(null);
  }, [addHistory, t]);

  const removeLot = useCallback((id: string) => {
    setLots((l) => {
      const lot = l.find((x) => x.id === id);
      if (lot) addHistory(t('auction_log_lot_removed').replace('{0}', lot.name));
      return l.filter((x) => x.id !== id);
    });
  }, [addHistory, t]);

  const togglePin = useCallback((id: string) => {
    setLots((l) => l.map((x) => x.id === id ? { ...x, pinned: !x.pinned } : x));
  }, []);

  const addSumToLot = useCallback((id: string, amountStr: string) => {
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount === 0) {
      setAddSumId(null);
      return;
    }
    setLots((l) => {
      const lot = l.find((x) => x.id === id);
      if (!lot) return l;
      const newPrice = lot.price + amount;
      addHistory(t('auction_log_lot_price').replace('{0}', lot.name).replace('{1}', String(lot.price)).replace('{2}', String(newPrice)));
      return l.map((x) => x.id === id ? { ...x, price: newPrice } : x);
    });
    setAddSumId(null);
    setAddSumValue('');
  }, [addHistory, t]);

  const sortedLots = useMemo(() => {
    const pinned = lots.filter((l) => l.pinned);
    const rest = lots.filter((l) => !l.pinned);
    const byPrice = (a: Lot, b: Lot) => b.price - a.price;
    return [...pinned.sort(byPrice), ...rest.sort(byPrice)];
  }, [lots]);

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedLots;
    return sortedLots.filter((l) => l.name.toLowerCase().includes(q));
  }, [sortedLots, search]);

  const filteredArchive = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    let res = archive;
    if (q) res = res.filter((a) => a.name.toLowerCase().includes(q));
    res = [...res].sort((a, b) =>
      archiveSort === 'date' ? b.savedAt - a.savedAt : a.name.localeCompare(b.name)
    );
    return res;
  }, [archive, archiveSearch, archiveSort]);

  const startNewAuction = (save: boolean) => {
    if (save && name.trim()) {
      const arch: ArchivedAuction = { id: uid(), name: name.trim() || 'Auction', lots, bids, savedAt: Date.now() };
      setArchive((a) => [arch, ...a]);
      addHistory(t('auction_log_auction_saved').replace('{0}', arch.name));
    }
    setName(newAuctionName.trim());
    setLots([]);
    setBids([]);
    setHistory([{ id: uid(), text: t('auction_log_auction_started'), ts: Date.now() }]);
    setCsLeft(DEFAULT_CS);
    setRunning(false);
    setRules(DEFAULT_RULES_HTML);
    setNewAuctionModal(false);
    setNewAuctionName('');
  };

  const saveCurrentToArchive = () => {
    if (!lots.length && !bids.length) return;
    const arch: ArchivedAuction = { id: uid(), name: name.trim() || 'Auction', lots, bids, savedAt: Date.now() };
    setArchive((a) => [arch, ...a]);
    addHistory(t('auction_log_auction_saved').replace('{0}', arch.name));
  };

  // Timer segment setters — always operate on total csLeft, recomputing from current display values
  const setHoursHH = (h: number) => setCsLeft(h * 360000 + minutesHH * 6000 + secsHH * 100);
  const setMinutesHH = (m: number) => setCsLeft(hours * 360000 + m * 6000 + secsHH * 100);
  const setSecsHH = (s: number) => setCsLeft(hours * 360000 + minutesHH * 6000 + s * 100);

  const setMinutesMM = (m: number) => setCsLeft(m * 6000 + secsMM * 100 + csMM);
  const setSecsMM = (s: number) => setCsLeft(minutesMM * 6000 + s * 100 + csMM);
  const setCsMM = (c: number) => setCsLeft(minutesMM * 6000 + secsMM * 100 + c);

  // Quick time adjust buttons (operate in centiseconds)
  const adjustTime = (deltaCs: number) => {
    setCsLeft((c) => Math.max(0, c + deltaCs));
  };

  return (
    <div className="flex h-full min-h-0 gap-4 p-4">
      {/* Main column */}
      <div className="flex flex-1 flex-col min-h-0 gap-4">
        {tab === 'wheel' ? (
          <div className="flex flex-1 items-center justify-center text-ink-500">
            <div className="text-center">
              <Disc className="mx-auto mb-3 h-12 w-12 text-ink-600" />
              <p className="text-sm">{t('auction_tab_wheel')} — coming soon</p>
            </div>
          </div>
        ) : (
          <>
            {/* Row 1: lot name, price, add lot, search */}
            <div className="flex items-center gap-2">
              <input
                value={newLotName}
                onChange={(e) => setNewLotName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLot()}
                placeholder={t('auction_lot_name')}
                className="min-w-[120px] flex-1 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
              />
              <input
                value={newLotPrice}
                onChange={(e) => setNewLotPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLot()}
                placeholder={t('auction_lot_price')}
                type="number"
                className="w-24 shrink-0 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={addLot}
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-400"
              >
                <Plus className="h-4 w-4" />
                {t('auction_add_lot')}
              </button>
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('auction_search')}
                  className="w-36 rounded-lg border border-ink-800 bg-ink-950 pl-8 pr-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Row 2: action buttons — New → Archive → Rules */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setNewAuctionModal(true)}
                title={t('auction_new_auction')}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-semibold text-ink-200 transition hover:bg-ink-700 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                {t('auction_new_auction')}
              </button>
              <button
                onClick={() => setArchiveModal(true)}
                title={t('auction_archive')}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-semibold text-ink-200 transition hover:bg-ink-700 whitespace-nowrap"
              >
                <Archive className="h-4 w-4" />
                {t('auction_archive')}
              </button>
              <button
                onClick={() => setRulesOpen((r) => !r)}
                title={t('auction_rules')}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition whitespace-nowrap ${rulesOpen ? 'border-accent-500/50 bg-accent-500/10 text-accent-400' : 'border-ink-700 bg-ink-800 text-ink-200 hover:bg-ink-700'}`}
              >
                <ScrollText className="h-4 w-4" />
                {t('auction_rules')}
              </button>
            </div>

            {/* Lot list + Rules panel */}
            <div className="flex min-h-0 flex-1 gap-4">
              {/* Rules panel */}
              <AnimatePresence initial={false}>
                {rulesOpen && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 288, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 overflow-hidden"
                  >
                    <div className="flex h-full w-72 flex-col rounded-xl border border-ink-800 bg-ink-900/40 p-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-300">
                        <ScrollText className="h-3.5 w-3.5" />
                        {t('auction_rules_title')}
                      </div>
                      <RulesEditor
                        value={rules}
                        onChange={setRules}
                        placeholder={t('auction_rules_placeholder')}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lot list */}
              <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/30 p-3">
                {filteredLots.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-600">
                    {t('auction_no_lots')}
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {filteredLots.map((lot, idx) => (
                      <li
                        key={lot.id}
                        className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition hover:border-ink-700 ${
                          lot.pinned
                            ? 'border-accent-500/40 bg-accent-500/5'
                            : 'border-ink-800 bg-ink-950/50'
                        }`}
                      >
                        <span className="shrink-0 text-xs font-bold text-ink-600 tabular-nums w-7 text-right">
                          #{idx + 1}
                        </span>
                        {renamingId === lot.id ? (
                          <input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => renameLot(lot.id, renameValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameLot(lot.id, renameValue);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="flex-1 rounded border border-accent-500/50 bg-ink-900 px-2 py-1 text-sm text-ink-100 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => { setRenamingId(lot.id); setRenameValue(lot.name); }}
                            className="flex-1 text-left text-sm font-medium text-ink-200 transition hover:text-accent-400 truncate"
                          >
                            {lot.name}
                          </button>
                        )}
                        {editingPriceId === lot.id ? (
                          <input
                            autoFocus
                            type="number"
                            value={priceValue}
                            onChange={(e) => setPriceValue(e.target.value)}
                            onBlur={() => changePrice(lot.id, priceValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') changePrice(lot.id, priceValue);
                              if (e.key === 'Escape') setEditingPriceId(null);
                            }}
                            className="w-24 rounded border border-accent-500/50 bg-ink-900 px-2 py-1 text-right text-sm text-ink-100 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingPriceId(lot.id); setPriceValue(String(lot.price)); }}
                            className="shrink-0 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 text-sm font-semibold text-ink-300 transition hover:border-accent-500/50 hover:text-accent-400 tabular-nums"
                          >
                            {lot.price}
                          </button>
                        )}
                        {addSumId === lot.id ? (
                          <input
                            autoFocus
                            type="number"
                            value={addSumValue}
                            onChange={(e) => setAddSumValue(e.target.value)}
                            onBlur={() => addSumToLot(lot.id, addSumValue)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addSumToLot(lot.id, addSumValue);
                              if (e.key === 'Escape') { setAddSumId(null); setAddSumValue(''); }
                            }}
                            placeholder="+/-"
                            className="w-16 rounded border border-accent-500/50 bg-ink-900 px-2 py-1 text-right text-sm text-ink-100 placeholder:text-ink-600 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => { setAddSumId(lot.id); setAddSumValue(''); }}
                            className="shrink-0 text-ink-600 opacity-0 transition hover:text-accent-400 group-hover:opacity-100"
                            title={t('auction_add_sum')}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => togglePin(lot.id)}
                          className={`shrink-0 transition ${lot.pinned ? 'text-accent-400' : 'text-ink-600 opacity-0 group-hover:opacity-100 hover:text-accent-400'}`}
                          title={lot.pinned ? t('auction_unpin') : t('auction_pin')}
                        >
                          {lot.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => removeLot(lot.id)}
                          className="shrink-0 text-ink-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right column — timer + bids/history */}
      {tab === 'auction' && (
        <div className="flex w-72 shrink-0 flex-col gap-4">
          {/* Timer */}
          <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-4">
            <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-ink-500">
              <Clock className="h-3.5 w-3.5" />
              {name || t('auction_tab_auction')}
            </div>

            {/* Large digit display */}
            <div
              className="flex items-center justify-center font-extrabold leading-none tracking-tight select-none"
              style={{ fontSize: '3rem' }}
            >
              {useHHMMSS ? (
                <>
                  <TimerSegment value={hours} max={99} onChange={setHoursHH} onAdjust={adjustTime} stepCs={360000} disabled={running} color={timerColor} label={t('auction_timer_hours')} />
                  <span style={{ color: timerColor }} className="mx-0.5 opacity-60">:</span>
                  <TimerSegment value={minutesHH} max={59} onChange={setMinutesHH} onAdjust={adjustTime} stepCs={6000} disabled={running} color={timerColor} label={t('auction_timer_minutes')} />
                  <span style={{ color: timerColor }} className="mx-0.5 opacity-60">:</span>
                  <TimerSegment value={secsHH} max={59} onChange={setSecsHH} onAdjust={adjustTime} stepCs={100} disabled={running} color={timerColor} label={t('auction_timer_seconds')} />
                </>
              ) : (
                <>
                  <TimerSegment value={minutesMM} max={59} onChange={setMinutesMM} onAdjust={adjustTime} stepCs={6000} disabled={running} color={timerColor} label={t('auction_timer_minutes')} />
                  <span style={{ color: timerColor }} className="mx-0.5 opacity-60">:</span>
                  <TimerSegment value={secsMM} max={59} onChange={setSecsMM} onAdjust={adjustTime} stepCs={100} disabled={running} color={timerColor} label={t('auction_timer_seconds')} />
                  <span style={{ color: timerColor }} className="mx-0.5 opacity-60">:</span>
                  <TimerSegment value={csMM} max={99} onChange={setCsMM} onAdjust={adjustTime} stepCs={1} disabled={running} color={timerColor} label={t('auction_timer_ms')} />
                </>
              )}
            </div>

            {/* Quick time adjust buttons */}
            <div className="mt-3 flex items-center justify-center gap-1.5">
              <button
                onClick={() => adjustTime(-30000)}
                disabled={running}
                className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
                5m
              </button>
              <button
                onClick={() => adjustTime(-6000)}
                disabled={running}
                className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <Minus className="h-3 w-3" />
                1m
              </button>
              <button
                onClick={() => adjustTime(6000)}
                disabled={running}
                className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
                1m
              </button>
              <button
                onClick={() => adjustTime(12000)}
                disabled={running}
                className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
                2m
              </button>
              <button
                onClick={() => adjustTime(30000)}
                disabled={running}
                className="flex items-center gap-1 rounded-md border border-ink-700 bg-ink-800 px-2 py-1 text-[10px] font-semibold text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <Plus className="h-3 w-3" />
                5m
              </button>
            </div>

            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => setRunning((r) => !r)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-bold text-ink-950 transition hover:bg-accent-400"
              >
                {running ? <X className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {running ? t('auction_stop') : t('auction_start')}
              </button>
              <button
                onClick={() => { setCsLeft(DEFAULT_CS); setRunning(false); }}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('auction_reset')}
              </button>
            </div>
          </div>

          {/* Bids / History */}
          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-ink-800 bg-ink-900/40">
            <div className="flex border-b border-ink-800">
              <button
                onClick={() => setSideTab('bids')}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold transition ${sideTab === 'bids' ? 'border-b-2 border-accent-500 text-accent-400' : 'text-ink-500 hover:text-ink-300'}`}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                {t('auction_bids')}
              </button>
              <button
                onClick={() => setSideTab('history')}
                className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold transition ${sideTab === 'history' ? 'border-b-2 border-accent-500 text-accent-400' : 'text-ink-500 hover:text-ink-300'}`}
              >
                <HistoryIcon className="h-3.5 w-3.5" />
                {t('auction_history')}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {sideTab === 'bids' ? (
                bids.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-xs text-ink-600">{t('auction_no_bids')}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {bids.map((b) => (
                      <li key={b.id} className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-950/40 px-3 py-2 text-xs">
                        <span className="font-medium text-ink-200">{b.user}</span>
                        <span className="text-ink-500">{b.amount} pts</span>
                        <span className="text-ink-600 truncate ml-2">{b.lotName}</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : history.length === 0 ? (
                <p className="flex h-full items-center justify-center text-xs text-ink-600">{t('auction_no_history')}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-lg border border-ink-800/60 bg-ink-950/30 px-3 py-2 text-xs text-ink-400">
                      <span className="text-ink-600 mr-2">{new Date(h.ts).toLocaleTimeString()}</span>
                      {h.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New auction modal */}
      <AnimatePresence>
        {newAuctionModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setNewAuctionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-ink-800 bg-ink-900 p-6"
            >
              <h3 className="mb-2 text-lg font-bold text-ink-100">{t('auction_new_confirm_title')}</h3>
              <p className="mb-4 text-sm text-red-400">{t('auction_new_confirm_desc')}</p>
              <input
                value={newAuctionName}
                onChange={(e) => setNewAuctionName(e.target.value)}
                placeholder={t('auction_new_name')}
                className="mb-4 w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => startNewAuction(false)}
                  className="flex-1 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm font-semibold text-ink-200 transition hover:bg-ink-700"
                >
                  {t('auction_start_no_save')}
                </button>
                <button
                  onClick={() => startNewAuction(true)}
                  className="flex-1 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-bold text-ink-950 transition hover:bg-accent-400"
                >
                  {t('auction_save_and_start')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive modal */}
      <AnimatePresence>
        {archiveModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setArchiveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl border border-ink-800 bg-ink-900 p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-ink-100">{t('auction_archive')}</h3>
                <button
                  onClick={saveCurrentToArchive}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-xs font-semibold text-ink-200 transition hover:bg-ink-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  {t('auction_archive_save_current')}
                </button>
              </div>
              <div className="mb-4 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
                  <input
                    value={archiveSearch}
                    onChange={(e) => setArchiveSearch(e.target.value)}
                    placeholder={t('auction_archive_search')}
                    className="w-full rounded-lg border border-ink-800 bg-ink-950 pl-8 pr-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
                  />
                </div>
                <div className="flex rounded-lg border border-ink-800 bg-ink-950 p-0.5">
                  <button
                    onClick={() => setArchiveSort('date')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${archiveSort === 'date' ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'}`}
                  >
                    {t('auction_archive_sort_date')}
                  </button>
                  <button
                    onClick={() => setArchiveSort('name')}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${archiveSort === 'name' ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'}`}
                  >
                    {t('auction_archive_sort_name')}
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {filteredArchive.length === 0 ? (
                  <p className="flex h-32 items-center justify-center text-sm text-ink-600">{t('auction_archive_empty')}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {filteredArchive.map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded-lg border border-ink-800 bg-ink-950/50 px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-ink-200">{a.name}</p>
                          <p className="text-xs text-ink-600">
                            {a.lots.length} lots · {a.bids.length} bids · {new Date(a.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => setArchive((ar) => ar.filter((x) => x.id !== a.id))}
                          className="text-ink-600 transition hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
