# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run dev              # Start local development server at http://localhost:8787
npm run deploy           # Deploy to Cloudflare Workers

# Database
npm run db:migrate       # Run migrations on local D1 database
npm run db:migrate:remote # Run migrations on remote D1 database

# Data import
npm run import:csv <username> <path/to/file.csv>              # Import CSV locally
npm run import:csv <username> <path/to/file.csv> -- --remote  # Import CSV to remote
```

## Architecture

This is a self-hosted habit tracking app built on Cloudflare Workers with server-side rendering.

### Tech Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono with JSX for server-side rendering
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Cloudflare Access (JWT validation via `Cf-Access-Jwt-Assertion` header)
- **Frontend**: HTMX for interactivity, Tailwind CSS (via CDN), SortableJS for drag-and-drop

### Project Structure
- `src/index.tsx` - Main Hono app with all routes (habits, calendar)
- `src/types.ts` - TypeScript interfaces for User, Habit, HabitLog, Env bindings
- `src/utils/access.ts` - Cloudflare Access JWT validation (RS256, key caching)
- `src/utils/date.ts` - Date utilities, calendar generation
- `src/components/` - Hono JSX components (Layout, HabitCard, Calendar)
- `scripts/` - CLI tools for CSV import (run with tsx, use better-sqlite3 for local D1)
- `schema.sql` - D1 database schema
- `wrangler.toml` - Cloudflare Workers configuration (includes Access team domain and AUD)

### Key Patterns
- Routes return full HTML pages via `c.html(<Layout>...</Layout>)` for initial loads
- HTMX endpoints return HTML fragments for partial updates (e.g., `/habits/:id/toggle`, `/habits/:id/calendar/partial`)
- Auth middleware validates Cloudflare Access JWT and sets `c.get("user")` (auto-creates user on first visit)
- Protected routes use `requireAuth` middleware (returns 403 if no valid JWT)
- Users are identified by email from the Access JWT; stored in `username` column
- Dates stored as ISO strings (YYYY-MM-DD) in SQLite
- Habits support drag-and-drop reordering via `sort_order` column
- Local dev requires `wrangler dev --remote` for authenticated testing through Cloudflare Access
