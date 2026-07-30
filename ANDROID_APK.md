# Building the Namma Spot APK

The Android build needs the Android SDK + Gradle, which cannot run inside Lovable.
Do these steps once on your own machine (Android Studio installed, Java 17+).

1. **Publish the app** in Lovable, then open `capacitor.config.ts` and set
   `server.url` to your published URL (e.g. `https://namma-spot.lovable.app`).
2. Export the project to GitHub, `git clone` it, then:

   ```bash
   npm install
   npx cap add android      # creates the android/ project (first time only)
   npx cap sync android
   ```

3. Build the APK:

   ```bash
   cd android
   ./gradlew assembleDebug      # debug APK for testing
   # or, for a store-ready build:
   ./gradlew assembleRelease
   ```

   The file lands at
   `android/app/build/outputs/apk/debug/app-debug.apk`.

   You can also run `npx cap open android` and use **Build → Build Bundle(s)/APK(s) → Build APK(s)** in Android Studio.

4. Copy the APK to your phone and install it (allow "install unknown apps").

## Signing a release APK

```bash
keytool -genkey -v -keystore namma-spot.keystore -alias nammaspot \
  -keyalg RSA -keysize 2048 -validity 10000
```

Add the keystore details to `android/app/build.gradle` (`signingConfigs`) or via
Android Studio's **Generate Signed Bundle / APK** wizard.

## Google API key

The app does **not** ship a key. On first launch, tap **Add your Google API key**
and paste a Google Cloud key. It is stored on the device and used for the map,
search, place details, nearby lookups and routing.

Enable these APIs on that key's Google Cloud project:

- Maps JavaScript API
- Places API (New)
- Routes API

Because the APK loads the site from your published domain, restrict the key by
**HTTP referrer** to that domain (`https://your-app.lovable.app/*`), or leave it
unrestricted while testing.