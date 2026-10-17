# 실행 · 배포 · 백업 · 복구

## 새 개발 환경

Node.js 22 이상, npm, MariaDB/MySQL을 준비한다. Android 빌드는 Java 21과 Android SDK 36을 사용한다.
프로젝트는 Windows 운영 전제를 가진 자동화·실행 파일이 있으므로 다른 OS로 이전 시 별도 검증한다.

```powershell
git clone --branch codex/android-app https://github.com/B-chanyu/bebeu_web.git
Set-Location .\bebeu_web\bebeu\v2
npm ci
Copy-Item .env.example .env
```

기존 `.env`가 있다면 복사 명령으로 덮어쓰지 않는다. `.env`에 개발용 DB·관리자 암호·사진/로그 경로를 설정한다.
서버는 `bebeu/v2/.env`를 읽는다. 루트 `.env.example`이 실제 서버 설정 파일은 아니다.
실행 환경에 이미 설정된 변수는 `.env`보다 우선할 수 있다. 배치/PowerShell 실행 파일에서 DB 값과 경로를 지정하는지도 확인한다.

| 환경변수 | 용도 |
| --- | --- |
| `PORT` | 기본 3000 |
| `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` | DB 연결. 운영은 전용 계정 사용 |
| `PHOTO_ROOT`, `LOG_DIR` | 파일/로그의 실제 절대 경로. Git 작업 폴더와 분리 가능 |
| `DEFAULT_ADMIN_PASSWORD`, `DEFAULT_MEMBER_PASSWORD` | 해시가 없는 계정의 초기 암호 대체값. 실제 계정 암호 변경과는 별개 |
| `APP_ALLOWED_ORIGINS` | 허용 출처 목록. Android `https://localhost`, iOS `capacitor://localhost` 등 실제 사용 출처만 허용 |
| `UPLOAD_LIMIT_MB` | 요청 업로드 한도. 프록시 제한과 개별 파일 제한도 함께 확인 |
| `KAKAO_MAPS_JAVASCRIPT_KEY` | 공개 SDK 키. 지도 페이지의 운영 도메인을 Kakao에 등록 |
| `KAKAO_REST_API_KEY`, `KAKAO_DIRECTIONS_REST_API_KEY` | 서버 전용 검색/경로 키 |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `NAVER_CAFE_CLUB_ID`, `NAVER_CAFE_MENU_ID` | 네이버 연동 설정 |
| `NAVER_CAFE_AUTOMATION_PROFILE`, `NAVER_CAFE_AUTOMATION_HEADLESS` | 브라우저 로그인 프로필과 자동화 표시 여부 |

Naver Maps 변수는 이전 연동 코드에도 남아 있다. 현재 배송 지도와 경로는 Kakao 기준이다.
키는 화면이나 Git에 넣지 않으며 JS SDK 키는 브라우저에 노출되는 성격이므로 도메인 제한으로 관리한다.

### DB 최초 준비

**`database/schema.sql`은 기존 테이블을 삭제한다. 운영 DB와 운영 복제본에 재실행하지 않는다.**
완전히 비어 있는 격리 DB에서만 내용을 검토해 초기 생성한다. 파일의 `USE bebeu`와 DB 이름도 확인한다.
`database/`의 개별 SQL을 파일 이름순으로 일괄 실행하지 않는다. 자동 보정 코드와 중복되거나 과거 단계 변환용일 수 있다.
실제 인계는 현재 운영 DB의 전체 덤프를 받아 격리된 서버에서 복원하는 방법을 우선한다.

```powershell
npm start
```

접속은 `http://localhost:3000`, 헬스 확인은 `/api/health`이다. HTTPS 운영 주소와 달리 로컬 HTTP/IP에서는 카메라·위치 등 브라우저 기능이 제한될 수 있다.
카페 자동화가 필요하면 `npx playwright install chromium`으로 브라우저를 설치하고 운영자 계정으로 직접 로그인한다. 실제 게시 테스트는 지정한 테스트 게시판에서 수행한다.

## 운영 프로세스

```powershell
# bebeu/v2에서 서버를 관리 모드로 시작
npm run serve:managed

# 이미 관리 모드가 실행 중일 때 변경 적용
npm run reload:managed
```

두 명령을 별도 실행 시점에 사용한다. `reload:managed`는 시작 명령이 아니며 관리 프로세스가 없으면 서버를 켜지 않는다.
`npm start`는 직접 서버 실행이고 관리 모드의 재시작 감시가 없다. 같은 포트에 두 서버를 동시에 켜지 않는다.
관리 모드는 파일 편집마다 재시작하지 않는다. reload 요청 시 빌드 후 재시작하며 자식 서버 비정상 종료 시 재시작을 시도한다.
빌드가 실패하면 서버가 중지된 채 다음 reload를 기다릴 수 있으므로 로그 확인이 필요하다.

### 운영 PC 인계 확인

마지막 운영 작업에서 프로젝트는 `C:\bebeyu\bebeu\v2`, 바탕화면 서버 실행 파일과 Cloudflare Tunnel을 사용했다.
Git의 일부 배치 파일은 `D:\bebeyu` 기준이므로 배포할 때 바탕화면 실행 파일까지 무조건 덮어쓰지 않는다.
과거 복구를 위해 `BEBEU-Recovery-20261008` 예약 작업과 `C:\bebeyu\server-recovery.ps1`을 운영 PC에 두었다. 자동 시작 트리거를 보장하는 구성이 아니며 Git에 포함되지 않는다. 현재 존재 여부·로그온 조건을 확인해 인계한다.

Cloudflare의 실제 `config.yml`, Tunnel 인증 파일, DNS 권한은 별도 인계한다. 마지막 구성은 `app.bebeu.cloud` → `http://127.0.0.1:3000`이었다.
운영 PC 재부팅 후 DB, Node 관리 프로세스, 터널을 각각 확인한다. 서버를 SSH 접속 세션에만 종속시켜 두면 접속 종료 시 꺼질 수 있다.

### 웹 변경 배포

1. Git 커밋과 배포 대상 파일을 확인하고 현 서버 파일·DB·사진의 복구 지점을 확보한다.
2. 별도 환경에서 `npm ci`, `npm run build:app`, `npm run check`, `node --test tests/kakao-delivery.test.js`를 수행한다. 이 검사는 전체 통합/실기기 테스트를 대신하지 않는다.
3. `server.js`, 필요한 `lib/`, 수정 소스, 생성된 `public/app.js`와 관련 자산을 같은 버전으로 옮긴다. `.env`, 사진, 로그인 프로필, 서명키는 덮어쓰지 않는다.
4. 의존성 변경 시 운영에서도 잠금 파일에 맞춰 설치한다. 공통 자산 변경 시 `APP_RELEASE_VERSION`, `CUSTOMER_SHARE_CACHE_VERSION`, `index.html`/`sw.js`의 캐시 참조를 함께 검토한다.
5. 관리 모드 reload 후 로컬 헬스와 HTTPS 화면, 기존 로그인/사진 표시를 확인한다.
6. Git 푸시만으로 운영 PC에 자동 배포되는 설정은 없다. 반영한 커밋·시간·담당자·복구 경로를 기록한다.

## Android 배포

앱 ID와 기존 업로드 서명키를 유지한다. `android/local.properties`는 인수자 SDK 경로로 설정하고 `keystore.properties.example`을 참고해 비공개 서명 설정을 준비한다. 새 키를 임의로 생성해 기존 키를 대체하지 않는다.

```powershell
# 경로는 인수자의 설치 위치로 변경
$env:JAVA_HOME = 'D:\Android\jdk-21.0.12.1+1'
$env:ANDROID_HOME = 'D:\Android\sdk'
$env:GRADLE_USER_HOME = 'D:\Android\gradle-cache'
npm run native:android:bundle
```

AAB 결과는 `android/app/build/outputs/bundle/release/app-release.aab`이다.
`android/app/build.gradle`의 versionCode는 다음 업로드 때 17보다 큰 값으로 올린다. versionName과 화면의 `APP_ANDROID_VERSION`도 맞춘다.
실기기 확인 후 Console 내부 테스트에 올리고 출시 상태를 확인한다. **게시되기 전 `public/app-release.json`을 먼저 올리지 않는다.**
게시 후 서버의 해당 JSON을 실제 버전으로 갱신하면 기존 앱이 업데이트 안내를 표시한다. 앱의 설치 파일은 Git에 넣지 않는다.
직접 다운로드도 제공한다면 `public/download.html`의 파일명/표시 버전과 `public/downloads` 산출물을 별도로 맞춘다.
위치 foreground service 관련 신고, 데이터 보안, 개인정보처리방침, 심사용 계정은 실제 동작과 일치해야 한다.

## 백업과 복구

사진 임시 큐나 배포 전 파일 복사는 정기 백업이 아니다. 현재 코드에 외부 저장소까지 정기 백업·보존·복원 검증을 보장하는 체계는 없다.
인수 후 최소 일일 백업 주기, 보존 기간, 암호화, 외부 보관 장소와 담당자를 정한다.

백업 대상: 전체 MariaDB 덤프(스키마와 데이터), 같은 시점의 `PHOTO_ROOT`, 비공개 설정/VAPID/서명 자료, 운영 실행 및 터널 설정.
DB 덤프는 `mariadb-dump`의 암호 프롬프트와 `--result-file`을 사용해 암호 노출 및 PowerShell 리다이렉션 인코딩 문제를 피한다. 덤프 파일에는 고객 개인정보가 있으므로 Git 밖의 접근 제한 저장소에 둔다.
파일/DB 정합성을 위해 쓰기를 잠시 중지하거나 검증된 일관성 스냅샷 절차를 사용한다. 백업본 생성 후 종료 코드·크기·해시만이 아니라 실제 복원을 확인한다.

복구는 새 격리 DB와 별도 사진 폴더에 먼저 수행한다. 테이블 건수, 대표 품번의 사진 파일, 고객 공유 링크, 템플릿과 사용자 로그인을 대조한다.
운영 전환 전에 주소/포트·파일 경로·권한을 확인하고 새 업로드가 생긴 뒤 과거 백업으로 무작정 되돌리지 않는다.
코드 롤백은 이전 커밋의 파일을 적용하고 reload하는 절차다. 자동 DB 스키마 변경이 동반됐다면 코드만 되돌리는 것으로 충분하지 않을 수 있다.
