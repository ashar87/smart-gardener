<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e8d2081a-ddc3-477e-8a92-a9c12a097846

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deployment & Android Build

### 1. Generate Release Key (First time only)
Run this from the project root to generate a keystore in the Android folder:
```bash
keytool -genkey -v -keystore android/app/release.keystore -alias plant-patrol -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configure Credentials
Update `android/gradle.properties` with your passwords:
- `RELEASE_STORE_PASSWORD`
- `RELEASE_KEY_PASSWORD`

### 3. Build App Bundle (.aab)
```bash
npm run build
npx cap sync android
cd android && ./gradlew bundleRelease
```
The bundle will be at `android/app/build/outputs/bundle/release/app-release.aab`.
