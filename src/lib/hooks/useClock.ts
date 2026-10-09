"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared wall clock for every relative timestamp on screen: a single interval re-renders subscribers every 30 s
 * instead of one timer per table row. Returns epoch ms (module load time during server render).
 */
const bootTime = Date.now();
let current = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = (): number => {
  if (current === 0) current = Date.now();
  return current;
};

export function useClock(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => bootTime);
}
