import React, { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { GlassSlabLogo } from '../../components/glass-slab-logo';

interface OpeningIntroProps {
  logoSrc: string;
  onScatterStart: () => void;
  onComplete: () => void;
}

interface ShardSpec {
  id: number;
  angleDeg: number;
  distanceVw: number;
  distanceVh: number;
  size: number;
  rotEnd: number;
  delay: number;
  clipClass: string;
  tintClass: string;
}

interface LetterScatter {
  char: string;
  xVw: number;
  yVh: number;
  rotZ: number;
  rotY: number;
  scale: number;
}

const SHARD_CLIPS = [
  '[clip-path:polygon(12%_0%,100%_18%,78%_100%,0%_76%)]',
  '[clip-path:polygon(50%_0%,100%_42%,64%_100%,4%_62%)]',
  '[clip-path:polygon(0%_20%,85%_0%,100%_88%,22%_100%)]',
  '[clip-path:polygon(25%_0%,100%_10%,72%_100%,0%_84%)]',
  '[clip-path:polygon(50%_0%,96%_68%,28%_100%,0%_34%)]',
];

const SHARD_TINTS = [
  'from-white/80 via-[#D9D0CB]/60 to-[#908B6F]/35 border-white/70',
  'from-[#FAF8F6]/75 via-[#E5DFDA]/55 to-[#6A6754]/35 border-[#FAF8F6]/60',
  'from-[#F7ECE6]/80 via-[#E4A88E]/55 to-[#B86B4B]/40 border-[#F7ECE6]/75',
  'from-white/70 via-[#D9D0CB]/50 to-[#4A483A]/35 border-white/55',
];

const LETTER_SCATTERS: LetterScatter[] = [
  { char: 'M', xVw: -36, yVh: -24, rotZ: -58, rotY: -75, scale: 1.25 },
  { char: 'a', xVw: -22, yVh: 28, rotZ: 44, rotY: 60, scale: 0.8 },
  { char: 'l', xVw: -9, yVh: -34, rotZ: -32, rotY: -50, scale: 1.15 },
  { char: 'o', xVw: 2, yVh: 32, rotZ: 68, rotY: 80, scale: 0.75 },
  { char: 'x', xVw: 14, yVh: -28, rotZ: 92, rotY: -65, scale: 1.2 },
  { char: 'i', xVw: 26, yVh: 22, rotZ: -48, rotY: 55, scale: 0.85 },
  { char: 'e', xVw: 38, yVh: -18, rotZ: 54, rotY: 75, scale: 1.22 },
];

export const OpeningIntro: React.FC<OpeningIntroProps> = ({
  logoSrc,
  onScatterStart,
  onComplete,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const slabWrapRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const shardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scatterTriggeredRef = useRef(false);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const onScatterStartRef = useRef(onScatterStart);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onScatterStartRef.current = onScatterStart;
  }, [onScatterStart]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const shards = useMemo<ShardSpec[]>(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const baseAngle = (i / 12) * 360 + (i % 2 === 0 ? 7 : -9);
      return {
        id: i,
        angleDeg: baseAngle,
        distanceVw: 26 + ((i * 11) % 30),
        distanceVh: 22 + ((i * 13) % 28),
        size: 18 + ((i * 7) % 26),
        rotEnd: (i % 2 === 0 ? 1 : -1) * (140 + ((i * 37) % 210)),
        delay: (i % 5) * 0.025,
        clipClass: SHARD_CLIPS[i % SHARD_CLIPS.length],
        tintClass: SHARD_TINTS[i % SHARD_TINTS.length],
      };
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const slab = slabWrapRef.current;
    const wordmark = wordmarkRef.current;
    if (!root || !slab || !wordmark) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const letters = letterRefs.current.filter(
      (el): el is HTMLSpanElement => el !== null
    );
    const shardEls = shardRefs.current.filter(
      (el): el is HTMLDivElement => el !== null
    );

    const ctx = gsap.context(() => {
      if (prefersReducedMotion) {
        const reducedTl = gsap.timeline({
          onComplete: () => onCompleteRef.current(),
        });
        reducedTl
          .fromTo(
            [slab, wordmark],
            { opacity: 0 },
            { opacity: 1, duration: 0.35, ease: 'power2.out' }
          )
          .to({}, { duration: 0.5 })
          .call(() => {
            scatterTriggeredRef.current = true;
            gsap.set(root, { pointerEvents: 'none' });
            onScatterStartRef.current();
          })
          .to(root, {
            opacity: 0,
            duration: 0.4,
            ease: 'power2.inOut',
          });
        tlRef.current = reducedTl;
        return;
      }

      gsap.set(shardEls, {
        opacity: 0,
        scale: 0.25,
        x: 0,
        y: -46,
        rotation: 0,
      });

      const tl = gsap.timeline({
        onComplete: () => onCompleteRef.current(),
      });

      // Act 1: Entrance over pure MoltenMetal — Glass slab & Maloxie letters cascade in
      tl.fromTo(
        slab,
        { opacity: 0, y: 34, scale: 0.82 },
        { opacity: 1, y: 0, scale: 1, duration: 0.95, ease: 'power3.out' },
        0.06
      )
        .fromTo(
          letters,
          {
            opacity: 0,
            y: 36,
            rotateX: -48,
            scale: 0.9,
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 0.72,
            stagger: 0.055,
            ease: 'power3.out',
          },
          0.32
        )
        // Act 2: Poised hover
        .to(
          slab,
          {
            y: -6,
            duration: 0.95,
            ease: 'sine.inOut',
          },
          1.05
        )
        // Act 3: Scatter across screen & return to home page
        .addLabel('scatter', 2.0)
        .call(
          () => {
            scatterTriggeredRef.current = true;
            gsap.set(root, { pointerEvents: 'none' });
            onScatterStartRef.current();
          },
          [],
          'scatter'
        )
        .to(
          slab,
          {
            scale: 1.24,
            y: -26,
            rotation: 6,
            opacity: 0,
            duration: 0.65,
            ease: 'power2.in',
          },
          'scatter'
        );

      // Scatter translucent glass shards across the viewport
      shardEls.forEach((el, idx) => {
        const spec = shards[idx];
        const rad = (spec.angleDeg * Math.PI) / 180;
        const tx = `${Math.cos(rad) * spec.distanceVw}vw`;
        const ty = `${Math.sin(rad) * spec.distanceVh - 4}vh`;

        tl.fromTo(
          el,
          {
            opacity: 0,
            scale: 0.3,
            x: Math.cos(rad) * 18,
            y: Math.sin(rad) * 18 - 44,
            rotation: 0,
          },
          {
            opacity: 0.95,
            scale: 1.15,
            x: tx,
            y: ty,
            rotation: spec.rotEnd,
            duration: 0.95,
            ease: 'power3.out',
          },
          `scatter+=${spec.delay}`
        ).to(
          el,
          {
            opacity: 0,
            scale: 0.45,
            duration: 0.35,
            ease: 'power2.in',
          },
          `scatter+=${spec.delay + 0.65}`
        );
      });

      // Scatter each letter of "Maloxie" across the screen
      letters.forEach((el, idx) => {
        const cfg = LETTER_SCATTERS[idx] || LETTER_SCATTERS[0];
        tl.to(
          el,
          {
            x: `${cfg.xVw}vw`,
            y: `${cfg.yVh}vh`,
            rotation: cfg.rotZ,
            rotateY: cfg.rotY,
            scale: cfg.scale,
            opacity: 0,
            duration: 0.95,
            ease: 'power3.out',
          },
          `scatter+=${idx * 0.025}`
        );
      });

      // Finish cleanly as the home page fades in
      tl.to(
        root,
        {
          opacity: 0,
          duration: 0.45,
          ease: 'power2.inOut',
        },
        'scatter+=0.68'
      );

      tlRef.current = tl;
    }, root);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !scatterTriggeredRef.current) {
        tlRef.current?.seek('scatter');
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      ctx.revert();
    };
  }, [shards]);

  const handleEarlySkip = () => {
    if (!scatterTriggeredRef.current) {
      tlRef.current?.seek('scatter');
    }
  };

  return (
    <div
      ref={rootRef}
      onClick={handleEarlySkip}
      role="presentation"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-transparent px-6 cursor-pointer select-none"
    >
      {/* Iridescent Glass Shards that Scatter Across the Screen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
      >
        {shards.map((shard, idx) => (
          <div
            key={shard.id}
            ref={(el) => {
              shardRefs.current[idx] = el;
            }}
            style={{ width: shard.size, height: shard.size * 1.18 }}
            className={`absolute bg-gradient-to-br ${shard.tintClass} ${shard.clipClass} border shadow-[0_6px_18px_rgba(46,45,36,0.24)] will-change-transform`}
          />
        ))}
      </div>

      {/* Center Stage: Pure MoltenMetal Backdrop + Glass Slab + Maloxie Letters */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div
          ref={slabWrapRef}
          className="relative w-[300px] sm:w-[390px] drop-shadow-[0_18px_36px_rgba(46,45,36,0.48)]"
        >
          <GlassSlabLogo
            logo={logoSrc}
            colorPreset="oil"
            colors={['#FFFFFF', '#F5EFEA', '#D9D0CB', '#B86B4B', '#908B6F']}
            lightColor="#FFFFFF"
            exposure={1.7}
            ambient={0.42}
            reflectivity={1.9}
            ior={1.68}
            thickness={0.013}
            depth={0.85}
            density={0.85}
            logoScale={0.86}
            backgroundColor="transparent"
            maxDpr={1.25}
            samples={20}
            style={{ height: 260 }}
            aria-label="Maloxie glass slab logo"
          />
        </div>

        <div
          ref={wordmarkRef}
          style={{ perspective: '900px' }}
          className="mt-2 inline-flex items-center justify-center gap-[0.04em] font-display text-4xl sm:text-5xl font-bold tracking-[0.04em] text-[#FAF8F6] drop-shadow-[0_4px_22px_rgba(46,45,36,0.72)]"
          aria-label="Maloxie"
        >
          {LETTER_SCATTERS.map((item, idx) => (
            <span
              key={`${item.char}-${idx}`}
              ref={(el) => {
                letterRefs.current[idx] = el;
              }}
              className="inline-block will-change-transform"
            >
              {item.char}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
