class LanguageManager {
  constructor(root = document, spotDB = window.spotDB) {
    this.root = root;
    this.spotDB = spotDB;
    this.storageKey = 'spot-language-v1';
    this.language = 'ko';
    this.observer = null;

    this.translations = {
      en: {
        '홈': 'Home','내역': 'History','지도': 'Map','AI': 'AI','프로필': 'Profile','소비 분석': 'Spending Analytics','소비 지도': 'Spending Map','분석 결과': 'Analysis Result','최근 소비': 'Recent Spending','이번 달 총 지출': 'Total Spending This Month','AI 인사이트': 'AI Insights','주간 구매량 추이': 'Weekly Spending Trend','카테고리별 소비': 'Spending by Category','실시간 소비 분석': 'Live Spending Analysis','AI 분석 리포트': 'AI Analysis Report','일간': 'Daily','주간': 'Weekly','월간': 'Monthly','연간': 'Yearly','오늘': 'Today','이번 주': 'This Week','이번 달': 'This Month','올해': 'This Year','어제': 'Yesterday','지난주': 'Last Week','지난달': 'Last Month','지난해': 'Last Year','지출 추가': 'Add Expense','+ 지출 추가': '+ Add Expense','지출 수정': 'Edit Expense','추가하기': 'Add','수정 저장': 'Save Changes','수정': 'Edit','삭제': 'Delete','취소': 'Cancel','저장하기': 'Save','예산': 'Budget','설정': 'Set','월 예산 설정': 'Set Monthly Budget','월 예산': 'Monthly Budget','예산 저장': 'Save Budget','상호명': 'Merchant','지점명 · 지도 표시용': 'Branch · for Map','지도 찾기': 'Find on Map','금액': 'Amount','카테고리': 'Category','날짜·시간': 'Date & Time','메모': 'Memo','식비': 'Food','카페': 'Cafe','마트': 'Groceries','쇼핑': 'Shopping','교통': 'Transport','생활': 'Living','기타': 'Other','구매 내역': 'Items','합계': 'Total','카메라 버튼을 눌러 영수증을 촬영하거나 선택하세요.': 'Tap the camera button to take or choose a receipt photo.','무엇이든 물어보세요': 'Ask anything','입력 즉시 갱신': 'Updates instantly','방문': 'Visits','구매': 'Purchases','총 지출': 'Total Spent','최근 결제': 'Latest Payment','등록된 소비 장소가 없어요.': 'No spending locations yet.','장소 검색': 'Search Places','언어': 'Language'
      },
      ja: {
        '홈': 'ホーム','내역': '履歴','지도': 'マップ','AI': 'AI','프로필': 'プロフィール','소비 분석': '支出分析','소비 지도': '支出マップ','분석 결과': '分析結果','최근 소비': '最近の支出','이번 달 총 지출': '今月の総支出','AI 인사이트': 'AIインサイト','주간 구매량 추이': '週間支出推移','카테고리별 소비': 'カテゴリー別支出','실시간 소비 분석': 'リアルタイム支出分析','AI 분석 리포트': 'AI分析レポート','일간': '日次','주간': '週間','월간': '月間','연간': '年間','오늘': '今日','이번 주': '今週','이번 달': '今月','올해': '今年','어제': '昨日','지난주': '先週','지난달': '先月','지난해': '昨年','지출 추가': '支出を追加','+ 지출 추가': '+ 支出を追加','지출 수정': '支出を編集','추가하기': '追加','수정 저장': '変更を保存','수정': '編集','삭제': '削除','취소': 'キャンセル','저장하기': '保存','예산': '予算','설정': '設定','월 예산 설정': '月間予算設定','월 예산': '月間予算','예산 저장': '予算を保存','상호명': '店舗名','지점명 · 지도 표시용': '支店名・地図表示用','지도 찾기': '地図で検索','금액': '金額','카테고리': 'カテゴリー','날짜·시간': '日時','메モ': 'メモ','식비': '食費','카페': 'カフェ','마트': 'スーパー','쇼핑': 'ショッピング','교통': '交通','생활': '生活','기타': 'その他','구매 내역': '購入内容','합계': '合計','카메라 버튼을 눌러 영수증을 촬영하거나 선택하세요.': 'カメラボタンを押してレシートを撮影または選択してください。','무엇이든 물어보세요': '何でも聞いてください','입력 즉시 갱신': '入力後すぐ更新','방문': '訪問','구매': '購入','총 지출': '総支出','최근 결제': '最新の支払い','등록된 소비 장소가 없어요.': '登録された支出場所はありません。','장소 검색': '場所を検索','언어': '言語'
      }
    };

    this.reverse = { en: {}, ja: {} };
    for (const lang of ['en', 'ja']) Object.entries(this.translations[lang]).forEach(([ko, value]) => { this.reverse[lang][value] = ko; });
  }

  async start() {
    this.language = await this.loadLanguage();
    this.ensureStyles();
    this.createToggle();
    this.applyLanguage(this.language);
    this.observe();
  }

  async loadLanguage() {
    try {
      const dbValue = await this.spotDB?.getSetting?.('language');
      if (['ko', 'en', 'ja'].includes(dbValue)) return dbValue;
    } catch (_) {}
    const local = localStorage.getItem(this.storageKey);
    return ['ko', 'en', 'ja'].includes(local) ? local : 'ko';
  }

  async saveLanguage(lang) {
    localStorage.setItem(this.storageKey, lang);
    try { await this.spotDB?.setSetting?.('language', lang); } catch (_) {}
  }

  ensureStyles() {
    if (document.getElementById('spot-language-styles')) return;
    const style = document.createElement('style');
    style.id = 'spot-language-styles';
    style.textContent = `
      .phone-container{position:relative}
      .spot-language-wrap{position:absolute;top:12px;right:12px;z-index:9998;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}
      .spot-language-main,.spot-language-option{pointer-events:auto;width:32px;height:32px;border-radius:999px;border:1px solid rgba(8,35,61,.14);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:950;box-shadow:0 4px 14px rgba(8,35,61,.16);cursor:pointer;transition:transform .16s ease,opacity .16s ease,background .16s ease}
      .spot-language-main{background:#08233D;color:#fff;font-size:12px}
      .spot-language-options{display:flex;flex-direction:column;gap:5px;opacity:0;transform:translateY(-6px) scale(.92);pointer-events:none;transition:.16s ease}
      .spot-language-wrap.open .spot-language-options{opacity:1;transform:none;pointer-events:auto}
      .spot-language-option{background:rgba(255,255,255,.97);color:#08233D}
      .spot-language-option.active{background:#D4A23B;color:#08233D;border-color:#D4A23B}
      .spot-language-option:hover,.spot-language-main:hover{transform:scale(1.05)}
      @media (min-width:640px){.spot-language-wrap{top:14px;right:14px}}
    `;
    document.head.appendChild(style);
  }

  createToggle() {
    const container = this.root.querySelector('.phone-container') || document.body;
    if (this.root.getElementById('spot-language-toggle')) return;
    const wrap = document.createElement('div');
    wrap.id = 'spot-language-toggle';
    wrap.className = 'spot-language-wrap';
    wrap.innerHTML = `
      <button type="button" class="spot-language-main" aria-label="언어 선택" aria-expanded="false">文</button>
      <div class="spot-language-options">
        <button type="button" class="spot-language-option" data-lang="ko" title="한국어">KO</button>
        <button type="button" class="spot-language-option" data-lang="en" title="English">EN</button>
        <button type="button" class="spot-language-option" data-lang="ja" title="日本語">日</button>
      </div>`;
    container.appendChild(wrap);

    const main = wrap.querySelector('.spot-language-main');
    main.addEventListener('click', e => {
      e.stopPropagation();
      const open = wrap.classList.toggle('open');
      main.setAttribute('aria-expanded', String(open));
    });
    wrap.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', async () => {
      await this.setLanguage(button.dataset.lang);
      wrap.classList.remove('open');
      main.setAttribute('aria-expanded', 'false');
    }));
    document.addEventListener('click', e => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('open');
        main.setAttribute('aria-expanded', 'false');
      }
    });
    this.updateToggleState();
  }

  async setLanguage(lang) {
    if (!['ko', 'en', 'ja'].includes(lang)) return;
    const previous = this.language;
    if (previous === lang) return;
    this.restoreKorean(previous);
    this.language = lang;
    document.documentElement.lang = lang === 'ja' ? 'ja' : lang === 'en' ? 'en' : 'ko';
    await this.saveLanguage(lang);
    this.applyLanguage(lang);
    this.updateToggleState();
    window.dispatchEvent(new CustomEvent('spot-language-change', { detail: { language: lang } }));
  }

  updateToggleState() {
    const wrap = this.root.getElementById('spot-language-toggle');
    wrap?.querySelectorAll('[data-lang]').forEach(button => button.classList.toggle('active', button.dataset.lang === this.language));
  }

  restoreKorean(fromLang) {
    if (fromLang === 'ko') return;
    const reverse = this.reverse[fromLang] || {};
    this.walkTextNodes(this.root.body, text => reverse[text] || text);
    this.root.querySelectorAll('[placeholder]').forEach(el => {
      const value = String(el.getAttribute('placeholder') || '').trim();
      if (reverse[value]) el.setAttribute('placeholder', reverse[value]);
    });
  }

  applyLanguage(lang) {
    if (lang === 'ko') return;
    const dict = this.translations[lang] || {};
    this.walkTextNodes(this.root.body, text => dict[text] || text);
    this.root.querySelectorAll('[placeholder]').forEach(el => {
      const value = String(el.getAttribute('placeholder') || '').trim();
      if (dict[value]) el.setAttribute('placeholder', dict[value]);
    });
    this.updateToggleState();
  }

  walkTextNodes(node, mapper) {
    if (!node) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(textNode => {
      const parent = textNode.parentElement;
      if (!parent || parent.closest('#spot-language-toggle')) return;
      if (['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) return;
      const raw = textNode.nodeValue;
      const trimmed = raw.trim();
      if (!trimmed) return;
      const mapped = mapper(trimmed);
      if (mapped !== trimmed) textNode.nodeValue = raw.replace(trimmed, mapped);
    });
  }

  observe() {
    if (this.observer) return;
    this.observer = new MutationObserver(mutations => {
      if (this.language === 'ko') return;
      const dict = this.translations[this.language] || {};
      for (const mutation of mutations) mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && !node.closest?.('#spot-language-toggle')) {
          this.walkTextNodes(node, text => dict[text] || text);
          node.querySelectorAll?.('[placeholder]').forEach(el => {
            const value = String(el.getAttribute('placeholder') || '').trim();
            if (dict[value]) el.setAttribute('placeholder', dict[value]);
          });
        }
      });
    });
    this.observer.observe(this.root.body, { childList: true, subtree: true });
  }

  t(koText) {
    if (this.language === 'ko') return koText;
    return this.translations[this.language]?.[koText] || koText;
  }
}

window.LanguageManager = LanguageManager;