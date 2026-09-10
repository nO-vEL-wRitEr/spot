/** 객체 구성과 DOM 이벤트 수명주기를 담당하는 앱 진입점입니다. */
class SpotApp {
  constructor(root = document) {
    this.root = root;
    this.ensureBioShell();

    const screens = [...root.querySelectorAll('.screen-view')].map(el => new Screen(el));
    const navigation = new NavigationView(root, {
      'view-home': 'tab-home',
      'view-analytics': 'tab-history',
      'view-whatif': 'tab-history',
      'view-receipt-detail': 'tab-history',
      'view-map': 'tab-map',
      'view-ai': 'tab-ai',
      'view-bio': 'tab-bio',
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

  ensureBioShell() {
    const phone = this.root.querySelector('.phone-container');
    const nav = this.root.querySelector('.bottom-tab-bar');
    if (!phone || !nav) return;

    nav.style.gridTemplateColumns = 'repeat(6, minmax(0, 1fr))';

    if (!this.root.getElementById('view-bio')) {
      const view = document.createElement('section');
      view.id = 'view-bio';
      view.className = 'screen-view px-4 pt-3.5 pb-3';
      view.innerHTML = `
        <header class="flex items-center justify-between mb-3">
          <div>
            <div class="text-[10px] font-black text-[#9B701C] tracking-wide">SPOT BIO</div>
            <h1 class="text-[18px] font-black text-[#08233D]">바이오</h1>
          </div>
          <button type="button" data-screen="view-allergy-mgmt" class="text-[10px] font-black text-[#08233D] bg-white border border-[#EAE5DB] rounded-xl px-2.5 py-2">알레르기 관리</button>
        </header>

        <div id="spot-bio-allergy-summary" class="bg-[#08233D] text-white rounded-2xl p-4 mb-3"></div>

        <div class="bg-white border border-[#EAE5DB] rounded-2xl p-4 mb-3 shadow-sm">
          <div class="flex items-center justify-between gap-2 mb-2">
            <div>
              <div class="text-xs font-black text-[#161616]">내 알레르기 정보</div>
              <div class="text-[9.5px] text-[#77736C] mt-0.5">선택한 항목과 겹치는 음식은 주의로 표시해요.</div>
            </div>
            <span class="text-[9px] font-black text-[#9B701C] bg-[#F8EDDA] rounded-full px-2 py-1">기기 저장</span>
          </div>
          <div id="spot-bio-allergy-options" class="flex flex-wrap gap-1.5"></div>
        </div>

        <div class="flex items-end justify-between gap-2 mb-2">
          <div>
            <div class="text-xs font-black text-[#161616]">식품 추천</div>
            <div class="text-[9.5px] text-[#77736C]">알레르기 정보와 일반 영양 구성을 함께 확인해요.</div>
          </div>
        </div>
        <div id="spot-bio-filter" class="flex gap-1.5 overflow-x-auto pb-2 mb-1"></div>
        <div id="spot-bio-food-list" class="space-y-2.5"></div>

        <div class="mt-3 mb-2 text-[9px] leading-relaxed text-[#77736C] bg-[#F8EDDA]/70 border border-[#E7D1A0] rounded-xl p-3">
          영양·알레르기 정보는 일반적인 예시이며 제품과 조리법에 따라 달라질 수 있어요. 실제 섭취 전에는 포장지나 매장의 알레르기·원재료 정보를 확인하세요.
        </div>`;
      phone.insertBefore(view, nav);
    }

    if (!this.root.getElementById('tab-bio')) {
      const button = document.createElement('button');
      button.id = 'tab-bio';
      button.dataset.screen = 'view-bio';
      button.className = 'tab-btn';
      button.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c4.5-3.2 7-7.1 7-11.1C19 6.1 16.2 3 12.8 3c-1.7 0-3.2.8-4.1 2.1C7.8 3.8 6.3 3 4.6 3 2.1 3 1 5.2 1 7.5 1 12 5.5 17.5 12 21z"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v7m-3.5-3.5h7"/>
        </svg>
        <span>바이오</span>`;
      const profileTab = this.root.getElementById('tab-profile');
      nav.insertBefore(button, profileTab || null);
    }

    const router = this.root.getElementById('screenRouter');
    if (router && !router.querySelector('option[value="view-bio"]')) {
      const option = document.createElement('option');
      option.value = 'view-bio';
      option.textContent = '10. 바이오 (Bio)';
      const profileOption = router.querySelector('option[value="view-profile"]');
      router.insertBefore(option, profileOption || null);
    }
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
