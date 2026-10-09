import type { AdminTab } from "@/components/Sidebar";

/**
 * One-shot "open this tab pre-filtered" hint: the dashboard attention feed sets it right before navigating, the target
 * view reads it when it mounts (peek) and clears it once applied. Module state, so nothing leaks into the URL or storage.
 */
let intent: { tab: AdminTab; filter: string } | null = null;

export function setNavIntent(tab: AdminTab, filter: string): void {
  intent = { tab, filter };
}

export function peekNavIntent(tab: AdminTab): string | null {
  return intent && intent.tab === tab ? intent.filter : null;
}

export function clearNavIntent(): void {
  intent = null;
}
