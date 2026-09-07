class AnalyticsManager {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.range = 'month';
    this.selectedCategory = null;
    this.palette = ['#08233D', '#D4A23B', '#9B701C', '#D17D19', '#64748B', '#94A3B8', '#CBD5E1'];
    this.categoryDescriptions = {
      '식비': '식당, 배달, 간식처럼 식사와 직접 관련된 소비예요.',
      '카페': '커피, 음료, 디저트 등 카페에서 발생한 소비예요.',
      '마트': '마트, 편의점, 식료품 및 생활용품 구매에 사용된 소비예요.',
      '쇼핑': '의류, 화장품, 잡화 등 상품 구매에 사용된 소비예요.',
      '교통': '대중교통, 택시, 이동 서비스 등에 사용된 소비예요.',
      '생활': '일상생활 유지에 필요한 서비스나 생활비 소비예요.',
      '기타': '기존 분류에 포함되지 않은 소비예요.'
    };
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
        this.selectedCategory = null;
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

    this.comparisonCard = document.createElement('div');
    this.comparisonCard.id = 'spot-period-comparison';
    this.comparisonCard.className = 'bg-white rounded-2xl p-4 border border-[#EAE5DB] shadow-sm mb-3';
    this.categoryCard?.insertAdjacentElement('beforebegin', this.comparisonCard);

    this.detailCard = document.createElement('div');
    this.detailCard.id = 'spot-category-detail';
    this.detailCard.className = 'bg-white rounded-2xl p-4 border border-[#EAE5DB] shadow-sm mb-3 hidden';
    this.categoryCard?.insertAdjacentElement('afterend', this.detailCard);
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

  getBounds(offset = 0, range = this.range) {
    const now = new Date();
    let start;
    let end;

    if (range === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset + 1);
    } else if (range === 'week') {
      const mondayOffset = (now.getDay() + 6) % 7;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset + offset * 7);
      end = new Date(start);
      end.setDate(start.getDate() + 7);
    } else if (range === 'year') {
      start = new Date(now.getFullYear() + offset, 0, 1);
      end = new Date(now.getFullYear() + offset + 1, 0, 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    }

    return { start, end };
  }

  summarize(offset = 0, range = this.range) {
    const { start, end } = this.getBounds(offset, range);
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
    this.renderComparison();
    this.renderCategoryCard(current);
    this.renderCategoryDetail(current);
    this.renderReport(current, previous);
  }

  renderComparison() {
    if (!this.comparisonCard) return;
    const week = this.summarize(0, 'week');
    const prevWeek = this.summarize(-1, 'week');
    const month = this.summarize(0, 'month');
    const prevMonth = this.summarize(-1, 'month');

    const weekChange = this.changePercent(week.total, prevWeek.total);
    const monthChange = this.changePercent(month.total, prevMonth.total);

    const stat = (label, current, previous, change) => `
      <div class="rounded-xl border border-[#EAE5DB] bg-[#FFFCF7] p-3">
        <div class="text-[10px] font-bold text-[#77736C]">${label}</div>
        <div class="text-base font-black text-[#08233D] mt-1">${this.money(current)}</div>
        <div class="text-[10px] mt-1 ${change > 0 ? 'text-[#D17D19]' : change < 0 ? 'text-emerald-700' : 'text-[#77736C]'} font-bold">
          ${previous > 0 ? `${change > 0 ? '+' : ''}${change}%` : '비교 데이터 없음'}
        </div>
      </div>`;

    this.comparisonCard.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-xs font-black text-[#08233D]">주간·월간 소비 비교</div>
          <div class="text-[10px] text-[#77736C] mt-0.5">이전 기간 대비 실제 입력 데이터를 비교해요.</div>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        ${stat('이번 주', week.total, prevWeek.total, weekChange)}
        ${stat('이번 달', month.total, prevMonth.total, monthChange)}
      </div>
      <div class="grid grid-cols-2 gap-2 mt-2 text-[10px] text-[#77736C]">
        <div>지난주 ${this.money(prevWeek.total)}</div>
        <div>지난달 ${this.money(prevMonth.total)}</div>
      </div>`;
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
      ? summary.categories.slice(0, 8).map((item, i) => `
          <button type="button" data-category="${this.escapeAttr(item.category)}" class="w-full flex justify-between items-center text-left p-2 rounded-xl hover:bg-[#FFFAF2] border border-transparent hover:border-[#EAE5DB] transition">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${this.palette[i % this.palette.length]}"></span>
              <span class="font-bold text-[#161616] truncate">${this.escapeHtml(item.category)} ${item.percent}%</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-black text-[#161616] whitespace-nowrap">${this.money(item.amount)}</span>
              <span class="text-[#9B701C] font-black">›</span>
            </div>
          </button>`).join('')
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

      <div class="mt-4 space-y-1 text-xs">${rows}</div>
      ${summary.categories.length ? '<div class="text-[9px] text-[#9B701C] font-bold mt-2 text-center">카테고리를 누르면 상세 분석을 볼 수 있어요.</div>' : ''}`;

    this.categoryCard.querySelectorAll('[data-category]').forEach(button => {
      button.addEventListener('click', () => {
        this.selectedCategory = button.dataset.category;
        this.renderCategoryDetail(summary);
        this.detailCard?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  renderCategoryDetail(summary) {
    if (!this.detailCard) return;
    if (!this.selectedCategory) {
      this.detailCard.classList.add('hidden');
      this.detailCard.innerHTML = '';
      return;
    }

    const items = summary.expenses
      .filter(e => (e.category || '기타') === this.selectedCategory)
      .sort((a, b) => b.parsedDate - a.parsedDate);

    if (!items.length) {
      this.detailCard.classList.add('hidden');
      return;
    }

    const total = items.reduce((sum, e) => sum + e.amount, 0);
    const average = Math.round(total / items.length);
    const largest = [...items].sort((a, b) => b.amount - a.amount)[0];
    const share = summary.total > 0 ? Math.round((total / summary.total) * 100) : 0;
    const description = this.categoryDescriptions[this.selectedCategory] || `${this.selectedCategory}로 분류된 소비 항목이에요.`;

    const itemRows = items.slice(0, 20).map(item => `
      <div class="flex justify-between items-start gap-3 py-2 border-b border-slate-100 last:border-0">
        <div class="min-w-0">
          <div class="text-[11px] font-black text-[#161616] truncate">${this.escapeHtml(item.merchant || '지출')}</div>
          <div class="text-[9px] text-[#77736C] mt-0.5">${this.formatDate(item.parsedDate)}${item.source === 'ocr' ? ' · 영수증 OCR' : ''}</div>
          ${item.memo ? `<div class="text-[9px] text-slate-400 mt-1 line-clamp-2">${this.escapeHtml(this.cleanMemo(item.memo))}</div>` : ''}
        </div>
        <div class="text-[11px] font-black text-[#08233D] whitespace-nowrap">${this.money(item.amount)}</div>
      </div>`).join('');

    let analysis = `${this.selectedCategory} 지출은 ${this.rangeLabel()} 전체의 ${share}%를 차지해요.`;
    if (largest) {
      analysis += ` 가장 큰 단일 지출은 ${this.escapeHtml(largest.merchant || '지출')}의 ${this.money(largest.amount)}이에요.`;
    }

    this.detailCard.classList.remove('hidden');
    this.detailCard.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <div class="text-sm font-black text-[#08233D]">${this.escapeHtml(this.selectedCategory)} 상세 분석</div>
          <div class="text-[10px] text-[#77736C] mt-1 leading-relaxed">${this.escapeHtml(description)}</div>
        </div>
        <button type="button" id="spot-category-close" class="text-slate-400 text-lg leading-none px-1">×</button>
      </div>

      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="bg-[#FFFAF2] border border-[#EAE5DB] rounded-xl p-2 text-center">
          <div class="text-[9px] text-[#77736C]">총 지출</div>
          <div class="text-[11px] font-black text-[#08233D] mt-1">${this.money(total)}</div>
        </div>
        <div class="bg-[#FFFAF2] border border-[#EAE5DB] rounded-xl p-2 text-center">
          <div class="text-[9px] text-[#77736C]">건수</div>
          <div class="text-[11px] font-black text-[#08233D] mt-1">${items.length}건</div>
        </div>
        <div class="bg-[#FFFAF2] border border-[#EAE5DB] rounded-xl p-2 text-center">
          <div class="text-[9px] text-[#77736C]">평균</div>
          <div class="text-[11px] font-black text-[#08233D] mt-1">${this.money(average)}</div>
        </div>
      </div>

      <div class="bg-[#F8EDDA] border border-[#E7D1A0] rounded-xl p-3 mb-3">
        <div class="text-[10px] font-black text-[#9B701C]">카테고리 분석</div>
        <div class="text-[10.5px] text-[#161616] font-bold leading-relaxed mt-1">${analysis}</div>
      </div>

      <div class="flex items-center justify-between mb-1">
        <div class="text-[11px] font-black text-[#161616]">구매·지출 목록</div>
        <div class="text-[9px] text-[#77736C]">최대 20건 표시</div>
      </div>
      <div>${itemRows}</div>`;

    this.detailCard.querySelector('#spot-category-close')?.addEventListener('click', () => {
      this.selectedCategory = null;
      this.renderCategoryDetail(summary);
    });
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

  changePercent(current, previous) {
    if (previous <= 0) return 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  cleanMemo(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? `${text.slice(0, 90)}…` : text;
  }

  formatDate(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  money(value) {
    return `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#096;');
  }
}

window.AnalyticsManager = AnalyticsManager;
