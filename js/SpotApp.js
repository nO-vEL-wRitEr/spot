/** 객체 구성과 DOM 이벤트 수명주기를 담당하는 앱 진입점입니다. */
class SpotApp {
  constructor(root = document) {
    this.root = root;
    const screens = [...root.querySelectorAll('.screen-view')].map(el => new Screen(el));
    const navigation = new NavigationView(root, {
      'view-home': 'tab-home',
      'view-analytics': 'tab-history',
      'view-whatif': 'tab-history',
      'view-receipt-detail': 'tab-history',
      'view-map': 'tab-map',
      'view-ai': 'tab-ai',
      'view-profile': 'tab-profile',
      'view-allergy-mgmt': 'tab-profile',
    });
    this.router = new ScreenRouter(screens, navigation);
    this.started = false;
    this.chatSending = false;

    this.handleClick = event => {
      const trigger = event.target.closest?.('[data-screen]');
      if (trigger) this.router.navigate(trigger.dataset.screen);
    };
    this.handleChange = event => {
      if (event.target.id === 'screenRouter') this.router.navigate(event.target.value);
    };
    this.handleKeydown = event => {
      const trigger = event.target.closest?.('[data-screen][role="button"]');
      if (trigger && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.router.navigate(trigger.dataset.screen);
      }
    };
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const trigger of this.root.querySelectorAll('[data-screen]')) {
      if (trigger.tagName !== 'BUTTON') {
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('tabindex', '0');
      }
    }
    this.root.addEventListener('click', this.handleClick);
    this.root.addEventListener('change', this.handleChange);
    this.root.addEventListener('keydown', this.handleKeydown);
    this.setupAIChat();
    this.router.navigate('view-home');
  }

  setupAIChat() {
    const view = this.root.getElementById('view-ai');
    if (!view || view.dataset.chatBound) return;
    const input = view.querySelector('input[placeholder="무엇이든 물어보세요"]');
    const button = input?.parentElement?.querySelector('button');
    const log = view.querySelector('header')?.parentElement;
    if (!input || !button || !log) return;

    view.dataset.chatBound = 'true';
    button.type = 'button';
    button.setAttribute('aria-label', '메시지 보내기');
    this.chatInput = input;
    this.chatButton = button;
    this.chatLog = log;

    const send = () => this.sendAIChat();
    button.addEventListener('click', send);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });
  }

  async sendAIChat() {
    const text = String(this.chatInput?.value || '').trim();
    if (!text || this.chatSending) return;

    this.chatInput.value = '';
    this.appendChatBubble('user', text);
    this.chatSending = true;
    this.chatButton.disabled = true;
    this.chatButton.style.opacity = '0.55';
    const waiting = this.appendChatBubble('assistant', '지출 데이터를 확인하고 있어요…');

    try {
      const summary = window.spotAIInsight?.getSummary?.() || {
        monthlyTotal: 0,
        transactionCount: 0,
        monthlyBudget: Number(window.spotExpenseManager?.monthlyBudget || 0),
        topCategories: []
      };
      const model = localStorage.getItem('spot-gemini-model-v1') || 'gemini-3.8-flash';
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          summary,
          messages: [{ role: 'user', text }]
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      waiting?.remove();
      this.appendChatBubble('assistant', data.reply || '응답을 받지 못했어요.');
    } catch (error) {
      waiting?.remove();
      const missingKey = String(error.message || '').includes('GEMINI_API_KEY');
      this.appendChatBubble('assistant', missingKey
        ? 'Gemini API 키가 아직 서버에 연결되지 않았어요. Vercel 환경변수를 확인해 주세요.'
        : '지금은 AI 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
      console.warn('SPOT AI chat:', error);
    } finally {
      this.chatSending = false;
      this.chatButton.disabled = false;
      this.chatButton.style.opacity = '1';
      this.chatInput.focus();
    }
  }

  appendChatBubble(role, text) {
    if (!this.chatLog) return null;
    const wrap = document.createElement('div');
    wrap.className = role === 'user' ? 'flex justify-end mt-3' : 'flex items-start gap-2 mt-3';
    const safe = this.escapeHtml(text);
    wrap.innerHTML = role === 'user'
      ? `<div class="bg-white/10 border border-white/20 text-white px-3.5 py-2 rounded-2xl rounded-tr-none max-w-[80%] font-medium text-[11.5px] whitespace-pre-wrap break-words">${safe}</div>`
      : `<div class="w-6 h-6 rounded-full bg-amber-400 text-[#08233D] font-black flex items-center justify-center shrink-0 text-[9px]">AI</div><div class="bg-white text-slate-900 px-3.5 py-2.5 rounded-2xl rounded-tl-none max-w-[85%] shadow text-[11.5px] whitespace-pre-wrap break-words">${safe}</div>`;
    this.chatLog.appendChild(wrap);
    requestAnimationFrame(() => { this.chatLog.scrollTop = this.chatLog.scrollHeight; });
    return wrap;
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  destroy() {
    this.root.removeEventListener('click', this.handleClick);
    this.root.removeEventListener('change', this.handleChange);
    this.root.removeEventListener('keydown', this.handleKeydown);
    this.started = false;
  }
}
