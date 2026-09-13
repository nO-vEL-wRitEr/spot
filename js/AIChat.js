class AIChat {
  constructor(root = document, expenseManager = window.spotExpenseManager, aiInsight = window.spotAIInsight) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.aiInsight = aiInsight;
    this.messages = [];
    this.sending = false;
    this.detailedButton = null;
  }

  start() {
    const view = this.root.getElementById('view-ai');
    if (!view || view.dataset.chatEnhanced) return;
    view.dataset.chatEnhanced = 'true';

    this.view = view;
    this.input = view.querySelector('input[placeholder="무엇이든 물어보세요"]') || view.querySelector('input[type="text"]');
    this.sendButton = this.input?.parentElement?.querySelector('button');
    this.log = view.querySelector('header')?.parentElement;
    this.inputArea = this.input?.parentElement?.parentElement;

    if (!this.input || !this.sendButton || !this.log || !this.inputArea) {
      console.error('SPOT AI Chat: 채팅 UI 요소를 찾지 못했습니다.');
      return;
    }

    this.prepareLayout();
    this.prepareLog();
    this.prepareDetailedButton();
    this.sendButton.type = 'button';
    this.sendButton.setAttribute('aria-label', '메시지 보내기');
    this.sendButton.addEventListener('click', () => this.send());
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });

    this.addAssistant('안녕하세요! 실제로 등록된 지출 데이터를 바탕으로 소비 패턴을 함께 살펴볼게요. 무엇이 궁금한가요?');
  }

  prepareLayout() {
    this.view.style.overflow = 'hidden';
    this.view.style.minHeight = '0';
    this.view.style.flexDirection = 'column';

    this.log.style.flex = '1 1 0%';
    this.log.style.minHeight = '0';
    this.log.style.overflowY = 'auto';
    this.log.style.overscrollBehavior = 'contain';
    this.log.style.scrollBehavior = 'smooth';
    this.log.style.paddingRight = '2px';
    this.log.style.paddingBottom = '18px';

    this.inputArea.style.flex = '0 0 auto';
    this.inputArea.style.position = 'relative';
    this.inputArea.style.zIndex = '5';
    this.inputArea.style.paddingTop = '10px';
    this.inputArea.style.paddingBottom = '2px';
    this.inputArea.style.background = '#08233D';
  }

  prepareLog() {
    const header = this.log.querySelector('header');
    [...this.log.children].forEach(child => {
      if (child !== header) child.remove();
    });
    this.log.id = 'spot-ai-chat-log';
  }

  prepareDetailedButton() {
    const existing = this.inputArea.querySelector('#spot-ai-detailed-analysis');
    if (existing) {
      this.detailedButton = existing;
      return;
    }

    const button = document.createElement('button');
    button.id = 'spot-ai-detailed-analysis';
    button.type = 'button';
    button.className = 'w-full mt-2.5 py-2.5 rounded-xl bg-amber-400 text-[#08233D] text-[11.5px] font-black shadow-sm hover:bg-amber-300 active:scale-[0.99] transition';
    button.textContent = '상세 분석';
    button.setAttribute('aria-label', '현재 지출 상세 분석');
    button.addEventListener('click', () => this.runDetailedAnalysis());
    this.inputArea.appendChild(button);
    this.detailedButton = button;
  }

  async send() {
    const text = String(this.input.value || '').trim();
    if (!text || this.sending) return;

    this.input.value = '';
    this.messages.push({ role: 'user', text });
    this.addUser(text);
    this.setSending(true);
    const thinking = this.addAssistant('지출 데이터를 확인하고 있어요…', true);

    try {
      const reply = await this.requestAI(this.messages.slice(-10));
      thinking?.remove();
      this.messages.push({ role: 'assistant', text: reply });
      this.addAssistant(reply);
    } catch (error) {
      console.warn('SPOT AI Chat:', error);
      thinking?.remove();
      this.addAssistant(this.errorMessage(error));
    } finally {
      this.setSending(false);
      this.input.focus();
    }
  }

  async runDetailedAnalysis() {
    if (this.sending) return;

    const prompt = `현재 등록된 지출 데이터만 근거로 상세 분석을 해주세요.\n반드시 아래 네 개 섹션을 모두 작성하고, 각 섹션 제목을 정확히 그대로 사용해 주세요.\n\n(현재 상황)\n현재 지출 규모, 예산 사용률, 식비 비중, 반복 지출 또는 자주 가는 지점을 실제 데이터로 요약하세요.\n\n(문제점과 해결책)\n확인 가능한 문제를 최대 2개만 짚고, 각 문제마다 바로 실행할 수 있는 해결책을 붙이세요.\n\n(간단한 what-if 시나리오)\n실제 데이터로 계산 가능한 한 가지 시나리오와 예상 절약액을 제시하세요. 계산 근거가 부족하면 숫자를 만들지 말고 데이터가 부족하다고 명시하세요.\n\n(실천방법)\n이번 주 바로 실행할 수 있는 행동을 최대 3개로 정리하세요.\n\n각 섹션은 2~4문장 정도로 간결하게 쓰고, 문장이 중간에서 끊기지 않게 완결해서 작성하세요.`;

    this.setSending(true);
    const thinking = this.addAssistant('분석을 시작하겠습니다!\n\n등록된 지출 데이터를 정리하고 있어요…', true);

    try {
      const requestMessages = [...this.messages.slice(-8), { role: 'user', text: prompt }];
      const reply = await this.requestAI(requestMessages);
      thinking?.remove();
      this.messages.push({ role: 'user', text: prompt });
      this.messages.push({ role: 'assistant', text: reply });
      this.addDetailedAnalysis(reply);
    } catch (error) {
      console.warn('SPOT AI detailed analysis:', error);
      thinking?.remove();
      this.addAssistant(this.errorMessage(error));
    } finally {
      this.setSending(false);
    }
  }

  async requestAI(messages) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.getModel(),
        summary: this.getSummary(),
        messages
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

    const reply = String(data.reply || '').trim();
    if (!reply) throw new Error('AI 응답이 비어 있습니다.');
    return reply;
  }

  addDetailedAnalysis(text) {
    const sections = ['현재 상황', '문제점과 해결책', '간단한 what-if 시나리오', '실천방법'];
    const normalized = String(text || '').replace(/^분석을 시작하겠습니다!\s*/i, '').trim();
    const parsed = [];

    for (let i = 0; i < sections.length; i += 1) {
      const title = sections[i];
      const startToken = `(${title})`;
      const start = normalized.indexOf(startToken);
      if (start < 0) continue;
      const contentStart = start + startToken.length;
      const nextStarts = sections.slice(i + 1)
        .map(next => normalized.indexOf(`(${next})`, contentStart))
        .filter(index => index >= 0);
      const end = nextStarts.length ? Math.min(...nextStarts) : normalized.length;
      const body = normalized.slice(contentStart, end).trim();
      parsed.push({ title, body });
    }

    if (!parsed.length) {
      this.addAssistant(text);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'flex items-start gap-2 mt-3';
    const cards = parsed.map(section => `
      <div class="rounded-xl border border-[#E9D59F] bg-[#FFFCF5] px-3 py-2.5">
        <div class="text-[11px] font-black text-[#9B701C] mb-1">(${this.escapeHtml(section.title)})</div>
        <div class="text-[11.5px] text-slate-800 whitespace-pre-wrap break-words leading-[1.75]">${this.formatReply(section.body)}</div>
      </div>`).join('');

    wrap.innerHTML = `
      <div class="w-6 h-6 rounded-full bg-amber-400 text-[#08233D] font-black flex items-center justify-center shrink-0 text-[9px]">AI</div>
      <div class="max-w-[90%] w-full">
        <div class="bg-white text-[#08233D] px-3.5 py-2.5 rounded-2xl rounded-tl-none shadow text-[11.5px] font-black mb-2">분석을 시작하겠습니다!</div>
        <div class="space-y-2">${cards}</div>
      </div>`;

    this.log.appendChild(wrap);
    this.scrollToBottom();
    return wrap;
  }

  errorMessage(error) {
    const missingKey = String(error?.message || '').includes('GEMINI_API_KEY');
    return missingKey
      ? 'Gemini API 키가 아직 서버에 연결되지 않았어요. Vercel의 GEMINI_API_KEY를 확인해 주세요.'
      : '지금은 AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  getSummary() {
    if (this.aiInsight && typeof this.aiInsight.getSummary === 'function') {
      return this.aiInsight.getSummary();
    }

    const expenses = Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [];
    const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return {
      monthlyTotal: total,
      transactionCount: expenses.length,
      monthlyBudget: Number(this.expenseManager?.monthlyBudget || 0),
      topCategories: []
    };
  }

  getModel() {
    return localStorage.getItem('spot-gemini-model-v1') || 'gemini-3.8-flash';
  }

  setSending(value) {
    this.sending = value;
    this.sendButton.disabled = value;
    this.sendButton.style.opacity = value ? '0.55' : '1';
    this.input.disabled = value;
    if (this.detailedButton) {
      this.detailedButton.disabled = value;
      this.detailedButton.style.opacity = value ? '0.55' : '1';
      this.detailedButton.style.cursor = value ? 'not-allowed' : 'pointer';
    }
  }

  addUser(text) {
    const wrap = document.createElement('div');
    wrap.className = 'flex justify-end mt-3';
    wrap.innerHTML = `<div class="bg-white/10 border border-white/20 text-white px-3.5 py-2 rounded-2xl rounded-tr-none max-w-[80%] font-medium text-[11.5px] whitespace-pre-wrap break-words leading-relaxed">${this.escapeHtml(text)}</div>`;
    this.log.appendChild(wrap);
    this.scrollToBottom();
    return wrap;
  }

  addAssistant(text, temporary = false) {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-start gap-2 mt-3';
    if (temporary) wrap.dataset.temporary = 'true';
    wrap.innerHTML = `
      <div class="w-6 h-6 rounded-full bg-amber-400 text-[#08233D] font-black flex items-center justify-center shrink-0 text-[9px]">AI</div>
      <div class="bg-white text-slate-900 px-3.5 py-2.5 rounded-2xl rounded-tl-none max-w-[88%] shadow text-[11.5px] whitespace-pre-wrap break-words leading-relaxed">${this.formatReply(text)}</div>`;
    this.log.appendChild(wrap);
    this.scrollToBottom();
    return wrap;
  }

  formatReply(value) {
    let safe = this.escapeHtml(value);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/^[-•]\s+/gm, '• ');
    return safe;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.log.scrollTop = this.log.scrollHeight;
    });
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }
}

window.AIChat = AIChat;
