# 웹 · Android 앱 인수인계

문서 기준일: 2026-10-17. 코드 기준: `codex/android-app`의 Android 1.16 / versionCode 17, 웹 자산 버전 331.
운영 서버와 Play Console을 이 문서 작성 중 다시 조회하지는 않았다. 스토어의 마지막 확인 상태는 2026-10-08 내부 테스트 게시 완료이며, 인수자는 실제 운영 상태를 재확인해야 한다.

## 먼저 읽기

이 앱은 유모차·카시트 세탁 매장의 관리자, 작업 직원, 배송 직원이 사용한다.
접수 → 단계별 사진 등록 → 완료 → 고객 링크 공유 → 배송/픽업 처리 흐름을 관리하며, 채팅·근태·카페 게시 자동화를 함께 제공한다.

| 항목 | 위치 / 설명 |
| --- | --- |
| 저장소 | https://github.com/B-chanyu/bebeu_web |
| 인계 기준 브랜치 | `codex/android-app` (웹 공통 코드와 Android 코드 모두 포함) |
| 웹 기준 브랜치 | `main` (앱 브랜치와 동일하다고 가정하지 말 것) |
| 실행 프로젝트 | `bebeu/v2` |
| 운영 주소 | https://app.bebeu.cloud |
| Android 패키지 / 표시 이름 | `cloud.bebeu.work` / 베베유 관리자 |
| Android 배포 | Google Play 내부 테스트. 일반 공개 출시와 다름 |
| iOS | 시뮬레이터 빌드용 workflow만 준비. App Store 배포 완료 상태 아님 |

이 안내에 사용한 상대 경로는 별도 표기가 없으면 저장소 루트 기준이다.
현재 작업 PC의 체크아웃은 `C:\bebeyu`, Android 도구는 `D:\Android`에 있다.
저장소의 일부 실행 배치 파일은 과거 `D:\bebeyu`를 고정 참조한다. 복제 후 그대로 실행하지 말고 실제 경로와 DB 설정부터 확인한다.

## 인수 순서

1. 저장소 접근 권한을 받고 `codex/android-app`을 복제한다. `git rev-parse HEAD`로 인수 기준 커밋을 기록한다.
2. [구조와 개발 안내](handover/ARCHITECTURE.md)를 읽고 테스트 DB와 테스트 사진 저장소를 준비한다.
3. [운영과 복구 절차](handover/OPERATIONS.md)에 따라 별도 개발 환경에서 실행한다. 운영 DB에 초기 스키마를 실행하지 않는다.
4. 아래 비공개 자산과 외부 서비스 권한을 별도 보안 채널로 인계받는다.
5. [인수 확인표와 남은 위험](handover/ACCEPTANCE.md)의 검증 결과를 기존 담당자와 확인한다.
6. 백업 복구를 별도 환경에서 검증한 뒤 운영 변경 권한과 책임을 넘긴다.

## Git 밖에서 반드시 받아야 하는 것

Git clone만으로 운영 데이터와 서명키는 복원되지 않는다. 각 항목의 보관 위치·전달일·인수자·복구 확인 결과를 비공개 인계 기록에 남긴다.

| 자산 | 인계 시 확인할 내용 |
| --- | --- |
| 운영 `.env`와 실행 환경 | `bebeu/v2/.env`, 실행 배치/예약 작업이 덮어쓰는 환경변수, 실제 데이터 경로 |
| MariaDB | 전체 DB 덤프, DB 계정 및 권한, 서버 버전, 실제 데이터 디렉터리, 복원 방법 |
| 사진 원본 및 파생 파일 | 실제 `PHOTO_ROOT` 전체. 채팅·품목 사진과 표시용 파일을 함께 이관 |
| Web Push | `push-vapid.json` 등 실제 사용 중인 VAPID 파일. 경로는 서버 코드에서 확인 |
| 카페 자동화 | 네이버 계정 관리 권한과 브라우저 프로필 위치. 새 PC에서는 직접 재로그인 |
| Android 업로드 서명 | 기존 `.jks`/`.keystore`, 별칭, 암호, `android/keystore.properties`, 인증서 지문 |
| Google Play | 해당 앱에 대한 적절한 Console 권한, 테스터 목록, 개인정보/권한 신고 현황 |
| Kakao | Developers 및 Mobility 앱 관리 권한, JS/REST 키, 등록 도메인, API 사용 한도/결제 주체 |
| Naver | 카페/게시판 운영 권한, 연동 앱 권한, 필요한 API 설정 |
| Cloudflare / 도메인 | DNS, Tunnel, 인증 파일과 config, 갱신·비용 담당자 |
| 운영 PC / 원격 관리 | Windows 계정, Tailscale 장치 접근, SSH 공개키 등록, 방화벽 범위, 서버 실행 작업 |
| 복구 자료 | 최근 정상 백업, 이전 배포 파일, 배포 이력, 장애 연락망 |

비밀번호·REST 키·고객 DB·사진·브라우저 로그인 세션은 GitHub 이슈나 README에 첨부하지 않는다.
기존 담당자의 개인 계정과 SSH 개인키를 공유하는 대신 인수자 계정에 필요한 권한만 부여한다.
인수 검증 후 불필요한 이전 접근 권한을 회수하고 노출 가능성이 있는 비밀값은 교체한다.

## 관련 문서

- [운영 / 배포 / 백업 / 복구](handover/OPERATIONS.md)
- [코드 구조 / 데이터 / 웹과 앱의 차이](handover/ARCHITECTURE.md)
- [인수 검증 / 보안 위험 / 문제 해결](handover/ACCEPTANCE.md)
- [Android 빌드](android-release.md), [브랜치 규칙](android-branch.md)
- [카카오 배송 상세](../bebeu/v2/docs/KAKAO_DELIVERY.md)
- [업데이트 안내 동작](../bebeu/v2/docs/APP_UPDATE.md)

이 변경은 인계 문서 정리이며 서버 설정 변경, 데이터 이전, 앱 신규 출시를 수행하지 않는다.
