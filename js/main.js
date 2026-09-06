// defer 스크립트는 HTML 파싱 후 순서대로 실행됩니다.
// 전역 switchScreen 함수와 인라인 이벤트 없이 앱을 시작합니다.
(() => {
  const app = new SpotApp(document);
  app.start();
})();
