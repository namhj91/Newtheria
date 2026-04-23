# 13. NPC/PC 정보 템플릿

## 1) 목적
- PC(플레이어 캐릭터)와 NPC(비플레이어 캐릭터)에 동일한 데이터 틀을 적용한다.
- 캐릭터 생성/저장 시 필요한 핵심 항목(id, 고유 시드, 이름/성, 스탯, 성향, 숙원)을 표준화한다.

## 2) 공용 스키마 (요청 반영 템플릿)
```json
{
  "id": 0,
  "actorId": "asteria_npc",
  "uniqueSeed": "0123456789",
  "role": "pc | npc",
  "family": "000가문 | null",
  "givenName": "이름",
  "surname": "성(= family, family가 없으면 빈 문자열)",
  "name": "이름 성",
  "gender": "성별",
  "age": 20,
  "heightCm": 170,
  "weightKg": 60,
  "race": "종족",
  "raceInheritanceRule": "부모 종족 계승",
  "familyLinks": {
    "fatherId": null,
    "motherId": null,
    "childrenIds": []
  },
  "traits": {
    "innateTraitIds": [101, 103],
    "acquired": ["후천 특성"]
  },
  "layers": ["assets/img/example.png"],
  "stats": {
    "STR": 10,
    "DEX": 10,
    "CON": 10,
    "INT": 10,
    "WIS": 10,
    "CHA": 10
  },
  "alignment": {
    "aggressionVsModeration": 0,
    "settlementVsWandering": 0,
    "honorVsPragmatism": 0
  },
  "wallet": { "gold": 0, "silver": 0, "copper": 0 },
  "location": {
    "regionId": "sanctuary_outskirts",
    "tile": { "x": 0, "y": 0, "z": 0 },
    "landmarkId": "camp"
  },
  "inventory": {
    "maxSlots": 20,
    "items": [{ "itemId": "item_example", "qty": 1 }]
  },
  "aspiration": {
    "currentId": null,
    "poolId": 1
  }
}
```

## 2-1) 공용 풀 카탈로그 (외부 파일 분리 저장)
```json
{
  "selectionPolicy": {
    "description": "조건 충족 후보 필터 -> priority 정렬 -> rollRange 가중 추첨 -> 1개 확정"
  },
  "innateTraitCatalog": [
    { "id": 101, "code": "star_blessing", "name": "별의 가호", "effectHint": "야간 시야/탐지 보정" }
  ],
  "aspirationPoolCatalog": [
    { "id": 1, "key": "default", "aspirationIds": [201, 202] }
  ],
  "aspirationDefinitions": [
    { "id": 201, "code": "blood_revenge", "priority": 95, "rollRange": 24 },
    { "id": 202, "code": "world_best_merchant", "priority": 80, "rollRange": 20 }
  ]
}
```

## 2-2) 세이브에는 참조만 저장
```json
{
  "catalogRefs": {
    "characterPools": "assets/data/character_common_pools.json"
  },
  "characters": {
    "pilgrim_pc": { "familyLinks": { "fatherId": null, "motherId": null, "childrenIds": [] }, "traits": { "innateTraitIds": [101, 103] }, "aspiration": { "currentId": null, "poolId": 1 } }
  }
}
```

## 3) 필드 규칙
- `id`: 0부터 시작하는 정수. (세이브 슬롯 내부에서 중복 금지)
- 현재 고정 매핑: `0=아스테리아`, `1=플레이어(순례자)`.
- `uniqueSeed`: 각 자리가 0~9로만 구성된 **10자리 숫자 문자열**.
- `family`: 가문명은 `000가문` 형식을 권장한다. (예: `루메니아가문`)
- `family`: 가문이 없는 캐릭터는 `null`을 사용한다. (예: 순례자, 아스테리아)
- `surname`: `family`가 있으면 동일 값, 없으면 빈 문자열(`""`).
- `race`: 기본적으로 부모 종족을 계승한다. (예외 종족 규칙은 별도 문서로 확장)
- `familyLinks.fatherId`/`motherId`: 부모 캐릭터 id 참조. 미확정은 `null`.
- `familyLinks.childrenIds`: 자식 캐릭터 id 배열.
- `traits.innateTraitIds`: 선천 특성 id 배열. 문자열 대신 id를 저장해 세이브 용량을 줄인다.
- `traits.acquired`: 후천 특성. 이벤트/훈련/장비/직책 변화로 획득.
- `layers`: 캐릭터 스탠딩 표현 레이어.
- `wallet`: 캐릭터 소지금(금/은/동).
- `location`: 현재 지역/타일 좌표/랜드마크 정보.
- `inventory`: 보유 아이템 목록과 슬롯 제한.
- `stats`: 6대 스텟(STR/DEX/CON/INT/WIS/CHA).
- `alignment`: 세 축(호전↔온건, 정착↔방랑, 명예↔실리)을 수치로 표현.
- `aspiration.currentId`: 현재 선택된 숙원 id. 초기값은 `null`.
- `aspiration.poolId`: 캐릭터가 참조할 숙원 풀 id.
- `aspirationPoolCatalog`: id 기반 숙원 풀 메타 목록.
- `aspirationDefinitions`: 숙원 상세 정의 목록(행동 프로파일 포함).
- `selectionPolicy`: 숙원 선택 순서/규칙 정의(조건 필터링, 우선순위, 가중 추첨).
- `behaviorProfile`: 숙원 선택 후 캐릭터 행동 방향/양식을 결정하는 핵심 정책 묶음.
- `innateTraitCatalog`: 공용 선천 특성 카탈로그. 외부 파일에서 관리.

## 4) id 우선 저장 정책
- 세이브에는 가능한 한 문자열 대신 id를 저장한다. (`innateTraitIds`, `aspiration.poolId`, `aspiration.currentId`)
- UI/디버그 출력 단계에서만 공용 카탈로그를 조회해 이름/설명을 복원한다.

## 5) 숙원 행동 규칙(게임 반영 기준)
- 숙원은 "캐릭터별 고정값"이 아니라, `selectionPolicy`에 따라 후보 중 1개가 선택된다.
- 행동 AI/이벤트 선택지는 `behaviorProfile.decisionBias`를 가중치로 사용한다.
- 전투/외교/탐사 액션 우선순위는 `preferredActions`/`avoidActions`를 먼저 반영한다.
- 스토리 장기 진행 축은 `longTermDirective`를 기준으로 퀘스트/대사/목표를 생성한다.

> 참고: 현재 샘플 캐릭터인 순례자/아스테리아는 `family = null` 규칙을 사용한다.

## 6) 숙원 예시
- `피의 복수`: 호전 + 명예 + 방랑 성향이며 부모 살해 이벤트 발생 시 생성.
- `세계 제일의 상인`: 온건 + 방랑 + 실리 성향이며 대형 교역 성공 이벤트 누적 시 생성.

## 7) 저장 위치 권장
- 대표 캐릭터(소수): `localStorage.newtheria.characters`
- 슬롯 종속 캐릭터(대부분): `localStorage.newtheria.saveSlots.data.slots[slotId].characters`

## 8) 샘플 적용
- 실제 샘플 데이터는 `assets/js/start_screen.js`의 `defaultSaveSlotsData.slot1.catalogRefs`(참조 정보)와 `characters`를 참고한다.
- 공용 풀 원본은 `assets/data/character_common_pools.json`에서 관리한다.
- 숙원 선택/행동 방향 규칙도 같은 파일의 `selectionPolicy`와 각 숙원 `behaviorProfile`에 함께 정의한다.


## 9) 선천 특성 추천 목록
- `별의 가호(star_blessing)`: 야간 시야/탐지 보정
- `강골 체질(iron_vein)`: 출혈·골절 저항 보정
- `순간 반응(swift_reflex)`: 선공·회피 판정 보정
- `마력 공명(mana_resonance)`: 의식/주문 유지력 보정
- `은빛 언변(silver_tongue)`: 협상·설득 성공률 보정
- `개척 본능(frontier_instinct)`: 미지 지역 탐사 페널티 완화


## 10) 데이터 무결성 검증 규칙
- `id` 중복 금지: 캐릭터/특성/숙원/숙원풀 id는 각 범위에서 유일해야 한다.
- 부모/자식 참조 무결성: `fatherId`/`motherId`/`childrenIds`는 존재하는 캐릭터 id여야 한다.
- 상호 참조 일관성: 부모의 `childrenIds`에 있는 자식은 자식 쪽 `fatherId` 또는 `motherId`에 부모 id가 있어야 한다.
- 숙원/특성 참조 무결성: `innateTraitIds`, `aspiration.poolId`, `aspiration.currentId`는 공용 카탈로그에 정의된 id만 사용한다.

## 11) 런타임 인덱스 규칙
- 시작 시 공용 풀을 로드한 뒤 `id -> 객체` 인덱스를 생성한다.
- 필수 인덱스: `characterById`, `traitById`, `aspirationById`, `aspirationPoolById`.
- UI/이벤트/AI는 문자열 탐색보다 인덱스 조회를 우선 사용해 성능과 일관성을 확보한다.
- 관련 유틸은 `assets/js/character_data_utils.js` (`validateCharacterData`, `buildCharacterIndexes`)를 사용한다.


## 12) AI 행동 연결 명세
- 행동 후보는 `chooseActionByAspiration()`으로 평가한다.
- 점수 계산은 `scoreActionByAspiration()`을 사용한다.
  - `decisionBias[actionTag] * 100`
  - `preferredActions` 보너스 `+25`
  - `avoidActions` 페널티 `-35`
- 디버그 화면에는 `reasons[]`와 `directive(longTermDirective)`를 함께 노출해 선택 근거를 설명한다.

## 13) 운영/툴링 명세
- 공용 풀 데이터 검증 스크립트: `scripts/validate_character_data.mjs`
- 실행 명령: `node scripts/validate_character_data.mjs`
- 검증 대상:
  - 특성/숙원/숙원풀 id 유일성
  - 숙원풀의 `aspirationIds` 참조 무결성
- CI 도입 시 위 스크립트를 pre-check 단계에 포함한다.


## 14) 캐릭터 상태 변경 API 명세
- `applyCurrencyDelta(character, delta)`
  - 소지금 증감 적용 (`gold/silver/copper`)
  - 음수로 내려가면 0으로 보정
- `moveCharacterLocation(character, locationPatch)`
  - 지역/랜드마크/타일 좌표 패치
- `addInventoryItem(character, itemId, qty)`
  - 인벤토리 슬롯 제한 내에서 아이템 추가
- `removeInventoryItem(character, itemId, qty)`
  - 수량 차감 후 0 이하면 아이템 제거
- 위 API는 모두 불변 객체를 반환하며, 호출부에서 저장 dirty 플래그를 관리한다.

## 15) 세이브 직렬화/복원 규칙
- 직렬화: `serializeCharacterState(character)`
  - 반환 형식: `{ saveSchemaVersion, payload }`
- 복원: `deserializeCharacterState(saveBlob)`
  - 버전별 마이그레이션 포인트를 거쳐 런타임 정규화 객체 반환
- 기본 스키마 버전: `1.0.0`
- 세이브 슬롯 루트에도 `saveSchemaVersion`을 기록한다.
