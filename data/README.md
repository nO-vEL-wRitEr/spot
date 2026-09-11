# SPOT Data Layer

SPOT의 데이터 계층은 **비정형 입력 → 정규화 → 정형 레코드 → 임베딩 준비 데이터** 흐름을 기준으로 구성합니다.

> 중요: 실제 사용자의 영수증, 메모, 알레르기 정보 같은 개인 데이터는 GitHub `data/` 폴더에 저장하지 않습니다. 런타임 데이터는 IndexedDB에 저장하고, 이 폴더에는 스키마·예시·변환 규칙만 둡니다.

## 구조

```text
data/
├─ README.md
├─ raw/
│  └─ sample-receipt.txt
├─ processed/
│  ├─ sample-expense.json
│  └─ sample-embedding-record.json
└─ schemas/
   └─ expense.schema.json
```

## 파이프라인

### 1. raw
OCR 결과, 메모, CSV 행, 상품 설명처럼 아직 필드가 나뉘지 않은 비정형/반정형 입력입니다.

예:

```text
스타벅스 서면점
아메리카노 4500
샌드위치 6800
합계 11300원
2026-09-11 14:32
```

### 2. normalize / extract
`js/DataPipeline.js`가 문자열을 정리하고 다음 값을 추출합니다.

- merchant
- amount
- category
- date
- source
- rawText
- tokens
- features

### 3. structured
앱에서 통계, 지도, AI 분석에 바로 사용할 수 있는 객체입니다.

```json
{
  "merchant": "스타벅스 서면점",
  "amount": 11300,
  "category": "카페",
  "date": "2026-09-11T14:32",
  "source": "ocr"
}
```

### 4. embedding-ready
정형 레코드의 핵심 정보를 한 문장으로 합쳐 임베딩 모델에 넣기 좋은 텍스트를 만듭니다.

```text
상호 스타벅스 서면점 | 카테고리 카페 | 금액 11300원 | 시간대 오후 | 메모 아메리카노 샌드위치
```

실제 임베딩 벡터는 추후 Gemini/OpenAI/로컬 임베딩 모델 등을 연결할 때 생성합니다.

## 왜 정형화와 임베딩을 분리하나

정형화는 **분석 가능한 필드 생성**이 목적이고, 임베딩은 **유사도·검색·군집화**가 목적입니다.

예를 들어:

- SQL/통계: `카페 카테고리 월 총액`
- 임베딩: `비슷한 소비 패턴`, `유사한 영수증`, `비슷한 음식/성분` 검색

두 계층을 분리하면 데이터 분석과 AI 검색을 동시에 확장하기 쉽습니다.
