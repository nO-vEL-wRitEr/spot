class AdditiveManager {
  constructor(root = document) {
    this.root = root;
    this.view = null;
    this.count = 4;
    this.items = [
      {
        name: '소르비톨',
        en: 'Sorbitol',
        type: '감미료 · 당알코올',
        description: '단맛과 보습성을 내기 위해 사용되는 당알코올이에요. 무설탕 껌·캔디 같은 제품에서 자주 볼 수 있어요.',
        note: '한 번에 많이 섭취하면 일부 사람에게 복부 불편감이 생길 수 있어요.'
      },
      {
        name: '정제수',
        en: 'Purified Water',
        type: '원재료 · 용매',
        description: '불순물을 줄이도록 정제한 물이에요. 음료·소스·가공식품에서 다른 성분을 섞는 기본 원료로 널리 쓰여요.',
        note: '그 자체로 특별한 첨가 효과를 내기보다는 제품의 기본 원료 역할을 해요.'
      },
      {
        name: '과당',
        en: 'Fructose',
        type: '당류 · 감미 원료',
        description: '과일과 꿀에도 자연적으로 존재하는 단당류예요. 가공식품에서는 단맛을 내는 원료로 쓰일 수 있어요.',
        note: '영양정보의 당류 함량과 함께 확인하는 것이 좋아요.'
      },
      {
        name: '구연산',
        en: 'Citric Acid',
        type: '산도조절제',
        description: '신맛을 내고 산도를 조절하기 위해 사용돼요. 과일에도 자연적으로 존재하며 음료·젤리 등에 흔해요.',
        note: '제품 전체의 성분표와 섭취량을 함께 보는 것이 중요해요.'
      },
      {
        name: '레시틴',
        en: 'Lecithin',
        type: '유화제',
        description: '물과 기름 성분이 잘 섞이도록 돕는 성분이에요. 초콜릿·제과·소스 등에 사용될 수 있어요.',
        note: '대두 유래 레시틴처럼 원료 유래 알레르기 표시를 함께 확인하세요.'
      },
      {
        name: '잔탄검',
        en: 'Xanthan Gum',
        type: '증점제 · 안정제',
        description: '식품의 점도와 질감을 유지하는 데 쓰여요. 드레싱·소스·글루텐프리 제품에서 자주 보여요.',
        note: '소량으로 질감을 조절하는 용도로 사용되는 경우가 많아요.'
      },
      {
        name: '아스코르빈산',
        en: 'Ascorbic Acid',
        type: '산화방지제 · 비타민 C',
        description: '비타민 C로도 알려진 성분으로, 산화를 늦추거나 영양 강화를 위해 사용될 수 있어요.',
        note: '제품에 따라 영양소 또는 식품첨가물 용도로 표시될 수 있어요.'
      },
      {
        name: '말토덱스트린',
        en: 'Maltodextrin',
        type: '탄수화물 원료',
        description: '전분을 분해해 만든 탄수화물 원료로, 분말의 질감이나 부피를 조절하는 데 쓰일 수 있어요.',
        note: '제품의 총 탄수화물과 당류 정보를 함께 확인하세요.'
      },
      {
        name: '탄산수소나트륨',
        en: 'Sodium Bicarbonate',
        type: '팽창제 · 산도조절제',
        description: '베이킹소다로도 알려져 있어요. 제과·제빵에서 반죽을 부풀리거나 산도를 조절하는 데 사용돼요.',
        note: '나트륨 섭취를 관리한다면 제품의 나트륨 영양정보도 함께 확인하세요.'
      },
      {
        name: '소르빈산칼륨',
        en: 'Potassium Sorbate',
        type: '보존료',
        description: '곰팡이와 효모의 증식을 억제해 식품의 보존성을 높이기 위해 사용되는 보존료예요.',
        note: '허용 기준 안에서 사용되며, 제품 표시사항에서 사용 여부를 확인할 수 있어요.'
      },
      {
        name: '카라기난',
        en: 'Carrageenan',
        type: '증점제 · 안정제',
        description: '해조류에서 얻는 성분으로, 유제품·음료·디저트의 질감을 안정적으로 유지하는 데 쓰일 수 있어요.',
        note: '제품에 따라 사용 여부와 목적이 달라질 수 있어요.'
      },
      {
        name: '글리세린',
        en: 'Glycerin',
        type: '보습제 · 용매',
        description: '수분을 유지하거나 부드러운 질감을 만드는 데 사용될 수 있는 성분이에요.',
        note: '식품 외에도 의약품·화장품 등 다양한 분야에서 사용돼요.'
      }
    ];
  }

  start() {
    this.view = this.root.getElementById('view-bio');
    if (!this.view || this.view.dataset.additiveEnhanced) return;
    this.view.dataset.additiveEnhanced = 'true';
    this.ensureStyles();
    this.createSection();
    this.render();
  }

  ensureStyles() {
    if (this.root.getElementById('spot-additive-styles')) return;
    const style = document.createElement('style');
    style.id = 'spot-additive-styles';
    style.textContent = `
      .spot-additive-section{margin-top:16px;padding-top:15px;border-top:1px solid #EAE5DB}
      .spot-additive-card{background:#fff;border:1px solid #EAE5DB;border-radius:16px;padding:12px;box-shadow:0 1px 3px rgba(15,23,42,.04)}
      .spot-additive-type{display:inline-flex;border-radius:999px;background:#EEF6F2;color:#227A52;border:1px solid #D4EBDD;padding:3px 7px;font-size:8.5px;font-weight:900}
      .spot-additive-refresh{border:1px solid #D9E2EA;background:#fff;color:#08233D;border-radius:999px;padding:6px 9px;font-size:9px;font-weight:900}
    `;
    document.head.appendChild(style);
  }

  createSection() {
    if (this.view.querySelector('#spot-additive-section')) return;
    const foodList = this.view.querySelector('#spot-bio-food-list');
    if (!foodList) return;

    const section = document.createElement('section');
    section.id = 'spot-additive-section';
    section.className = 'spot-additive-section';
    section.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <div class="text-[10px] font-black text-[#2F855A]">FOOD CHEMISTRY</div>
          <h2 class="text-sm font-black text-[#08233D] mt-0.5">첨가물</h2>
          <p class="text-[9.5px] text-[#77736C] mt-1 leading-relaxed">식품 성분표에서 자주 만나는 첨가물·원재료 성분을 랜덤으로 알아봐요.</p>
        </div>
        <button type="button" id="spot-additive-refresh" class="spot-additive-refresh">새로 보기 ↻</button>
      </div>
      <div id="spot-additive-list" class="space-y-2"></div>
      <div class="text-[8.5px] leading-relaxed text-[#77736C] bg-[#FBF7EF] rounded-xl p-2.5 mt-3">성분 이름만으로 식품의 안전성이나 건강 영향을 단정할 수 없어요. 실제 제품의 함량·전체 영양정보·알레르기 표시를 함께 확인하세요.</div>`;

    foodList.insertAdjacentElement('afterend', section);
    section.querySelector('#spot-additive-refresh')?.addEventListener('click', () => this.render());
  }

  randomItems() {
    const pool = [...this.items];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.min(this.count, pool.length));
  }

  render() {
    const list = this.view?.querySelector('#spot-additive-list');
    if (!list) return;
    const selected = this.randomItems();
    list.innerHTML = selected.map(item => `
      <article class="spot-additive-card">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h3 class="text-[12px] font-black text-[#161616]">${this.escapeHtml(item.name)}</h3>
            <div class="text-[8.5px] text-[#94A3B8] font-bold mt-0.5">${this.escapeHtml(item.en)}</div>
          </div>
          <span class="spot-additive-type">${this.escapeHtml(item.type)}</span>
        </div>
        <p class="text-[9.5px] text-[#475569] leading-relaxed mt-2">${this.escapeHtml(item.description)}</p>
        <div class="mt-2 text-[8.8px] text-[#77736C] bg-[#FBF7EF] rounded-lg px-2.5 py-2"><strong class="text-[#08233D]">알아두기</strong> · ${this.escapeHtml(item.note)}</div>
      </article>`).join('');
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }
}

window.AdditiveManager = AdditiveManager;
