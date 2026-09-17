# BEBEU WORK 네이티브 빌드

## 현재 상태

- Capacitor 앱 ID: `cloud.bebeu.work`
- 웹 자산: `bebeu/v2/public`
- API 서버: `https://app.bebeu.cloud`
- GitHub Actions: `main` 푸시 또는 수동 실행 시 iOS 시뮬레이터 빌드 검사

GitHub Actions의 결과는 서명되지 않은 시뮬레이터용 빌드입니다. iPhone 설치, TestFlight 또는 App Store 제출용 IPA를 만들려면 Apple Developer 계정의 배포 인증서, 프로비저닝 프로파일 및 서명 설정이 추가로 필요합니다. Apple 계정 정보나 인증서 파일을 저장소에 커밋하지 마세요.

## iOS 로컬 빌드

최신 Capacitor 8과 호환되는 macOS, Xcode, Node.js 22 이상이 필요합니다.

```bash
cd bebeu/v2
npm ci
npm run build:app
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode에서 Bundle ID, 서명 Team, 사진/카메라/위치 권한 설명, 아이콘 및 Privacy Manifest를 확인한 뒤 실기기에서 검사하세요. `ios/` 프로젝트를 로컬에서 생성했다면 추후 네이티브 설정 변경을 보존하도록 Git에 별도 추가해야 합니다.

## 운영 설정

네이버 지도 Client ID와 Client Secret은 서버의 `NAVER_MAPS_CLIENT_ID`, `NAVER_MAPS_CLIENT_SECRET` 환경 변수로만 설정합니다. 앱 또는 GitHub 저장소에 Secret을 넣지 않습니다. 네이버 지도 Web SDK가 네이티브 WebView의 `capacitor://localhost` 출처를 허용하는지도 별도로 검증해야 합니다. 허용되지 않으면 지도 표시 방식을 네이티브 SDK 또는 승인된 웹 출처 기반 화면으로 변경해야 합니다.

웹 푸시와 백그라운드 위치 추적도 네이티브 앱에서는 별도 구현과 실기기 검증이 필요합니다. 이 빌드 검사는 해당 기능의 동작을 보장하지 않습니다.
