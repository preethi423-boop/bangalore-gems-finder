#!/usr/bin/env bash
# Build a release-signed APK for Namma Spot.
# Requires: Java 17+, Android SDK (ANDROID_HOME set). Run on your own machine.
set -euo pipefail
cd "$(dirname "$0")/.."

KEYSTORE="android/namma-spot.keystore"
ALIAS="${KEY_ALIAS:-nammaspot}"

if [ ! -f "$KEYSTORE" ]; then
  echo "No keystore found. Creating one (answer the prompts, remember the password)..."
  keytool -genkeypair -v -keystore "$KEYSTORE" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000
fi

if [ ! -f "android/keystore.properties" ]; then
  read -rsp "Keystore password: " KSPASS; echo
  cat > android/keystore.properties <<PROPS
storeFile=namma-spot.keystore
storePassword=$KSPASS
keyAlias=$ALIAS
keyPassword=$KSPASS
PROPS
  echo "Wrote android/keystore.properties (git-ignored - keep it private)."
fi

npm run build
npx cap sync android
(cd android && ./gradlew assembleRelease)

echo
echo "Signed APK: android/app/build/outputs/apk/release/app-release.apk"
