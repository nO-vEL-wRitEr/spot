/** 하나의 화면의 표시 상태와 스크롤을 관리합니다. */
class Screen {
  constructor(element) {
    this.element = element;
    this.id = element.id;
  }

  setActive(active) {
    this.element.classList.toggle('active', active);
    this.element.setAttribute('aria-hidden', String(!active));
    if (active) this.element.scrollTop = 0;
  }
}
