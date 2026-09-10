class BioManager {
  constructor(root = document, spotDB = window.spotDB) {
    this.root = root;
    this.spotDB = spotDB;
    this.view = null;
    this.allergies = [];
    this.activeFilter = 'all';
    this.storageKey = 'spot-bio-allergies-v1';

    this.allergyOptions = ['우유', '달걀', '대두', '밀', '땅콩', '견과류', '갑각류', '생선', '메밀', '참깨'];
    this.filters = [
      { id: 'all', label: '전체' },
      { id: 'balanced', label: '균형식' },
      { id: 'healthy', label: '건강식' },
      { id: 'snack', label: '분식' }
    ];

    this.foods = [
      {
        id: 'chicken-rice-bowl', name: '닭가슴살 현미볼', category: 'balanced',
        description: '곡류·채소·단백질을 한 끼에 함께 구성한 메뉴예요.',
        allergens: ['대두'],
        nutrition: { calories: 510, carbohydrate: 63, protein: 34, fat: 12, sugar: 7, sodium: 690, fiber: 8 },
        ingredients: ['현미밥', '닭가슴살', '채소', '간장 베이스 소스']
      },
      {
        id: 'tofu-salad', name: '두부 채소 샐러드', category: 'healthy',
        description: '두부와 여러 채소를 함께 먹는 가벼운 식사 구성이에요.',
        allergens: ['대두', '참깨'],
        nutrition: { calories: 330, carbohydrate: 24, protein: 21, fat: 18, sugar: 6, sodium: 420, fiber: 9 },
        ingredients: ['두부', '잎채소', '토마토', '참깨 드레싱']
      },
      {
        id: 'salmon-poke', name: '연어 포케', category: 'healthy',
        description: '생선·곡류·채소를 한 그릇에 담은 메뉴예요.',
        allergens: ['생선', '대두', '참깨'],
        nutrition: { calories: 560, carbohydrate: 68, protein: 30, fat: 19, sugar: 9, sodium: 760, fiber: 7 },
        ingredients: ['연어', '밥', '채소', '간장 소스', '참깨']
      },
      {
        id: 'egg-kimbap', name: '계란 김밥', category: 'snack',
        description: '밥과 채소, 계란을 함께 먹을 수 있는 분식 메뉴예요.',
        allergens: ['달걀', '참깨'],
        nutrition: { calories: 430, carbohydrate: 66, protein: 15, fat: 12, sugar: 5, sodium: 810, fiber: 5 },
        ingredients: ['쌀밥', '김', '달걀', '채소', '참기름']
      },
      {
        id: 'tteokbokki', name: '떡볶이', category: 'snack',
        description: '떡과 양념을 중심으로 한 대표적인 분식 메뉴예요.',
        allergens: ['밀', '대두'],
        nutrition: { calories: 480, carbohydrate: 94, protein: 9, fat: 7, sugar: 23, sodium: 1190, fiber: 4 },
        ingredients: ['쌀떡 또는 밀떡', '고추장 양념', '어묵', '채소']
      },
      {
        id: 'fishcake-udon', name: '어묵 우동', category: 'snack',
        description: '면과 어묵, 국물을 함께 먹는 따뜻한 분식 메뉴예요.',
        allergens: ['밀', '생선', '대두'],
        nutrition: { calories: 520, carbohydrate: 84, protein: 18, fat: 11, sugar: 8, sodium: 1580, fiber: 5 },
        ingredients: ['우동면', '어묵', '채소', '간장 육수']
      },
      {
        id: 'yogurt-fruit-bowl', name: '요거트 과일볼', category: 'balanced',
        description: '요거트와 과일, 곡물을 곁들이는 간단한 식사·간식 구성이에요.',
        allergens: ['우유', '견과류'],
        nutrition: { calories: 360, carbohydrate: 49, protein: 14, fat: 13, sugar: 24, sodium: 120, fiber: 7 },
        ingredients: ['플레인 요거트', '과일', '오트', '견과류']
      }
    ];
  }

  async start() {
    this.view = this.root.getElementById('view-bio');
    if (!this.view || this.view.dataset.bioEnhanced) return;
    this.view.dataset.bioEnhanced = 'true';
    this.ensureStyles();
    await this.loadAllergies();
    this.bind();
    this.render();
  }

  ensureStyles() {
    if (this.root.getElementById('spot-bio-styles')) return;
    const style = document.createElement('style');
    style.id = 'spot-bio-styles';
    style.textContent = `
      .spot-bio-chip{border:1px solid #E2E8F0;background:#fff;color:#475569;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800;transition:.15s ease}
      .spot-bio-chip.active{background:#08233D;color:#fff;border-color:#08233D}
      .spot-bio-filter{white-space:nowrap;border:1px solid #EAE5DB;background:#fff;color:#77736C;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:900}
      .spot-bio-filter.active{background:#D4A23B;color:#08233D;border-color:#D4A23B}
      .spot-bio-food{background:#fff;border:1px solid #EAE5DB;border-radius:18px;padding:14px;box-shadow:0 1px 3px rgba(15,23,42,.04)}
      .spot-bio-caution{background:#FFF7ED;border-color:#FDBA74}
      .spot-bio-safe{background:#F0FDF4;color:#166534;border:1px solid #BBF7D0}
      .spot-bio-warn{background:#FFF7ED;color:#C2410C;border:1px solid #FED7AA}
      .spot-bio-nutrition-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:11px}
      .spot-bio-nutrition-row:last-child{border-bottom:0}
    `;
    document.head.appendChild(style);
  }

  async loadAllergies() {
    try {
      const stored = await this.spotDB?.getSetting?.('bioAllergies');
      if (Array.isArray(stored)) {
        this.allergies = stored.filter(item => this.allergyOptions.includes(item));
        return;
      }
    } catch (_) {}

    try {
      const local = JSON.parse(localStorage.getItem(this.storageKey) || '[]');
      if (Array.isArray(local)) this.allergies = local.filter(item => this.allergyOptions.includes(item));
    } catch (_) {}
  }

  async saveAllergies() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.allergies));
    try { await this.spotDB?.setSetting?.('bioAllergies', [...this.allergies]); } catch (_) {}
  }

  bind() {
    this.view.querySelector('#spot-bio-allergy-options')?.addEventListener('click', async event => {
      const button = event.target.closest('[data-allergy]');
      if (!button) return;
      const allergy = button.dataset.allergy;
      if (this.allergies.includes(allergy)) this.allergies = this.allergies.filter(item => item !== allergy);
      else this.allergies.push(allergy);
      await this.saveAllergies();
      this.render();
    });

    this.view.querySelector('#spot-bio-filter')?.addEventListener('click', event => {
      const button = event.target.closest('[data-bio-filter]');
      if (!button) return;
      this.activeFilter = button.dataset.bioFilter;
      this.render();
    });

    this.view.querySelector('#spot-bio-food-list')?.addEventListener('click', event => {
      const button = event.target.closest('[data-nutrition]');
      if (!button) return;
      const food = this.foods.find(item => item.id === button.dataset.nutrition);
      if (food) this.openNutrition(food);
    });
  }

  render() {
    this.renderAllergySummary();
    this.renderAllergyOptions();
    this.renderFilters();
    this.renderFoods();
  }

  renderAllergySummary() {
    const node = this.view.querySelector('#spot-bio-allergy-summary');
    if (!node) return;
    const cautionCount = this.foods.filter(food => this.getMatches(food).length).length;
    node.innerHTML = this.allergies.length
      ? `<div class="text-[10px] font-black text-amber-300 mb-1">내 알레르기 체크</div>
         <div class="text-base font-black">${this.escapeHtml(this.allergies.join(' · '))}</div>
         <div class="text-[10px] text-white/70 mt-1.5">현재 추천 목록 ${this.foods.length}개 중 ${cautionCount}개에 주의 표시가 적용돼요.</div>`
      : `<div class="text-[10px] font-black text-amber-300 mb-1">내 알레르기 체크</div>
         <div class="text-base font-black">아직 선택된 알레르기가 없어요.</div>
         <div class="text-[10px] text-white/70 mt-1.5">아래에서 해당 항목을 선택하면 음식 카드에 주의 표시를 적용해요.</div>`;
  }

  renderAllergyOptions() {
    const node = this.view.querySelector('#spot-bio-allergy-options');
    if (!node) return;
    node.innerHTML = this.allergyOptions.map(item => `
      <button type="button" data-allergy="${this.escapeAttr(item)}" class="spot-bio-chip ${this.allergies.includes(item) ? 'active' : ''}">${this.escapeHtml(item)}</button>`).join('');
  }

  renderFilters() {
    const node = this.view.querySelector('#spot-bio-filter');
    if (!node) return;
    node.innerHTML = this.filters.map(item => `
      <button type="button" data-bio-filter="${item.id}" class="spot-bio-filter ${this.activeFilter === item.id ? 'active' : ''}">${this.escapeHtml(item.label)}</button>`).join('');
  }

  renderFoods() {
    const node = this.view.querySelector('#spot-bio-food-list');
    if (!node) return;
    const foods = this.foods
      .filter(food => this.activeFilter === 'all' || food.category === this.activeFilter)
      .sort((a, b) => Number(this.getMatches(a).length > 0) - Number(this.getMatches(b).length > 0));

    node.innerHTML = foods.map(food => {
      const matches = this.getMatches(food);
      const caution = matches.length > 0;
      const category = this.filters.find(item => item.id === food.category)?.label || '';
      return `
        <article class="spot-bio-food ${caution ? 'spot-bio-caution' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 mb-1">
                <span class="text-[9px] font-black text-[#9B701C] bg-[#F8EDDA] rounded-full px-2 py-0.5">${this.escapeHtml(category)}</span>
                <span class="text-[9px] font-black rounded-full px-2 py-0.5 ${caution ? 'spot-bio-warn' : 'spot-bio-safe'}">${caution ? '알레르기 주의' : '선택 알레르기와 겹침 없음'}</span>
              </div>
              <h3 class="text-[13px] font-black text-[#161616]">${this.escapeHtml(food.name)}</h3>
              <p class="text-[10px] text-[#77736C] leading-relaxed mt-1">${this.escapeHtml(food.description)}</p>
            </div>
            <button type="button" data-nutrition="${food.id}" class="shrink-0 text-[9.5px] font-black text-white bg-[#08233D] rounded-xl px-2.5 py-2">영양정보</button>
          </div>

          <div class="grid grid-cols-3 gap-1.5 mt-3">
            <div class="rounded-xl bg-[#FBF7EF] p-2 text-center"><div class="text-[8.5px] text-[#77736C]">열량</div><div class="text-[10.5px] font-black text-[#08233D]">${food.nutrition.calories} kcal</div></div>
            <div class="rounded-xl bg-[#FBF7EF] p-2 text-center"><div class="text-[8.5px] text-[#77736C]">단백질</div><div class="text-[10.5px] font-black text-[#08233D]">${food.nutrition.protein}g</div></div>
            <div class="rounded-xl bg-[#FBF7EF] p-2 text-center"><div class="text-[8.5px] text-[#77736C]">나트륨</div><div class="text-[10.5px] font-black text-[#08233D]">${food.nutrition.sodium}mg</div></div>
          </div>

          <div class="mt-2 text-[9px] ${caution ? 'text-[#C2410C] font-black' : 'text-[#77736C]'}">
            ${caution ? `주의 성분: ${this.escapeHtml(matches.join(', '))}` : `표시 알레르기: ${this.escapeHtml(food.allergens.join(', ') || '없음')}`}
          </div>
        </article>`;
    }).join('') || '<div class="text-center text-[11px] text-slate-400 py-6">해당 분류의 음식이 없어요.</div>';
  }

  getMatches(food) {
    return food.allergens.filter(item => this.allergies.includes(item));
  }

  openNutrition(food) {
    const matches = this.getMatches(food);
    const nutrition = [
      ['열량', `${food.nutrition.calories} kcal`],
      ['탄수화물', `${food.nutrition.carbohydrate} g`],
      ['단백질', `${food.nutrition.protein} g`],
      ['지방', `${food.nutrition.fat} g`],
      ['당류', `${food.nutrition.sugar} g`],
      ['나트륨', `${food.nutrition.sodium} mg`],
      ['식이섬유', `${food.nutrition.fiber} g`]
    ];

    const backdrop = document.createElement('div');
    backdrop.className = 'spot-modal-backdrop';
    backdrop.innerHTML = `
      <div class="spot-modal max-h-[78vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <div class="text-[10px] font-black text-[#9B701C]">영양정보 · 예시</div>
            <h3 class="text-base font-black text-[#08233D] mt-0.5">${this.escapeHtml(food.name)}</h3>
          </div>
          <button type="button" data-close class="text-slate-400 text-xl">×</button>
        </div>

        ${matches.length ? `<div class="spot-bio-warn rounded-xl p-3 mb-3 text-[10.5px] font-black">내 알레르기 정보와 겹치는 항목: ${this.escapeHtml(matches.join(', '))}</div>` : ''}

        <div class="rounded-xl border border-[#EAE5DB] px-3 mb-3">
          ${nutrition.map(([label, value]) => `<div class="spot-bio-nutrition-row"><span class="text-[#77736C] font-bold">${label}</span><strong class="text-[#08233D]">${value}</strong></div>`).join('')}
        </div>

        <div class="text-[10px] font-black text-[#161616] mb-1.5">주요 구성 예시</div>
        <div class="flex flex-wrap gap-1.5 mb-3">${food.ingredients.map(item => `<span class="text-[9px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-1">${this.escapeHtml(item)}</span>`).join('')}</div>

        <div class="text-[9px] leading-relaxed text-[#77736C] bg-[#FBF7EF] rounded-xl p-3">이 수치는 메뉴 이해를 위한 일반적인 예시값이에요. 실제 제품·매장·조리법에 따라 영양성분과 알레르기 유발 원재료가 달라질 수 있으니 실제 섭취 전 표시사항을 확인하세요.</div>
        <button type="button" data-close class="spot-btn-primary w-full mt-3">확인</button>
      </div>`;

    document.body.appendChild(backdrop);
    const close = () => backdrop.remove();
    backdrop.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  escapeAttr(value) {
    return this.escapeHtml(value).replace(/`/g, '&#096;');
  }
}

window.BioManager = BioManager;
