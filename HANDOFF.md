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
- 상품검증 온채널 추출기: 미구현
- 상품검증 네이버 조사 추출기: 미구현
- 상품 캡처 전송: 계약 고정, 구현 전

## 공유 계약

```text
상품 원문 SoT = hajuncore-app의 hajun_messages
hajun_posts = 신규 상품 원문 저장 금지
internal_code = source:source_product_code
기본 흐름 = 하준아이 마당 → 거실 → 방
```

확장 프로그램은 사용자가 현재 열어 둔 페이지에서 버튼을 눌렀을 때만 데이터를 읽는다. 자동 로그인·쿠키 저장·대량 순회·자동 승인·CoreHub 자동 이관은 하지 않는다.

## 다음 작업 순서

1. `hajuncore-app`에서 실제 상품검증마당·방 key와 `metadata` 컬럼을 확인한다.
2. HajunAI 캡처 저장 API가 확정될 때까지 온채널·네이버 추출기를 구현하지 않는다.
3. 온채널 수동 캡처를 별도 content extractor와 popup action으로 추가한다.
4. 캡처 payload에 `internal_code`, 원문, source URL, captured_at을 포함한다.
5. HajunAI 저장 응답의 message ID를 보존한다.
6. 같은 상품 재캡처 시 새 원문을 두 저장소에 복제하지 않는다.
7. 네이버 조사는 같은 `internal_code`에 연결하되 동일상품 자동 확정은 하지 않는다.
8. 저장·중복·ref_ids·실패 시 원문 보존을 양쪽에서 함께 검증한다.

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
