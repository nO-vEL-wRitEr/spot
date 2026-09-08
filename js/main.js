// defer 스크립트는 HTML 파싱 후 순서대로 실행됩니다.
// 전역 switchScreen 함수와 인라인 이벤트 없이 앱을 시작합니다.
(() => {
  const app = new SpotApp(document);
  window.spotApp = app;
  app.start();

  const loadScript = (src, onload, onerrorMessage) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = onload;
    script.onerror = () => console.error(onerrorMessage);
    document.body.appendChild(script);
  };

  loadScript('js/SpotDB.js', () => {
    const spotDB = new SpotDB();
    window.spotDB = spotDB;

    loadScript('js/ExpenseManager.js', async () => {
      const expenseManager = new ExpenseManager(document, app);
      window.spotExpenseManager = expenseManager;
      expenseManager.start();

      try {
        await spotDB.hydrateManager(expenseManager);
        console.info('SPOT IndexedDB 연결 완료');
      } catch (error) {
        console.error('SPOT IndexedDB 초기화 실패. 기존 로컬 저장소를 사용합니다.', error);
      }

      const startFeatureManagers = () => {
        loadScript('js/MapManager.js', () => {
          const mapManager = new MapManager(document, expenseManager);
          window.spotMapManager = mapManager;
          mapManager.start();
        }, 'MapManager.js를 불러오지 못했습니다.');

        loadScript('js/AnalyticsManager.js', () => {
          const analyticsManager = new AnalyticsManager(document, expenseManager);
          window.spotAnalyticsManager = analyticsManager;
          analyticsManager.start();
        }, 'AnalyticsManager.js를 불러오지 못했습니다.');

        loadScript('js/AIInsight.js', () => {
          const aiInsight = new AIInsight(document, expenseManager);
          window.spotAIInsight = aiInsight;
          aiInsight.start();

          loadScript('js/AIChat.js', () => {
            const aiChat = new AIChat(document, expenseManager, aiInsight);
            window.spotAIChat = aiChat;
            aiChat.start();
          }, 'AIChat.js를 불러오지 못했습니다.');
        }, 'AIInsight.js를 불러오지 못했습니다.');
      };

      loadScript('js/LanguageManager.js', async () => {
        const languageManager = new LanguageManager(document, spotDB);
        window.spotLanguageManager = languageManager;
        await languageManager.start();
        startFeatureManagers();
      }, 'LanguageManager.js를 불러오지 못했습니다.');
    }, 'ExpenseManager.js를 불러오지 못했습니다.');
  }, 'SpotDB.js를 불러오지 못했습니다.');
})();
