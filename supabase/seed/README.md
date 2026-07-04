# Local seed data (not committed)

CSV and generated SQL files live here on each machine only.

## Setup

1. Place final CSV files in this directory:
   - `medicinas_clean_updated.csv`
   - `manual_review_remaining_updated.csv`
   - `duplicate_consolidation_log.csv`
   - `nota1_clean.csv` (from prior NOTA 1 parse, if needed)

2. Generate SQL:

```bash
npm run import:clean
```

3. Apply to a database (requires `SUPABASE_DB_URL` in `.env.local` or `.env.production.local`):

```bash
node scripts/load-inventory-seed.mjs --target prod --confirm
```

4. Resolve pending items in the app at `/import-review`.
