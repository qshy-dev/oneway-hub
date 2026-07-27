import { Crosshair as CrosshairIcon, Dices, Gift, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useTypewriter } from '@/lib/useTypewriter';

export function Home({ onNavigate }: { onNavigate: (s: 'roulette' | 'giveaways') => void }) {
  const { t } = useI18n();
  const { display: typedTitle, done: titleDone } = useTypewriter(t('site_title'), { speed: 110, typoChance: 18 });

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-accent-500/20 blur-2xl" />
        <div className="parallax parallax-logo group relative flex h-24 w-24 items-center justify-center rounded-3xl border border-ink-700 bg-ink-900">
          <CrosshairIcon className="h-12 w-12 text-accent-500 transition-transform duration-500 ease-out group-hover:rotate-180 group-hover:scale-110" strokeWidth={1.5} />
        </div>
      </div>

      <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight text-ink-100 sm:text-5xl">
        {typedTitle}
        <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-accent-500 align-middle h-[0.9em]" style={{ opacity: titleDone ? 0 : 1 }} />
      </h1>
      <p className="mt-4 max-w-xl text-base text-ink-400 sm:text-lg">
        {t('home_hero_sub')}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => onNavigate('roulette')}
          className="parallax parallax-btn group flex items-center gap-2 rounded-xl bg-accent-500 px-6 py-3 text-sm font-bold text-ink-950 transition hover:bg-accent-400"
        >
          <Dices className="h-4 w-4" />
          {t('section_roulette')}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
        <button
          onClick={() => onNavigate('giveaways')}
          className="parallax parallax-btn group flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-6 py-3 text-sm font-bold text-ink-200 transition hover:border-ink-600 hover:bg-ink-800"
        >
          <Gift className="h-4 w-4" />
          {t('section_giveaways')}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        <FeatureCard icon={<Dices className="h-5 w-5" />} title={t('section_roulette')} desc={t('home_feature_roulette')} />
        <FeatureCard icon={<Gift className="h-5 w-5" />} title={t('section_giveaways')} desc={t('home_feature_giveaways')} />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="parallax parallax-card rounded-2xl border border-ink-800 bg-ink-900/40 p-5 text-left">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 bg-ink-850 text-accent-400">
        {icon}
      </div>
      <h3 className="text-sm font-bold text-ink-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-500">{desc}</p>
    </div>
  );
}
