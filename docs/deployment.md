# Deployment Plan

> Post-MVP documentation. Review before production go-live.

## Recommended tiers

| Environment | Vercel | Supabase | Cost |
|-------------|--------|----------|------|
| Development / MVP validation | Hobby (free) | Free | $0 |
| Production (real usage) | Hobby or Pro | **Pro recommended** | ~$25/mo Supabase |

### Why Supabase Pro for production

- Project does not pause after 1 week of inactivity (free tier pauses).
- 8 GB database (vs 500 MB).
- Daily backups (7 days).
- Required if full Excel import exceeds free tier storage.

### When to consider Vercel Pro

- Exceeding Hobby bandwidth limits.
- Need team features or advanced analytics.

## Setup steps

### 1. Supabase production project

1. Create project at [supabase.com](https://supabase.com).
2. Run migrations from `supabase/migrations/` in order.
3. Run `supabase/seed.sql` if importing sample data (or full import post-MVP).
4. Create auth users or run `scripts/seed-auth.mjs` with service role key.
5. Configure Auth → URL settings with production Vercel URL.

### 2. Vercel deployment

1. Connect GitHub repo to Vercel.
2. Set branch `master` → Production, `develop` → Preview.
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)

### 3. Domain (when ready)

1. Register domain.
2. Add to Vercel project → Domains.
3. Update Supabase Auth redirect URLs.

### 4. HTTPS

Automatic on Vercel.

### 5. Rollback

- Vercel: redeploy previous successful deployment.
- Database: keep migrations reversible; avoid destructive changes without backup.

### 6. Monitoring

- Vercel Analytics (free on Hobby).
- Supabase dashboard → Database size, Auth usage, API logs.

## Staging

Use second Supabase free project for staging, or Supabase branching on Pro plan.

## Checklist before go-live

- [ ] All migrations applied to production DB
- [ ] RLS policies tested per role
- [ ] Manual testing guide completed
- [ ] Supabase Pro enabled if DB > 400 MB or production-critical
- [ ] Backups verified
- [ ] Auth redirect URLs include production domain
- [ ] Service role key not exposed to client
