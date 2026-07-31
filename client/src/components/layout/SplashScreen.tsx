import { useEffect, useState } from 'react';

/**
 * SplashScreen — full-screen loading overlay shown on app start.
 *
 * Mirrors the legacy index.legacy.html splash: TIMBERMAN logo (text
 * placeholder until a real logotipo image exists in client/public/)
 * with a pulsing animation and a spinning BET-yellow spinner.
 * Fades out automatically after a short delay.
 */
export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setHidden(true), 2200);
    const unmountTimer = setTimeout(() => setMounted(false), 2800);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className={`splash-screen${hidden ? ' hidden' : ''}`}>
      <div className="splash-logo">TIMBERMAN</div>
      <div className="splash-spinner" />
    </div>
  );
}
