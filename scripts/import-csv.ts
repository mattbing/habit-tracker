/**
 * Script to import habit data from a CSV file.
 *
 * CSV Format:
 *   date,habit_name
 *   2024-01-15,3
 *   2024-01-16,1
 *
 * Where "habit_name" is the column header (the name of the habit),
 * and any count > 0 means the habit was completed on that date.
 *
 * Usage:
 *   Local:  npx tsx scripts/import-csv.ts <username> <csv_file>
 *   Remote: npx tsx scripts/import-csv.ts <username> <csv_file> --remote
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface ParsedCSV {
  habitName: string;
  dates: string[];
}

function parseCSV(filePath: string): ParsedCSV {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data row');
  }

  // Parse header to get habit name
  const header = lines[0].split(',');
  if (header.length !== 2 || header[0].toLowerCase() !== 'date') {
    throw new Error('CSV must have format: date,<habit_name>');
  }

  const habitName = header[1].trim();
  const dates: string[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length !== 2) {
      console.warn(`Skipping malformed line ${i + 1}: ${line}`);
      continue;
    }

    const date = parts[0].trim();
    const count = parseInt(parts[1].trim(), 10);

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn(`Skipping invalid date on line ${i + 1}: ${date}`);
      continue;
    }

    // Any count > 0 means completed
    if (count > 0) {
      dates.push(date);
    }
  }

  return { habitName, dates };
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
    process.exit(1);
  }

  // Parse CSV
  const { habitName, dates } = parseCSV(csvPath);
  console.log(`Importing habit "${habitName}" with ${dates.length} completions for user "${username}"...`);

  // Create or get habit
  db.prepare('INSERT OR IGNORE INTO habits (user_id, name) VALUES (?, ?)').run(user.id, habitName);
  const habit = db.prepare('SELECT id FROM habits WHERE user_id = ? AND name = ?').get(user.id, habitName) as { id: number };

  // Insert habit logs
  const insertLog = db.prepare('INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)');
  let imported = 0;

  for (const date of dates) {
    try {
      const result = insertLog.run(habit.id, date);
      if (result.changes > 0) imported++;
    } catch (e) {
      // Already exists, skip
    }
  }

  db.close();

  console.log(`Successfully imported ${imported} log entries (${dates.length - imported} duplicates skipped).`);
}

async function importRemote(username: string, csvPath: string) {
  const { habitName, dates } = parseCSV(csvPath);
  console.log(`Importing habit "${habitName}" with ${dates.length} completions for user "${username}"...`);

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

  // Create or get habit
  execSync(
    `npx wrangler d1 execute habit-tracker-db --remote --command="INSERT OR IGNORE INTO habits (user_id, name) VALUES (${userId}, '${habitName}')"`,
    { stdio: 'inherit' }
  );

  const habitResult = execSync(
    `npx wrangler d1 execute habit-tracker-db --remote --command="SELECT id FROM habits WHERE user_id = ${userId} AND name = '${habitName}'" --json`,
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
      console.log(`Imported ${imported}/${dates.length} entries...`);
    } catch (e) {
      console.warn(`Warning: Some entries in batch ${i / batchSize + 1} may have failed.`);
    }
  }

  console.log(`Import complete.`);
}

async function main() {
  const args = process.argv.slice(2).filter(a => a !== '--remote');
  const isRemote = process.argv.includes('--remote');

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/import-csv.ts <username> <csv_file> [--remote]');
    console.log('');
    console.log('CSV Format:');
    console.log('  date,habit_name');
    console.log('  2024-01-15,3');
    console.log('  2024-01-16,1');
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
