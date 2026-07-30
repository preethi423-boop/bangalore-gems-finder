# Building the release-signed Namma Spot APK

Compiling an APK needs the Android SDK, Gradle and a JDK — none of which exist in
Lovable's build sandbox, so the `.apk` binary has to be produced on your machine.
Everything else is already done: the `android/` project is committed and release
signing is wired up in `android/app/build.gradle`.

## One command

On a machine with **Java 17+** and the **Android SDK** (`ANDROID_HOME` set):

```bash
git clone <your-github-export> && cd <repo>
npm install
./scripts/build-apk.sh
```

The script will:

1. Create `android/namma-spot.keystore` if you don't have one (prompts you for a
   password and certificate details).
2. Write `android/keystore.properties` with the signing credentials (git-ignored).
3. Build the web bundle, `npx cap sync android`, then `./gradlew assembleRelease`.

Output: **`android/app/build/outputs/apk/release/app-release.apk`** — signed and
installable. Copy it to your phone and allow "install unknown apps".

## Before you build

**Publish the app** in Lovable, then set `server.url` in `capacitor.config.ts` to
your published URL (e.g. `https://bangalore-gems-finder.lovable.app`). The APK is a
wrapper that loads the hosted, server-rendered site.

## Reusing an existing keystore

Drop it at `android/namma-spot.keystore` (or set `storeFile` in
`android/keystore.properties`) and fill in `storePassword`, `keyAlias`,
`keyPassword`. CI can instead export `KEYSTORE_FILE`, `KEYSTORE_PASSWORD`,
`KEY_ALIAS`, `KEY_PASSWORD`.

For a Play Store upload bundle, run `./gradlew bundleRelease` instead
(`android/app/build/outputs/bundle/release/app-release.aab`).

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