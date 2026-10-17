# BEBEU WORK Android 배포

## 프로젝트 위치

프로젝트는 저장소의 `bebeu/v2`입니다. 이 문서의 `D:\bebeyu`는 기존 외장 드라이브 배치 예시이며 현재 체크아웃 위치와 다를 수 있습니다. 실제 경로에 맞춰 변경하세요. 앱 ID는 `cloud.bebeu.work`이며 기존 앱의 패키지 ID를 바꾸지 마세요. 운영 데이터와 비공개 설정은 [인수인계 안내](HANDOVER.md)에 따라 별도 보관합니다.

외장 드라이브는 exFAT입니다. 실행 중 분리하거나 드라이브 문자가 바뀌면 서버와 Android 빌드가 중단됩니다. 빌드 중에는 드라이브를 연결 상태로 유지하고, 저장소와 사진은 별도 장소에도 백업하세요.

## 개발 도구

- Node.js 22 이상
- Android Studio와 Android SDK Platform 36
- Android SDK Build-Tools 및 Platform-Tools

현재 PC에는 Android Studio가 `D:\Android\android-studio`, SDK가 `D:\Android\sdk`, Java 21이 `D:\Android\jdk-21.0.12.1+1`에 설치되어 있습니다. Android Studio에서 `D:\bebeyu\bebeu\v2\android`를 프로젝트로 여세요. Gradle JDK는 설치한 Java 21을 선택해야 합니다. 현재 Android Studio 번들 Java 25는 이 프로젝트의 Gradle 8.14.3과 호환되지 않습니다.

명령줄에서 디버그 APK를 빌드할 때는 다음 환경 변수를 설정하세요.

```powershell
Set-Location D:\bebeyu\bebeu\v2\android
$env:JAVA_HOME = 'D:\Android\jdk-21.0.12.1+1'
$env:ANDROID_HOME = 'D:\Android\sdk'
$env:GRADLE_USER_HOME = 'D:\Android\gradle-cache'
.\gradlew.bat :app:assembleDebug
```

APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다. 에뮬레이터 가속과 ADB 연결 상태는 인수자의 PC에서 확인하세요. 카메라·갤러리 드롭·위치 알림은 실제 사용 기기로 별도 검증합니다.

## 웹 변경 후 Android 동기화

```powershell
Set-Location D:\bebeyu\bebeu\v2
npm ci
npm run native:android:sync
npm run native:android
```

`npm ci`는 처음 한 번과 의존성 변경 후에 실행합니다. 일반적인 웹 코드 변경 후에는 `npm run native:android:sync`로 묶인 웹 자산을 갱신합니다. 서버 `server.js`와 비밀정보는 Android 앱에 포함되지 않으며, 앱은 HTTPS API 서버에 연결됩니다.

## 실기기 검증

1. 로그인, 목록, 채팅, 사진 촬영/선택/업로드를 확인합니다.
2. 배송 계정에서 위치·알림 권한과 배송 시작 동의를 확인합니다. Android 위치 foreground service의 화면 꺼짐 추적과 이전/다음/종료 알림을 실기기로 검증합니다. OS 절전 제한에 따라 동작이 달라질 수 있습니다.
3. 현재 지도는 운영 도메인의 iframe에서 Kakao SDK로 표시합니다. Kakao에 지도 페이지 도메인을 등록하고 서버 REST 키는 앱 자산에 넣지 않습니다. [배송 지도 안내](../bebeu/v2/docs/KAKAO_DELIVERY.md)를 참고하세요.
4. 앱 종료 후 재실행, 네트워크 장애 및 계정 로그아웃을 확인합니다.
5. 웹 푸시는 네이티브 푸시와 다릅니다. 알림이 필수라면 별도 Firebase/네이티브 푸시 작업 후 테스트합니다.

## Play Store 제출

Android Studio에서 `Build > Generate Signed Bundle / APK > Android App Bundle`을 선택하여 업로드용 키로 서명한 `.aab`를 생성합니다. 생성한 `.jks` 키와 암호는 Git 저장소 밖에 백업하세요. `versionCode`는 제출할 때마다 증가시킵니다.

Play Console에는 앱 설명, 512px 아이콘, 스크린샷, 개인정보처리방침, 데이터 보안 항목, 위치/사진 권한의 사용 목적, 심사용 로그인 계정이 필요합니다. 내부 테스트에 먼저 배포해 실기기 동작을 확인한 뒤 운영 출시를 진행하세요. 등록 비용과 계정 검증은 Play Console에서 처리합니다.
