class FoodCategoryManager {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.categories = ['한식', '분식', '일식', '중식', '양식', '패스트푸드', '음료', '간식', '편의점·마트', '기타 식품'];
    this.legacyMap = {
      '식비': null,
      '카페': '음료',
      '마트': '편의점·마트'
    };
    this.observer = null;
  }

  start() {
    if (!this.expenseManager || this.expenseManager.__foodCategoryEnhanced) return;
    this.expenseManager.__foodCategoryEnhanced = true;
    this.wrapPersistence();
    this.observeForms();
    this.migrateExistingFoodCategories();
  }

  wrapPersistence() {
    const manager = this.expenseManager;
    const originalAdd = manager.addExpense?.bind(manager);
    const originalUpdate = manager.updateExpense?.bind(manager);

    if (originalAdd) {
      manager.addExpense = data => originalAdd(this.normalizePayload(data));
    }
    if (originalUpdate) {
      manager.updateExpense = (id, data) => originalUpdate(id, this.normalizePayload(data));
    }
  }

  observeForms() {
    const enhance = form => {
      if (!form || form.dataset.foodCategories) return;
      form.dataset.foodCategories = 'true';
      const select = form.querySelector('select[name="category"]');
      if (!select) return;

      const merchant = form.querySelector('[name="merchant"]')?.value || '';
      const memo = form.querySelector('[name="memo"]')?.value || '';
      const current = select.value;
      const selected = this.categories.includes(current)
        ? current
        : this.legacyMap[current] || this.inferCategory(`${merchant} ${memo}`);

      select.innerHTML = this.categories
        .map(category => `<option value="${category}" ${category === selected ? 'selected' : ''}>${category}</option>`)
        .join('');
    };

    this.root.querySelectorAll('#spot-expense-form').forEach(enhance);
    this.observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches?.('#spot-expense-form')) enhance(node);
          node.querySelectorAll?.('#spot-expense-form').forEach(enhance);
        }
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  normalizePayload(data = {}) {
    const payload = { ...data };
    if (this.categories.includes(payload.category)) return payload;

    if (this.legacyMap[payload.category]) {
      payload.category = this.legacyMap[payload.category];
      return payload;
    }

    const text = `${payload.merchant || ''} ${payload.memo || ''} ${(payload.items || []).map(item => item.name || '').join(' ')}`;
    payload.category = this.inferCategory(text);
    return payload;
  }

  migrateExistingFoodCategories() {
    const expenses = Array.isArray(this.expenseManager.expenses) ? this.expenseManager.expenses : [];
    let changed = false;

    for (const expense of expenses) {
      if (this.categories.includes(expense.category)) continue;
      if (expense.category === '카페') {
        expense.category = '음료';
        changed = true;
      } else if (expense.category === '마트') {
        expense.category = '편의점·마트';
        changed = true;
      } else if (expense.category === '식비') {
        expense.category = this.inferCategory(`${expense.merchant || ''} ${expense.memo || ''}`);
        changed = true;
      }
    }

    if (changed) this.expenseManager.save?.();
  }

  inferCategory(text = '') {
    const value = String(text).toLowerCase();
    const rules = [
      ['분식', /떡볶이|김밥|순대|튀김|어묵|라볶이|분식/],
      ['한식', /한식|국밥|찌개|전골|불고기|비빔밥|삼겹살|갈비|백반|냉면|국수|설렁탕|감자탕/],
      ['일식', /초밥|스시|라멘|우동|돈카츠|돈까스|사시미|일식/],
      ['중식', /짜장|짬뽕|탕수육|마라|훠궈|중식|딤섬/],
      ['양식', /파스타|스테이크|리조또|샐러드|브런치|양식/],
      ['패스트푸드', /burger|햄버거|맥도날드|롯데리아|버거킹|맘스터치|kfc|피자|치킨/],
      ['음료', /카페|커피|coffee|starbucks|스타벅스|메가커피|투썸|이디야|음료|주스|에이드|탄산|tea/],
      ['간식', /디저트|dessert|빵|베이커리|케이크|쿠키|과자|아이스크림|초콜릿|도넛|간식/],
      ['편의점·마트', /마트|market|편의점|cu|gs25|세븐일레븐|emart|이마트|홈플러스|롯데마트/]
    ];

    for (const [category, rule] of rules) {
      if (rule.test(value)) return category;
    }
    return '기타 식품';
  }
}

window.FoodCategoryManager = FoodCategoryManager;
