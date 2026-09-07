class ExpenseManager {
  constructor(root = document, app = window.spotApp) {
    this.root = root;
    this.app = app;
    this.storageKey = 'spot-expenses-v1';
    this.expenses = this.load();
    this.editingId = null;
    this.pendingOcr = null;
  }

  start() {
    this.ensureStyles();
    this.seedIfEmpty();
    this.enhanceScanView();
    this.enhanceHomeView();
    this.enhanceDetailView();
    this.render();
  }

  load() {
    try { return JSON.parse(localStorage.getItem(this.storageKey) || '[]'); }
    catch (_) { return []; }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.expenses));
    this.render();
  }

  seedIfEmpty() {
    if (this.expenses.length) return;
    this.expenses = [
      { id: crypto.randomUUID(), merchant: '스타벅스 강남점', amount: 11500, category: '카페', date: '2026-09-03T14:32', memo: '', source: 'demo' },
      { id: crypto.randomUUID(), merchant: '배달의민족 B마트', amount: 23800, category: '마트', date: '2026-09-03T12:21', memo: '', source: 'demo' },
      { id: crypto.randomUUID(), merchant: '올리브영 강남점', amount: 32000, category: '쇼핑', date: '2026-09-02T18:44', memo: '', source: 'demo' }
    ];
    localStorage.setItem(this.storageKey, JSON.stringify(this.expenses));
  }

  ensureStyles() {
    if (document.getElementById('expense-manager-styles')) return;
    const style = document.createElement('style');
    style.id = 'expense-manager-styles';
    style.textContent = `
      .spot-modal-backdrop{position:fixed;inset:0;background:rgba(2,10,20,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}
      .spot-modal{width:min(380px,100%);background:#fff;border-radius:20px;padding:18px;box-shadow:0 24px 80px rgba(0,0,0,.28)}
      .spot-field{width:100%;border:1px solid #E5E7EB;border-radius:12px;padding:10px 12px;font-size:13px;outline:none;background:#fff}
      .spot-field:focus{border-color:#D4A23B;box-shadow:0 0 0 3px rgba(212,162,59,.12)}
      .spot-label{display:block;font-size:11px;font-weight:800;color:#475569;margin-bottom:5px}
      .spot-btn-primary{background:#08233D;color:#fff;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:900}
      .spot-btn-secondary{background:#F1F5F9;color:#334155;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:800}
      .spot-btn-danger{background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:900}
      .spot-ocr-status{font-size:11px;font-weight:800;color:#FBBF24;text-align:center;min-height:18px;margin-top:8px}
      .spot-expense-row{display:flex;justify-content:space-between;align-items:center;padding:9px 8px;border-radius:12px;background:rgba(255,255,255,.82);border:1px solid rgba(234,229,219,.85);cursor:pointer}
      .spot-expense-actions{display:flex;gap:5px;margin-left:8px}
      .spot-icon-btn{font-size:10px;font-weight:800;padding:5px 7px;border-radius:8px;background:#F8FAFC;border:1px solid #E2E8F0;color:#475569}
    `;
    document.head.appendChild(style);
  }

  enhanceHomeView() {
    const home = this.root.getElementById('view-home');
    if (!home || home.dataset.expenseEnhanced) return;
    home.dataset.expenseEnhanced = 'true';

    const recentTitle = [...home.querySelectorAll('h2')].find(el => el.textContent.includes('최근 소비'));
    if (recentTitle) {
      const header = recentTitle.parentElement;
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.textContent = '+ 지출 추가';
      addBtn.className = 'text-[11px] font-black text-[#D17D19] ml-auto mr-2';
      addBtn.addEventListener('click', () => this.openExpenseModal());
      header.insertBefore(addBtn, header.lastElementChild);

      const list = header.nextElementSibling;
      if (list) {
        list.id = 'spot-expense-list';
        list.innerHTML = '';
      }
    }
  }

  enhanceScanView() {
    const scan = this.root.getElementById('view-scan');
    if (!scan || scan.dataset.ocrEnhanced) return;
    scan.dataset.ocrEnhanced = 'true';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment';
    fileInput.hidden = true;
    fileInput.id = 'spot-receipt-file';
    scan.appendChild(fileInput);

    const status = document.createElement('div');
    status.className = 'spot-ocr-status';
    status.id = 'spot-ocr-status';
    status.textContent = '카메라 버튼을 눌러 영수증을 촬영하거나 선택하세요.';
    const controls = scan.querySelector('.flex.justify-around.items-center');
    if (controls) controls.insertAdjacentElement('beforebegin', status);

    const buttons = controls ? [...controls.querySelectorAll('button')] : [];
    const gallery = buttons[0];
    const shutter = buttons[1];
    if (gallery) gallery.addEventListener('click', () => fileInput.click());
    if (shutter) {
      shutter.removeAttribute('data-screen');
      shutter.addEventListener('click', () => fileInput.click());
    }
    fileInput.addEventListener('change', e => this.runOcr(e.target.files?.[0]));
  }

  enhanceDetailView() {
    const detail = this.root.getElementById('view-receipt-detail');
    if (!detail || detail.dataset.expenseEnhanced) return;
    detail.dataset.expenseEnhanced = 'true';
    const bottomButton = detail.querySelector('button.w-full');
    if (!bottomButton) return;
    const wrap = document.createElement('div');
    wrap.className = 'grid grid-cols-2 gap-2 mt-3';
    wrap.innerHTML = '<button id="spot-detail-edit" class="spot-btn-secondary">수정</button><button id="spot-detail-delete" class="spot-btn-danger">삭제</button>';
    bottomButton.insertAdjacentElement('beforebegin', wrap);
    wrap.querySelector('#spot-detail-edit').addEventListener('click', () => {
      if (this.editingId) this.openExpenseModal(this.editingId);
    });
    wrap.querySelector('#spot-detail-delete').addEventListener('click', () => {
      if (this.editingId) this.deleteExpense(this.editingId);
    });
  }

  async loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.Tesseract;
  }

  async runOcr(file) {
    if (!file) return;
    const status = this.root.getElementById('spot-ocr-status');
    try {
      if (status) status.textContent = 'OCR 엔진을 불러오는 중...';
      const Tesseract = await this.loadTesseract();
      if (status) status.textContent = '영수증 글자를 인식하고 있어요...';
      const result = await Tesseract.recognize(file, 'kor+eng', {
        logger: m => {
          if (!status || typeof m.progress !== 'number') return;
          status.textContent = `영수증 인식 중 ${Math.round(m.progress * 100)}%`;
        }
      });
      const parsed = this.parseReceipt(result.data.text || '');
      this.pendingOcr = parsed;
      if (status) status.textContent = '인식 완료! 결과를 확인해 주세요.';
      this.showOcrResult(parsed);
      this.app?.router?.navigate('view-result');
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'OCR에 실패했어요. 다른 사진을 선택하거나 직접 입력해 주세요.';
      this.openExpenseModal();
    }
  }

  parseReceipt(text) {
    const lines = text.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    const moneyMatches = [...text.matchAll(/(?:₩|￦)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})\s*(?:원)?/g)]
      .map(m => Number(m[1].replace(/,/g, '')))
      .filter(n => n >= 100 && n <= 10000000);
    const amount = moneyMatches.length ? Math.max(...moneyMatches) : 0;
    const dateMatch = text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?:일)?(?:\s+(\d{1,2})[:시](\d{2}))?/);
    const pad = n => String(n).padStart(2, '0');
    const date = dateMatch
      ? `${dateMatch[1]}-${pad(dateMatch[2])}-${pad(dateMatch[3])}T${pad(dateMatch[4] || 12)}:${pad(dateMatch[5] || 0)}`
      : new Date().toISOString().slice(0, 16);
    const ignored = /(사업자|대표자|주소|전화|tel|합계|총액|결제|카드|승인|부가세|vat|영수증|receipt)/i;
    const merchant = lines.find(l => l.length >= 2 && l.length <= 30 && !ignored.test(l) && !/^[-\d\s.,:]+$/.test(l)) || '인식된 가맹점';
    const lower = `${merchant} ${text}`.toLowerCase();
    let category = '기타';
    if (/카페|커피|coffee|starbucks|메가커피|투썸/.test(lower)) category = '카페';
    else if (/마트|market|편의점|cu|gs25|세븐일레븐/.test(lower)) category = '마트';
    else if (/배달|식당|restaurant|burger|치킨|피자/.test(lower)) category = '식비';
    else if (/올리브영|쇼핑|shop|store/.test(lower)) category = '쇼핑';
    return { merchant, amount, category, date, memo: text.slice(0, 1200), source: 'ocr' };
  }

  showOcrResult(expense) {
    const view = this.root.getElementById('view-result');
    if (!view) return;
    const card = view.querySelector('.bg-white.rounded-2xl');
    if (card) {
      const blocks = card.querySelectorAll('div');
      const merchant = blocks[0];
      if (merchant) merchant.textContent = expense.merchant;
      const amountEl = [...card.querySelectorAll('div')].find(el => el.className.includes('text-2xl'));
      if (amountEl) amountEl.textContent = this.formatMoney(expense.amount);
    }
    const save = [...view.querySelectorAll('button')].find(b => b.textContent.includes('저장하기'));
    if (save && !save.dataset.bound) {
      save.dataset.bound = 'true';
      save.removeAttribute('data-screen');
      save.addEventListener('click', () => {
        if (!this.pendingOcr) return;
        this.addExpense(this.pendingOcr);
        this.pendingOcr = null;
        this.app?.router?.navigate('view-home');
      });
    }
    const edit = [...view.querySelectorAll('button')].find(b => b.textContent.includes('수정하기'));
    if (edit && !edit.dataset.bound) {
      edit.dataset.bound = 'true';
      edit.addEventListener('click', () => this.openExpenseModal(null, this.pendingOcr));
    }
  }

  addExpense(data) {
    this.expenses.unshift({ ...data, id: crypto.randomUUID(), amount: Number(data.amount) || 0 });
    this.save();
  }

  updateExpense(id, data) {
    const i = this.expenses.findIndex(e => e.id === id);
    if (i < 0) return;
    this.expenses[i] = { ...this.expenses[i], ...data, amount: Number(data.amount) || 0 };
    this.save();
  }

  deleteExpense(id) {
    const expense = this.expenses.find(e => e.id === id);
    if (!expense) return;
    if (!confirm(`'${expense.merchant}' 지출을 삭제할까요?`)) return;
    this.expenses = this.expenses.filter(e => e.id !== id);
    this.editingId = null;
    this.save();
    this.app?.router?.navigate('view-home');
  }

  openExpenseModal(id = null, initial = null) {
    const existing = id ? this.expenses.find(e => e.id === id) : null;
    const data = existing || initial || { merchant: '', amount: '', category: '식비', date: new Date().toISOString().slice(0,16), memo: '', source: 'manual' };
    const backdrop = document.createElement('div');
    backdrop.className = 'spot-modal-backdrop';
    backdrop.innerHTML = `
      <form class="spot-modal" id="spot-expense-form">
        <div class="flex items-center justify-between mb-4"><h3 class="text-base font-black text-[#08233D]">${existing ? '지출 수정' : '지출 추가'}</h3><button type="button" data-close class="text-slate-400 text-xl">×</button></div>
        <div class="space-y-3">
          <label><span class="spot-label">상호명</span><input name="merchant" class="spot-field" required value="${this.escapeAttr(data.merchant || '')}"></label>
          <label><span class="spot-label">금액</span><input name="amount" type="number" min="0" class="spot-field" required value="${Number(data.amount) || ''}"></label>
          <label><span class="spot-label">카테고리</span><select name="category" class="spot-field">${['식비','카페','마트','쇼핑','교통','생활','기타'].map(c => `<option ${c === data.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
          <label><span class="spot-label">날짜·시간</span><input name="date" type="datetime-local" class="spot-field" value="${this.escapeAttr((data.date || '').slice(0,16))}"></label>
          <label><span class="spot-label">메모</span><textarea name="memo" rows="3" class="spot-field">${this.escapeHtml(data.memo || '')}</textarea></label>
        </div>
        <div class="grid ${existing ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-4">
          <button type="button" data-close class="spot-btn-secondary">취소</button>
          ${existing ? '<button type="button" data-delete class="spot-btn-danger">삭제</button>' : ''}
          <button class="spot-btn-primary">${existing ? '수정 저장' : '추가하기'}</button>
        </div>
      </form>`;
    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    backdrop.querySelector('[data-delete]')?.addEventListener('click', () => { close(); this.deleteExpense(existing.id); });
    backdrop.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      payload.amount = Number(payload.amount);
      payload.source = existing?.source || data.source || 'manual';
      if (existing) this.updateExpense(existing.id, payload); else this.addExpense(payload);
      close();
      this.app?.router?.navigate('view-home');
    });
  }

  render() {
    this.renderHomeList();
    this.renderMonthlyTotal();
  }

  renderHomeList() {
    const list = this.root.getElementById('spot-expense-list');
    if (!list) return;
    list.innerHTML = '';
    const recent = this.expenses.slice(0, 4);
    if (!recent.length) {
      list.innerHTML = '<div class="text-center text-[11px] text-slate-400 py-4">아직 등록된 지출이 없어요.</div>';
      return;
    }
    recent.forEach(expense => {
      const row = document.createElement('div');
      row.className = 'spot-expense-row';
      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 shrink-0 rounded-full bg-white border border-[#EAE5DB] flex items-center justify-center font-bold text-[9px] text-[#08233D]">${this.escapeHtml(expense.category)}</div>
          <div class="min-w-0"><div class="text-xs font-bold text-[#161616] truncate">${this.escapeHtml(expense.merchant)}</div><div class="text-[10px] text-[#77736C]">${this.formatDate(expense.date)}</div></div>
        </div>
        <div class="flex items-center"><div class="text-xs font-black text-[#161616] whitespace-nowrap">${this.formatMoney(expense.amount)}</div><div class="spot-expense-actions"><button class="spot-icon-btn" data-edit>수정</button><button class="spot-icon-btn" data-delete>삭제</button></div></div>`;
      row.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        this.openDetail(expense.id);
      });
      row.querySelector('[data-edit]').addEventListener('click', () => this.openExpenseModal(expense.id));
      row.querySelector('[data-delete]').addEventListener('click', () => this.deleteExpense(expense.id));
      list.appendChild(row);
    });
  }

  renderMonthlyTotal() {
    const home = this.root.getElementById('view-home');
    if (!home) return;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const total = this.expenses.filter(e => String(e.date || '').startsWith(ym)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalEl = [...home.querySelectorAll('div')].find(el => el.className.includes('text-2xl') && el.className.includes('font-black'));
    if (totalEl) totalEl.textContent = this.formatMoney(total);
  }

  openDetail(id) {
    const expense = this.expenses.find(e => e.id === id);
    if (!expense) return;
    this.editingId = id;
    const view = this.root.getElementById('view-receipt-detail');
    if (view) {
      const card = view.querySelector('.bg-white.rounded-2xl');
      if (card) {
        const title = card.querySelector('.text-base.font-black');
        if (title) title.textContent = expense.merchant;
        const amount = card.querySelector('.text-xl.font-black');
        if (amount) amount.textContent = this.formatMoney(expense.amount);
        const rows = card.querySelectorAll('.border-t.border-slate-100 .flex.justify-between');
        if (rows[1]?.lastElementChild) rows[1].lastElementChild.textContent = expense.category;
      }
    }
    this.app?.router?.navigate('view-receipt-detail');
  }

  formatMoney(value) { return `₩${Number(value || 0).toLocaleString('ko-KR')}`; }
  formatDate(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value || '';
    return `${d.getMonth()+1}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  escapeHtml(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  escapeAttr(v) { return this.escapeHtml(v).replace(/`/g, '&#096;'); }
}

window.ExpenseManager = ExpenseManager;
