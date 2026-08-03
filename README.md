# BEBEU Work PWA

아기용품 세탁/수거/배송 업무를 관리하기 위해 만든 현장 운영용 PWA입니다.  
주문 접수, 단계별 사진 업로드, 채팅, 완료 공유, 근태 결산, 네이버 카페 자동 업로드까지 실제 매장 운영 흐름에 맞춰 개발했습니다.

## 주요 기능

- A/B 유형별 주문 접수 및 복사 문구 자동 파싱
- 접수, 라벨링, 전사진, 탈거, 세탁, 조립, 검수, 후사진, 살균, 배송 단계 관리
- 단계별 사진 업로드, 대표 사진, 고정 사진, 휴지통 복구
- 진행중/완료 목록, 긴급/오늘할일/부속품 메모
- 채팅 기반 사진 공유 및 품목 단계 업로드
- 고객 공유 URL 생성 및 문자/링크 발송 상태 관리
- 관리자/직원 로그인, 출퇴근, 근태 결산
- 네이버 카페 글쓰기 API 및 Playwright 자동화 기반 게시글 업로드
- PWA 설치, 모바일 중심 UI, Cloudflare Tunnel 운영 대응

## 기술 스택

- Frontend: Vanilla JavaScript, HTML, CSS, PWA Service Worker
- Backend: Node.js HTTP server
- Database: MariaDB / MySQL
- Media: Sharp image processing
- Automation: Playwright
- Mobile bridge: Capacitor
- Push: Web Push / VAPID

## 폴더 구조

```text
C:\bebeyu
├─ bebeu
│  ├─ v1                 # 이전 버전 보관
│  └─ v2                 # 현재 운영 버전
│     ├─ public          # PWA frontend
│     ├─ database        # schema/migration SQL
│     ├─ scripts         # maintenance scripts
│     ├─ server.js       # Node.js backend
│     └─ package.json
├─ database              # root-level database scripts
├─ .env.example          # public-safe environment sample
└─ .gitignore
```

## 실행 방법

```powershell
cd C:\bebeyu\bebeu\v2
npm install
copy .env.example .env
npm start
```

실행 후 접속:

```text
http://localhost:3000
```

Cloudflare Tunnel을 사용할 때는 서버를 먼저 켠 뒤 별도 터미널에서 터널을 실행합니다.

```powershell
cloudflared tunnel run
```

## 환경 변수

실제 운영 값은 `.env` 또는 서버 환경 변수로 관리합니다.  
포트폴리오 저장소에는 `.env.example`만 포함합니다.

필수 항목:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `PHOTO_ROOT`
- `DEFAULT_ADMIN_PASSWORD`

선택 항목:

- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`
- `NAVER_CAFE_CLUB_ID`
- `NAVER_CAFE_MENU_ID`
- `APP_ALLOWED_ORIGINS`
- `UPLOAD_LIMIT_MB`

## 보안 및 공개 제외 대상

다음 항목은 포트폴리오 저장소에 포함하지 않습니다.

- `.env`, 실제 DB 비밀번호
- `push-vapid.json`
- 사진 저장소 `bebeu_image/`
- 로그 `app_logs/`, `logs/`
- 네이버 로그인 브라우저 프로필 `naver-cafe-browser/`
- `node_modules/`
- zip, dump, backup 파일

## Git 사용 흐름

```powershell
git status
git add .
git commit -m "Initial portfolio-ready version"
```

추천 브랜치:

- `main`: 포트폴리오 공개용 안정 버전
- `develop`: 운영 기능 개발
- `feature/*`: 기능 단위 작업
- `hotfix/*`: 운영 긴급 수정

## 포트폴리오 메모

이 프로젝트는 단순 CRUD가 아니라 실제 현장 작업자의 반복 업무를 줄이기 위해 만들어진 운영 도구입니다.  
모바일 사용성을 우선으로 설계했고, 사진 업로드/공유/상태 전환처럼 업무 흐름이 끊기지 않는 UX에 초점을 맞췄습니다.
