class AIInsight {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.modelKey = 'spot-gemini-model-v1';
    this.cacheKey = 'spot-ai-insight-cache-v1';
    this.models = ['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite'];
    this.model = localStorage.getItem(this.modelKey) || 'gemini-3.8-flash';
    if (!this.models.includes(this.model)) this.model = 'gemini-3.8-flash';
    this.lastSignature = '';
    this.refreshTimer = null;
  }

  start() {
    this.enhanceCard();
    this.renderLocalInsight();
    this.requestInsight(false);

    const manager = this.expenseManager;
    if (manager && typeof manager.render === 'function' && !manager.__aiInsightWrapped) {
      const originalRender = manager.render.bind(manager);
      manager.render = (...args) => {
        const result = originalRender(...args);
        clearTimeout(this.refreshTimer);
        this.refreshTimer = setTimeout(() => {
          this.renderLocalInsight();
          this.requestInsight(false);
        }, 250);
        return result;
      };
      manager.__aiInsightWrapped = true;
    }
  }

  enhanceCard() {
    const home = this.root.getElementById('view-home');
    if (!home) return;
    const card = [...home.querySelectorAll('article')].find(a => a.textContent.includes('AI 인사이트'));
    if (!card || card.dataset.aiEnhanced) return;
    card.dataset.aiEnhanced = 'true';
    card.removeAttribute('data-screen');

    const titleRow = [...card.querySelectorAll('div')].find(el => el.textContent.trim() === 'AI 인사이트')?.parentElement;
    if (titleRow) {
      titleRow.classList.add('justify-between');
      titleRow.innerHTML = `
        <div class="flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5 text-[#D17D19]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>AI 인사이트</span>
        </div>
        <div class="flex items-center gap-1.5">
          <select id="spot-ai-model" class="text-[9px] font-black text-[#08233D] bg-white/70 border border-[#E6D4AD] rounded-lg px-1.5 py-1 max-w-[126px]">
            ${this.models.map(m => `<option value="${m}" ${m === this.model ? 'selected' : ''}>${m.replace('gemini-', '')}</option>`).join('')}
          </select>
          <button id="spot-ai-refresh" type="button" class="text-[9px] font-black text-[#9B701C] bg-white/70 border border-[#E6D4AD] rounded-lg px-2 py-1">새로고침</button>
        </div>`;
      titleRow.querySelector('#spot-ai-model').addEventListener('change', e => {
        this.model = e.target.value;
        localStorage.setItem(this.modelKey, this.model);
        this.requestInsight(true);
      });
      titleRow.querySelector('#spot-ai-refresh').addEventListener('click', e => {
        e.stopPropagation();
        this.requestInsight(true);
      });
    }

    const headline = [...card.querySelectorAll('div')].find(el => el.className.includes('text-sm') && el.className.includes('font-black'));
    const detail = card.querySelector('p');
    const reportLink = [...card.querySelectorAll('div')].find(el => el.textContent.includes('분석 리포트 보기'));
    if (headline) headline.id = 'spot-ai-headline';
    if (detail) detail.id = 'spot-ai-detail';
    if (reportLink) {
      reportLink.id = 'spot-ai-tip';
      reportLink.innerHTML = '<span>실제 지출 데이터를 분석 중이에요.</span>';
    }
  }

  getExpenses() {
    return Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [];
  }

  getBudget() {
    return Number(this.expenseManager?.monthlyBudget || 0);
  }

  getSummary() {
    const expenses = this.getExpenses();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const weekStart = new Date(now);
    const day = (now.getDay() + 6) % 7;
    weekStart.setDate(now.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const valid = expenses.map(e => ({ ...e, amount: Number(e.amount || 0), parsedDate: new Date(e.date) }))
      .filter(e => e.amount >= 0 && !Number.isNaN(e.parsedDate.getTime()));

    const sumBetween = (start, end) => valid.filter(e => e.parsedDate >= start && e.parsedDate < end).reduce((s, e) => s + e.amount, 0);
    const currentMonth = valid.filter(e => e.parsedDate >= monthStart && e.parsedDate < nextMonth);
    const monthlyTotal = currentMonth.reduce((s, e) => s + e.amount, 0);
    const previousMonthTotal = sumBetween(prevMonthStart, monthStart);
    const weeklyTotal = sumBetween(weekStart, new Date(now.getTime() + 24 * 60 * 60 * 1000));
    const previousWeekTotal = sumBetween(prevWeekStart, weekStart);

    const categoryTotals = {};
    const merchantStats = {};
    currentMonth.forEach(e => {
      const category = e.category || '기타';
      const merchant = e.placeName || e.merchant || '기타';
      categoryTotals[category] = (categoryTotals[category] || 0) + e.amount;
      if (!merchantStats[merchant]) merchantStats[merchant] = { merchant, amount: 0, count: 0, category };
      merchantStats[merchant].amount += e.amount;
      merchantStats[merchant].count += 1;
    });

    const topCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, amount]) => ({ category, amount }));
    const merchantList = Object.values(merchantStats);
    const topMerchants = merchantList.sort((a, b) => b.amount - a.amount).slice(0, 5);
    const frequentMerchants = [...merchantList].filter(m => m.count >= 2).sort((a, b) => b.count - a.count || b.amount - a.amount).slice(0, 5);
    const highValueExpenses = [...currentMonth].sort((a, b) => b.amount - a.amount).slice(0, 5).map(e => ({
      merchant: e.placeName || e.merchant || '기타',
      category: e.category || '기타',
      amount: e.amount,
      date: e.date
    }));

    const repeatedCategoryGroups = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        count: currentMonth.filter(e => (e.category || '기타') === category).length
      }))
      .filter(x => x.count >= 2)
      .sort((a, b) => b.count - a.count || b.amount - a.amount)
      .slice(0, 5);

    const pctChange = (current, previous) => previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
    const budget = this.getBudget();

    const patternClusters = [];
    if (frequentMerchants[0]) {
      const m = frequentMerchants[0];
      patternClusters.push({ type: 'frequent_merchant', label: m.merchant, count: m.count, amount: m.amount, category: m.category });
    }
    if (repeatedCategoryGroups[0]) {
      const c = repeatedCategoryGroups[0];
      patternClusters.push({ type: 'repeated_category', label: c.category, count: c.count, amount: c.amount });
    }
    if (highValueExpenses[0]) {
      const h = highValueExpenses[0];
      patternClusters.push({ type: 'high_value_expense', label: h.merchant, amount: h.amount, category: h.category, date: h.date });
    }

    return {
      generatedAt: now.toISOString(),
      monthlyTotal,
      previousMonthTotal,
      monthlyChangePercent: pctChange(monthlyTotal, previousMonthTotal),
      weeklyTotal,
      previousWeekTotal,
      weeklyChangePercent: pctChange(weeklyTotal, previousWeekTotal),
      transactionCount: currentMonth.length,
      averageTransaction: currentMonth.length ? Math.round(monthlyTotal / currentMonth.length) : 0,
      monthlyBudget: budget,
      budgetUsedPercent: budget > 0 ? Math.round((monthlyTotal / budget) * 100) : null,
      topCategories,
      topMerchants,
      frequentMerchants,
      repeatedCategoryGroups,
      highValueExpenses,
      patternClusters
    };
  }

  signature(summary) {
    return JSON.stringify({
      monthlyTotal: summary.monthlyTotal,
      previousMonthTotal: summary.previousMonthTotal,
      weeklyTotal: summary.weeklyTotal,
      previousWeekTotal: summary.previousWeekTotal,
      monthlyBudget: summary.monthlyBudget,
      transactionCount: summary.transactionCount,
      topCategories: summary.topCategories,
      frequentMerchants: summary.frequentMerchants,
      repeatedCategoryGroups: summary.repeatedCategoryGroups,
      highValueExpenses: summary.highValueExpenses,
      model: this.model
    });
  }

  renderLocalInsight() {
    const s = this.getSummary();
    let headline = '지출 데이터를 조금 더 모으면 패턴이 보여요.';
    let detail = `이번 달 ${s.transactionCount}건, 총 ${this.money(s.monthlyTotal)}을 기록했어요.`;
    let tip = '지출을 추가할수록 AI 분석이 더 정확해져요.';

    if (s.transactionCount > 0) {
      const frequent = s.frequentMerchants[0];
      const repeatedCategory = s.repeatedCategoryGroups[0];
      const high = s.highValueExpenses[0];
      const top = s.topCategories[0];

      if (frequent) {
        headline = `${frequent.merchant}에서 이번 달 ${frequent.count}번 지출했어요.`;
        detail = `반복 지출 합계 ${this.money(frequent.amount)} · ${frequent.category} 소비 패턴으로 묶였어요.`;
      } else if (repeatedCategory) {
        headline = `${repeatedCategory.category} 지출이 ${repeatedCategory.count}건으로 가장 반복돼요.`;
        detail = `반복 지출 합계 ${this.money(repeatedCategory.amount)} · 같은 유형 소비가 자주 나타나요.`;
      } else if (top && s.monthlyTotal > 0) {
        const share = Math.round((top.amount / s.monthlyTotal) * 100);
        headline = `${top.category}가 이번 달 지출의 ${share}%로 가장 커요.`;
        detail = `${top.category} ${this.money(top.amount)} · 전체 ${this.money(s.monthlyTotal)}`;
      }

      if (high) {
        tip = `가장 큰 단일 지출은 ${high.merchant} ${this.money(high.amount)}이에요.`;
      }
      if (s.monthlyBudget > 0) {
        const budgetTip = `예산의 ${s.budgetUsedPercent}% 사용 · 남은 금액 ${this.money(Math.max(0, s.monthlyBudget - s.monthlyTotal))}`;
        tip = `${tip} ${budgetTip}`;
      }
    }

    this.paint({ headline, detail, tip }, '데이터 기반 패턴 분석');
  }

  async requestInsight(force = false) {
    const summary = this.getSummary();
    const sig = this.signature(summary);
    if (!force && sig === this.lastSignature) return;
    this.lastSignature = sig;
    if (!summary.transactionCount) return;

    const cached = this.readCache(sig);
    if (!force && cached) {
      this.paint(cached.insight, cached.model);
      return;
    }

    this.setStatus('Gemini가 반복 지출과 큰 지출을 함께 분석 중이에요…');
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, summary })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (!data.insight) throw new Error('AI 인사이트가 비어 있습니다.');
      this.writeCache(sig, data);
      this.paint(data.insight, data.model || this.model);
    } catch (error) {
      console.warn('SPOT Gemini insight:', error);
      const suffix = String(error.message || '').includes('GEMINI_API_KEY')
        ? 'API 키 설정 후 Gemini 분석이 활성화돼요.'
        : 'AI 연결이 불안정해 기본 데이터 분석을 표시하고 있어요.';
      this.setStatus(suffix);
    }
  }

  readCache(sig) {
    try {
      const cache = JSON.parse(localStorage.getItem(this.cacheKey) || 'null');
      if (!cache || cache.signature !== sig) return null;
      if (Date.now() - cache.savedAt > 30 * 60 * 1000) return null;
      return cache.payload;
    } catch { return null; }
  }

  writeCache(sig, payload) {
    try { localStorage.setItem(this.cacheKey, JSON.stringify({ signature: sig, savedAt: Date.now(), payload })); }
    catch (_) {}
  }

  paint(insight, modelLabel = '') {
    const headline = this.root.getElementById('spot-ai-headline');
    const detail = this.root.getElementById('spot-ai-detail');
    const tip = this.root.getElementById('spot-ai-tip');
    if (headline) headline.textContent = insight.headline || '소비 패턴을 분석했어요.';
    if (detail) detail.textContent = insight.detail || '';
    if (tip) tip.innerHTML = `<span>${this.escapeHtml(insight.tip || '')}</span><span class="ml-auto text-[9px] opacity-60">${this.escapeHtml(modelLabel)}</span>`;
  }

  setStatus(text) {
    const tip = this.root.getElementById('spot-ai-tip');
    if (tip) tip.innerHTML = `<span>${this.escapeHtml(text)}</span>`;
  }

  money(value) { return `₩${Number(value || 0).toLocaleString('ko-KR')}`; }
  escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c])); }
}

window.AIInsight = AIInsight;