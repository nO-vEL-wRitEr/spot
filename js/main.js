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

            loadScript('js/MapHighlightsManager.js', () => {
              const mapHighlightsManager = new MapHighlightsManager(mapManager, expenseManager);
              window.spotMapHighlightsManager = mapHighlightsManager;
              mapHighlightsManager.start();
            }, 'MapHighlightsManager.js를 불러오지 못했습니다.');
          }, 'MapManager.js를 불러오지 못했습니다.');

          loadScript('js/AnalyticsManager.js', () => {
            const analyticsManager = new AnalyticsManager(document, expenseManager);
            analyticsManager.categoryDescriptions = {
              ...analyticsManager.categoryDescriptions,
              '식비': '외식, 배달, 카페, 장보기, 편의점, 간식을 묶어 가장 깊게 분석하는 핵심 소비 영역이에요.',
              '쇼핑': '의류, 화장품, 잡화 등 상품 구매에 사용된 소비예요.',
              '교통': '대중교통, 택시, 이동 서비스 등에 사용된 소비예요.',
              '생활': '일상생활 유지에 필요한 서비스나 생활비 소비예요.',
              '기타': '기존 분류에 포함되지 않은 소비예요.'
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

          loadScript('js/ProductExperienceManager.js', () => {
            const productExperienceManager = new ProductExperienceManager(document, expenseManager);
            window.spotProductExperienceManager = productExperienceManager;
            productExperienceManager.start();

            loadScript('js/LanguageManager.js', async () => {
              const languageManager = new LanguageManager(document, spotDB);
              window.spotLanguageManager = languageManager;
              await languageManager.start();
              startFeatureManagers();
            }, 'LanguageManager.js를 불러오지 못했습니다.');
          }, 'ProductExperienceManager.js를 불러오지 못했습니다.');
        }, 'FoodCategoryManager.js를 불러오지 못했습니다.');
      }, 'ExpenseManager.js를 불러오지 못했습니다.');
    }, 'DataPipeline.js를 불러오지 못했습니다.');
  }, 'SpotDB.js를 불러오지 못했습니다.');
})();
