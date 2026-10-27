# WhisprTalk on iPhone (openwhispr-mobile)

Status (2026-10-27): the iOS Simulator Debug build succeeds as **WhisprTalk** (`com.lrtogi.whisprtalk`).
The device install below has not been done yet. It needs your Apple signing team and a connected iPhone.

## Toolchain that worked

| Tool | Version | Notes |
|---|---|---|
| Node | 24.22.1 via nvm (`.nvmrc` = 24) | `.npmrc` has `engine-strict=true`, so other Node versions fail |
| Ruby | rbenv 3.2.6 (`RBENV_VERSION=3.2.6`) | The global rbenv default is system Ruby 2.6, which is too old for CocoaPods 1.16 |
| CocoaPods | 1.16.2 via `bundle exec` (Gemfile adds `cocoapods-spm`) | |
| Xcode | 27.1, iOS 26.x simulators | |

## Local identity (already done)

`openwhispr-mobile/.env.local` (git-ignored by `.env*.local`) is a copy of `.env.example` with these lines added:

```dotenv
OPENWHISPR_APP_ENV=development
OPENWHISPR_IOS_BUNDLE_IDENTIFIER=com.lrtogi.whisprtalk
OPENWHISPR_ANDROID_PACKAGE=com.lrtogi.whisprtalk
OPENWHISPR_SCHEME=whisprtalk
OPENWHISPR_DISPLAY_NAME=WhisprTalk
OPENWHISPR_KEYBOARD_DISPLAY_NAME=WhisprTalk
```

These resolve to the following values:
- Bundle IDs: `com.lrtogi.whisprtalk` (app), `com.lrtogi.whisprtalk.keyboard`, `com.lrtogi.whisprtalk.activity`
- App Group: `group.com.lrtogi.whisprtalk` (all three targets)
- URL scheme: `whisprtalk`

## Commands that worked

```bash
cd ~/Projects/OpenWhispr/openwhispr-mobile
source ~/.nvm/nvm.sh && nvm use 24
export RBENV_VERSION=3.2.6 LANG=en_US.UTF-8 SENTRY_DISABLE_AUTO_UPLOAD=true

npm ci
bundle install          # adds an arm64-darwin-27 platform line to Gemfile.lock; don't commit it

# verify identity
OPENWHISPR_APP_ENV=development npx expo config --type public

# generate ios/ (gitignored) and run pod install
npm run prebuild:dev -- --clean --platform ios

# simulator build (no signing)
cd ios
xcodebuild -workspace OpenWhispr.xcworkspace -scheme OpenWhispr \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/dd CODE_SIGNING_ALLOWED=NO build
```

Output: `openwhispr-mobile/ios/build/dd/Build/Products/Debug-iphonesimulator/OpenWhispr.app`. The file is named
`OpenWhispr.app` because the Xcode target name is unchanged, but the home-screen name is WhisprTalk.

To run it in the simulator, start Metro with `npm start`, then run
`xcrun simctl install booted <path to .app>` and `xcrun simctl launch booted com.lrtogi.whisprtalk`.
You can also run `npm run ios`, which builds the app and starts Metro.

Notes:
- npm 11 skips dependency install scripts (sentry-cli, better-sqlite3, esbuild, and others). The root `postinstall` still runs (patch-package, fonts). The iOS build doesn't need the skipped scripts.
- `ios/.xcode.env.local` now contains `export SENTRY_DISABLE_AUTO_UPLOAD=true`. With it, Xcode GUI builds don't try to upload to OpenWhispr's Sentry org. A `prebuild --clean` regenerates this file, so add the line again after each one.
- The Live Activity extension's display name is still "OpenWhispr", because the plugin hardcodes it. Only the Live Activity uses it.

## Remaining steps to install on your iPhone (you must do these)

1. **Apple Developer Program team (paid).** All three targets use the App Group `group.com.lrtogi.whisprtalk`, which a free Personal Team can't use. The main app also requests Push Notifications (`aps-environment`) and Sign in with Apple, which free teams also can't use.
   - Your keychain has a Distribution cert for *So Healthful Innovations Pty Ltd* (team `N8H5B55PTU`), so that team is probably paid. Use it, or your own paid team if you have one.
   - The personal "Apple Development: Louis Partogi / Louis Rizki Partogi" certs could belong to free Personal Teams. To build with a free team, you would have to remove the App Group, Push and Sign in with Apple entitlements. That breaks the keyboard ↔ app handoff, so it isn't recommended.
2. **Connect the iPhone** by USB, unlock it, and tap *Trust This Computer*.
3. **Turn on Developer Mode** on the phone: Settings → Privacy & Security → Developer Mode → On. The phone restarts; confirm when it comes back.
4. **Open the workspace**:
   ```bash
   open ~/Projects/OpenWhispr/openwhispr-mobile/ios/OpenWhispr.xcworkspace
   ```
   Open the `.xcworkspace`, not the `.xcodeproj`. If Xcode isn't signed in yet: Xcode → Settings → Accounts → add your Apple ID.
5. **Select the team on all three targets**: `OpenWhispr` (main app), `OpenWhisprKeyboard`, and `OpenWhisprActivity`. For each one, open Signing & Capabilities, tick *Automatically manage signing*, and choose the team. Xcode then registers the three bundle IDs and the App Group `group.com.lrtogi.whisprtalk` with that team. If a bundle ID is already taken, change `OPENWHISPR_IOS_BUNDLE_IDENTIFIER` in `.env.local`, then run prebuild again.
6. **Run on the phone.** In Xcode, pick your iPhone as the run destination and press Run.
   - A **Debug** build loads its JS from Metro, so run `npm start` on the Mac and keep the phone on the same Wi-Fi.
   - For a build that runs on its own: Product → Scheme → Edit Scheme → Run → Build Configuration = **Release**. From the CLI:
     ```bash
     SENTRY_DISABLE_AUTO_UPLOAD=true npx expo run:ios --device --configuration Release
     ```
7. On first launch, if iOS blocks the app, go to Settings → General → VPN & Device Management and trust your developer profile.
8. **Enable the keyboard**: Settings → General → Keyboard → Keyboards → Add New Keyboard → WhisprTalk. Then turn on *Allow Full Access*, which the keyboard needs for the microphone and App Group handoff.

Development-signed installs from a paid team expire after about 1 year (7 days with a free team). To refresh, run the app from Xcode again.

Running `prebuild --clean` again recreates `ios/`, and you lose the team selection from step 5. In that case, do step 5 again. Another option is to set `ios.appleTeamId` locally. Don't commit it: `app.base.json` holds OpenWhispr's team.

## What works without OpenWhispr cloud

- **On-device transcription.** In AI Models, choose On-Device. The models available are whisper.rn (Whisper models downloaded in the app) and Parakeet (`modules/parakeet-asr`). Dictation and uploads can each use a specific downloaded model or Automatic.
- **Bring Your Own Key.** In AI Models, open a workflow, choose Bring Your Own Key, then pick OpenAI, Groq, OpenRouter (text only) or **Custom**. Custom accepts any OpenAI-compatible server, with an optional key. Public hosts need HTTPS. For a server on your Mac, use the Mac's LAN IP (not `localhost`) and allow Local Network access. No OpenWhispr account or Pro subscription is needed. Keys stay in the device Keychain.
- Keyboard dictation (when set to On-Device or BYOK) and the local dictionary need no account. Markdown/plain-text note exports work offline.
- These features **need OpenWhispr cloud** and an account: hosted transcription, cloud sync, note sharing links and invites, and Pro or paywall features. Superwall, RevenueCat, AppsFlyer and Sentry are disabled because their keys are empty in `.env.local`.
