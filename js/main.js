// defer 스크립트는 HTML 파싱 후 순서대로 실행됩니다.
// 전역 switchScreen 함수와 인라인 이벤트 없이 앱을 시작합니다.
(() => {
  const app = new SpotApp(document);
  window.spotApp = app;
  app.start();

  const expenseScript = document.createElement('script');
  expenseScript.src = 'js/ExpenseManager.js';
  expenseScript.onload = () => {
    const expenseManager = new ExpenseManager(document, app);
    window.spotExpenseManager = expenseManager;
    expenseManager.start();

    const aiScript = document.createElement('script');
    aiScript.src = 'js/AIInsight.js';
    aiScript.onload = () => {
      const aiInsight = new AIInsight(document, expenseManager);
      window.spotAIInsight = aiInsight;
      aiInsight.start();

      const chatScript = document.createElement('script');
      chatScript.src = 'js/AIChat.js';
      chatScript.onload = () => {
        const aiChat = new AIChat(document, expenseManager, aiInsight);
        window.spotAIChat = aiChat;
        aiChat.start();
      };
      chatScript.onerror = () => console.error('AIChat.js를 불러오지 못했습니다.');
      document.body.appendChild(chatScript);
    };
    aiScript.onerror = () => console.error('AIInsight.js를 불러오지 못했습니다.');
    document.body.appendChild(aiScript);
  };
  expenseScript.onerror = () => console.error('ExpenseManager.js를 불러오지 못했습니다.');
  document.body.appendChild(expenseScript);
})();
