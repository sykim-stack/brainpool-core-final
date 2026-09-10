# BRAINPOOL Core Final 작업 인수인계

> **목적:** Manus 1·2가 확장 프로그램 작업을 하준아이와 함께 이어가기 위한 문서
> **기준 브랜치:** `master`
> **갱신일:** 2026-09-09

## 시작 명령

```bash
git switch master
git fetch origin
git pull --ff-only origin master
git status --short --branch
```

하준아이 연동 계약은 다음 문서를 기준으로 한다.

- `hajunai-api-spec.json`
- `../hajuncore-app/docs/HAJUNAI_PRODUCT_EXTENSION_CONTRACT.md`

## 현재 상태

- 외부 AI 대화 추출: 구현됨
- 전체 원문 보존·누락 경고: 구현됨
- 하준아이 마당·방 선택: 구현됨
- 선택한 방 메시지 저장: 구현됨
- 선택한 방 맥락의 외부 AI 입력창 주입: 구현됨
- 상품검증 온채널 수동 추출기: 구현됨
- 상품검증 네이버 조사 추출기: 미구현
- 상품 캡처 전송·중복 방지·message ID 표시: 구현됨

## 공유 계약

```text
상품 원문 SoT = hajuncore-app의 hajun_messages
hajun_posts = 신규 상품 원문 저장 금지
internal_code = source:source_product_code
기본 흐름 = 하준아이 마당 → 거실 → 방
```

확장 프로그램은 사용자가 현재 열어 둔 페이지에서 버튼을 눌렀을 때만 데이터를 읽는다. 자동 로그인·쿠키 저장·대량 순회·자동 승인·CoreHub 자동 이관은 하지 않는다.

## 다음 작업 순서

1. 온채널 수동 캡처를 운영 Chrome에서 실제 테스트한다.
2. 동일 상품 재캡처 시 local storage·HajunAI 양쪽 중복 방지를 검증한다.
3. 캡처 실패·페이지 원문 누락·잘못된 방 선택 오류를 확인한다.
4. 네이버 조사 캡처는 별도 구현하되 동일상품 자동 확정은 하지 않는다.
5. 저장·중복·ref_ids·실패 시 원문 보존을 양쪽에서 함께 검증한다.

## 작업 중단 기록

```markdown
### 작업 로그: YYYY-MM-DD HH:MM
- 담당:
- 작업:
- 변경 파일:
- HajunAI 계약 상태:
- 검증:
- 다음 작업:
- 주의:
```

커밋 전에는 확장 프로그램 JavaScript에 대해 다음을 실행한다.

```bash
node --check background.js
node --check content.js
node --check popup/popup.js
git diff --check
```

상품검증 작업은 항상 `hajuncore-app`의 계약 문서와 함께 커밋 단위로 기록한다.

### 작업 로그: 2026-09-09 10:03
- 담당: Manus 2
- 작업: 코어 파이널을 원격 `master`와 동기화하고 양쪽 저장소 공통 상품검증 연동 계약을 추가할 준비
- 변경 파일: `HANDOFF.md` 예정
- HajunAI 계약 상태: 캡처 payload와 `internal_code` 규칙은 `hajuncore-app` 계약 문서 기준
- 검증: 로컬을 원격 `4b5d4e8`까지 fast-forward 동기화
- 다음 작업: HajunAI DB의 metadata·상품검증 방 key 확인 후 캡처 저장 API 연결
- 주의: 저장 API가 확정되기 전 온채널·네이버 추출기를 만들지 않음

### 작업 로그: 2026-09-09 10:21

- 담당: Manus 1
- 작업: HajunCore 계약 문서 추가, `post_message`의 metadata·yard/room key 지원, 상품 후보 조회 action 로컬 구현, `POST_HAJUN_PRODUCT_CAPTURE` background action 구현
- 변경 파일: `background.js`, `hajunai-api-spec.json` 확인, HajunCore `docs/HAJUNAI_PRODUCT_EXTENSION_CONTRACT.md`, `app/api/hajun/route.ts`, `types/hajun.ts`
- HajunAI 계약 상태: 상품 원문은 `hajun_messages`에만 저장하며, `hajun_posts`에는 신규 상품 원문을 쓰지 않음. `internal_code=source:source_product_code` 검증 추가
- 검증: 확장프로그램 `node --check` 3개 파일 통과, `git diff --check` 통과, HajunCore `npm run build` 통과. 배포 API의 `product_candidates`, `product_random`, `product_timeline` 빈 응답 확인
- 다음 작업: 배포 DB의 `metadata` 저장과 상품검증마당·방 seed를 확인한 뒤 온채널 수동 extractor 연결
- 주의: 현재 배포 API에는 상품 조회 action이 응답하지만 `product_validation` 마당은 아직 존재하지 않음. 실제 상품 캡처는 seed와 metadata 저장을 확인한 뒤 활성화

### 작업 로그: 2026-09-09 10:25

- 담당: Manus 1
- 작업: 상품검증마당·4개 기능방·`hajun_messages.metadata`를 준비하는 idempotent Supabase migration 작성
- 변경 파일: HajunCore `docs/migrations/20260909_product_validation.sql`, `types/hajun.ts`
- HajunAI 계약 상태: `product_validation` 마당, `product_discovery`, `market_research`, `product_validation`, `approved_products` 방을 기능 단위로 사용하며 상품별 방은 생성하지 않음
- 검증: migration 파일 존재 및 로컬 소스 반영 예정. 운영 DB에는 아직 적용하지 않음
- 다음 작업: Supabase SQL Editor에서 migration 적용 후 마당·방·metadata 컬럼 확인
- 주의: 운영 DB migration 적용 전 온채널·네이버 extractor를 활성화하지 않음

### 작업 로그: 2026-09-09 10:33

- 담당: Manus 1
- 작업: 온채널 수동 상품 원문 extractor, 팝업 캡처 버튼, background 캡처·중복 확인·HajunAI 전송 연결 구현
- 변경 파일: `content/product-content.js`, `popup/popup.html`, `popup/popup.js`, `background.js`
- HajunAI 계약 상태: 캡처 payload에 `internal_code`, 원문, source URL, captured_at, metadata를 포함하고 저장 응답의 message ID를 표시함
- 검증: `node --check` background/content/product-content/popup 통과, `git diff --check` 통과, HajunCore `npm run build` 통과
- 다음 작업: 배포 API에서 상품검증마당과 방 응답을 정상 확인한 뒤 Chrome에서 온채널 상세페이지 수동 캡처를 테스트
- 주의: 현재 배포 endpoint의 상품검증마당 응답 본문이 비어 있어 운영 seed/API 상태를 먼저 확인해야 함. extractor는 사용자가 상품검증마당과 방을 선택한 경우에만 실행됨

### 작업 로그: 2026-09-09 13:27

- 담당: Manus 1
- 작업: 운영 단일 DB를 Supabase `Jena-Voca-01` (`grlfocvlfatuvphkyivd`)로 확정하고 상품검증 migration 적용
- 결과: `product_validation` 마당, 4개 기능방, `hajun_messages.metadata jsonb` 컬럼 생성 확인
- 검증: Supabase MCP 조회와 운영 API의 `room_list&yard=product_validation` 응답 확인
- 주의: `hajunai` 프로젝트에는 Hajun 테이블이 없으므로 운영 DB로 사용하지 않음. 상품 후보 조회 API는 별도 배포 코드 확인이 필요함

### 작업 로그: 2026-09-10 15:01
- 담당: Manus 2
- 작업: 원격 최신 코어 파이널과 운영 HajunAI를 재검증하고 인수인계 상태를 실제 구현에 맞게 정정
- 결과: 코어 파이널 `master=0f717b5`; 상품검증 온채널 수동 캡처·중복 방지·팝업 상태 저장 구현 확인
- 운영 확인: `product_validation` 마당과 `product_discovery`, `market_research`, `product_validation`, `approved_products` 4개 방 확인; `product_candidates` 5건 확인
- 검증: 코어 파이널 4개 JS `node --check` 통과; 운영 API `product_candidates`와 `product_random` 응답 확인
- 다음 작업: 실제 Chrome 온채널 상세페이지에서 캡처 버튼을 눌러 저장·중복 결과 확인
- 주의: 네이버 조사 extractor와 승인 승격 흐름은 아직 미구현

### 작업 로그: 2026-09-10 17:31
- 담당: Manus 2
- 작업: 대상 공간 저장을 `chrome.storage.local` 저장 후 재조회 검증 방식으로 보강
- 변경 파일: `popup/popup.js`
- 결정: 저장 성공·실패를 버튼과 상태 문구에 표시하고, 마당·방이 비어 있으면 저장하지 않음
- 검증: `node --check background.js`, `content.js`, `content/product-content.js`, `popup/popup.js`, `git diff --check` 통과
- 다음 작업: Chrome 확장 프로그램을 새로고침한 뒤 마당·방 선택 → 선택 공간 저장 → 팝업 재개방으로 실제 확인
- 주의: 브라우저의 확장 프로그램 저장소를 직접 확인해야 하므로 현재 정적 검증만 완료
