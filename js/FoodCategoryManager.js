class FoodCategoryManager {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.mainCategories = ['식비', '쇼핑', '교통', '생활', '기타'];
    this.foodSubcategories = ['외식', '배달', '카페', '장보기', '편의점', '간식', '기타 식비'];
    this.legacyFoodMap = {
      '카페': '카페',
      '마트': '장보기',
      '한식': '외식',
      '분식': '외식',
      '일식': '외식',
      '중식': '외식',
      '양식': '외식',
      '패스트푸드': '외식',
      '음료': '카페',
      '간식': '간식',
      '편의점·마트': '장보기',
      '기타 식품': '기타 식비'
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

      const categorySelect = form.querySelector('select[name="category"]');
      if (!categorySelect) return;

      const merchant = form.querySelector('[name="merchant"]')?.value || '';
      const memo = form.querySelector('[name="memo"]')?.value || '';
      const amount = Number(form.querySelector('[name="amount"]')?.value || 0);
      const matched = (this.expenseManager?.expenses || []).find(expense =>
        String(expense.merchant || '') === String(merchant) && Number(expense.amount || 0) === amount
      );

      const normalized = this.normalizePayload({
        category: matched?.category || categorySelect.value,
        foodSubcategory: matched?.foodSubcategory,
        merchant,
        memo
      });

      categorySelect.innerHTML = this.mainCategories
        .map(category => `<option value="${category}" ${category === normalized.category ? 'selected' : ''}>${category}</option>`)
        .join('');

      const categoryLabel = categorySelect.closest('label');
      const subLabel = document.createElement('label');
      subLabel.dataset.foodSubcategoryField = 'true';
      subLabel.innerHTML = `
        <span class="spot-label">식비 세부 카테고리</span>
        <select name="foodSubcategory" class="spot-field">
          ${this.foodSubcategories.map(category => `<option value="${category}" ${category === normalized.foodSubcategory ? 'selected' : ''}>${category}</option>`).join('')}
        </select>`;
      categoryLabel?.insertAdjacentElement('afterend', subLabel);

      const syncVisibility = () => {
        const isFood = categorySelect.value === '식비';
        subLabel.classList.toggle('hidden', !isFood);
        subLabel.querySelector('select').disabled = !isFood;
      };
      categorySelect.addEventListener('change', syncVisibility);
      syncVisibility();
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
    const originalCategory = String(payload.category || '기타').trim();
    const text = `${payload.merchant || ''} ${payload.memo || ''} ${(payload.items || []).map(item => item.name || '').join(' ')}`;

    if (Object.prototype.hasOwnProperty.call(this.legacyFoodMap, originalCategory)) {
      payload.category = '식비';
      payload.foodSubcategory = this.legacyFoodMap[originalCategory];
      return payload;
    }

    if (originalCategory === '식비') {
      payload.category = '식비';
      const selected = String(payload.foodSubcategory || '').trim();
      payload.foodSubcategory = this.foodSubcategories.includes(selected)
        ? selected
        : this.inferSubcategory(text);
      return payload;
    }

    payload.category = this.mainCategories.includes(originalCategory) ? originalCategory : '기타';
    delete payload.foodSubcategory;
    return payload;
  }

  migrateExistingFoodCategories() {
    const expenses = Array.isArray(this.expenseManager.expenses) ? this.expenseManager.expenses : [];
    let changed = false;

    for (let i = 0; i < expenses.length; i += 1) {
      const expense = expenses[i];
      const normalized = this.normalizePayload(expense);
      if (normalized.category !== expense.category || normalized.foodSubcategory !== expense.foodSubcategory) {
        expenses[i] = { ...expense, ...normalized };
        changed = true;
      }
    }

    if (changed) this.expenseManager.save?.();
  }

  inferSubcategory(text = '') {
    const value = String(text).toLowerCase();
    const rules = [
      ['장보기', /b마트|마트|market|emart|이마트|홈플러스|롯데마트|장보기|식료품/],
      ['편의점', /편의점|\bcu\b|gs25|세븐일레븐|7-eleven/],
      ['카페', /카페|커피|coffee|starbucks|스타벅스|메가커피|투썸|이디야|음료|주스|에이드|tea/],
      ['배달', /배달|배달의민족|배민|쿠팡이츠|요기요|delivery/],
      ['간식', /디저트|dessert|빵|베이커리|케이크|쿠키|과자|아이스크림|초콜릿|도넛|간식/],
      ['외식', /식당|restaurant|국밥|찌개|전골|불고기|비빔밥|삼겹살|갈비|백반|냉면|국수|초밥|스시|라멘|우동|돈카츠|짜장|짬뽕|탕수육|마라|파스타|스테이크|리조또|샐러드|브런치|burger|햄버거|치킨|피자/]
    ];

    for (const [subcategory, rule] of rules) {
      if (rule.test(value)) return subcategory;
    }
    return '기타 식비';
  }
}

window.FoodCategoryManager = FoodCategoryManager;
