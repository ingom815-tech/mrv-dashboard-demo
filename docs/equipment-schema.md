# 설비 커스텀 설정 스키마 (SaaS 전제)

고객사가 자기 공장의 설비와 계측 연결을 직접 등록하는 기능의 데이터 정의.
데모 단계는 localStorage 저장이며, SaaS 전환 시 **동일 스키마**를 서버 API로 옮긴다.

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `src/config/equipmentTypes.json` | 설비 유형 템플릿(계측 항목·필수/선택·단위·환산 기준 연결) — 유형 추가는 배열에 항목 추가 |
| `src/config/equipmentStore.ts` | 데이터 접근 계층 + 반응형 스토어(zustand). load/save 함수만 교체하면 서버 저장으로 전환 |
| `src/screens/EquipConfig.tsx` | 관리자 모드 > 설비 설정 화면 (목록·3단계 등록 폼·편집·삭제 확인 모달) |

## 유형 템플릿 (`equipmentTypes.json`)

```jsonc
{
  "types": [{
    "key": "chiller",            // 유형 식별자
    "name": "냉열원 (칠러·히트펌프)",
    "fields": [{
      "key": "elec_kwh",         // 계측 항목 식별자
      "label": "전력 사용량",     // 표시명
      "unit": "kWh",
      "required": true,          // 필수 여부 — 화면에서 잠금(해제 불가)
      "efLink": true             // 기본 배출계수(환산 기준) 연결 여부
    }]
  }],
  "sources": ["수기입력", "CSV 업로드", "커넥터(데모 합성데이터)"]
}
```

초기 유형 3종: 냉열원(chiller) / 공조(ahu) / 보일러·열원(boiler).

## 설비 레코드 (`EquipmentRec`)

```ts
{
  id: "EQ-01",
  name: "냉동기 1 (CH-01)",
  type: "chiller",              // TypeDef.key
  location: "냉수플랜트",
  phase: "도입 후",             // 개선 설비 여부 (도입 전/후)
  fields: {                     // 항목별 연결 설정
    elec_kwh: { on: true, source: "커넥터(데모 합성데이터)" },
    ...
  },
  demo: true,                   // 데모 합성데이터 연동 설비 (삭제 불가)
  engineTag: "CH1_kW"           // 산정 엔진 태그 매핑 (아래 참조)
}
```

## 규칙

- **필수 항목**: 유형 템플릿의 `required: true` 항목은 항상 연결 상태로 고정(화면에서 잠금 아이콘·해제 불가).
  하나라도 꺼진 설비는 `requiredOk() = false` → **산정 대상 제외** + 목록에 주의색 배지.
- **데모 설비**(demo: true) 5개는 엔진 합성데이터와 매핑되어 삭제 불가. 신규 설비는 필수 충족 시
  "수집 대기"로 표시(데모에는 해당 설비의 합성데이터가 없음 — 허위 수치 미표시 원칙).
- 전역 설정(`EquipSettings`): 반기 목표 감축량(tCO₂e). 전력 단가·적용 환산 기준(배출계수)은
  기존 기준정보(store.ts의 tariffValue·efList)를 그대로 읽는다 — 이중 관리 금지.

## 산정 엔진과의 관계 (엔진 무수정 원칙)

엔진(engine/synth.js → engine/mrv.js)은 냉수플랜트 15태그 고정 파이프라인이다:

- 입력: `rows[{date, post, excl, v{CH1_kW·CH2_kW·CHWP_kW·CWP_kW·CT_kW·SYS_kW·CHW_flow·CHW_sT·CHW_rT·Q_th·CW_inT·OAT·WBT·PROD·CH_n}, s{상태코드}}]`
- 체인: `aggregateDaily(data)` → `fitBaseline(일별)` → `computeSavings(daily, bl, cfg, nonRoutine, ef, tariff)`
- 프론트 주입값: 승인된 비일상적 조정(nrStatus), 배출계수(efValue), 단가(tariffValue) — `src/lib/useCalc.ts`

따라서 설비 설정은 다음 범위에서 엔진과 연동된다:

1. `engineTag`(CH1_kW 등)가 있는 데모 설비 → `computeSavings`의 설비별 기여(contrib: ch1·ch2·chwp·cwp·ct)에 매핑되어 설비별 성과 화면에 실산정값 표시.
2. 신규 설비는 화면 구성·산정 대상 판정까지만 동작 (엔진에 해당 태그의 데이터가 없음).

## SaaS 전환 방법

1. `equipmentStore.ts`의 `load()`/`save()` 두 함수를 서버 API(GET/PUT `/sites/{id}/equipment`, `/settings`)로 교체 — 스키마 그대로 직렬화.
2. 유형 템플릿은 서버 마스터 데이터로 승격(`GET /equipment-types`), JSON 구조 동일.
3. 수집 파이프라인: 각 설비의 `fields[].source`에 따라 커넥터/CSV 수집기가 태그를 생성하고,
   엔진(또는 서버 산정 서비스)에 설비군별 태그 세트를 전달 — `engineTag`가 그 매핑 키가 된다.
4. `demo` 플래그 제거, 삭제 정책은 서버 권한(승인자)으로 대체.

> 비고: 모든 값은 DEMO · 합성데이터. ISO 14064-2 준거 표기는 현재 문서 준거(ESCO M&V·ISO 50006·지침 별지·IEC 61724-1)에 없어 사용하지 않으며, 준거 문서 확보 시 추가 후보로 남긴다.
