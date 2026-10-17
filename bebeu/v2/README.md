# 베베유 관리자 웹 · Android

현재 실행 프로젝트입니다. 초기 프로토타입이 아니라 세탁 매장 운영용 PWA와 Android 앱의 공통 코드를 포함합니다.

## 인수인계

**[전체 인수인계 안내](../../docs/HANDOVER.md)**에서 시작하세요.

- [실행·환경변수·배포·백업·복구](../../docs/handover/OPERATIONS.md)
- [코드와 데이터 구조](../../docs/handover/ARCHITECTURE.md)
- [기능 확인표와 보안 한계](../../docs/handover/ACCEPTANCE.md)
- [Android 빌드 안내](../../docs/android-release.md)
- [카카오 배송 지도](docs/KAKAO_DELIVERY.md)

인계 기준 브랜치는 `codex/android-app`, Android 버전은 1.16 / versionCode 17입니다.
운영 주소는 https://app.bebeu.cloud 이며, Android는 로컬에 포함된 화면 자산으로 같은 서버 API를 호출합니다.
운영 DB·사진·환경설정·서명키는 Git에 없으므로 별도 인계가 필요합니다.

## 개발 환경 실행

Node.js 22 이상과 MariaDB를 준비하고 이 디렉터리에서 실행합니다.

```powershell
npm ci
Copy-Item .env.example .env
# .env에 개발 전용 DB, 사진/로그 경로와 초기 암호 설정
npm start
```

기존 `.env`는 덮어쓰지 마세요. 기본 접속은 `http://localhost:3000`입니다.
첫 DB 구성은 운영 안내를 따르세요. **`database/schema.sql`은 DROP TABLE을 포함하므로 운영 DB에 실행하면 안 됩니다.**
저장소의 배치 실행 파일에는 `D:` 고정 경로와 DB 환경변수 설정이 남아 있으므로 인수자의 환경에 맞춰 확인해야 합니다.

## 수정 위치

`src/app`의 기능별 파일을 수정하고 `npm run build:app`으로 `public/app.js`를 생성합니다.
일반 스타일은 `public/styles.css`, 서버는 `server.js`, 배송 경로 계산은 `lib/kakao-delivery.js`입니다.
Android 전용 구현은 `android/app/src/main/java/cloud/bebeu/work`에 있습니다.

```powershell
npm run check
node --test tests/kakao-delivery.test.js
```

위 검사는 문법/텍스트 검사와 일부 경로 계산 테스트이며 통합·보안·실기기 검증을 대신하지 않습니다.
관리 모드 시작은 `npm run serve:managed`, 실행 중 변경 적용은 `npm run reload:managed`입니다.
Git 푸시만으로 운영 서버 배포나 Play 업데이트가 자동 실행되지는 않습니다.
