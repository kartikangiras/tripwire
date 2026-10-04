import { useCallback, useEffect, useRef, useState } from "react";

const FULL_SPAN_MS = 22_000; // the whole window plays in 22s at 1×

/** The replay engine: a playhead over [t0, t1] with play/pause, speed, scrub and the space key. */
export function useReplay(t0: number, t1: number) {
  const [cur, setCur] = useState(t0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const raf = useRef(0);

  useEffect(() => { setCur(t0); setPlaying(false); }, [t0]);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      setCur(c => { const n = Math.min(t1, c + dt * rate * ((t1 - t0) / FULL_SPAN_MS)); if (n >= t1) setPlaying(false); return n; });
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, rate, t0, t1]);

  const toggle = useCallback(() => { setPlaying(p => { if (!p && cur >= t1) setCur(t0); return !p; }); }, [cur, t0, t1]);
  const scrub = useCallback((t: number) => { setPlaying(false); setCur(t); }, []);
  const cycleRate = useCallback(() => setRate(r => (r === 1 ? 8 : r === 8 ? 40 : 1)), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); toggle(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [toggle]);

  return { cur, playing, rate, toggle, scrub, cycleRate };
}
