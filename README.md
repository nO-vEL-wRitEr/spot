# SPOT — 객체 지향 UI 프로토타입

첨부된 Spot 디자인 HTML의 화면과 CSS를 유지하며 화면 전환 코드를 역할별 JavaScript 클래스로 분리했습니다. 프레임워크와 빌드 과정 없이 사용할 수 있습니다.

## 실행

압축을 풀고 `index.html`을 브라우저에서 엽니다. 파일을 분리한 상태이므로 `css/`, `js/` 폴더도 함께 보관하세요. Tailwind CDN과 웹폰트는 인터넷 연결이 필요합니다.

로컬 서버를 선호한다면 프로젝트 폴더에서 `python3 -m http.server 8000`을 실행하고 `http://localhost:8000`을 엽니다.

## 파일과 역할

| 파일 | 역할 |
| --- | --- |
| index.html | 기존 12개 화면의 마크업과 데모 데이터 |
| css/styles.css | 기존 폰트, 색상, 레이아웃, 애니메이션 |
| js/Screen.js | 개별 화면 표시와 스크롤 관리 |
| js/NavigationView.js | 상단 선택기와 하단 탭 동기화 |
| js/ScreenRouter.js | 유효한 화면으로 전환, 현재 화면 상태 관리 |
| js/SpotApp.js | 객체 생성 및 클릭·선택·키보드 이벤트 연결/해제 |
| js/main.js | 앱 시작 |
| tests/navigation.cjs | 실제 브라우저에서 전체 화면 전환 검증 |

ScreenRouter가 Screen과 NavigationView 객체를 조합하고, SpotApp이 이들을 구성합니다. 불필요한 상속 없이 각 클래스의 책임을 나눴습니다. HTML의 `data-screen` 속성으로 이동할 화면을 지정합니다. 직접 파일을 열어 미리볼 수 있도록 ES 모듈 대신 순서가 지정된 defer 스크립트를 사용합니다.

## 원본 대비 개선

- HTML 안의 onclick/onchange 및 전역 switchScreen 함수 제거
- 잘못된 화면 ID로 이동하면 기존 화면 유지
- 클릭 가능한 카드에 키보드 Enter/Space 이동 지원
- 활성 화면과 탭에 접근성 상태 추가
- 중복 이벤트 등록 방지와 이벤트 해제 제공

## 구현 범위

작동하는 기능은 12개 화면 이동, 탭·선택기 동기화, 화면 전환 시 스크롤 초기화입니다. 기존 버튼의 경로와 화면 문구, 예시 값은 그대로 유지했습니다.

OCR 촬영/분석, AI 대화, 영수증 저장, 실제 지도/GPS, 로그인, 알레르기 정보 편집, 추가 시뮬레이션은 아직 구현되지 않았습니다. 저장 버튼도 원본처럼 홈 화면으로 이동할 뿐입니다. 성분·알레르기·소비 분석 화면은 고정된 시안이며 실제 분석 결과가 아닙니다.

## GitHub 업로드

1. ZIP을 압축 해제합니다.
2. 저장소의 Add file → Upload files에서 이 폴더 안의 파일과 css/js/tests 폴더를 올립니다.
3. 저장소 루트에 index.html이 위치하도록 합니다.
4. Commit changes로 저장합니다.

GitHub Pages 등에 올릴 때 별도 빌드는 필요 없습니다. Tailwind CDN을 유지한 디자인 프로토타입이며 서비스 출시 전에는 CSS 빌드와 실제 데이터/API 연결이 필요합니다. API 비밀키는 공개 JavaScript에 넣지 않습니다.

## 검증

Node.js 환경에서 `npm install --no-save playwright` 및 `npx playwright install chromium` 후 `node tests/navigation.cjs`를 실행합니다. 전체 화면 선택, 기존 모든 이동 버튼, 하단 탭 매핑, 키보드 이동, 잘못된 경로 처리와 이벤트 해제를 검사합니다. 테스트는 외부 CDN을 차단하므로 시각적 스타일 검증은 포함하지 않습니다.

### 이 작업 환경의 검증 결과

`node tests/router.cjs` 통과: 12개 화면, 32개 이동 링크, 단일 활성 화면, 잘못된 경로 유지. 모든 JavaScript 문법 검사와 원본 마크업/CSS 보존 비교도 통과했습니다. 브라우저 실행 파일이 없어 navigation.cjs의 브라우저 검증과 시각 검증은 실행 완료하지 못했습니다.
