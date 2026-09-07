class AIChat {
  constructor(root = document, expenseManager = window.spotExpenseManager, aiInsight = window.spotAIInsight) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.aiInsight = aiInsight;
    this.messages = [];
    this.sending = false;
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
    // display는 .screen-view / .screen-view.active CSS가 관리해야 합니다.
    // 여기서 display:flex를 인라인으로 지정하면 비활성 AI 화면도 항상 노출됩니다.
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

  async send() {
    const text = String(this.input.value || '').trim();
    if (!text || this.sending) return;

    this.input.value = '';
    this.messages.push({ role: 'user', text });
    this.addUser(text);
    this.setSending(true);
    const thinking = this.addAssistant('지출 데이터를 확인하고 있어요…', true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.getModel(),
          summary: this.getSummary(),
          messages: this.messages.slice(-10)
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);

      const reply = String(data.reply || '').trim();
      if (!reply) throw new Error('AI 응답이 비어 있습니다.');

      thinking?.remove();
      this.messages.push({ role: 'assistant', text: reply });
      this.addAssistant(reply);
    } catch (error) {
      console.warn('SPOT AI Chat:', error);
      thinking?.remove();
      const missingKey = String(error.message || '').includes('GEMINI_API_KEY');
      this.addAssistant(missingKey
        ? 'Gemini API 키가 아직 서버에 연결되지 않았어요. Vercel의 GEMINI_API_KEY를 확인해 주세요.'
        : '지금은 AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      this.setSending(false);
      this.input.focus();
    }
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
