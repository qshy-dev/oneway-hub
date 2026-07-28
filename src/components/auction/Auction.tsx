import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Play, RotateCcw, Pencil, ChevronUp, ChevronDown, ChevronUp as ChevronUpDouble,
  Plus, Search, Gavel, Disc, Archive, Trash2, Save, X, Clock, History as HistoryIcon, ListOrdered,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useI18n } from '@/i18n';
import type { Lot, Bid, HistoryEntry, ArchivedAuction } from './types';

const DEFAULT_SECONDS = 30 * 60;
const LS_KEY = 'auction-state-v1';
const LS_ARCHIVE_KEY = 'auction-archive-v1';

type SavedState = {
  name: string;
  lots: Lot[];
  bids: Bid[];
  history: HistoryEntry[];
  secondsLeft: number;
};

function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as SavedState;
  } catch { /* ignore */ }
  return { name: '', lots: [], bids: [], history: [], secondsLeft: DEFAULT_SECONDS };
}

function loadArchive(): ArchivedAuction[] {
  try {
    const raw = localStorage.getItem(LS_ARCHIVE_KEY);
    if (raw) return JSON.parse(raw) as ArchivedAuction[];
  } catch { /* ignore */ }
  return [];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function Auction({ tab }: { tab: 'auction' | 'wheel' }) {
  const { t } = useI18n();
  const [name, setName] = useState(loadState().name);
  const [lots, setLots] = useState<Lot[]>(loadState().lots);
  const [bids, setBids] = useState<Bid[]>(loadState().bids);
  const [history, setHistory] = useState<HistoryEntry[]>(loadState().history);
  const [secondsLeft, setSecondsLeft] = useState(loadState().secondsLeft);
  const [running, setRunning] = useState(false);
  const [editingTimer, setEditingTimer] = useState(false);
  const [timerInput, setTimerInput] = useState('');
  const [newLotName, setNewLotName] = useState('');
  const [newLotPrice, setNewLotPrice] = useState('');
  const [search, setSearch] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState('');
  const [sideTab, setSideTab] = useState<'bids' | 'history'>('bids');
  const [newAuctionModal, setNewAuctionModal] = useState(false);
  const [newAuctionName, setNewAuctionName] = useState('');
  const [archiveModal, setArchiveModal] = useState(false);
  const [archive, setArchive] = useState<ArchivedAuction[]>(loadArchive());
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveSort, setArchiveSort] = useState<'date' | 'name'>('date');
  const tickRef = useRef<number | null>(null);

  // Persist
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ name, lots, bids, history, secondsLeft }));
  }, [name, lots, bids, history, secondsLeft]);

  useEffect(() => {
    localStorage.setItem(LS_ARCHIVE_KEY, JSON.stringify(archive));
  }, [archive]);

  // Timer tick
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    tickRef.current = id;
    return () => clearInterval(id);
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

  const filteredLots = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lots;
    return lots.filter((l) => l.name.toLowerCase().includes(q));
  }, [lots, search]);

  const filteredArchive = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    let res = archive;
    if (q) res = res.filter((a) => a.name.toLowerCase().includes(q));
    res = [...res].sort((a, b) => {
      if (archiveSort === 'date') return b.savedAt - a.savedAt;
      return a.name.localeCompare(b.name);
    });
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
    setSecondsLeft(DEFAULT_SECONDS);
    setRunning(false);
    setNewAuctionModal(false);
    setNewAuctionName('');
  };

  const saveCurrentToArchive = () => {
    if (!lots.length && !bids.length) return;
    const arch: ArchivedAuction = { id: uid(), name: name.trim() || 'Auction', lots, bids, savedAt: Date.now() };
    setArchive((a) => [arch, ...a]);
    addHistory(t('auction_log_auction_saved').replace('{0}', arch.name));
  };

  const applyTimerInput = () => {
    const m = parseInt(timerInput, 10);
    if (!isNaN(m) && m > 0) {
      setSecondsLeft(m * 60);
    }
    setEditingTimer(false);
    setTimerInput('');
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
            {/* Add lot + search */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newLotName}
                onChange={(e) => setNewLotName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLot()}
                placeholder={t('auction_lot_name')}
                className="min-w-[160px] flex-1 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
              />
              <input
                value={newLotPrice}
                onChange={(e) => setNewLotPrice(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addLot()}
                placeholder={t('auction_lot_price')}
                type="number"
                className="w-28 rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
              />
              <button
                onClick={addLot}
                className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent-400"
              >
                <Plus className="h-4 w-4" />
                {t('auction_add_lot')}
              </button>
              <div className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-600" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('auction_search')}
                  className="w-48 rounded-lg border border-ink-800 bg-ink-950 pl-8 pr-3 py-2 text-sm text-ink-200 placeholder:text-ink-600 focus:border-accent-500/50 focus:outline-none"
                />
              </div>
            </div>

            {/* Lot list */}
            <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-ink-800 bg-ink-900/30 p-3">
              {filteredLots.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-ink-600">
                  {t('auction_no_lots')}
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {filteredLots.map((lot) => (
                    <li
                      key={lot.id}
                      className="group flex items-center gap-3 rounded-lg border border-ink-800 bg-ink-950/50 px-3 py-2.5 transition hover:border-ink-700"
                    >
                      <Gavel className="h-4 w-4 shrink-0 text-accent-400" />
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
                          className="flex-1 text-left text-sm font-medium text-ink-200 transition hover:text-accent-400"
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
                          className="shrink-0 rounded-md border border-ink-700 bg-ink-800 px-2.5 py-1 text-sm font-semibold text-ink-300 transition hover:border-accent-500/50 hover:text-accent-400"
                        >
                          {lot.price}
                        </button>
                      )}
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

            {/* Bottom buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewAuctionModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm font-semibold text-ink-200 transition hover:bg-ink-700"
              >
                <Plus className="h-4 w-4" />
                {t('auction_new_auction')}
              </button>
              <button
                onClick={() => setArchiveModal(true)}
                className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2.5 text-sm font-semibold text-ink-200 transition hover:bg-ink-700"
              >
                <Archive className="h-4 w-4" />
                {t('auction_archive')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right column — timer + bids/history */}
      {tab === 'auction' && (
        <div className="flex w-72 shrink-0 flex-col gap-4">
          {/* Timer */}
          <div className="rounded-xl border border-ink-800 bg-ink-900/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                <Clock className="h-3.5 w-3.5" />
                {name || t('auction_tab_auction')}
              </span>
            </div>
            {editingTimer ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  value={timerInput}
                  onChange={(e) => setTimerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyTimerInput();
                    if (e.key === 'Escape') setEditingTimer(false);
                  }}
                  placeholder="мин"
                  className="w-full rounded-lg border border-accent-500/50 bg-ink-950 px-3 py-2 text-2xl font-bold text-ink-100 focus:outline-none"
                />
                <button onClick={applyTimerInput} className="rounded-lg bg-accent-500 px-3 py-2 text-sm font-bold text-ink-950">
                  OK
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingTimer(true); setTimerInput(String(Math.floor(secondsLeft / 60))); }}
                className="w-full text-left"
              >
                <span className={`text-4xl font-extrabold tabular-nums transition ${secondsLeft === 0 ? 'text-red-400' : running ? 'text-accent-400' : 'text-ink-100'}`}>
                  {fmtTime(secondsLeft)}
                </span>
              </button>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                onClick={() => setRunning((r) => !r)}
                className="flex items-center gap-1 rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-bold text-ink-950 transition hover:bg-accent-400"
              >
                {running ? <X className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {running ? 'Stop' : t('auction_start')}
              </button>
              <button
                onClick={() => { setSecondsLeft(DEFAULT_SECONDS); setRunning(false); }}
                className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('auction_reset')}
              </button>
              <button
                onClick={() => { setEditingTimer(true); setTimerInput(String(Math.floor(secondsLeft / 60))); }}
                className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSecondsLeft((s) => Math.max(0, s + 60))}
                className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                <span>1m</span>
              </button>
              <button
                onClick={() => setSecondsLeft((s) => Math.max(0, s - 60))}
                className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                <span>1m</span>
              </button>
              <button
                onClick={() => setSecondsLeft((s) => s + 120)}
                className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-ink-700"
              >
                <ChevronUpDouble className="h-3.5 w-3.5" />
                <span className="border-b border-current">2m</span>
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
