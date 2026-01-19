/**
 * Script to create a new user in the habit tracker database.
 *
 * Usage:
 *   Local:  npx tsx scripts/create-user.ts <username> <password>
 *   Remote: npx tsx scripts/create-user.ts <username> <password> --remote
 *
 * The script will hash the password and insert the user into the database.
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

async function hashPassword(password: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

async function createUserLocal(username: string, password: string) {
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

  const passwordHash = await hashPassword(password);

  try {
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
    console.log(`User "${username}" created successfully.`);
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed')) {
      console.error(`User "${username}" already exists.`);
      process.exit(1);
    }
    throw e;
  } finally {
    db.close();
  }
}

async function createUserRemote(username: string, password: string) {
  const passwordHash = await hashPassword(password);

  const sql = `INSERT INTO users (username, password_hash) VALUES ('${username}', '${passwordHash}')`;

  try {
    execSync(`npx wrangler d1 execute habit-tracker-db --remote --command="${sql}"`, {
      stdio: 'inherit',
    });
    console.log(`User "${username}" created successfully on remote database.`);
  } catch (e) {
    console.error('Failed to create user on remote database.');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/create-user.ts <username> <password> [--remote]');
    process.exit(1);
  }

  const username = args[0];
  const password = args[1];
  const isRemote = args.includes('--remote');

  if (username.length < 3) {
    console.error('Username must be at least 3 characters.');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  if (isRemote) {
    await createUserRemote(username, password);
  } else {
    await createUserLocal(username, password);
  }
}

main().catch(console.error);
