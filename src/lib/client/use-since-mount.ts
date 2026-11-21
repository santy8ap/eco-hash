"use client";
import { useEffect, useState } from "react";

/** Milisegundos desde que el componente apareció en pantalla, renovados cada `everyMs`. */
export function useSinceMount(everyMs: number) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - start), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return elapsed;
}
