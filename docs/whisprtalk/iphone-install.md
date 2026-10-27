# WhisprTalk on iPhone (openwhispr-mobile)

Status (2026-10-27): a **Release build signed with the free Personal Team "Louis Rizki Partogi" (H8MQT3PRR9,
the team of the Apple ID togisihombing@gmail.com)** is installed and running on the iPhone "Louis"
(iPhone 16 Pro, UDID `00008140-000905D83CFB001C`) as **WhisprTalk** (`com.lrtogi.whisprtalk.ios`).
It is a self-contained Release build: no Metro, the phone can be unplugged.

Why `.ios` on the bundle ID: a first attempt used team GYR4C58JWC, which turned out to be the Personal Team of
the l.partogi@sprintdigital.com.au Apple ID. That attempt registered the App ID `com.lrtogi.whisprtalk` with
GYR4C58JWC, and Apple does not let a second team register the same App ID ("Failed Registering Bundle
Identifier ... not available"), so the gmail team uses `com.lrtogi.whisprtalk.ios`. That build was uninstalled
from the phone; the GYR4C58JWC certificate and App ID still exist in Apple's portal (free teams cannot delete
App IDs) and in the login keychain, and are simply unused.

Built app: `openwhispr-mobile/ios/build/dd/Build/Products/Release-iphoneos/OpenWhispr.app`
(the Xcode target is still called OpenWhispr; the home-screen name is WhisprTalk).

## Toolchain that worked

| Tool | Version | Notes |
|---|---|---|
| Node | 24.22.1 via nvm (`.nvmrc` = 24) | `.npmrc` has `engine-strict=true`, so other Node versions fail |
| Ruby | rbenv 3.2.6 (`RBENV_VERSION=3.2.6`) | The global rbenv default is system Ruby 2.6, which is too old for CocoaPods 1.16 |
| CocoaPods | 1.16.2 via `bundle exec` (Gemfile adds `cocoapods-spm`) | |
| Xcode | 27.1, iOS 26.x simulators; phone on iOS 27.0.1 with Developer Mode on | |

## Local identity (already done)

`openwhispr-mobile/.env.local` (git-ignored by `.env*.local`) is a copy of `.env.example` with these lines added:

```dotenv
OPENWHISPR_APP_ENV=development
OPENWHISPR_IOS_BUNDLE_IDENTIFIER=com.lrtogi.whisprtalk.ios
OPENWHISPR_ANDROID_PACKAGE=com.lrtogi.whisprtalk
OPENWHISPR_SCHEME=whisprtalk
OPENWHISPR_DISPLAY_NAME=WhisprTalk
OPENWHISPR_KEYBOARD_DISPLAY_NAME=WhisprTalk
OPENWHISPR_FREE_TEAM=1
```

`EXPO_PUBLIC_API_URL` is left at `https://api.openwhispr.com`. Leaving it empty changes nothing: every
consumer (`src/config/constants.ts`, `apiClient.ts`, `authClient.ts`, `referralApi.ts`, `noteSharing.ts`)
falls back to that same URL. Only sign-in, cloud transcription, sync and sharing use it; on-device and
Bring Your Own Key transcription never do.

## Free-team variant (`OPENWHISPR_FREE_TEAM=1`)

A free Personal Team cannot sign App Groups, push, Sign in with Apple or extensions, so
`app.config.js` has an env-gated switch. With the flag set, prebuild:

- drops the `OpenWhisprKeyboard` and `OpenWhisprActivity` extension targets (their config plugins are
  skipped),
- strips the `com.apple.security.application-groups`, `aps-environment` and
  `com.apple.developer.applesignin` entitlements (an inline `withFreeTeamEntitlements` plugin; it is first
  in the plugin list because Expo runs mods in reverse order, and the notifications / apple-auth plugins
  are applied for every installed package regardless of the plugin list),
- sets `ios.usesAppleSignIn=false`, removes `NSSupportsLiveActivities`, and removes `ios.appleTeamId`
  (OpenWhispr's team from `app.base.json`) so the team only comes from the xcodebuild command line.

Without the flag the config is byte-for-byte the normal one. The generated `ios/OpenWhispr/OpenWhispr.entitlements`
is an empty dict and `ios/` has no extension folders.

What this costs on the phone:

- **No WhisprTalk dictation keyboard** (the keyboard extension is gone), so no dictation inside other apps and
  no Settings → Keyboards entry. Dictation, meeting recording, on-device models and BYOK in the app itself work.
- **No Live Activity / Dynamic Island card** while recording. The native module is still linked but
  `ActivityAuthorizationInfo().areActivitiesEnabled` is false without `NSSupportsLiveActivities`, so it no-ops.
- **No push notifications and no Sign in with Apple.** Email/password sign-in to OpenWhispr cloud would still work.
- No JS guard was needed: the `AppGroupStorage` native module still loads, `UserDefaults(suiteName:)` returns a
  private suite without the entitlement, and every App Group read/write in `src/` is on the keyboard-handoff
  path (`useKeyboardHandoff.ts`, `HomeScreen.tsx`), which never runs without the keyboard.

## Commands that worked (device build)

```bash
cd ~/Projects/OpenWhispr/openwhispr-mobile
source ~/.nvm/nvm.sh && nvm use 24
export RBENV_VERSION=3.2.6 LANG=en_US.UTF-8 SENTRY_DISABLE_AUTO_UPLOAD=true

# generate ios/ (gitignored) and run pod install; .env.local supplies OPENWHISPR_FREE_TEAM=1
npm run prebuild:dev -- --clean --platform ios
echo 'export SENTRY_DISABLE_AUTO_UPLOAD=true' >> ios/.xcode.env.local   # prebuild --clean resets this file

# Release build for the phone, signed by the free Personal Team only
cd ios
xcodebuild -workspace OpenWhispr.xcworkspace -scheme OpenWhispr \
  -configuration Release -destination 'id=00008140-000905D83CFB001C' \
  -derivedDataPath build/dd -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=H8MQT3PRR9 CODE_SIGN_STYLE=Automatic build

# check the signature before installing: expect Authority=Apple Development: togisihombing@gmail.com (...)
# and TeamIdentifier=H8MQT3PRR9
codesign -dvv build/dd/Build/Products/Release-iphoneos/OpenWhispr.app

# install and launch (phone unlocked, Developer Mode on)
xcrun devicectl device install app --device 00008140-000905D83CFB001C \
  build/dd/Build/Products/Release-iphoneos/OpenWhispr.app
xcrun devicectl device process launch --device 00008140-000905D83CFB001C com.lrtogi.whisprtalk.ios
```

Signing facts, for the record (Personal Team → Apple ID mapping, from the minted certificates' OU):
- **H8MQT3PRR9 "Louis Rizki Partogi (Personal Team)" = togisihombing@gmail.com.** This is the team to use.
  `-allowProvisioningUpdates` minted "Apple Development: togisihombing@gmail.com (9JLCZ33G97)". `codesign -dvv`
  on the installed .app shows `TeamIdentifier=H8MQT3PRR9` and entitlements of only `application-identifier`
  and `get-task-allow`.
- GYR4C58JWC "Louis Partogi (Personal Team)" = l.partogi@sprintdigital.com.au (it minted "Apple Development:
  l.partogi@sprintdigital.com.au (Z68VLZAFZ8)"). Do not use it.
- The pre-existing "Apple Development: Louis Partogi (W554539V87)", "Louis Rizki Partogi (HHTR9B3HGC)" and
  "Created via API" certs carry the company team IDs (OU N8H5B55PTU / ZJ54NQ9C46) and were never used; automatic
  signing cannot pair them with a Personal Team.
- No `DEVELOPMENT_TEAM` is written into `ios/OpenWhispr.xcodeproj` in free-team mode; it only comes from the command line.
- Changing only the bundle ID does not need `--clean`: `npm run prebuild:dev -- --platform ios` re-syncs `ios/`
  and keeps `build/dd`, so the rebuild is incremental.
- The simulator build from before (Debug, `CODE_SIGNING_ALLOWED=NO`, `-sdk iphonesimulator`) still works with the same workspace.

## First launch (on the phone)

The H8MQT3PRR9 build launched straight away from `devicectl`. If iOS ever refuses with "profile has not been
explicitly trusted by the user" (for example after a reinstall with a new certificate), trust it on the iPhone:
**Settings → General → VPN & Device Management → Developer App → "Apple Development: togisihombing@gmail.com"
→ Trust → Trust**, then tap the WhisprTalk icon or rerun the launch command above.
Developer Mode is already on (checked with `devicectl device info details`).

## Free Personal Team limits

- The development profile **expires after 7 days**. After that the app refuses to open; rebuild and reinstall
  with the two `xcodebuild` / `devicectl install` commands above (data in the app is kept on reinstall).
- A free team may hold at most 10 app IDs per 7 days and 3 installed dev apps per device.
- `prebuild --clean` regenerates `ios/` and `.xcode.env.local`; rerun the `echo ... >> ios/.xcode.env.local` line.

## What works without OpenWhispr cloud

- **On-device transcription.** In AI Models, choose On-Device. The models available are whisper.rn (Whisper models downloaded in the app) and Parakeet (`modules/parakeet-asr`). Dictation and uploads can each use a specific downloaded model or Automatic.
- **Bring Your Own Key.** In AI Models, open a workflow, choose Bring Your Own Key, then pick OpenAI, Groq, OpenRouter (text only) or **Custom**. Custom accepts any OpenAI-compatible server, with an optional key. Public hosts need HTTPS. For a server on your Mac, use the Mac's LAN IP (not `localhost`) and allow Local Network access. No OpenWhispr account or Pro subscription is needed. Keys stay in the device Keychain.
- The local dictionary and Markdown/plain-text note exports work offline.
- These features **need OpenWhispr cloud** and an account: hosted transcription, cloud sync, note sharing links and invites, and Pro or paywall features. Superwall, RevenueCat, AppsFlyer and Sentry are disabled because their keys are empty in `.env.local`.

## Going back to the full build (paid team only)

Remove `OPENWHISPR_FREE_TEAM=1` from `.env.local`, run `prebuild --clean` again, and sign all three targets with a
paid Apple Developer Program team in Xcode (App Group `group.com.lrtogi.whisprtalk.ios`, push, Sign in with Apple).
That restores the dictation keyboard and the Live Activity.
