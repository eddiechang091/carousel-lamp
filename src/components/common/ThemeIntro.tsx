import { useEffect, useRef, useState } from 'react';
import type { ThemeId } from '@/lib/themes';
import { INTRO_DURATION, ThemeIntroAnimator } from '@/lib/theme-intro';

interface Props {
  themeId: ThemeId;
}

export default function ThemeIntro({ themeId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(themeId !== 'default');

  useEffect(() => {
    if (themeId === 'default') { setVisible(false); return; }
    setVisible(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animator = new ThemeIntroAnimator(themeId, w, h);
    const start = performance.now();
    let raf = 0;

    function loop() {
      const t = (performance.now() - start) / 1000;
      const fadeIn = Math.min(1, t / 0.4);
      const fadeOut = Math.max(0, 1 - (t - (INTRO_DURATION - 0.6)) / 0.6);
      ctx!.clearRect(0, 0, w, h);
      animator.draw(ctx!, t, fadeIn * fadeOut);
      if (t < INTRO_DURATION) {
        raf = requestAnimationFrame(loop);
      } else {
        ctx!.clearRect(0, 0, w, h);
        setVisible(false);
      }
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [themeId]);

  if (!visible) return null;
  return <canvas ref={canvasRef} className="theme-intro" aria-hidden="true" />;
}
