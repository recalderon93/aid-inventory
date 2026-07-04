# Capacity Planning

> Post-MVP documentation for storage and cost planning.

## What consumes database space

| Table | Growth pattern |
|-------|----------------|
| `inventory` | High at initial import |
| `donation_items` | Grows with unique products |
| `inventory_transactions` | **Continuous** — every movement |

## Sample data baseline

From `INVENTARIO CARITAS STEPHANY.xlsx` (subset):

- 168 inventory rows
- 63 slots
- ~108 unique items

This fits easily in Supabase Free (500 MB).

## Full warehouse estimates

| Initial load | Approx. DB usage |
|--------------|------------------|
| 50K inventory rows | ~80–150 MB |
| 160K inventory rows | ~250–400 MB |
| 500K inventory rows | Near free tier limit |

## Transaction growth

| Daily movements | Additional DB/year |
|-----------------|-------------------|
| 100/day | ~25–40 MB |
| 500/day | ~90–120 MB |

## Upgrade triggers

| Signal | Action |
|--------|--------|
| DB > 400 MB in dashboard | Plan Supabase Pro |
| Approaching 500 MB on free | Upgrade before import |
| Production go-live | Supabase Pro ($25/mo) |
| Need daily backups | Supabase Pro |

## Cost reference (2026)

| Plan | Monthly | Database included |
|------|---------|-------------------|
| Supabase Free | $0 | 500 MB |
| Supabase Pro | ~$25 | 8 GB |
| Overage | +$0.125/GB | Above 8 GB |

Example: 20 GB database ≈ $26.50/month total.

## Mitigation strategies

1. Normalize items (one `donation_item` per product).
2. Paginate UI lists (performance, not storage).
3. Archive transactions older than 2 years (post-MVP).
4. Import Excel in batches with size monitoring.

## Monitoring

Supabase Dashboard → Settings → Database → check disk usage monthly.
