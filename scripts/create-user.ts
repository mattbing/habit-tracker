/**
 * Script to create a new user in the habit tracker database.
 *
 * Usage:
 *   Local:  npx tsx scripts/create-user.ts <username> <password>
 *   Remote: npx tsx scripts/create-user.ts <username> <password> --remote
 *
 * The script will hash the password using PBKDF2 and insert the user into the database.
 */

import Database from "better-sqlite3";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const PBKDF2_ITERATIONS = 50000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Hashes a password using PBKDF2-SHA256 with a random salt.
 *
 * Args:
 *   password: The plaintext password to hash.
 *
 * Returns:
 *   A string in the format "salt_hex:hash_hex" for storage.
 */
function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH);

    crypto.pbkdf2(
      password,
      salt,
      PBKDF2_ITERATIONS,
      HASH_LENGTH,
      "sha256",
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }

        const saltHex = salt.toString("hex");
        const hashHex = derivedKey.toString("hex");
        resolve(`${saltHex}:${hashHex}`);
      }
    );
  });
}

async function createUserLocal(username: string, password: string) {
  // Find the local D1 database
  const d1Path = path.join(process.cwd(), ".wrangler", "state", "v3", "d1");

  if (!fs.existsSync(d1Path)) {
    console.error(
      'Local D1 database not found. Run "npm run dev" first to initialize the database.'
    );
    process.exit(1);
  }

  // Find the database file
  const dirs = fs.readdirSync(d1Path);
  if (dirs.length === 0) {
    console.error('No D1 database found. Run "npm run db:migrate" first.');
    process.exit(1);
  }

  const dbDir = path.join(d1Path, dirs[0]);
  const dbFile = fs.readdirSync(dbDir).find((f) => f.endsWith(".sqlite"));

  if (!dbFile) {
    console.error("No SQLite database file found.");
    process.exit(1);
  }

  const dbPath = path.join(dbDir, dbFile);
  const db = new Database(dbPath);

  const passwordHash = await hashPassword(password);

  try {
    db.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)").run(
      username,
      passwordHash
    );
    console.log(`User "${username}" created successfully.`);
  } catch (e: any) {
    if (e.message.includes("UNIQUE constraint failed")) {
      console.error(`User "${username}" already exists.`);
      process.exit(1);
    }
    throw e;
  } finally {
    db.close();
  }
}

async function createUserRemote(username: string, password: string) {
  // Validate username contains only safe characters (alphanumeric, underscore, hyphen)
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    console.error(
      "Username can only contain letters, numbers, underscores, and hyphens."
    );
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  // Use wrangler's JSON input for safe parameter passing
  const sql = `INSERT INTO users (username, password_hash) VALUES ('${username}', '${passwordHash}')`;

  try {
    execSync(
      `npx wrangler d1 execute habit-tracker-db --remote --command="${sql}"`,
      {
        stdio: "inherit",
      }
    );
    console.log(`User "${username}" created successfully on remote database.`);
  } catch (e) {
    console.error("Failed to create user on remote database.");
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(
      "Usage: npx tsx scripts/create-user.ts <username> <password> [--remote]"
    );
    process.exit(1);
  }

  const username = args[0];
  const password = args[1];
  const isRemote = args.includes("--remote");

  if (username.length < 3) {
    console.error("Username must be at least 3 characters.");
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    console.error(
      "Username can only contain letters, numbers, underscores, and hyphens."
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  if (isRemote) {
    await createUserRemote(username, password);
  } else {
    await createUserLocal(username, password);
  }
}

main().catch(console.error);
