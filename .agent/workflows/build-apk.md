---
description: How to build the Android APK for Aurora OS.js
---

# Build Android APK

Follow these steps to build the APK for Aurora OS.js.

## Prerequisites
- Android Studio installed
- Android SDK installed

## Steps

1. **Build Web Assets**
   Compile the React project to the `dist` folder.
   ```bash
   npm run build
   ```

2. **Sync Capacitor**
   Copy the web assets to the native Android project.
   ```bash
   npx cap sync
   ```

3. **Open Android Studio**
   Open the native project in Android Studio.
   ```bash
   npx cap open android
   ```

4. **Build APK**
   - In Android Studio, go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - The APK will be generated in `android/app/build/outputs/apk/debug/app-debug.apk`.
   - Locate the APK and install it on your device.

## Troubleshooting
- If `npx cap open android` fails, manually open the `android` folder in Android Studio.
- Ensure your `JAVA_HOME` is set correctly if you encounter Gradle errors.
