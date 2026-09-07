class SpotDB {
  constructor() {
    this.dbName = 'spot-db';
    this.version = 1;
    this.db = null;
    this.migrationKey = 'spot-indexeddb-migrated-v1';
  }

  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('expenses')) {
          const store = db.createObjectStore('expenses', { keyPath: 'id' });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('merchant', 'merchant', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IndexedDB를 열지 못했습니다.'));
    });
    return this.db;
  }

  async getAllExpenses() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readonly');
      const req = tx.objectStore('expenses').getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
  }

  async replaceExpenses(expenses) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readwrite');
      const store = tx.objectStore('expenses');
      store.clear();
      (expenses || []).forEach(expense => store.put({ ...expense }));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('IndexedDB 저장이 취소되었습니다.'));
    });
  }

  async putExpense(expense) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readwrite');
      tx.objectStore('expenses').put({ ...expense });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteExpense(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('expenses', 'readwrite');
      tx.objectStore('expenses').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSetting(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(req.error);
    });
  }

  async setSetting(key, value) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async migrateFromLocalStorage() {
    if (localStorage.getItem(this.migrationKey) === '1') return;

    const existingExpenses = await this.getAllExpenses();
    if (!existingExpenses.length) {
      try {
        const legacy = JSON.parse(localStorage.getItem('spot-expenses-v1') || '[]');
        if (Array.isArray(legacy) && legacy.length) await this.replaceExpenses(legacy);
      } catch (_) {}
    }

    const budgetInDb = await this.getSetting('monthlyBudget');
    if (!(Number(budgetInDb) > 0)) {
      const legacyBudget = Number(localStorage.getItem('spot-monthly-budget-v1'));
      if (Number.isFinite(legacyBudget) && legacyBudget > 0) {
        await this.setSetting('monthlyBudget', legacyBudget);
      }
    }

    localStorage.setItem(this.migrationKey, '1');
  }

  async hydrateManager(manager) {
    await this.open();
    await this.migrateFromLocalStorage();

    const expenses = await this.getAllExpenses();
    if (expenses.length) {
      manager.expenses = expenses.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    } else if (Array.isArray(manager.expenses) && manager.expenses.length) {
      await this.replaceExpenses(manager.expenses);
    }

    const budget = Number(await this.getSetting('monthlyBudget'));
    if (Number.isFinite(budget) && budget > 0) manager.monthlyBudget = budget;
    else if (Number(manager.monthlyBudget) > 0) await this.setSetting('monthlyBudget', Number(manager.monthlyBudget));

    this.attachPersistence(manager);
    manager.render();
    return manager;
  }

  attachPersistence(manager) {
    if (manager.__indexedDbAttached) return;
    manager.__indexedDbAttached = true;

    manager.save = () => {
      manager.render();
      this.replaceExpenses(manager.expenses).catch(error => console.error('SPOT IndexedDB expense save:', error));
    };

    manager.saveBudget = value => {
      manager.monthlyBudget = Math.max(0, Number(value) || 0);
      manager.render();
      this.setSetting('monthlyBudget', manager.monthlyBudget).catch(error => console.error('SPOT IndexedDB budget save:', error));
    };
  }
}

window.SpotDB = SpotDB;
