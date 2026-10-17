# Android 앱 버전 관리

- 웹 기준 브랜치: `main`
- Android 앱 브랜치: `codex/android-app`
- 인계 기준 앱 버전: `1.16` (`versionCode 17`), 웹 자산 `331`
- 배포 트랙: Google Play 내부 테스트

앱 작업은 `codex/android-app`에서 진행한다. 웹과 공통으로 사용하는 변경은 검토 후 `main`에 반영한다.
현재 인계 코드 전체는 이 앱 브랜치에 있다. `main`이 최신 앱 코드와 같다고 가정하지 않는다.
최신 운영 상태는 별도 확인하며, 상세 절차는 [인수인계 안내](HANDOVER.md)를 따른다.

```powershell
git switch codex/android-app
git pull --ff-only
```

버전 변경은 `bebeu/v2/android/app/build.gradle`에서 관리하며, 새 배포 시 `versionCode`를 증가시킨다.

커밋은 `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore` 접두사와 간결한 한글 설명을 사용한다.
서명 키, 비밀번호, 환경 설정 및 APK/AAB 산출물은 커밋하지 않는다.
