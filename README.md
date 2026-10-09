# AmoorGo Ops — admin console

Next.js 16 (App Router, Cache Components) staff console for the AMOORGO backend (NestJS REST + Socket.IO).
All data comes from the API; there is no mock data in the runtime path.

## Run

```bash
cp .env.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:4000
pnpm install
pnpm dev                        # http://localhost:3000
```

The backend must be running (`pnpm start:dev` in `../backend`, port 4000, `CORS_ORIGINS` must include the console origin).
`pnpm build` / `pnpm lint` / `pnpm exec tsc --noEmit` must stay green.

## Sign-in

Staff sign in with e-mail + password, then a TOTP code. Accounts holding a sensitive permission must enrol an
authenticator app on first sign-in (the login screen shows the secret / `otpauth://` link). New staff receive an invite
link (`/accept-invite/<token>`) to set their password. Permissions shown in the UI come from the backend session
(`/admin/me`); the API remains the enforcement point.

Tokens live in memory + `sessionStorage` (never `localStorage`), are refreshed silently (single-flight, one retry on 401)
and the session ends with a notice when the refresh token is rejected.

## Demo mode (no backend)

Set `NEXT_PUBLIC_DEMO_MODE=true` at build time and the login screen gains an **Explore demo (no backend)** button. It opens
the whole console as a synthetic Super Admin on in-memory sample data (Austin / Dallas / Houston, USD, miles): rides in every
status, captains and KYC documents, riders, SOS incidents, finance, pricing, staff and audit logs. Mutations (cancel a ride,
approve a document or refund, acknowledge an SOS ...) update the in-memory store and write an audit entry, so the screens
reflect them immediately, but nothing is persisted or sent anywhere and a reload re-seeds the data. A banner shows
"Demo mode — sample data, changes are not saved" with an **Exit demo** button.

- It plugs into the single request function in `src/lib/api/client.ts`; every view and hook works unchanged. The demo code
  lives in `src/lib/demo` and is loaded with a dynamic `import()` only while a demo session is active. The realtime client
  runs a local simulation (periodic `ops.snapshot`, one `sos.raised` ~20 s after entering) instead of Socket.IO.
- Netlify: `netlify.toml` sets `NEXT_PUBLIC_DEMO_MODE = "true"`.
- **Turn it off:** remove that line from `netlify.toml` (or set it to `"false"`), set `NEXT_PUBLIC_API_URL` to the live API
  and redeploy (the flag is inlined at build time). With the flag unset the button does not render and the demo module is never
  requested.

## Layout

| Path | Purpose |
| --- | --- |
| `src/lib/api` | typed fetch client: envelope unwrapping, `ApiError`, auth header, refresh, timeouts, cursor pagination, CSV download |
| `src/lib/auth` | token store, `AuthProvider` / `useAuth` |
| `src/lib/realtime` | Socket.IO `/admin` client (fresh token on every reconnect, room re-joins) and hooks |
| `src/lib/hooks` | `useQuery`, `useCursorList`, `useMutation` |
| `src/lib/adapters` | API DTO -> UI type mappers (minor units -> dollars, meters -> miles ...) |
| `src/lib/demo` | demo mode: in-memory backend (seed data, route handlers, realtime simulation); see "Demo mode" above |
| `src/modules` | the twelve console views |
| `src/components` | shared UI (drawers, dialogs, auth screens, `ui/` primitives) |
