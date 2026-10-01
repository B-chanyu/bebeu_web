# Google Play 배포

## 1. 업로드 키 생성

Android Studio에서 `android` 폴더를 연 뒤 `Build > Generate Signed Bundle / APK > Android App Bundle`을 선택한다.

- Key store path: `D:/bebeu-keys/bebeu-upload.jks`
- Key alias: `bebeu-upload`
- Validity: 25년 이상

키 파일과 비밀번호는 Git에 올리지 않고 별도 저장 장치에도 백업한다.

## 2. 서명 설정

`android/keystore.properties.example`을 `android/keystore.properties`로 복사한 뒤 실제 값을 입력한다.

```properties
storeFile=D:/bebeu-keys/bebeu-upload.jks
storePassword=업로드키_비밀번호
keyAlias=bebeu-upload
keyPassword=키_비밀번호
```

## 3. AAB 생성

JDK와 Android SDK 환경 변수가 설정된 PowerShell에서 실행한다.

```powershell
cd C:\bebeyu\bebeu\v2
npm run native:android:bundle
```

생성 파일:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## 4. Play Console 입력

- 앱 이름: `BEBEU WORK`
- 패키지명: `cloud.bebeu.work`
- 개인정보처리방침: `https://app.bebeu.cloud/privacy.html`
- 광고 포함 여부: 광고 없음
- 앱 접근 권한: 심사용 직원 계정 제공
- 카메라: 작업 사진 촬영
- 위치: 배송 위치 표시 및 배송 경로 생성

첫 배포는 내부 테스트 트랙에 AAB를 올려 실제 기기에서 확인한 뒤 비공개 또는 운영 트랙으로 승격한다.

## 5. 업데이트

매 업데이트마다 `android/app/build.gradle`의 `versionCode`를 증가시키고 사용자에게 표시할 `versionName`도 갱신한다. 동일한 업로드 키로 새 AAB를 생성한다.
