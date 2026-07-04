# Testing Strategy

> Post-MVP automated testing plan.

## Overview

Manual testing covers MVP validation (see [manual-testing-guide.md](manual-testing-guide.md)). Introduce automated tests after MVP is stable.

## Unit tests (Vitest)

**Priority:**

- `src/lib/permissions.ts` — `inferCategory`, `suggestSlotsForItem`, `generateOrderNumber`
- Zod validation schemas (when added for forms)
- Excel export row mapping utility

**Tool:** Vitest

```bash
npm install -D vitest @vitejs/plugin-react jsdom
```

## Integration tests

**Priority:**

- API route `/api/export` — auth check, column output
- Donation registration logic (upsert inventory + transaction)
- Order fulfillment deduction

**Setup:** Vitest + Supabase local (`supabase start`) or test project.

## End-to-end tests (Playwright)

**Critical flows:**

1. Login → slot list
2. Add donation to slot
3. Create order → fulfill → verify inventory decrease
4. Export Excel

**Tool:** Playwright

```bash
npm install -D @playwright/test
npx playwright install
```

## CI (GitHub Actions)

Run on PRs to `develop`:

```yaml
- lint
- unit tests
- build
- e2e (optional, against preview deploy)
```

## When to introduce

| Phase | Tests |
|-------|-------|
| MVP | Manual only |
| Post-MVP stable | Unit + integration for fulfillment |
| Pre-production | E2E for critical paths |

## Coverage goals

- Permissions/helpers: 90%+
- API routes: critical paths covered
- E2E: 5–8 happy-path scenarios
