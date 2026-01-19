/**
 * Script to import habit data from a CSV file.
 *
 * CSV Format (multi-column):
 *   Date,Habit1,Habit2,Habit3
 *   01/18/26,1,1,,1
 *   01/17/26,1,,1,
 *
 * Supports date formats:
 *   - MM/DD/YY (e.g., 01/18/26)
 *   - YYYY-MM-DD (e.g., 2026-01-18)
 *
 * Any non-empty value in a habit column means the habit was completed.
 *
 * Usage:
 *   Local:  npx tsx scripts/import-csv.ts <username> <csv_file>
 *   Remote: npx tsx scripts/import-csv.ts <username> <csv_file> --remote
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface HabitData {
  habitName: string;
  dates: string[];
}

interface ParsedCSV {
  habits: HabitData[];
}

/**
 * Converts a date string to YYYY-MM-DD format.
 * Supports MM/DD/YY and YYYY-MM-DD formats.
 */
function normalizeDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // MM/DD/YY format
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (match) {
    const [, month, day, year] = match;
    // Assume 20xx for 2-digit years
    const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
    return `${fullYear}-${month}-${day}`;
  }

  return null;
}

function parseCSV(filePath: string): ParsedCSV {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data row');
  }

  // Parse header to get habit names
  const header = lines[0].split(',');
  if (header[0].toLowerCase() !== 'date') {
    throw new Error('First column must be "Date"');
  }

  const habitNames = header.slice(1).map(h => h.trim());
  const habitsMap: Map<string, string[]> = new Map();

  // Initialize habit data
  for (const name of habitNames) {
    if (name) {
      habitsMap.set(name, []);
    }
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    const date = normalizeDate(parts[0]);

    if (!date) {
      console.warn(`Skipping invalid date on line ${i + 1}: ${parts[0]}`);
      continue;
    }

    // Check each habit column
    for (let j = 1; j < parts.length && j < header.length; j++) {
      const habitName = habitNames[j - 1];
      const value = parts[j].trim();

      // Any non-empty value means completed
      if (habitName && value) {
        habitsMap.get(habitName)?.push(date);
      }
    }
  }

  const habits: HabitData[] = [];
  for (const [habitName, dates] of habitsMap) {
    if (dates.length > 0) {
      habits.push({ habitName, dates });
    }
  }

  return { habits };
}

async function importLocal(username: string, csvPath: string) {
  // Find the local D1 database
  const d1Path = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1');

  if (!fs.existsSync(d1Path)) {
    console.error('Local D1 database not found. Run "npm run dev" first to initialize the database.');
    process.exit(1);
  }

  // Find the database file
  const dirs = fs.readdirSync(d1Path);
  if (dirs.length === 0) {
    console.error('No D1 database found. Run "npm run db:migrate" first.');
    process.exit(1);
  }

  const dbDir = path.join(d1Path, dirs[0]);
  const dbFile = fs.readdirSync(dbDir).find(f => f.endsWith('.sqlite'));

  if (!dbFile) {
    console.error('No SQLite database file found.');
    process.exit(1);
  }

  const dbPath = path.join(dbDir, dbFile);
  const db = new Database(dbPath);

  // Get user ID
  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username) as { id: number } | undefined;
  if (!user) {
    console.error(`User "${username}" not found.`);
    db.close();
    process.exit(1);
  }

  // Parse CSV
  const { habits } = parseCSV(csvPath);
  console.log(`Found ${habits.length} habits to import for user "${username}"...`);

  const insertLog = db.prepare('INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)');
  let totalImported = 0;
  let totalSkipped = 0;

  for (const { habitName, dates } of habits) {
    // Create or get habit
    db.prepare('INSERT OR IGNORE INTO habits (user_id, name) VALUES (?, ?)').run(user.id, habitName);
    const habit = db.prepare('SELECT id FROM habits WHERE user_id = ? AND name = ?').get(user.id, habitName) as { id: number };

    let imported = 0;
    for (const date of dates) {
      try {
        const result = insertLog.run(habit.id, date);
        if (result.changes > 0) imported++;
      } catch (e) {
        // Already exists, skip
      }
    }

    const skipped = dates.length - imported;
    console.log(`  "${habitName}": ${imported} imported, ${skipped} skipped`);
    totalImported += imported;
    totalSkipped += skipped;
  }

  db.close();

  console.log(`\nTotal: ${totalImported} entries imported, ${totalSkipped} duplicates skipped.`);
}

async function importRemote(username: string, csvPath: string) {
  const { habits } = parseCSV(csvPath);
  console.log(`Found ${habits.length} habits to import for user "${username}"...`);

  // Get user ID
  const userResult = execSync(
    `npx wrangler d1 execute habit-tracker-db --remote --command="SELECT id FROM users WHERE username = '${username}'" --json`,
    { encoding: 'utf-8' }
  );
  const userData = JSON.parse(userResult);
  if (!userData[0]?.results?.[0]) {
    console.error(`User "${username}" not found.`);
    process.exit(1);
  }
  const userId = userData[0].results[0].id;

  let totalImported = 0;

  for (const { habitName, dates } of habits) {
    // Escape single quotes in habit name
    const escapedName = habitName.replace(/'/g, "''");

    // Create or get habit
    execSync(
      `npx wrangler d1 execute habit-tracker-db --remote --command="INSERT OR IGNORE INTO habits (user_id, name) VALUES (${userId}, '${escapedName}')"`,
      { stdio: 'pipe' }
    );

    const habitResult = execSync(
      `npx wrangler d1 execute habit-tracker-db --remote --command="SELECT id FROM habits WHERE user_id = ${userId} AND name = '${escapedName}'" --json`,
      { encoding: 'utf-8' }
    );
    const habitData = JSON.parse(habitResult);
    const habitId = habitData[0].results[0].id;

    // Insert habit logs in batches
    const batchSize = 50;
    let imported = 0;

    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize);
      const values = batch.map(date => `(${habitId}, '${date}')`).join(', ');

      try {
        execSync(
          `npx wrangler d1 execute habit-tracker-db --remote --command="INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES ${values}"`,
          { stdio: 'pipe' }
        );
        imported += batch.length;
      } catch (e) {
        console.warn(`Warning: Some entries for "${habitName}" may have failed.`);
      }
    }

    console.log(`  "${habitName}": ${imported} entries`);
    totalImported += imported;
  }

  console.log(`\nTotal: ${totalImported} entries imported.`);
}

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--remote');
  const isRemote = process.argv.includes('--remote');

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/import-csv.ts <username> <csv_file> [--remote]');
    console.log('');
    console.log('CSV Format:');
    console.log('  Date,Habit1,Habit2,Habit3');
    console.log('  01/18/26,1,1,');
    console.log('  01/17/26,1,,1');
    console.log('');
    console.log('Supports MM/DD/YY and YYYY-MM-DD date formats.');
    process.exit(1);
  }

  const username = args[0];
  const csvPath = args[1];

  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  if (isRemote) {
    await importRemote(username, csvPath);
  } else {
    await importLocal(username, csvPath);
  }
}

main().catch(console.error);
