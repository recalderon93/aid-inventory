# aid-inventory

Mobile-first inventory management system for a donation center. Tracks donated items in numbered boxes (slots), manages donation orders, and maintains an audit trail of inventory movements.

## Stack

- **Next.js** (App Router) + TypeScript
- **Supabase** — PostgreSQL, Auth, RLS
- **Tailwind CSS** + shadcn/ui
- **React Hook Form** + Zod
- **TanStack Query**

UI is in Spanish (`src/locales/es.ts`). Code, database, and routes use English naming.

## Prerequisites

- Node.js 20+
- npm
- [Supabase](https://supabase.com) project (free tier for dev)

## Setup

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/recalderon93/aid-inventory.git
cd aid-inventory
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Fill in Supabase credentials from your project dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Apply database migrations (Supabase CLI or SQL editor):

```bash
npx supabase db push
# or run files in supabase/migrations/ manually
```

5. Load seed data (optional, for local dev):

```bash
# Run supabase/seed.sql in SQL editor or via CLI
```

6. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test users (seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aid-inventory.local | `password123` |
| Staff | staff@aid-inventory.local | `password123` |
| Collaborator | collaborator@aid-inventory.local | `password123` |

## Project structure

```
src/
  app/           # Next.js App Router pages and API routes
  components/    # UI components
  lib/           # Supabase clients, utilities
  locales/       # Spanish UI strings (es.ts)
supabase/
  migrations/    # SQL migrations (one table per file)
  seed.sql       # Dev seed data from Excel sample
docs/
  project-request.md
  excel-mapping.md
  database-schema.md
  user-flows.md
  manual-testing-guide.md
  samples/       # Legacy Excel reference
```

## Documentation

- [Project specification](docs/project-request.md)
- [Excel column mapping](docs/excel-mapping.md)
- [Database schema](docs/database-schema.md)
- [User flows](docs/user-flows.md)
- [Manual testing guide](docs/manual-testing-guide.md)

## Branching

- `master` — stable releases
- `develop` — MVP integration

## License

MIT — see [LICENSE](LICENSE).
