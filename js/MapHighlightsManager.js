class MapHighlightsManager {
  constructor(mapManager = window.spotMapManager, expenseManager = window.spotExpenseManager) {
    this.mapManager = mapManager;
    this.expenseManager = expenseManager;
    this.featuredOverlays = [];
  }

  start() {
    if (!this.mapManager || this.mapManager.__featuredHighlightsWrapped) return;
    this.mapManager.__featuredHighlightsWrapped = true;

    const originalRenderMarkers = this.mapManager.renderMarkers.bind(this.mapManager);
    this.mapManager.renderMarkers = async (...args) => {
      const result = await originalRenderMarkers(...args);
      this.renderFeaturedOverlays();
      return result;
    };

    const originalClearMarkers = this.mapManager.clearMarkers.bind(this.mapManager);
    this.mapManager.clearMarkers = (...args) => {
      this.clearFeaturedOverlays();
      return originalClearMarkers(...args);
    };

    if (this.mapManager.map) this.renderFeaturedOverlays();
  }

  getPlaceStats() {
    const expenses = Array.isArray(this.expenseManager?.expenses) ? this.expenseManager.expenses : [];
    const groups = new Map();

    expenses.forEach(expense => {
      const placeName = String(expense.placeName || '').trim();
      const lat = Number(expense.latitude);
      const lng = Number(expense.longitude);
      if (!placeName || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

      if (!groups.has(placeName)) {
        groups.set(placeName, {
          placeName,
          address: expense.placeAddress || '',
          lat,
          lng,
          items: []
        });
      }
      groups.get(placeName).items.push(expense);
    });

    return [...groups.values()].map(group => {
      const visits = new Set(group.items.map(item => String(item.date || '').slice(0, 10))).size;
      const purchases = group.items.length;
      const total = group.items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...group, visits, purchases, total };
    });
  }

  renderFeaturedOverlays() {
    this.clearFeaturedOverlays();
    const map = this.mapManager?.map;
    if (!map || !window.kakao?.maps?.CustomOverlay) return;

    const topThree = this.getPlaceStats()
      .sort((a, b) => b.visits - a.visits || b.purchases - a.purchases || b.total - a.total)
      .slice(0, 3);

    topThree.forEach((place, index) => {
      const position = new kakao.maps.LatLng(place.lat, place.lng);
      const content = document.createElement('button');
      content.type = 'button';
      content.className = 'spot-map-featured-popup';
      content.style.cssText = [
        'display:block',
        'min-width:138px',
        'max-width:180px',
        'padding:8px 10px',
        'background:#fffdf8',
        'border:1px solid #E7D1A0',
        'border-radius:10px',
        'box-shadow:0 7px 20px rgba(8,35,61,.16)',
        'text-align:left',
        'font-family:inherit',
        'cursor:pointer'
      ].join(';');
      content.innerHTML = `
        <div style="font-size:9px;font-weight:900;color:#9B701C;margin-bottom:2px">TOP ${index + 1} 소비 지점</div>
        <div style="font-size:11px;font-weight:900;color:#08233D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(place.placeName)}</div>
        <div style="font-size:9px;color:#77736C;margin-top:3px">방문 ${place.visits}일 · 구매 ${place.purchases}회</div>
        <div style="font-size:10px;font-weight:900;color:#D17D19;margin-top:2px">${this.money(place.total)}</div>`;

      content.addEventListener('click', event => {
        event.stopPropagation();
        this.mapManager.map?.panTo(position);
        this.mapManager.showPlaceDetail?.(place.placeName, place.items, place.address);
      });

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position,
        content,
        xAnchor: 0.5,
        yAnchor: 1.45,
        zIndex: 7
      });
      this.featuredOverlays.push(overlay);
    });
  }

  clearFeaturedOverlays() {
    this.featuredOverlays.forEach(overlay => overlay.setMap(null));
    this.featuredOverlays = [];
  }

  money(value) {
    return `₩${Number(value || 0).toLocaleString('ko-KR')}`;
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }
}

window.MapHighlightsManager = MapHighlightsManager;
