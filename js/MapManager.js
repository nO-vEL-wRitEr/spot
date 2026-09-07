class MapManager {
  constructor(root = document, expenseManager = window.spotExpenseManager) {
    this.root = root;
    this.expenseManager = expenseManager;
    this.view = null;
    this.map = null;
    this.places = null;
    this.infoWindow = null;
    this.markers = [];
    this.sdkPromise = null;
    this.renderTimer = null;
    this.formObserver = null;
    this.defaultCenter = { lat: 37.4979, lng: 127.0276 };
  }

  start() {
    this.view = this.root.getElementById('view-map');
    if (!this.view || this.view.dataset.kakaoMapEnhanced) return;
    this.view.dataset.kakaoMapEnhanced = 'true';

    this.prepareMapView();
    this.observeExpenseForms();
    this.bindExpenseUpdates();
    this.bindNavigation();

    if (this.view.classList.contains('active')) this.ensureMap();
  }

  prepareMapView() {
    const header = this.view.querySelector('header');
    const mapShell = [...this.view.querySelectorAll('div')].find(el => el.querySelector(':scope > svg') && el.className.includes('h-64'));
    if (!mapShell) return;

    this.mapShell = mapShell;
    this.mapShell.innerHTML = `
      <div id="spot-kakao-map" class="absolute inset-0 bg-[#EAE8E3]"></div>
      <div id="spot-map-status" class="absolute top-2.5 left-2.5 right-2.5 z-10 pointer-events-none">
        <span class="inline-block bg-white/95 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#08233D] shadow border border-slate-200">지도를 불러오는 중…</span>
      </div>
      <button id="spot-map-my-location" type="button" class="absolute bottom-2.5 right-2.5 z-10 w-9 h-9 rounded-full bg-white text-[#08233D] shadow border border-slate-200 text-sm font-black" aria-label="내 위치">◎</button>`;

    const search = document.createElement('form');
    search.id = 'spot-map-search-form';
    search.className = 'flex gap-2 mb-3';
    search.innerHTML = `
      <input id="spot-map-search" class="spot-field flex-1" placeholder="지점명 검색 (예: 스타벅스 서면점)" autocomplete="off">
      <button class="spot-btn-primary whitespace-nowrap" type="submit">찾기</button>`;
    header?.insertAdjacentElement('afterend', search);

    this.searchInput = search.querySelector('#spot-map-search');
    this.status = this.root.getElementById('spot-map-status');
    this.mapNode = this.root.getElementById('spot-kakao-map');
    this.detailCard = this.mapShell.nextElementSibling;

    search.addEventListener('submit', async event => {
      event.preventDefault();
      const keyword = String(this.searchInput.value || '').trim();
      if (!keyword) return;
      await this.ensureMap();
      this.searchAndPan(keyword);
    });

    this.root.getElementById('spot-map-my-location')?.addEventListener('click', async () => {
      await this.ensureMap();
      this.moveToCurrentLocation();
    });

    if (this.detailCard) {
      this.detailCard.innerHTML = `
        <div class="text-sm font-black text-[#161616] mb-1">지점을 선택해 주세요</div>
        <div class="text-[11px] text-[#77736C] leading-relaxed">등록한 지점명이 지도에 마커로 표시됩니다. 마커를 누르면 해당 지점의 방문·지출 통계를 볼 수 있어요.</div>`;
    }
  }

  bindNavigation() {
    this.root.addEventListener('click', event => {
      const trigger = event.target.closest?.('[data-screen="view-map"]');
      if (!trigger) return;
      setTimeout(async () => {
        await this.ensureMap();
        this.map?.relayout?.();
        this.fitToSavedPlaces();
      }, 80);
    });
  }

  bindExpenseUpdates() {
    const manager = this.expenseManager;
    if (!manager || manager.__mapPersistenceWrapped) return;
    manager.__mapPersistenceWrapped = true;

    const originalSave = manager.save.bind(manager);
    manager.save = (...args) => {
      const result = originalSave(...args);
      this.scheduleRender();
      return result;
    };
  }

  observeExpenseForms() {
    this.formObserver = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const form = node.matches?.('#spot-expense-form') ? node : node.querySelector?.('#spot-expense-form');
          if (form) this.enhanceExpenseForm(form);
        }
      }
    });
    this.formObserver.observe(document.body, { childList: true, subtree: true });
  }

  enhanceExpenseForm(form) {
    if (!form || form.dataset.placeEnhanced) return;
    form.dataset.placeEnhanced = 'true';

    const merchantInput = form.querySelector('[name="merchant"]');
    const amountInput = form.querySelector('[name="amount"]');
    const fields = form.querySelector('.space-y-3');
    if (!merchantInput || !fields) return;

    const matched = (this.expenseManager?.expenses || []).find(expense =>
      String(expense.merchant || '') === String(merchantInput.value || '') &&
      Number(expense.amount || 0) === Number(amountInput?.value || 0)
    );

    const placeName = matched?.placeName || merchantInput.value || '';
    const placeAddress = matched?.placeAddress || '';
    const latitude = matched?.latitude || '';
    const longitude = matched?.longitude || '';

    const wrap = document.createElement('label');
    wrap.innerHTML = `
      <span class="spot-label">지점명 <span class="text-[#D17D19]">· 지도 표시용</span></span>
      <div class="flex gap-2">
        <input name="placeName" class="spot-field flex-1" value="${this.escapeAttr(placeName)}" placeholder="예: 스타벅스 강남R점">
        <button type="button" data-place-search class="spot-btn-secondary whitespace-nowrap">지도 찾기</button>
      </div>
      <div data-place-result class="text-[10px] text-slate-400 mt-1">상호명과 별개의 데이터로 저장됩니다.</div>
      <input type="hidden" name="placeAddress" value="${this.escapeAttr(placeAddress)}">
      <input type="hidden" name="latitude" value="${this.escapeAttr(latitude)}">
      <input type="hidden" name="longitude" value="${this.escapeAttr(longitude)}">`;

    merchantInput.closest('label')?.insertAdjacentElement('afterend', wrap);

    wrap.querySelector('[data-place-search]')?.addEventListener('click', async () => {
      const input = wrap.querySelector('[name="placeName"]');
      const keyword = String(input?.value || '').trim();
      const resultText = wrap.querySelector('[data-place-result]');
      if (!keyword) {
        if (resultText) resultText.textContent = '먼저 지점명을 입력해 주세요.';
        return;
      }

      try {
        await this.ensureMap();
        const place = await this.findPlace(keyword);
        if (!place) {
          if (resultText) resultText.textContent = '카카오맵에서 이 지점을 찾지 못했어요.';
          return;
        }
        wrap.querySelector('[name="placeAddress"]').value = place.road_address_name || place.address_name || '';
        wrap.querySelector('[name="latitude"]').value = place.y || '';
        wrap.querySelector('[name="longitude"]').value = place.x || '';
        if (resultText) resultText.textContent = `✓ ${place.place_name} · ${place.road_address_name || place.address_name || ''}`;
        input.value = place.place_name || keyword;
        this.panTo(Number(place.y), Number(place.x));
      } catch (error) {
        console.warn('SPOT place search:', error);
        if (resultText) resultText.textContent = '지도 검색을 사용할 수 없어요. API 설정을 확인해 주세요.';
      }
    });
  }

  async ensureMap() {
    if (this.map) {
      this.map.relayout?.();
      return this.map;
    }
    if (!this.mapNode) return null;

    try {
      await this.loadKakaoSdk();
      const center = new kakao.maps.LatLng(this.defaultCenter.lat, this.defaultCenter.lng);
      this.map = new kakao.maps.Map(this.mapNode, { center, level: 5 });
      this.places = new kakao.maps.services.Places();
      this.infoWindow = new kakao.maps.InfoWindow({ zIndex: 10 });
      this.setStatus('지도를 드래그하거나 확대·축소할 수 있어요.');
      await this.renderMarkers();
      return this.map;
    } catch (error) {
      console.error('SPOT Kakao Map:', error);
      const message = String(error.message || '').includes('KAKAO_MAP_JS_KEY')
        ? 'KAKAO_MAP_JS_KEY를 Vercel에 설정해 주세요.'
        : '카카오맵을 불러오지 못했어요.';
      this.setStatus(message);
      return null;
    }
  }

  async loadKakaoSdk() {
    if (window.kakao?.maps?.services) return;
    if (this.sdkPromise) return this.sdkPromise;

    this.sdkPromise = (async () => {
      const response = await fetch('/api/kakao-config', { cache: 'no-store' });
      const config = await response.json().catch(() => ({}));
      if (!response.ok || !config.appKey) throw new Error(config.error || 'KAKAO_MAP_JS_KEY가 설정되지 않았습니다.');

      await new Promise((resolve, reject) => {
        const existing = document.getElementById('spot-kakao-sdk');
        if (existing) {
          if (window.kakao?.maps) return window.kakao.maps.load(resolve);
          existing.addEventListener('load', () => window.kakao.maps.load(resolve), { once: true });
          existing.addEventListener('error', reject, { once: true });
          return;
        }
        const script = document.createElement('script');
        script.id = 'spot-kakao-sdk';
        script.async = true;
        script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(config.appKey)}&libraries=services&autoload=false`;
        script.onload = () => window.kakao.maps.load(resolve);
        script.onerror = () => reject(new Error('Kakao Maps SDK 로드 실패'));
        document.head.appendChild(script);
      });
    })();

    return this.sdkPromise;
  }

  async renderMarkers() {
    if (!this.map || !this.places) return;
    this.clearMarkers();

    const expenses = Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [];
    const groups = new Map();
    expenses.forEach(expense => {
      const placeName = String(expense.placeName || '').trim();
      if (!placeName) return;
      if (!groups.has(placeName)) groups.set(placeName, []);
      groups.get(placeName).push(expense);
    });

    if (!groups.size) {
      this.setStatus('지출에 지점명을 입력하면 지도에 표시돼요.');
      this.renderEmptyDetail();
      return;
    }

    let changed = false;
    const positions = [];

    for (const [placeName, items] of groups.entries()) {
      let lat = Number(items.find(item => Number(item.latitude))?.latitude);
      let lng = Number(items.find(item => Number(item.longitude))?.longitude);
      let address = items.find(item => item.placeAddress)?.placeAddress || '';

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        const place = await this.findPlace(placeName).catch(() => null);
        if (!place) continue;
        lat = Number(place.y);
        lng = Number(place.x);
        address = place.road_address_name || place.address_name || '';
        items.forEach(item => {
          item.latitude = lat;
          item.longitude = lng;
          item.placeAddress = address;
        });
        changed = true;
      }

      const position = new kakao.maps.LatLng(lat, lng);
      positions.push(position);
      const marker = new kakao.maps.Marker({ map: this.map, position, title: placeName });
      this.markers.push(marker);
      kakao.maps.event.addListener(marker, 'click', () => {
        this.map.panTo(position);
        this.showPlaceDetail(placeName, items, address);
        this.infoWindow?.setContent(`<div style="padding:6px 9px;font-size:11px;font-weight:700;white-space:nowrap">${this.escapeHtml(placeName)}</div>`);
        this.infoWindow?.open(this.map, marker);
      });
    }

    if (changed && this.expenseManager?.save) this.expenseManager.save();
    this.setStatus(`저장된 소비 지점 ${this.markers.length}곳`);
    if (positions.length) this.fitPositions(positions);
  }

  scheduleRender() {
    clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => {
      if (this.map) this.renderMarkers();
    }, 180);
  }

  clearMarkers() {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    this.infoWindow?.close?.();
  }

  async findPlace(keyword) {
    await this.loadKakaoSdk();
    if (!this.places) this.places = new kakao.maps.services.Places();
    return new Promise(resolve => {
      this.places.keywordSearch(keyword, (data, status) => {
        if (status === kakao.maps.services.Status.OK && data?.length) resolve(data[0]);
        else resolve(null);
      });
    });
  }

  async searchAndPan(keyword) {
    const place = await this.findPlace(keyword);
    if (!place) {
      this.setStatus(`'${keyword}' 검색 결과가 없어요.`);
      return;
    }
    const lat = Number(place.y);
    const lng = Number(place.x);
    this.panTo(lat, lng);
    this.setStatus(`${place.place_name}으로 이동했어요.`);
  }

  panTo(lat, lng) {
    if (!this.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    this.map.panTo(new kakao.maps.LatLng(lat, lng));
  }

  moveToCurrentLocation() {
    if (!navigator.geolocation) {
      this.setStatus('이 브라우저는 위치 기능을 지원하지 않아요.');
      return;
    }
    this.setStatus('현재 위치를 확인하는 중…');
    navigator.geolocation.getCurrentPosition(
      position => {
        this.panTo(position.coords.latitude, position.coords.longitude);
        this.map?.setLevel?.(4);
        this.setStatus('현재 위치로 이동했어요.');
      },
      () => this.setStatus('위치 권한이 필요해요.'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    );
  }

  fitToSavedPlaces() {
    if (!this.map || !this.markers.length) return;
    const bounds = new kakao.maps.LatLngBounds();
    this.markers.forEach(marker => bounds.extend(marker.getPosition()));
    this.map.setBounds(bounds, 40, 40, 40, 40);
  }

  fitPositions(positions) {
    if (!this.map || !positions.length) return;
    if (positions.length === 1) {
      this.map.setCenter(positions[0]);
      this.map.setLevel(4);
      return;
    }
    const bounds = new kakao.maps.LatLngBounds();
    positions.forEach(position => bounds.extend(position));
    this.map.setBounds(bounds, 40, 40, 40, 40);
  }

  showPlaceDetail(placeName, expenses, address) {
    if (!this.detailCard) return;
    const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const visits = new Set(expenses.map(item => String(item.date || '').slice(0, 10))).size;
    const latest = [...expenses].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];

    this.detailCard.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <div class="text-sm font-black text-[#161616] truncate">${this.escapeHtml(placeName)}</div>
          <div class="text-[10px] text-[#77736C] mt-0.5 truncate">${this.escapeHtml(address || '주소 정보 없음')}</div>
        </div>
        <span class="spot-stat-pill">지도 지점</span>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center border-y border-slate-100 py-2.5 mb-3 text-xs">
        <div><div class="text-[#77736C] text-[11px]">방문일</div><div class="font-black text-[#08233D]">${visits}일</div></div>
        <div><div class="text-[#77736C] text-[11px]">결제</div><div class="font-black text-[#08233D]">${expenses.length}회</div></div>
        <div><div class="text-[#77736C] text-[11px]">총 지출</div><div class="font-black text-[#D17D19]">${this.money(total)}</div></div>
      </div>
      <div class="flex justify-between items-center text-[11px] text-[#77736C]">
        <span>최근 결제 ${latest ? this.formatDate(latest.date) : '-'}</span>
        <span class="font-black text-[#08233D]">${latest ? this.escapeHtml(latest.category || '기타') : ''}</span>
      </div>`;
  }

  renderEmptyDetail() {
    if (!this.detailCard) return;
    this.detailCard.innerHTML = `
      <div class="text-sm font-black text-[#161616] mb-1">아직 지도 지점이 없어요</div>
      <div class="text-[11px] text-[#77736C] leading-relaxed">지출을 추가하거나 수정할 때 ‘지점명’을 입력하면 카카오맵에서 위치를 찾아 마커로 표시해요.</div>`;
  }

  setStatus(message) {
    if (!this.status) return;
    this.status.innerHTML = `<span class="inline-block bg-white/95 px-2.5 py-1 rounded-lg text-[10px] font-bold text-[#08233D] shadow border border-slate-200">${this.escapeHtml(message)}</span>`;
  }

  money(value) {
    return `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  }

  formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  escapeAttr(value) {
    return this.escapeHtml(value);
  }
}

window.MapManager = MapManager;
