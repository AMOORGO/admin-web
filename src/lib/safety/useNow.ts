"use client";

import { useEffect, useState } from "react";

/** Wall clock (epoch ms) refreshed by an interval callback while `enabled`; use it to derive countdowns during render. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
