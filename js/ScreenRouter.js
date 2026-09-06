/** 화면 전환을 조율합니다. 잘못된 목적지는 현재 화면을 유지합니다. */
class ScreenRouter {
  constructor(screens, navigation) {
    this.screens = new Map(screens.map(screen => [screen.id, screen]));
    this.navigation = navigation;
    this.currentScreenId = null;
  }

  navigate(screenId) {
    if (!this.screens.has(screenId)) return false;
    for (const screen of this.screens.values()) {
      screen.setActive(screen.id === screenId);
    }
    this.navigation.render(screenId);
    this.currentScreenId = screenId;
    return true;
  }
}
