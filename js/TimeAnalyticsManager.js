class TimeAnalyticsManager {
  constructor(root = document, expenseManager = window.spotExpenseManager, analyticsManager = window.spotAnalyticsManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.analyticsManager = analyticsManager;
    this.view = null;
    this.card = null;
    this.buckets = [
      { key: 'lateNight', label: '심야', range: '00~05시', start: 0, end: 6 },
      { key: 'morning', label: '아침', range: '06~10시', start: 6, end: 11 },
      { key: 'lunch', label: '점심', range: '11~13시', start: 11, end: 14 },
      { key: 'afternoon', label: '오후', range: '14~17시', start: 14, end: 18 },
      { key: 'evening', label: '저녁', range: '18~21시', start: 18, end: 22 },
      { key: 'night', label: '밤', range: '22~23시', start: 22, end: 24 }
    ];
  }

  start() {
    this.view = this.root.getElementById('view-analytics');
    if (!this.view || this.view.dataset.timeAnalyticsEnhanced) return;
    this.view.dataset.timeAnalyticsEnhanced = 'true';

    this.createCard();
    this.bindRangeChanges();
    this.bindExpenseUpdates();
    this.render();
  }

  createCard() {
    const categoryCard = this.root.getElementById('spot-live-analytics-card');
    if (!categoryCard) return;

    this.card = document.createElement('div');
    this.card.id = 'spot-time-analytics';
    this.card.className = 'bg-white rounded-2xl p-4 border border-[#EAE5DB] shadow-sm mb-3';
    categoryCard.insertAdjacentElement('beforebegin', this.card);
  }

  bindRangeChanges() {
    this.view.addEventListener('click', event => {
      if (!event.target.closest?.('[data-range]')) return;
      setTimeout(() => this.render(), 0);
    });
  }

  bindExpenseUpdates() {
    const manager = this.expenseManager;
    if (!manager || typeof manager.render !== 'function' || manager.__timeAnalyticsWrapped) return;

    const originalRender = manager.render.bind(manager);
    manager.render = (...args) => {
      const result = originalRender(...args);
      this.render();
      return result;
    };
    manager.__timeAnalyticsWrapped = true;
  }

  currentRange() {
    return this.analyticsManager?.range || 'month';
  }

  getBounds() {
    if (this.analyticsManager?.getBounds) return this.analyticsManager.getBounds(0, this.currentRange());

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }

  getExpenses() {
    const { start, end } = this.getBounds();
    return (Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [])
      .map(expense => ({ ...expense, amount: Number(expense.amount || 0), parsedDate: new Date(expense.date) }))
      .filter(expense =>
        expense.amount >= 0 &&
        !Number.isNaN(expense.parsedDate.getTime()) &&
        expense.parsedDate >= start && expense.parsedDate < end
      );
  }

  rangeLabel() {
    return ({ day: '오늘', week: '이번 주', month: '이번 달', year: '올해' })[this.currentRange()] || '이번 달';
  }

  summarize() {
    const expenses = this.getExpenses();
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const values = this.buckets.map(bucket => {
      const items = expenses.filter(expense => {
        const hour = expense.parsedDate.getHours();
        return hour >= bucket.start && hour < bucket.end;
      });
      const amount = items.reduce((sum, expense) => sum + expense.amount, 0);
      return {
        ...bucket,
        amount,
        count: items.length,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0
      };
    });

    return { expenses, total, values };
  }

  render() {
    if (!this.card) return;

    const summary = this.summarize();
    const top = [...summary.values].sort((a, b) => b.amount - a.amount)[0];
    const maxAmount = Math.max(...summary.values.map(item => item.amount), 1);

    const bars = summary.values.map(item => {
      const height = item.amount > 0 ? Math.max(10, Math.round((item.amount / maxAmount) * 74)) : 5;
      const active = top?.amount > 0 && item.key === top.key;
      return `
        <div class="flex-1 min-w-0 text-center">
          <div class="h-[82px] flex items-end justify-center mb-1.5">
            <div title="${this.escapeAttr(item.label)} ${this.money(item.amount)}" class="w-full max-w-[28px] rounded-t-lg transition-all ${active ? 'bg-[#D4A23B]' : 'bg-[#08233D]'}" style="height:${height}px"></div>
          </div>
          <div class="text-[9px] font-black ${active ? 'text-[#D17D19]' : 'text-[#08233D]'}">${this.escapeHtml(item.label)}</div>
          <div class="text-[8px] text-[#94A3B8] mt-0.5">${item.percent}%</div>
        </div>`;
    }).join('');

    const rows = summary.values.map(item => `
      <div class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
        <div class="min-w-0">
          <span class="text-[10.5px] font-black text-[#161616]">${this.escapeHtml(item.label)}</span>
          <span class="text-[9px] text-[#94A3B8] ml-1">${this.escapeHtml(item.range)}</span>
        </div>
        <div class="text-right shrink-0">
          <div class="text-[10.5px] font-black text-[#08233D]">${this.money(item.amount)}</div>
          <div class="text-[8.5px] text-[#77736C]">${item.count}건</div>
        </div>
      </div>`).join('');

    const insight = summary.expenses.length && top?.amount > 0
      ? `${this.rangeLabel()}에는 ${top.label}(${top.range}) 소비가 ${this.money(top.amount)}으로 가장 많고, 전체의 ${top.percent}%를 차지해요.`
      : `${this.rangeLabel()}에 시간 정보가 포함된 지출을 입력하면 소비가 집중되는 시간대를 확인할 수 있어요.`;

    this.card.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <div class="text-xs font-black text-[#08233D]">시간대별 소비 분석</div>
          <div class="text-[10px] text-[#77736C] mt-0.5">결제 시간을 기준으로 소비가 집중되는 시간대를 찾아요.</div>
        </div>
        <span class="text-[9px] font-black text-[#9B701C] bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg whitespace-nowrap">${this.rangeLabel()}</span>
      </div>

      <div class="flex gap-1.5 items-end border-b border-[#EAE5DB] pb-3">${bars}</div>

      <div class="mt-3 bg-[#FFFAF2] border border-[#EAE5DB] rounded-xl p-3">
        <div class="text-[9px] font-black text-[#9B701C] mb-1">시간 패턴</div>
        <div class="text-[10.5px] font-bold text-[#161616] leading-relaxed">${this.escapeHtml(insight)}</div>
      </div>

      <details class="mt-2">
        <summary class="cursor-pointer text-[9.5px] font-black text-[#08233D] py-1">시간대별 금액·건수 보기</summary>
        <div class="mt-1">${rows}</div>
      </details>`;
  }

  money(value) {
    return `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#096;');
  }
}

window.TimeAnalyticsManager = TimeAnalyticsManager;