/** 상단 선택기와 하단 탭을 현재 화면에 맞춥니다. */
class NavigationView {
  constructor(root, tabByScreen) {
    this.select = root.querySelector('#screenRouter');
    this.tabs = [...root.querySelectorAll('.tab-btn')];
    this.tabByScreen = tabByScreen;
  }

  render(screenId) {
    if (this.select) this.select.value = screenId;
    for (const tab of this.tabs) {
      const active = tab.id === this.tabByScreen[screenId];
      tab.classList.toggle('active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
  }
}
