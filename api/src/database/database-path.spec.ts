import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { prepareDatabasePath } from './database-path';

function seedDatabase(filePath: string, rowCount: number) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT)');
  const insert = db.prepare('INSERT INTO notes (body) VALUES (?)');
  for (let i = 0; i < rowCount; i += 1) {
    insert.run(`row-${i}`);
  }
  db.close();
}

function countRows(filePath: string) {
  const db = new Database(filePath, { readonly: true });
  try {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
      .all();
    if (tables.length === 0) {
      return 0;
    }
    const row = db.prepare('SELECT COUNT(*) AS count FROM notes').get() as
      | { count: number }
      | undefined;
    return row?.count ?? 0;
  } finally {
    db.close();
  }
}

describe('prepareDatabasePath', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-path-test-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
    delete process.env.YINJIE_DATA_ROOT;
  });

  it('preserves an existing target database with rows even when other candidates carry different data', () => {
    const accountDir = path.join(workDir, 'accounts', '12345');
    const targetPath = path.join(accountDir, 'database.sqlite');
    seedDatabase(targetPath, 7);
    const targetMtimeBefore = fs.statSync(targetPath).mtimeMs;

    process.env.YINJIE_DATA_ROOT = accountDir;

    // Simulate a populated legacy DB sitting at the repo-root data dir.
    const legacyPath = path.join(workDir, 'data', 'database.sqlite');
    seedDatabase(legacyPath, 99);
    fs.utimesSync(
      legacyPath,
      new Date(),
      new Date(Date.now() + 60_000), // mtime later than the target
    );

    const resolved = prepareDatabasePath(targetPath);

    expect(resolved).toBe(targetPath);
    expect(countRows(targetPath)).toBe(7);
    expect(fs.statSync(targetPath).mtimeMs).toBe(targetMtimeBefore);
  });

  // Note: legacy bootstrap behavior (copying from `/data/database.sqlite` etc.
  // into a fresh target) is intentionally still in place for first-run setup,
  // but it's not unit-tested here because the legacy candidate paths are
  // hardcoded relative to the repo root and would collide with whatever
  // database.sqlite actually exists in the working tree at test time.
});
