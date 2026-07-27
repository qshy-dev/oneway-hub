import { useEffect, useMemo, useState } from 'react';
import {
  CheckCheck, X, Search, Plus, Archive as ArchiveIcon,
  Trash2, RotateCcw, Save, User,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { CrosshairCodePreview } from './CrosshairPreview';
import { CrosshairDetailModal } from './CrosshairDetailModal';
import { useI18n } from '@/i18n';
import { useUserCrosshairsCtx } from '@/lib/userCrosshairsContext';
import { useSettings } from '@/lib/settings';
import { decodeCrosshairShareCode } from 'csgo-sharecode';

export function Settings() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [newPlayer, setNewPlayer] = useState('');
  const [newCode, setNewCode] = useState('');
  const [addError, setAddError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [detail, setDetail] = useState<{ player: string; code: string } | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { rows, add, archive, restore, remove, setRoulette, resetToDefault } = useUserCrosshairsCtx();
  const { prefs, setIncludeRandom, setIncludeOwn, setOwnCode } = useSettings();
  const [ownInput, setOwnInput] = useState(prefs.ownCode ?? '');

  const activeRows = useMemo(
    () =>
      rows
        .filter(
          (r) => !r.archived && r.player.toLowerCase().includes(query.trim().toLowerCase()),
        )
        .slice()
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [rows, query],
  );
  const archivedRows = useMemo(
    () => rows.filter((r) => r.archived).slice().sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')),
    [rows],
  );
  const selectedCount = activeRows.filter((r) => r.include_in_roulette).length;

  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedRows = activeRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, tab]);

  const handleAdd = async () => {
    setAddError('');
    if (!newPlayer.trim()) {
      setAddError(t('player_name'));
      return;
    }
    if (!newCode.trim()) {
      setAddError(t('share_code_label'));
      return;
    }
    try {
      decodeCrosshairShareCode(newCode.trim());
    } catch {
      setAddError(t('invalid_crosshair'));
      return;
    }
    await add(newPlayer.trim(), newCode.trim());
    setNewPlayer('');
    setNewCode('');
    setShowAdd(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Crosshair selection (merged with add) */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink-100">{t('settings_title')}</h2>
            <p className="mt-0.5 text-sm text-ink-500">{t('settings_sub')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-sm font-semibold text-accent-400">
              {t('selected_count', String(selectedCount))}
            </span>
            <button
              onClick={() => {
                setShowAdd((v) => !v);
                setAddError('');
              }}
              className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm font-medium text-ink-200 transition hover:bg-ink-700"
            >
              <Plus className="h-4 w-4" />
              {t('add')}
            </button>
          </div>
        </div>

        {showAdd && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-ink-800 bg-ink-950 p-4">
            <input
              type="text"
              value={newPlayer}
              onChange={(e) => setNewPlayer(e.target.value)}
              placeholder={t('player_name')}
              className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none focus:border-accent-500"
            />
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder={t('share_code_label')}
              className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 font-mono text-sm text-ink-100 outline-none focus:border-accent-500"
            />
            {addError && (
              <p className="text-sm text-red-400">
                {t('fill_field')} {addError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-ink-100 transition hover:bg-accent-400"
              >
                {t('add')}
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setAddError('');
                }}
                className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-300 transition hover:bg-ink-700"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Select all / Clear all — above the tabs */}
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            onClick={() => activeRows.forEach((r) => setRoulette(r.id, true))}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-200 transition hover:bg-ink-700"
          >
            <CheckCheck className="h-4 w-4" />
            {t('select_all')}
          </button>
          <button
            onClick={() => activeRows.forEach((r) => setRoulette(r.id, false))}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-200 transition hover:bg-ink-700"
          >
            <X className="h-4 w-4" />
            {t('clear_all')}
          </button>
        </div>

        {/* Active / Archive tabs */}
        <div className="mb-3 flex gap-1 rounded-lg border border-ink-800 bg-ink-950 p-1">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'active' ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'
            }`}
          >
            {t('active')} ({activeRows.length})
          </button>
          <button
            onClick={() => setTab('archive')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === 'archive' ? 'bg-ink-700 text-ink-100' : 'text-ink-500 hover:text-ink-300'
            }`}
          >
            {t('archive')} ({archivedRows.length})
          </button>
        </div>

        {/* Search only for active tab */}
        {tab === 'active' && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search_placeholder')}
              className="w-full rounded-lg border border-ink-800 bg-ink-950 py-2 pl-9 pr-3 text-sm text-ink-100 outline-none transition focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40"
            />
          </div>
        )}

        {/* Grid */}
        {tab === 'active' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pagedRows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/50 p-3"
              >
                <button
                  onClick={() => setDetail({ player: r.player, code: r.code })}
                  className="group relative"
                  title={t('crosshair_details')}
                >
                  <CrosshairCodePreview
                    code={r.code}
                    className="h-24 w-24 rounded-lg border border-ink-800 bg-ink-850 transition group-hover:border-accent-500/50"
                    background="dark"
                  />
                </button>
                <button
                  onClick={() => setDetail({ player: r.player, code: r.code })}
                  className="max-w-full truncate text-xs font-medium text-ink-300 transition hover:text-accent-400"
                >
                  {r.player}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRoulette(r.id, !r.include_in_roulette)}
                    className={`rounded px-2 py-1 text-[10px] font-semibold uppercase transition ${
                      r.include_in_roulette
                        ? 'bg-accent-500/20 text-accent-300'
                        : 'bg-ink-800 text-ink-500'
                    }`}
                    title={t('in_roulette')}
                  >
                    {t('in_roulette')}
                  </button>
                  <button
                    onClick={() => archive(r.id)}
                    className="rounded bg-ink-800 p-1.5 text-ink-400 transition hover:bg-ink-700 hover:text-ink-200"
                    title={t('move_to_archive')}
                  >
                    <ArchiveIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(r.id)}
                    className="rounded bg-ink-800 p-1.5 text-ink-400 transition hover:bg-red-900/40 hover:text-red-400"
                    title={t('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {archivedRows.map((r) => (
              <div
                key={r.id}
                className="flex flex-col items-center gap-2 rounded-xl border border-ink-800 bg-ink-900/30 p-3 opacity-70"
              >
                <button
                  onClick={() => setDetail({ player: r.player, code: r.code })}
                  className="group relative"
                  title={t('crosshair_details')}
                >
                  <CrosshairCodePreview
                    code={r.code}
                    className="h-24 w-24 rounded-lg border border-ink-800 bg-ink-850 opacity-90 transition group-hover:border-accent-500/50 group-hover:opacity-100"
                    background="dark"
                  />
                </button>
                <button
                  onClick={() => setDetail({ player: r.player, code: r.code })}
                  className="max-w-full truncate text-xs font-medium text-ink-400 transition hover:text-accent-400"
                >
                  {r.player}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => restore(r.id)}
                    className="rounded bg-ink-800 p-1.5 text-ink-400 transition hover:bg-ink-700 hover:text-ink-200"
                    title={t('restore')}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(r.id)}
                    className="rounded bg-ink-800 p-1.5 text-ink-400 transition hover:bg-red-900/40 hover:text-red-400"
                    title={t('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-ink-500">{t('use_archive_hint')}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-200 transition hover:border-red-500/40 hover:bg-red-900/20 hover:text-red-300"
          >
            <RotateCcw className="h-4 w-4" />
            {t('reset_to_default')}
          </button>

          {tab === 'active' && totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-500">
                {t('page')} {currentPage + 1} {t('page_of').replace('{0}', String(totalPages))}
              </span>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded-lg border border-ink-700 bg-ink-800 p-1.5 text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage === totalPages - 1}
                className="rounded-lg border border-ink-700 bg-ink-800 p-1.5 text-ink-300 transition hover:bg-ink-700 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Your crosshair */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <User className="h-5 w-5 text-accent-400" />
          <h3 className="text-base font-bold text-ink-100">{t('your_crosshair')}</h3>
        </div>
        <p className="mb-4 text-sm text-ink-500">{t('your_crosshair_sub')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-ink-500">
              {t('share_code_label')}
            </label>
            <input
              type="text"
              value={ownInput}
              onChange={(e) => setOwnInput(e.target.value)}
              placeholder={t('share_code_label')}
              className="w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 font-mono text-sm text-ink-100 outline-none focus:border-accent-500"
            />
          </div>
          <button
            onClick={() => setOwnCode(ownInput.trim() || null)}
            className="flex items-center gap-2 rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-200 transition hover:bg-ink-700"
          >
            <Save className="h-4 w-4" />
            {t('save_current')}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-600">
          {prefs.ownCode ? t('saved') : t('no_saved')}
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <Toggle checked={prefs.includeOwn} onChange={setIncludeOwn} />
          <div>
            <span className="block text-sm font-medium text-ink-200">
              {t('own_crosshair_toggle')}
            </span>
            <span className="block text-xs text-ink-500">{t('own_crosshair_sub')}</span>
          </div>
        </label>
      </div>

      {/* Roulette options */}
      <div className="rounded-2xl border border-ink-800 bg-ink-900/50 p-5">
        <h3 className="mb-4 text-base font-bold text-ink-100">{t('spin_menu')}</h3>
        <label className="flex cursor-pointer items-center gap-3">
          <Toggle checked={prefs.includeRandom} onChange={setIncludeRandom} />
          <div>
            <span className="block text-sm font-medium text-ink-200">
              {t('random_crosshair')}
            </span>
            <span className="block text-xs text-ink-500">{t('random_crosshair_sub')}</span>
          </div>
        </label>
      </div>

      {/* Reset confirmation modal */}
      {confirmReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-bold text-ink-100">{t('reset_confirm_title')}</h3>
            <p className="mb-5 text-sm text-ink-500">{t('reset_confirm_sub')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  resetToDefault();
                  setConfirmReset(false);
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                {t('yes_reset')}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-300 transition hover:bg-ink-700"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-ink-700 bg-ink-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-lg font-bold text-ink-100">{t('delete_confirm')}</h3>
            <p className="mb-5 text-sm text-ink-500">{t('delete_confirm_sub')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  remove(confirmDelete);
                  setConfirmDelete(null);
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500"
              >
                {t('yes_delete')}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-ink-700 bg-ink-800 px-4 py-2 text-sm font-medium text-ink-300 transition hover:bg-ink-700"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      {detail && (
        <CrosshairDetailModal
          player={detail.player}
          code={detail.code}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-accent-500' : 'bg-ink-700'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink-100 transition ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}
