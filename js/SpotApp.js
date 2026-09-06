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
    this.router.navigate('view-home');
  }

  destroy() {
    this.root.removeEventListener('click', this.handleClick);
    this.root.removeEventListener('change', this.handleChange);
    this.root.removeEventListener('keydown', this.handleKeydown);
    this.started = false;
  }
}
