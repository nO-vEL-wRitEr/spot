class ProductExperienceManager {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
  }

  start() {
    this.applyPositioning();
    this.syncNumbers();
    this.wrapExpenseRender();
  }

  applyPositioning() {
    document.title = 'SPOT - 식비 중심 AI 소비 코치';

    const home = this.root.getElementById('view-home');
    const logo = home?.querySelector('header .text-xl.font-black');
    if (logo && !home.querySelector('[data-spot-positioning]')) {
      const wrap = document.createElement('div');
      wrap.dataset.spotPositioning = 'true';
      wrap.className = 'leading-tight';
      logo.parentNode?.insertBefore(wrap, logo);
      wrap.appendChild(logo);
      const subtitle = document.createElement('div');
      subtitle.className = 'text-[8.5px] font-bold text-[#9B701C] mt-0.5 tracking-tight';
      subtitle.textContent = '식비 중심 AI 소비 코치';
      wrap.appendChild(subtitle);
    }

    const greeting = home?.querySelector('h1');
    if (greeting && !home.querySelector('[data-spot-food-coach-copy]')) {
      const note = document.createElement('p');
      note.dataset.spotFoodCoachCopy = 'true';
      note.className = 'text-[9.5px] text-[#77736C] mt-1 font-medium';
      note.textContent = '식비는 더 깊게, 전체 소비는 한눈에 코칭해요.';
      greeting.insertAdjacentElement('afterend', note);
    }

    const aiView = this.root.getElementById('view-ai');
    const aiTitle = aiView?.querySelector('header .text-amber-300');
    if (aiTitle) aiTitle.textContent = '식비 중심 AI 소비 코치';

    const router = this.root.getElementById('screenRouter');
    const aiOption = router?.querySelector('option[value="view-ai"]');
    if (aiOption) aiOption.textContent = '6. 식비 중심 AI 소비 코치 (Coach)';
  }

  wrapExpenseRender() {
    const manager = this.expenseManager;
    if (!manager || typeof manager.render !== 'function' || manager.__productExperienceWrapped) return;
    manager.__productExperienceWrapped = true;
    const original = manager.render.bind(manager);
    manager.render = (...args) => {
      const result = original(...args);
      this.syncNumbers();
      return result;
    };
  }

  syncNumbers() {
    const summary = this.getCurrentMonthSummary();
    this.syncWhatIf(summary);
    this.syncStaticAIExample(summary);
  }

  getCurrentMonthSummary() {
    const expenses = Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const current = expenses
      .map(expense => ({ ...expense, amount: Number(expense.amount || 0), parsedDate: new Date(expense.date) }))
      .filter(expense => !Number.isNaN(expense.parsedDate.getTime()) && expense.parsedDate >= start && expense.parsedDate < end);

    const total = current.reduce((sum, expense) => sum + expense.amount, 0);
    const delivery = current.filter(expense =>
      expense.category === '식비' && (
        expense.foodSubcategory === '배달' ||
        /배달|배민|배달의민족|쿠팡이츠|요기요|delivery/i.test(`${expense.merchant || ''} ${expense.memo || ''}`)
      )
    );
    const deliveryTotal = delivery.reduce((sum, expense) => sum + expense.amount, 0);
    const estimatedSavings = deliveryTotal > 0 ? Math.round((deliveryTotal * 2 / 3) / 1000) * 1000 : 0;

    return {
      total,
      deliveryTotal,
      deliveryCount: delivery.length,
      estimatedSavings,
      adjustedTotal: Math.max(0, total - estimatedSavings)
    };
  }

  syncWhatIf(summary) {
    const view = this.root.getElementById('view-whatif');
    if (!view) return;

    const resultCard = [...view.querySelectorAll('div')].find(el => el.textContent?.includes('AI 시뮬레이션 결과'))?.parentElement;
    if (!resultCard) return;

    const savingsStrong = [...resultCard.querySelectorAll('strong')][0];
    if (savingsStrong) savingsStrong.textContent = this.money(summary.estimatedSavings);

    const rows = [...resultCard.querySelectorAll('.flex.justify-between')];
    const currentRow = rows.find(row => row.textContent?.includes('현재 소비'));
    const adjustedRow = rows.find(row => row.textContent?.includes('조정 후 예상 소비'));
    if (currentRow?.lastElementChild) currentRow.lastElementChild.textContent = this.money(summary.total);
    if (adjustedRow?.lastElementChild) adjustedRow.lastElementChild.textContent = this.money(summary.adjustedTotal);

    const bars = [...resultCard.querySelectorAll('.h-full')];
    const ratio = summary.total > 0 ? Math.round((summary.adjustedTotal / summary.total) * 100) : 0;
    if (bars[0]) bars[0].style.width = summary.total > 0 ? '100%' : '0%';
    if (bars[1]) bars[1].style.width = `${Math.max(0, Math.min(100, ratio))}%`;

    const question = [...view.querySelectorAll('div')].find(el => el.textContent?.trim() === '배달을 주 3회에서 1회로 줄이면?');
    if (question) {
      question.textContent = summary.deliveryCount > 0
        ? `배달 소비를 약 ⅔ 줄이면? · 이번 달 ${summary.deliveryCount}건 기준`
        : '배달 소비를 줄이면 얼마나 절약할 수 있을까요?';
    }
  }

  syncStaticAIExample(summary) {
    const aiView = this.root.getElementById('view-ai');
    if (!aiView) return;
    const bubbles = [...aiView.querySelectorAll('div')];
    const answer = bubbles.find(el => el.textContent?.includes('이번 달 총 지출은'));
    const strong = answer?.querySelector('strong');
    if (strong) strong.textContent = this.money(summary.total);
  }

  money(value) {
    return `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  }
}

window.ProductExperienceManager = ProductExperienceManager;
