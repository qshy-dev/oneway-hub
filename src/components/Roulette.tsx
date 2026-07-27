import { useI18n } from '@/i18n';
import { type ProCrosshair } from '@/data/proCrosshairs';
import { type Crosshair } from 'csgo-sharecode';
import { useUserCrosshairsCtx } from '@/lib/userCrosshairsContext';
import { HorizontalRoulette } from './HorizontalRoulette';
import { WheelRoulette } from './WheelRoulette';

export type RouletteMode = 'horizontal' | 'wheel';

interface RouletteProps {
  items: ProCrosshair[];
  onWin: (player: string, code: string, crosshair: Crosshair) => void;
  history: { player: string; code: string }[];
  includeRandom: boolean;
  mode: RouletteMode;
  sidebarCollapsed: boolean;
}

export function Roulette({ items, onWin, history, includeRandom, mode, sidebarCollapsed }: RouletteProps) {
  const { t } = useI18n();
  const { loading } = useUserCrosshairsCtx();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
      {(loading || items.length > 0 || includeRandom) ? (
        <div className="w-full max-w-5xl">
        {mode === 'horizontal' ? (
          <HorizontalRoulette items={items} onWin={onWin} history={history} includeRandom={includeRandom} />
        ) : mode === 'wheel' ? (
          <WheelRoulette items={items} onWin={onWin} history={history} includeRandom={includeRandom} sidebarCollapsed={sidebarCollapsed} />
        ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-8 text-center text-sm text-red-300">
          {t('none_selected_error')}
        </div>
      )}
    </div>
  );
}
