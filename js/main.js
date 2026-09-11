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

    loadScript('js/DataPipeline.js', () => {
      loadScript('js/ExpenseManager.js', async () => {
        const expenseManager = new ExpenseManager(document, app);

        // OCR 원문을 데이터 파이프라인에서 정형 레코드로 변환합니다.
        // 파이프라인에 문제가 생기면 기존 파서를 자동으로 사용합니다.
        const fallbackParseReceipt = expenseManager.parseReceipt.bind(expenseManager);
        expenseManager.parseReceipt = text => {
          try {
            const structured = window.SPOTDataPipeline?.receiptToExpense?.(text);
            return structured || fallbackParseReceipt(text);
          } catch (error) {
            console.warn('SPOT DataPipeline 변환 실패. 기존 OCR 파서를 사용합니다.', error);
            return fallbackParseReceipt(text);
          }
        };

        window.spotExpenseManager = expenseManager;
        expenseManager.start();

        try {
          await spotDB.hydrateManager(expenseManager);
          console.info('SPOT IndexedDB 연결 완료');
        } catch (error) {
          console.error('SPOT IndexedDB 초기화 실패. 기존 로컬 저장소를 사용합니다.', error);
        }

        const startFeatureManagers = () => {
          loadScript('js/BioManager.js', async () => {
            const bioManager = new BioManager(document, spotDB);
            window.spotBioManager = bioManager;
            await bioManager.start();

            loadScript('js/AdditiveManager.js', () => {
              const additiveManager = new AdditiveManager(document);
              window.spotAdditiveManager = additiveManager;
              additiveManager.start();
            }, 'AdditiveManager.js를 불러오지 못했습니다.');
          }, 'BioManager.js를 불러오지 못했습니다.');

          loadScript('js/MapManager.js', () => {
            const mapManager = new MapManager(document, expenseManager);
            window.spotMapManager = mapManager;
            mapManager.start();
          }, 'MapManager.js를 불러오지 못했습니다.');

          loadScript('js/AnalyticsManager.js', () => {
            const analyticsManager = new AnalyticsManager(document, expenseManager);
            analyticsManager.categoryDescriptions = {
              ...analyticsManager.categoryDescriptions,
              '한식': '국밥, 찌개, 백반, 고기류 등 한식 중심의 식사 소비예요.',
              '분식': '떡볶이, 김밥, 순대, 튀김 등 분식류 소비예요.',
              '일식': '초밥, 라멘, 돈카츠 등 일식류 소비예요.',
              '중식': '짜장면, 짬뽕, 마라 등 중식류 소비예요.',
              '양식': '파스타, 스테이크, 리조또 등 양식류 소비예요.',
              '패스트푸드': '햄버거, 치킨, 피자 등 빠르게 소비하는 외식 항목이에요.',
              '음료': '커피, 차, 탄산, 주스 등 음료 소비예요.',
              '간식': '과자, 빵, 디저트, 아이스크림 등 간식 소비예요.',
              '편의점·마트': '편의점이나 마트에서 구매한 식품·음료 소비예요.',
              '기타 식품': '다른 식품 분류에 포함되지 않은 식품 소비예요.'
            };
            window.spotAnalyticsManager = analyticsManager;
            analyticsManager.start();

            loadScript('js/TimeAnalyticsManager.js', () => {
              const timeAnalyticsManager = new TimeAnalyticsManager(document, expenseManager, analyticsManager);
              window.spotTimeAnalyticsManager = timeAnalyticsManager;
              timeAnalyticsManager.start();
            }, 'TimeAnalyticsManager.js를 불러오지 못했습니다.');
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

        loadScript('js/FoodCategoryManager.js', () => {
          const foodCategoryManager = new FoodCategoryManager(document, expenseManager);
          window.spotFoodCategoryManager = foodCategoryManager;
          foodCategoryManager.start();

          loadScript('js/LanguageManager.js', async () => {
            const languageManager = new LanguageManager(document, spotDB);
            window.spotLanguageManager = languageManager;
            await languageManager.start();
            startFeatureManagers();
          }, 'LanguageManager.js를 불러오지 못했습니다.');
        }, 'FoodCategoryManager.js를 불러오지 못했습니다.');
      }, 'ExpenseManager.js를 불러오지 못했습니다.');
    }, 'DataPipeline.js를 불러오지 못했습니다.');
  }, 'SpotDB.js를 불러오지 못했습니다.');
})();
