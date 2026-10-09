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

## Layout

| Path | Purpose |
| --- | --- |
| `src/lib/api` | typed fetch client: envelope unwrapping, `ApiError`, auth header, refresh, timeouts, cursor pagination, CSV download |
| `src/lib/auth` | token store, `AuthProvider` / `useAuth` |
| `src/lib/realtime` | Socket.IO `/admin` client (fresh token on every reconnect, room re-joins) and hooks |
| `src/lib/hooks` | `useQuery`, `useCursorList`, `useMutation` |
| `src/lib/adapters` | API DTO -> UI type mappers (minor units -> dollars, meters -> miles ...) |
| `src/modules` | the twelve console views |
| `src/components` | shared UI (drawers, dialogs, auth screens, `ui/` primitives) |
