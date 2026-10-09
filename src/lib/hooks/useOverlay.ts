"use client";

import { useEffect, useRef, type RefObject } from "react";

/* Shared behaviour for every overlay (sheets, drawers, dialogs, the fullscreen map, the mobile nav). */

let lockCount = 0;
let savedOverflow = "";
let savedPadding = "";

/** Locks page scroll while `active` (ref-counted so stacked overlays don't fight; compensates the scrollbar width). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (lockCount === 0) {
      savedOverflow = root.style.overflow;
      savedPadding = root.style.paddingRight;
      const gutter = window.innerWidth - root.clientWidth;
      root.style.overflow = "hidden";
      if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    }
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) {
        root.style.overflow = savedOverflow;
        root.style.paddingRight = savedPadding;
      }
    };
  }, [active]);
}

/** Calls `onEscape` when Escape is pressed while `active`. Only the top-most overlay (last registered) reacts. */
const escapeStack: Array<symbol> = [];
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const id = Symbol("overlay");
    escapeStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (escapeStack[escapeStack.length - 1] !== id) return;
      e.stopPropagation();
      handlerRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = escapeStack.indexOf(id);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[inert]") && el.getClientRects().length > 0);
}

/**
 * Keeps keyboard focus inside `ref` while `active`, moves focus in on open (first element carrying `data-autofocus`,
 * else the container itself) and restores it to whatever was focused before when the overlay closes.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const auto = root.querySelector<HTMLElement>("[data-autofocus]");
    (auto ?? root).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (current === first || current === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      } else if (current && !root.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
