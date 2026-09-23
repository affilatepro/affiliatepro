const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

class CompactDB {
  constructor(collectionName) {
    this.collectionName = collectionName;
    this.filePath = path.join(DB_DIR, `${collectionName}.json`);
    this.data = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.data = [];
        this.save();
      }
    } catch (err) {
      console.error(`Error loading collection ${this.collectionName}:`, err);
      this.data = [];
    }
  }

  save() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error(`Error saving collection ${this.collectionName}:`, err);
    }
  }

  find(query = {}) {
    return this.data.filter(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    });
  }

  findOne(query = {}) {
    return this.data.find(item => {
      for (const key in query) {
        if (item[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  }

  findById(id) {
    return this.data.find(item => item.id === id) || null;
  }

  insert(item) {
    if (!item.id) {
      item.id = 'ID_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    item.createdAt = item.createdAt || new Date().toISOString();
    item.updatedAt = new Date().toISOString();
    this.data.unshift(item);
    this.save();
    return item;
  }

  update(id, updateData) {
    const index = this.data.findIndex(item => item.id === id);
    if (index === -1) return null;
    this.data[index] = {
      ...this.data[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    this.save();
    return this.data[index];
  }

  delete(id) {
    const initialLen = this.data.length;
    this.data = this.data.filter(item => item.id !== id);
    if (this.data.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  count(query = {}) {
    return this.find(query).length;
  }
}

module.exports = {
  users: new CompactDB('users'),
  packages: new CompactDB('packages'),
  orders: new CompactDB('orders'),
  transactions: new CompactDB('transactions'),
  withdrawals: new CompactDB('withdrawals'),
  leads: new CompactDB('leads'),
  tickets: new CompactDB('tickets'),
  settings: new CompactDB('settings')
};
