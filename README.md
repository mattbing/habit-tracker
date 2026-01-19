# Habit Tracker

A simple, self-hosted habit tracking web app built with Cloudflare Workers and D1.

## Features

- Binary habit tracking (done/not done per day)
- Per-habit calendar view with month navigation
- Multi-user support with password authentication
- CSV import for existing habit data
- Responsive design with Tailwind CSS

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Hono JSX + HTMX + Tailwind CSS

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the D1 database

```bash
# Create the database
npx wrangler d1 create habit-tracker-db

# Copy the database_id from the output and update wrangler.toml
```

### 3. Update wrangler.toml

Replace `YOUR_DATABASE_ID_HERE` with your actual database ID.

### 4. Run database migrations

```bash
# Local
npm run db:migrate

# Remote (production)
npm run db:migrate:remote
```

### 5. Create a user

```bash
# Local
npm run user:create <username> <password>

# Remote
npm run user:create <username> <password> -- --remote
```

### 6. Start development server

```bash
npm run dev
```

Visit `http://localhost:8787` and log in with your credentials.

## Deployment

```bash
npm run deploy
```

## Importing Existing Data

If you have existing habit data in CSV format, you can import it:

### CSV Format

```csv
date,exercise
2024-01-15,3
2024-01-16,1
2024-01-17,0
```

- First column must be `date` (YYYY-MM-DD format)
- Second column header is the habit name
- Any count > 0 is treated as "completed"

### Import Command

```bash
# Local
npm run import:csv <username> <path/to/file.csv>

# Remote
npm run import:csv <username> <path/to/file.csv> -- --remote
```

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Habits table
CREATE TABLE habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- Habit logs (one entry per day per habit when completed)
CREATE TABLE habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, date)
);
```

## Usage

1. **Dashboard**: View all your habits for today, toggle completion status
2. **Add Habit**: Enter a name and click "Add Habit"
3. **Calendar View**: Click "View Calendar" on any habit to see monthly history
4. **Navigation**: Use arrows to navigate between months

## Security Notes

- Passwords are hashed using SHA-256
- Sessions expire after 30 days
- All routes (except login) require authentication
