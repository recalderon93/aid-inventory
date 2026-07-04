# Production Readiness Checklist

Use this checklist before the first production release (v1.0.0).

## Build and automation

- [ ] `npm run lint` passes
- [ ] `npm test` passes (unit tests for permissions, export mapping, search, taxonomy)
- [ ] `npm run build` succeeds
- [ ] CI workflow (`.github/workflows/ci.yml`) green on `master`

## Database and auth

- [ ] All migrations in `supabase/migrations/` applied to production DB (including `00015_collaborator_slot_insert.sql`)
- [ ] RLS policies verified per role (admin, staff, collaborator)
- [ ] Auth redirect URLs include production Vercel domain
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set only on server (never `NEXT_PUBLIC_*`)
- [ ] Admin users created via User Management (no self-registration on login)

## Manual flows

Complete [manual-testing-guide.md](manual-testing-guide.md) against staging or production:

| Flow | Roles to test |
|------|----------------|
| Login / logout / password recovery | All |
| Slot list, search, create | admin, staff, collaborator |
| Register donation | admin, staff, collaborator |
| Inventory list and item detail | All |
| Create order | admin, staff |
| Fulfill / handle order | admin, staff, collaborator |
| Transactions history | All |
| Excel export | admin only |
| User management | admin only |
| Profile edit and change password | All |
| Theme toggle | All |

## Deployment

Follow [deployment.md](deployment.md):

- [ ] Supabase Pro if DB > 400 MB or production-critical uptime
- [ ] Vercel production env vars configured
- [ ] Backups verified
- [ ] Rollback plan documented (redeploy previous Vercel build)

## Post-launch

- [ ] App version visible in user side menu (profile avatar → bottom)
- [ ] Monitor Supabase dashboard (DB size, auth, API errors)
- [ ] Plan E2E tests (Playwright) for next iteration — see [testing-strategy.md](testing-strategy.md)

## Known gaps (acceptable for v1)

- No Playwright E2E in CI yet
- Integration tests against live Supabase not automated
- Excel import from legacy file is post-MVP
