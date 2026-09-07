// defer 스크립트는 HTML 파싱 후 순서대로 실행됩니다.
// 전역 switchScreen 함수와 인라인 이벤트 없이 앱을 시작합니다.
(() => {
  const app = new SpotApp(document);
  window.spotApp = app;
  app.start();

  const script = document.createElement('script');
  script.src = 'js/ExpenseManager.js';
  script.onload = () => {
    const expenseManager = new ExpenseManager(document, app);
    window.spotExpenseManager = expenseManager;
    expenseManager.start();
  };
  script.onerror = () => console.error('ExpenseManager.js를 불러오지 못했습니다.');
  document.body.appendChild(script);
})();
