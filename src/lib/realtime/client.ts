import { io, type Socket } from "socket.io-client";
import { API_ORIGIN } from "../config";
import { getAccessToken } from "../api";
import { tokenStore } from "../auth/tokenStore";

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "offline";

type Handler = (payload: unknown) => void;

interface JoinRequest {
  event: "ops.join" | "ride.join";
  payload: Record<string, string | undefined>;
}

const joinKey = (j: JoinRequest) => `${j.event}:${JSON.stringify(j.payload)}`;

/**
 * Socket.IO client for the staff `/admin` namespace.
 * - Authenticates with the *current* access token on every (re)connect (token is refreshed first if it is about to expire).
 * - Re-emits the active room joins (`ops.join`, `ride.join`) after each reconnect, because rooms are lost with the socket.
 * - Server-side handshake rejections are not retried by socket.io, so they are retried here with backoff.
 */
class RealtimeClient {
  private socket: Socket | null = null;
  private state: ConnectionState = "idle";
  private readonly listeners = new Set<() => void>();
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly joins = new Map<string, JoinRequest>();
  private readonly joinRefs = new Map<string, number>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1000;
  private started = false;

  // ── store contract ──
  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getState = (): ConnectionState => this.state;

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  // ── lifecycle ──
  start(): void {
    if (this.started) return;
    this.started = true;
    this.setState("connecting");
    const socket = io(`${API_ORIGIN}/admin`, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15_000,
      // Called on every connection attempt: always send a fresh token.
      auth: (cb) => {
        void getAccessToken().then((token) => cb({ token: token ?? "" }));
      },
    });
    this.socket = socket;

    socket.on("connect", () => {
      this.retryDelay = 1000;
      this.setState("connected");
      this.rejoin();
    });
    socket.on("disconnect", (reason) => {
      // "io client disconnect" is our own stop(); everything else is retried by socket.io (or by us for server kicks).
      if (reason === "io server disconnect") this.scheduleRetry();
      else if (reason !== "io client disconnect") this.setState("reconnecting");
    });
    socket.on("connect_error", () => {
      // A handshake rejected by the server (expired / revoked token) is not retried by socket.io.
      this.setState(tokenStore.get() ? "reconnecting" : "offline");
      if (!socket.active) this.scheduleRetry();
    });
    socket.io.on("reconnect_attempt", () => this.setState("reconnecting"));
    socket.onAny((event: string, payload: unknown) => {
      this.handlers.get(event)?.forEach((h) => h(payload));
    });
    socket.connect();
  }

  stop(): void {
    this.started = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.socket?.removeAllListeners();
    this.socket?.io.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.setState("idle");
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.socket) return;
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (!this.started || !this.socket || !tokenStore.get()) return;
      this.socket.connect();
    }, delay);
  }

  private rejoin(): void {
    this.joins.forEach((j) => this.socket?.emit(j.event, j.payload));
  }

  // ── public API ──
  /** Subscribe to a server event. Returns the unsubscribe function. */
  on(event: string, handler: Handler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /** Join a room (re-joined automatically after reconnects). Returns a leave function. */
  join(request: JoinRequest): () => void {
    const key = joinKey(request);
    this.joins.set(key, request);
    // reference-counted: several components may join the same room (shell + a view); the last one out leaves it
    this.joinRefs.set(key, (this.joinRefs.get(key) ?? 0) + 1);
    if (this.socket?.connected) this.socket.emit(request.event, request.payload);
    let left = false;
    return () => {
      if (left) return;
      left = true;
      const n = (this.joinRefs.get(key) ?? 1) - 1;
      if (n > 0) {
        this.joinRefs.set(key, n);
        return;
      }
      this.joinRefs.delete(key);
      this.joins.delete(key);
      if (request.event === "ride.join" && this.socket?.connected) this.socket.emit("ride.leave", request.payload);
    };
  }
}

export const realtime = new RealtimeClient();
