class AnalyticsManager {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.range = 'month';
    this.palette = ['#08233D', '#D4A23B', '#9B701C', '#D17D19', '#64748B', '#94A3B8', '#CBD5E1'];
  }

  start() {
    this.view = this.root.getElementById('view-analytics');
    if (!this.view || this.view.dataset.liveAnalytics) return;
    this.view.dataset.liveAnalytics = 'true';
    this.setupRangeTabs();
    this.setupLiveCard();
    this.bindExpenseUpdates();
    this.render();
  }

  setupRangeTabs() {
    const header = this.view.querySelector('header');
    this.rangeBar = header?.nextElementSibling;
    if (!this.rangeBar) return;
    this.rangeBar.innerHTML = `
      <button data-range="day" class="px-3 py-1 rounded-lg text-slate-600">일간</button>
      <button data-range="week" class="px-3 py-1 rounded-lg text-slate-600">주간</button>
      <button data-range="month" class="px-3 py-1 rounded-lg bg-white text-[#08233D] shadow-sm font-black">월간</button>
      <button data-range="year" class="px-3 py-1 rounded-lg text-slate-600">연간</button>`;
    this.rangeBar.querySelectorAll('[data-range]').forEach(button => {
      button.addEventListener('click', () => {
        this.range = button.dataset.range;
        this.updateRangeButtons();
        this.render();
      });
    });
  }

  setupLiveCard() {
    const blocks = [...this.view.children];
    this.categoryCard = blocks.find(el => el.textContent?.includes('카테고리별 소비'));
    this.reportCard = blocks.find(el => el.textContent?.includes('AI 분석 리포트'));
    if (this.categoryCard) this.categoryCard.id = 'spot-live-analytics-card';
    if (this.reportCard) {
      this.reportCard.id = 'spot-live-analytics-report';
      this.reportCard.removeAttribute('data-screen');
    }
  }

  bindExpenseUpdates() {
    const manager = this.expenseManager;
    if (!manager || typeof manager.render !== 'function') return;
    if (manager.__analyticsWrapped) return;
    const original = manager.render.bind(manager);
    manager.render = (...args) => {
      const result = original(...args);
      this.render();
      return result;
    };
    manager.__analyticsWrapped = true;
  }

  updateRangeButtons() {
    this.rangeBar?.querySelectorAll('[data-range]').forEach(button => {
      const active = button.dataset.range === this.range;
      button.className = active
        ? 'px-3 py-1 rounded-lg bg-white text-[#08233D] shadow-sm font-black'
        : 'px-3 py-1 rounded-lg text-slate-600';
    });
  }

  getExpenses() {
    return (Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [])
      .map(e => ({ ...e, amount: Number(e.amount || 0), parsedDate: new Date(e.date) }))
      .filter(e => e.amount >= 0 && !Number.isNaN(e.parsedDate.getTime()));
  }

  getBounds(offset = 0) {
    const now = new Date();
    let start;
    let end;

    if (this.range === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + 1);
    } else if (this.range === 'week') {
      const mondayOffset = (now.getDay() + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + offset * 7);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else if (this.range === 'year') {
      start = new Date(now.getFullYear() + offset, 0, 1);
      end = new Date(now.getFullYear() + offset + 1, 0, 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    }

    return { start, end };
  }

  summarize(offset = 0) {
    const { start, end } = this.getBounds(offset);
    const expenses = this.getExpenses().filter(e => e.parsedDate >= start && e.parsedDate < end);
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const categories = {};
    expenses.forEach(e => {
      const category = e.category || '기타';
      categories[category] = (categories[category] || 0) + e.amount;
    });
    const sorted = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0
      }));
    return { start, end, expenses, total, categories: sorted };
  }

  rangeLabel() {
    return ({ day: '오늘', week: '이번 주', month: '이번 달', year: '올해' })[this.range];
  }

  previousLabel() {
    return ({ day: '어제', week: '지난주', month: '지난달', year: '지난해' })[this.range];
  }

  render() {
    if (!this.view || !this.categoryCard) return;
    const current = this.summarize(0);
    const previous = this.summarize(-1);
    this.renderCategoryCard(current);
    this.renderReport(current, previous);
  }

  renderCategoryCard(summary) {
    const top = summary.categories[0];
    const topName = top?.category || '데이터 없음';
    const topPercent = top?.percent || 0;

    let cursor = 0;
    const segments = summary.categories.slice(0, 7).map((item, i) => {
      const start = cursor;
      cursor += item.percent;
      return `${this.palette[i % this.palette.length]} ${start}% ${cursor}%`;
    });
    if (cursor < 100) segments.push(`#EEF2F7 ${cursor}% 100%`);
    const gradient = segments.length ? `conic-gradient(${segments.join(',')})` : '#EEF2F7';

    const rows = summary.categories.length
      ? summary.categories.slice(0, 6).map((item, i) => `
          <div class="flex justify-between items-center">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${this.palette[i % this.palette.length]}"></span>
              <span class="font-bold text-[#161616] truncate">${this.escapeHtml(item.category)} ${item.percent}%</span>
            </div>
            <span class="font-black text-[#161616] whitespace-nowrap">${this.money(item.amount)}</span>
          </div>`).join('')
      : '<div class="text-center text-[11px] text-slate-400 py-3">이 기간에 등록된 지출이 없어요.</div>';

    this.categoryCard.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="text-xs font-bold text-[#77736C]">카테고리별 소비</div>
        <div class="text-[10px] font-black text-[#9B701C] bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">${this.rangeLabel()} ${summary.expenses.length}건</div>
      </div>

      <div class="grid grid-cols-[132px_1fr] gap-3 items-center mt-1">
        <div class="relative w-32 h-32 mx-auto rounded-full" style="background:${gradient}">
          <div class="absolute inset-[19px] rounded-full bg-white flex flex-col items-center justify-center text-center px-2">
            <span class="text-[10px] font-bold text-[#77736C] truncate max-w-[78px]">${this.escapeHtml(topName)}</span>
            <span class="text-lg font-black text-[#08233D]">${topPercent}%</span>
          </div>
        </div>
        <div>
          <div class="text-[10px] font-bold text-[#77736C]">${this.rangeLabel()} 총 지출</div>
          <div class="text-xl font-black text-[#08233D] mt-0.5">${this.money(summary.total)}</div>
          <div class="text-[10px] text-[#77736C] mt-1">${summary.expenses.length}건 · 평균 ${this.money(summary.expenses.length ? Math.round(summary.total / summary.expenses.length) : 0)}</div>
        </div>
      </div>

      <div class="mt-4 space-y-2 text-xs">${rows}</div>`;
  }

  renderReport(current, previous) {
    if (!this.reportCard) return;
    const top = current.categories[0];
    let headline = `${this.rangeLabel()} 지출 데이터가 아직 없어요.`;
    let detail = '지출을 추가하면 이곳에서 바로 소비 패턴을 확인할 수 있어요.';

    if (current.total > 0) {
      if (previous.total > 0) {
        const change = Math.round(((current.total - previous.total) / previous.total) * 100);
        const abs = Math.abs(change);
        if (change > 0) {
          headline = `${this.rangeLabel()} 지출이 ${this.previousLabel()}보다 ${abs}% 늘었어요.`;
          detail = `${this.money(previous.total)} → ${this.money(current.total)} · 가장 큰 항목은 ${top?.category || '기타'}예요.`;
        } else if (change < 0) {
          headline = `${this.rangeLabel()} 지출이 ${this.previousLabel()}보다 ${abs}% 줄었어요.`;
          detail = `${this.money(previous.total)} → ${this.money(current.total)} · 가장 큰 항목은 ${top?.category || '기타'}예요.`;
        } else {
          headline = `${this.rangeLabel()} 지출이 ${this.previousLabel()}과 같아요.`;
          detail = `총 ${this.money(current.total)} · ${top?.category || '기타'} 비중이 ${top?.percent || 0}%로 가장 커요.`;
        }
      } else {
        headline = `${this.rangeLabel()} 총 ${this.money(current.total)}을 사용했어요.`;
        detail = `${current.expenses.length}건 중 ${top?.category || '기타'}가 ${top?.percent || 0}%로 가장 큰 비중이에요.`;
      }
    }

    this.reportCard.innerHTML = `
      <div class="text-[11px] font-black text-[#9B701C] mb-0.5">실시간 소비 분석</div>
      <div class="text-xs font-black text-[#161616]">${this.escapeHtml(headline)}</div>
      <p class="text-[10.5px] text-[#77736C] mt-1 leading-relaxed">${this.escapeHtml(detail)}</p>
      <div class="mt-2 flex items-center justify-between text-[10px] font-bold text-[#08233D]">
        <span>${this.rangeLabel()} 데이터 기준</span>
        <span class="text-[#D17D19]">입력 즉시 갱신</span>
      </div>`;
  }

  money(value) {
    return `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }
}

window.AnalyticsManager = AnalyticsManager;
