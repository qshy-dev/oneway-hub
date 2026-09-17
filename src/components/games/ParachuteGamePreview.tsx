import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameTheme, GameConfig } from './types';
import { DEFAULT_GAME_CONFIG } from './types';
import { getTheme } from './themes';

interface Props {
  themeId?: string;
  config?: Partial<GameConfig>;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  decay: number;
  type: 'circle' | 'square' | 'leaf';
}

interface Diver {
  id: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  swingPhase: number;
  swingAmp: number;
  startTime: number;
  landed: boolean;
  landedAt: number | null;
  score: number | null;
  hitTarget: boolean;
  fadeAlpha: number;
  avatarUrl: string;
  username: string;
}

interface Target {
  x: number;
  y: number;
  w: number;
  h: number;
  __spawnTime: number;
}

let nextId = 0;

export function ParachuteGamePreview({ themeId = 'cauldron', config: cfg }: Props) {
  const config: GameConfig = useMemo(() => ({ ...DEFAULT_GAME_CONFIG, ...cfg }), [cfg]);
  const theme: GameTheme = getTheme(themeId);
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number>(0);
  const diversRef = useRef<Diver[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const targetRef = useRef<Target | null>(null);
  const lastSpawn = useRef<number>(0);
  const sizeRef = useRef({ width: 400, height: 300 });
  const [divers, setDivers] = useState<Diver[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [totalScore, setTotalScore] = useState<number>(0);

  useEffect(() => {
    const upd = () => {
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        sizeRef.current = { width: r.width, height: r.height };
      }
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);

  const getTwitchAvatarUrl = (username: string) =>
    `https://static-cdn.jtvnw.net/jtv_user_pictures/${encodeURIComponent(username)}-profile_image-300x300.png`;

  useEffect(() => {
    const loop = (time: number) => {
      const { width, height } = sizeRef.current;

      // Spawn divers periodically
      if (time - lastSpawn.current > 2500 && diversRef.current.filter(d => !d.landed).length < 3) {
        lastSpawn.current = time;
        const usernames = ['Player1', 'SkyDiver', 'CloudJumper', 'WindRider', 'StarGazer'];
        const colors = ['#a855f7', '#ec4899', '#3b82f6', '#22c55e', '#f59e0b'];
        const name = usernames[Math.floor(Math.random() * usernames.length)] + Math.floor(Math.random() * 100);
        const color = colors[Math.floor(Math.random() * colors.length)];

        const startX = 30 + Math.random() * Math.max(1, width - 60);
        const angle = (Math.random() - 0.5) * 0.8;
        const speed = 0.2 + Math.random() * 0.6;

        const div: Diver = {
          id: nextId++,
          color,
          x: startX,
          y: -40,
          vx: Math.cos(angle) * speed,
          vy: 0.1 + Math.random() * 0.25,
          swingPhase: Math.random() * Math.PI * 2,
          swingAmp: 0.5 + Math.random() * 0.5,
          startTime: time,
          landed: false,
          landedAt: null,
          score: null,
          hitTarget: false,
          fadeAlpha: 1,
          avatarUrl: getTwitchAvatarUrl(name),
          username: name,
        };
        diversRef.current.push(div);

        // Preload avatar
        const img = new Image();
        img.onload = () => { div.avatarUrl = img.src; };
        img.onerror = () => { /* fallback circle */ };
        img.src = div.avatarUrl;
      }

      // Create target if needed
      if (!targetRef.current && time > 500) {
        const tw = (config.targetWidthPercent / 100) * width;
        const th = (config.targetHeightPercent / 100) * height;
        const tx = 20 + Math.random() * Math.max(1, width - tw - 40);
        const ty = height - th - 15;
        targetRef.current = { x: tx, y: ty, w: tw, h: th, __spawnTime: time };
        setTarget({ x: tx, y: ty, w: tw, h: th, __spawnTime: time });
      }

      // Check target expiry
      if (targetRef.current && time - targetRef.current.__spawnTime! > config.targetDisplayDurationMs) {
        targetRef.current = null;
        setTarget(null);
      }

      // Update divers
      for (const d of diversRef.current) {
        if (d.landed) {
          d.fadeAlpha -= 0.025;
          continue;
        }

        d.vy += config.gravity;
        d.swingPhase += 0.018;
        d.vx += Math.sin(d.swingPhase) * config.windStrength * d.swingAmp;
        d.vx *= 0.998;
        d.vy *= 0.9995;

        const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
        if (spd > config.maxSpeed) {
          d.vx = (d.vx / spd) * config.maxSpeed;
          d.vy = (d.vy / spd) * config.maxSpeed;
        }

        d.x += d.vx;
        d.y += d.vy;

        // Bounce
        if (d.x < 20) { d.x = 20; d.vx = Math.abs(d.vx) * 0.65; }
        if (d.x > width - 20) { d.x = width - 20; d.vx = -Math.abs(d.vx) * 0.65; }

        // Target collision
        if (targetRef.current && d.y >= targetRef.current.y - 35 && d.y <= targetRef.current.y + targetRef.current.h + 15) {
          const inZone = d.x >= targetRef.current.x - 15 && d.x <= targetRef.current.x + targetRef.current.w + 15;
          if (inZone) {
            d.landed = true;
            d.landedAt = time;
            d.hitTarget = true;
            const flightTime = time - d.startTime;
            const ratio = Math.max(0, 1 - flightTime / config.maxTimeMs);
            const bonus = Math.round(config.maxBonusScore * Math.pow(ratio, 1.5));
            d.score = config.baseScore + Math.min(bonus, config.maxBonusScore);
            setTotalScore(s => s + d.score!);

            for (let i = 0; i < 20; i++) {
              const a = Math.random() * Math.PI * 2;
              const s = 1 + Math.random() * 3;
              particlesRef.current.push({
                id: nextId++, x: d.x, y: d.y + 15,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
                r: 3 + Math.random() * 5,
                color: theme.splashColors[Math.floor(Math.random() * theme.splashColors.length)],
                life: 1, decay: 0.015, type: 'circle',
              });
            }
          }
        }

        // Fell off screen
        if (d.y > height + 50 && !d.landed) {
          d.landed = true;
          d.landedAt = time;
          d.hitTarget = false;
          d.score = 0;
        }
      }

      // Update particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.99;
        p.life -= p.decay;
        return p.life > 0;
      });

      // Cleanup landed divers
      diversRef.current = diversRef.current.filter(d => d.fadeAlpha > 0);

      setDivers([...diversRef.current]);
      setParticles([...particlesRef.current]);

      raf.current = requestAnimationFrame(loop);
    };

    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [config, theme]);

  const bg = `linear-gradient(180deg, ${theme.backgroundGradient[0]} 0%, ${theme.backgroundGradient[1]} 100%)`;
  const pct = (v: number, t: number) => (v / t * 100) + '%';

  return (
    <div ref={ref} className="relative w-full aspect-video rounded-lg overflow-hidden border border-ink-800" style={{ background: bg }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {particles.map(p => (
          <circle
            key={p.id}
            cx={p.x}
            cy={p.y}
            r={Math.max(0.5, p.r * p.life)}
            fill={p.color}
            opacity={p.life * 0.8}
          />
        ))}
      </svg>

      {totalScore > 0 && (
        <div className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded bg-black/50 text-emerald-400 z-50">
          Очки: {totalScore}
        </div>
      )}

      <AnimatePresence>
        {target && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute rounded-lg border-2 border-dashed flex items-center justify-center"
            style={{
              left: pct(target.x, sizeRef.current.width),
              top: pct(target.y, sizeRef.current.height),
              width: pct(target.w, sizeRef.current.width),
              height: pct(target.h, sizeRef.current.height),
              borderColor: theme.targetBorderColor,
              backgroundColor: theme.targetColor + '40',
            }}
          >
            <span className="text-[10px] font-bold" style={{ color: theme.targetBorderColor }}>{theme.emoji}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {divers.map(d => (
        <div
          key={d.id}
          className="absolute pointer-events-none"
          style={{ left: d.x - 16, top: d.y - 16, opacity: d.landed ? Math.max(0, d.fadeAlpha) : 1 }}
        >
          <svg width="64" height="56" viewBox="0 0 64 56" className="absolute -top-14 left-1/2 -translate-x-1/2">
            <defs>
              <linearGradient id={`para-grad-${d.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.color} stopOpacity="0.9" />
                <stop offset="60%" stopColor={d.color} stopOpacity="0.7" />
                <stop offset="100%" stopColor={d.color} stopOpacity="0.5" />
              </linearGradient>
            </defs>
            <path d="M32 4 C10 4 2 12 2 18 C2 22 8 24 16 24 C20 24 24 23 28 22 C32 21 36 21 40 22 C44 23 48 24 52 24 C56 24 62 22 62 18 C62 12 54 4 32 4 Z" fill={`url(#para-grad-${d.id})`} stroke={d.color} strokeWidth="1.2" />
            <path d="M16 24 C14 28 16 30 18 30" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth="0.8" />
            <path d="M28 22 C26 26 28 28 30 28" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth="0.8" />
            <path d="M40 22 C38 26 40 28 42 28" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth="0.8" />
            <path d="M52 24 C50 28 52 30 54 30" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth="0.8" />
            <line x1="4" y1="18" x2="2" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
            <line x1="16" y1="24" x2="12" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
            <line x1="28" y1="22" x2="24" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
            <line x1="40" y1="22" x2="40" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
            <line x1="52" y1="24" x2="56" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
            <line x1="62" y1="18" x2="64" y2="40" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" />
          </svg>
          {d.landed && d.score ? (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-[11px] font-bold text-emerald-400">+{d.score}</span>
              <span className="block text-[9px] text-white/60 text-center">{d.username}</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-white text-[10px] font-bold" style={{ borderColor: 'rgba(255,255,255,0.6)', backgroundColor: d.color }}>
              {d.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}

      <div className="absolute bottom-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded bg-black/50 text-white/70">
        {theme.emoji} {theme.name}
      </div>
    </div>
  );
}
