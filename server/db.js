const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const SQLITE_FILE = path.join(DB_DIR, 'affiliate_empire.db');
const sqlite = new DatabaseSync(SQLITE_FILE);

// Enable WAL Mode & High-Performance Pragmas for millions of operations
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA synchronous = NORMAL;');
sqlite.exec('PRAGMA cache_size = -64000;'); // 64MB in-memory cache
sqlite.exec('PRAGMA temp_store = MEMORY;');

class SQLiteCollection {
  constructor(name) {
    this.name = name;
    this.initTable();
    this.migrateFromJSONIfNeeded();
  }

  initTable() {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS ${this.name} (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);

    // Performance indexes
    if (this.name === 'users') {
      try {
        sqlite.exec(`
          CREATE INDEX IF NOT EXISTS idx_users_pid ON users(json_extract(data, '$.permanentId'));
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(json_extract(data, '$.email'));
          CREATE INDEX IF NOT EXISTS idx_users_phone ON users(json_extract(data, '$.phone'));
          CREATE INDEX IF NOT EXISTS idx_users_fullName ON users(json_extract(data, '$.fullName'));
          CREATE INDEX IF NOT EXISTS idx_users_ref ON users(json_extract(data, '$.referredBy'));
        `);
      } catch (e) {
        // Fallback if json_extract indexing differs
      }
    } else if (this.name === 'orders') {
      try {
        sqlite.exec(`
          CREATE INDEX IF NOT EXISTS idx_orders_uid ON orders(json_extract(data, '$.userId'));
          CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(json_extract(data, '$.status'));
        `);
      } catch (e) {}
    } else if (this.name === 'transactions') {
      try {
        sqlite.exec(`
          CREATE INDEX IF NOT EXISTS idx_trans_uid ON transactions(json_extract(data, '$.userId'));
        `);
      } catch (e) {}
    }
  }

  migrateFromJSONIfNeeded() {
    try {
      const countRow = sqlite.prepare(`SELECT COUNT(*) as count FROM ${this.name}`).get();
      if (countRow && countRow.count === 0) {
        const jsonPath = path.join(DB_DIR, `${this.name}.json`);
        if (fs.existsSync(jsonPath)) {
          const raw = fs.readFileSync(jsonPath, 'utf8');
          if (raw && raw.trim()) {
            const items = JSON.parse(raw);
            if (Array.isArray(items) && items.length > 0) {
              const insertStmt = sqlite.prepare(`
                INSERT OR REPLACE INTO ${this.name} (id, data, createdAt, updatedAt)
                VALUES (?, ?, ?, ?)
              `);
              for (const item of items) {
                const id = item.id || ('ID_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36));
                item.id = id;
                const createdAt = item.createdAt || new Date().toISOString();
                const updatedAt = item.updatedAt || new Date().toISOString();
                insertStmt.run(id, JSON.stringify(item), createdAt, updatedAt);
              }
              console.log(`📦 Auto-migrated ${items.length} records into SQLite table '${this.name}'`);
            }
          }
        }
      }
    } catch (err) {
      console.error(`Migration error for ${this.name}:`, err);
    }
  }

  // Find all items matching optional query object
  find(query = {}) {
    const keys = Object.keys(query);
    if (keys.length === 0) {
      const rows = sqlite.prepare(`SELECT data FROM ${this.name} ORDER BY rowid DESC`).all();
      return rows.map(r => JSON.parse(r.data));
    }

    // Filter using fast SQL json_extract
    const conditions = [];
    const values = [];
    for (const key of keys) {
      conditions.push(`json_extract(data, '$.${key}') = ?`);
      values.push(query[key]);
    }

    try {
      const sql = `SELECT data FROM ${this.name} WHERE ${conditions.join(' AND ')} ORDER BY rowid DESC`;
      const rows = sqlite.prepare(sql).all(...values);
      return rows.map(r => JSON.parse(r.data));
    } catch (err) {
      // Fallback in-memory filter
      const rows = sqlite.prepare(`SELECT data FROM ${this.name} ORDER BY rowid DESC`).all();
      return rows.map(r => JSON.parse(r.data)).filter(item => {
        for (const k of keys) {
          if (item[k] !== query[k]) return false;
        }
        return true;
      });
    }
  }

  // Find single item matching query
  findOne(query = {}) {
    const keys = Object.keys(query);
    if (keys.length === 0) {
      const row = sqlite.prepare(`SELECT data FROM ${this.name} ORDER BY rowid DESC LIMIT 1`).get();
      return row ? JSON.parse(row.data) : null;
    }

    if (query.id) {
      return this.findById(query.id);
    }

    const conditions = [];
    const values = [];
    for (const key of keys) {
      conditions.push(`json_extract(data, '$.${key}') = ?`);
      values.push(query[key]);
    }

    try {
      const sql = `SELECT data FROM ${this.name} WHERE ${conditions.join(' AND ')} LIMIT 1`;
      const row = sqlite.prepare(sql).get(...values);
      return row ? JSON.parse(row.data) : null;
    } catch (err) {
      const all = this.find();
      return all.find(item => {
        for (const k of keys) {
          if (item[k] !== query[k]) return false;
        }
        return true;
      }) || null;
    }
  }

  // Find by Primary Key ID (instant microsecond lookup)
  findById(id) {
    if (!id) return null;
    const row = sqlite.prepare(`SELECT data FROM ${this.name} WHERE id = ? LIMIT 1`).get(id);
    return row ? JSON.parse(row.data) : null;
  }

  // Insert item into SQLite database
  insert(item) {
    if (!item.id) {
      item.id = 'ID_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    const now = new Date().toISOString();
    item.createdAt = item.createdAt || now;
    item.updatedAt = now;

    const stmt = sqlite.prepare(`
      INSERT OR REPLACE INTO ${this.name} (id, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(item.id, JSON.stringify(item), item.createdAt, item.updatedAt);
    return item;
  }

  // Update item in SQLite database
  update(id, updateData) {
    if (!id) return null;
    const existing = this.findById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    const stmt = sqlite.prepare(`
      UPDATE ${this.name}
      SET data = ?, updatedAt = ?
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(updated), updated.updatedAt, id);
    return updated;
  }

  // Delete item from SQLite database
  delete(id) {
    if (!id) return false;
    const stmt = sqlite.prepare(`DELETE FROM ${this.name} WHERE id = ?`);
    const res = stmt.run(id);
    return res.changes > 0;
  }

  // Count items matching query
  count(query = {}) {
    const keys = Object.keys(query);
    if (keys.length === 0) {
      const row = sqlite.prepare(`SELECT COUNT(*) as cnt FROM ${this.name}`).get();
      return row ? Number(row.cnt) : 0;
    }
    return this.find(query).length;
  }

  // Getter for raw data array (for backward compatibility)
  get data() {
    return this.find();
  }

  set data(items) {
    if (!Array.isArray(items)) return;
    sqlite.exec(`DELETE FROM ${this.name}`);
    const stmt = sqlite.prepare(`
      INSERT INTO ${this.name} (id, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?)
    `);
    for (const item of items) {
      const id = item.id || ('ID_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36));
      item.id = id;
      const createdAt = item.createdAt || new Date().toISOString();
      const updatedAt = item.updatedAt || new Date().toISOString();
      stmt.run(id, JSON.stringify(item), createdAt, updatedAt);
    }
  }

  save() {
    // No-op for SQLite since writes are committed immediately
    return true;
  }
}

module.exports = {
  sqlite,
  users: new SQLiteCollection('users'),
  packages: new SQLiteCollection('packages'),
  orders: new SQLiteCollection('orders'),
  transactions: new SQLiteCollection('transactions'),
  withdrawals: new SQLiteCollection('withdrawals'),
  leads: new SQLiteCollection('leads'),
  tickets: new SQLiteCollection('tickets'),
  settings: new SQLiteCollection('settings')
};
