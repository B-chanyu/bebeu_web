# 구조와 개발 안내

## 실행 구조

```text
브라우저 PWA ──────────────┐
Android (Capacitor WebView) ├─ HTTPS app.bebeu.cloud
                          │       ↓ Cloudflare Tunnel
                          │   Node.js :3000 / server.js
                          │       ├─ MariaDB: 품목·직원·공유·근태·설정
                          │       ├─ PHOTO_ROOT: 사진/동영상 파일
                          │       ├─ Playwright: 네이버 카페 편집기 자동화
                          │       └─ Kakao Local / Mobility: 주소·배송 경로
                          └─ 운영 도메인 delivery-map.html을 iframe으로 표시
```

Android는 서버 프로그램을 포함하지 않는다. `capacitor.config.json`의 `webDir: public`에 있는 웹 자산을 앱에 포함하고, HTTPS 서버 API를 호출한다. 단순히 모든 페이지를 서버에서 여는 브라우저 앱과는 다르다.
기본 서버 주소는 `src/app/00-config-state-dom.js`의 `DEFAULT_NATIVE_SERVER_URL`이다. 변경 시 저장된 서버 주소 설정과 지도 허용 출처도 확인한다.
웹 코드 수정은 운영 웹에 반영되지만, 앱에 묶인 화면 코드·Java 코드·권한 변경은 재동기화와 앱 배포가 필요하다.

## 주요 코드

아래 경로는 `bebeu/v2` 기준이다.

| 위치 | 담당 기능 |
| --- | --- |
| `server.js` | HTTP/API, DB 접근, 로그인·역할 처리, 사진 저장, 공유, 카페 자동화, SSE |
| `lib/kakao-delivery.js` | 주소 검색, 구·동 단위 묶음, 주행 시간 기반 순서 및 실제 경로 계산 |
| `src/app/00-config-state-dom.js` | 공통 상태, 상수, 버전, DOM 참조 |
| `src/app/10-api-core.js` | API, 초기 데이터 캐시, 사진 전송 임시 큐와 복구 |
| `src/app/20-chat-auth.js` | 채팅, 로그인 |
| `src/app/30-me-attendance-notes.js` | 근태, 정산, 메모 |
| `src/app/35-delivery-route.js` | 배송 지도, 위치 공유, 배송 세션 |
| `src/app/40-orders-list-detail.js` | 진행/완료 목록, 사진 상세, 고정 사진 |
| `src/app/50-settings-share.js` | 설정, 공유 템플릿, 고객 링크, 휴지통 |
| `src/app/60-events-actions.js` | 버튼 동작, 네이티브 공유, 사진 선택·고정 |
| `src/app/70-photo-chat-upload.js` | 사진 준비·업로드, 채팅 전송 |
| `src/app/80-order-parser-forms.js` | 접수 문자 파싱, 입력 폼 |
| `src/app/90-bootstrap-events.js` | 시작 처리, 폼/전역 이벤트, 앱 업데이트 확인 |
| `public/styles.css` | 웹/앱 공통 스타일 |
| `public/delivery-map.html`, `delivery-map.js` | 운영 도메인에서 인증되는 카카오 지도 |
| `android/app/src/main/java/cloud/bebeu/work` | MainActivity, 촬영/드롭, 스토어 이동, 배송 위치 서비스 |

프런트엔드는 독립 모듈 번들이 아니라 위 파일을 순서대로 합친 공통 런타임이다. 함수·상수는 다른 파일에서 사용될 수 있다.
`scripts/build-public-app.js`가 11개 소스를 `public/app.js`로 합친다. 생성된 `public/app.js`만 직접 고치지 않는다.

## 데이터와 보존

- DB: `orders`, `photos`, `order_step_memos`, `users`, `attendance`, `work_logs` 등이 중심이다. `app_settings`에는 공유 템플릿과 배송 관련 설정 등도 들어간다.
- 고객 공유 정보의 실제 테이블은 `share_links`이다 (`share_inks` 아님). 토큰, 제외 사진, 고객 메모 등을 관리한다.
- 파일: 실제 `PHOTO_ROOT` 아래 품목 사진과 `bebeu_chat` 채팅 사진이 저장된다. DB와 파일을 함께 백업해야 한다.
- `database/schema.sql`은 초기 생성용이며 `DROP TABLE`을 포함한다. 운영 이관에는 전체 덤프를 사용한다.
- 서버의 `ensureMariaDbColumns()`가 일부 추가 컬럼/테이블을 자동 보정한다. 빈 DB에 전체 기본 스키마를 만드는 대체 수단은 아니다. 스키마 파일만으로 현재 운영 상태를 완전히 재현한다고 가정하지 않는다.
- 채팅과 사진 휴지통에는 만료 정리가 있다. 정확한 기간·삭제 범위는 `cleanupExpiredChatMessages`, `cleanupExpiredTrashPhotos`를 확인한다. 휴지통은 영구 백업이 아니다.

## 사진 누락 대응의 범위

사진 업로드는 브라우저/WebView의 IndexedDB `bebeu-photo-outbox`에 전송 작업을 먼저 기록한 뒤 묶음 전송한다.
서버가 반환한 사진 건수를 확인하고 성공한 진행 지점을 저장한다. 다음 실행 시 해당 사용자·서버의 남은 작업 복구를 제안한다.
서버는 `uploadJobId`와 사진 순번을 이용해 같은 전송의 재시도 중복을 줄인다.

이 장치는 원본 백업이나 모든 상황의 무손실 보장을 뜻하지 않는다. 앱 삭제, 앱 데이터/브라우저 저장소 삭제, 저장 용량 부족, 큐 기록 전 중단 등은 별도 위험이다. 성공 안내뿐 아니라 DB 행과 실제 파일 확인이 필요하다.

## 역할과 배송

관리자/직원은 로그인 후 역할별 UI를 사용하며 배송 전용은 배송 화면만 제공한다. 배송 계정의 무비밀번호 진입은 기존 요구사항으로 구현된 동작이다.
실제 보안 한계는 [인수 확인표](ACCEPTANCE.md)의 인증 항목을 우선 확인한다.

배송 지도 초기 위치는 사무실이며 위치 허용 시 배송자의 첫 위치로 이동한다. 계산 경로는 구·동 묶음과 방향별 주행 시간을 고려하고 마지막은 사무실이다. 전역 최적해 보장은 아니다.
Android 배송 세션은 위치 foreground service와 지속 알림의 이전/다음/종료 버튼을 사용한다. 다음 목적지 선택과 DB의 배송 완료 처리는 같은 동작이 아니다.
웹의 위치 공유는 화면 활성 상태와 브라우저 제한에 영향을 받는다. 화면 꺼짐 추적은 실기기·권한·절전 설정에 따라 검증한다.
