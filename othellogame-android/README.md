# Reversi — Android app

An offline Reversi board game (play vs. 3 AI bots or pass-and-play on one device), originally generated with Google AI
Studio and turned into a Vite + React + TypeScript web app wrapped for Android with **Capacitor 8**.

| | |
|---|---|
| App name | `Reversi` |
| Package id (placeholder!) | `com.meneer.reversi` — set in **`app.identity.json`** |
| Target / compile SDK | **36** (Android 16) — required by Google Play for new apps since Aug 31, 2026 |
| Min SDK | 24 (Android 7.0) |
| Orientation | Portrait only, fullscreen (immersive) |

> ⚠️ **The package id is permanent once the app is published on Google Play.** Pick the final one before the first upload.

## Project layout
```
app.identity.json        <- app id, name, versionCode, versionName (ONE place)
capacitor.config.ts      <- reads app.identity.json
index.html, vite.config.ts, tsconfig.json
src/                     <- game source (App.tsx, reversiLogic.ts, useTournament.ts, ...)
  backend/               <- offline session (LocalSession.ts); plug Firebase etc. in here later
  settings.ts            <- defaults from playground_config.json + saved choices (localStorage)
  native.ts              <- Android: back button, status bar, pause music in background
public/assets/           <- images + music
assets/                  <- icon/splash sources for @capacitor/assets
android/                 <- native Android project (Gradle)
scripts/e2e.mjs          <- headless smoke test (Playwright)
_SIGNING-KEEP-SAFE/      <- upload keystore + passwords (NOT in git, back it up!)
```

## Requirements
- Node.js **22+** (Capacitor CLI requires it; Vite needs 20.19+)
- JDK **21**
- Android SDK: `platform-tools`, `platforms;android-36`, `build-tools;36.0.0` (Android Studio installs these for you)
- Create `android/local.properties` with `sdk.dir=/path/to/Android/sdk` if `ANDROID_HOME` isn't set.

## Build
```bash
npm install
npm run dev              # play in the browser at http://localhost:5173
npm test                 # unit tests (vitest) for the game engine
npm run build            # type-check + production web build into dist/
npm run e2e              # headless browser smoke test (after npm run build; first time: npx playwright install chromium)

npm run android:debug    # -> android/app/build/outputs/apk/debug/app-debug.apk   (install on a phone to test)
npm run android:release  # -> android/app/build/outputs/bundle/release/app-release.aab (upload to Play Console)
```
On Windows run the Gradle step as `cd android && gradlew.bat bundleRelease`.

You can also open the `android/` folder in Android Studio and use *Build › Generate Signed App Bundle*.

### Release signing
`android/keystore.properties` (not committed) tells Gradle where the upload key is:
```
storeFile=../_SIGNING-KEEP-SAFE/upload-keystore.jks
storePassword=...
keyAlias=upload
keyPassword=...
```
A copy is in `_SIGNING-KEEP-SAFE/keystore.properties.copy`. Without this file the release build is unsigned.

## Bump the version (every Play upload)
Edit `app.identity.json`:
```json
"versionCode": 2,        // +1 for EVERY upload, Play rejects a code it has seen before
"versionName": "1.0.1"   // what users see
```
then `npm run android:release`.

## Change the package id / app name
1. `app.identity.json` → `appId` (and/or `appName`).
2. App name shown under the icon: also edit `android/app/src/main/res/values/strings.xml` (`app_name`, `title_activity_main`).
3. Rebuild. (The Java package/namespace `com.meneer.reversi` inside `android/` is internal and can stay.)

## Icons & splash
Sources are in `assets/` (made from the game's disc and felt artwork). Regenerate after editing them:
```bash
npx capacitor-assets generate --android --iconBackgroundColor '#064e3b' --splashBackgroundColor '#09090b' --splashBackgroundColorDark '#09090b'
```

## What changed vs. the AI Studio export
- **Online multiplayer removed for v1.** It depended on the AI Studio Playground SDK/RPC host, which doesn't exist outside AI Studio.
  The lobby button is gone; `usePlaygroundMultiplayer`, `useRpc`/`usePlayground`, `playground-fake.ts` and `agent_injected.d.ts`
  were dropped. `src/backend/LocalSession.ts` implements the same interface offline (one local player, always host),
  so the tournament flow (3 rounds, podium) still works. To add online play later, write e.g. a `FirebaseSession`
  with the same methods and return it from `createGameBackend()` in `src/backend/useGameBackend.ts`.
- Settings use `playground_config.json` as defaults and remember the player's choices (hints, colorblind) in localStorage.
- Board is drawn in code (wood frame, felt, 8×8 grid, star points, A–H/1–8 labels) so discs, hints and labels line up
  exactly with the cells. Canvas is 800×840; the evaluation bar is horizontal under the board.
- Portrait layout: HUD on top, board directly below at full width, move analysis fills the rest (checked at 360×800,
  393×852 and 412×915 by `npm run e2e`). Forfeit/menu buttons are compact on phones so they don't cover the HUD.
- Removed the "Connected (Host)" network badge. Title is "Reversi" (not "Othello", that's a trademark).
- Real `@types/react` instead of `agent_injected.d.ts`; unused heavy libraries (three, phaser, rapier, framer-motion,
  lucide-react) are not installed — the game never imported them.
- Android: portrait lock, immersive fullscreen, Back button closes dialogs / asks before leaving a match / exits from
  the main menu, background music pauses when the app goes to the background.
- Note: on Android 16, large screens (tablets/foldables ≥ 600dp) may ignore the portrait lock; the layout still works.

## Still to do before publishing on Google Play
1. **Developer account** — [Play Console](https://play.google.com/console), one-time **US$25** fee, identity verification
   (government ID + card in your legal name), and device verification with the Play Console app (personal accounts).
2. **Final package id + name** (see above) — then rebuild.
3. **Paid app?** You need a **payments (merchant) profile** in Play Console (legal name, physical address, bank account).
   ⚠️ A free app can never be changed to paid later — decide before publishing.
4. **Privacy policy** — `privacy-policy.md` is a draft (the app collects no data). Fill in the support email and host it
   at a public URL (e.g. GitHub Pages / Google Sites) and paste that URL in Play Console.
5. **Store listing** — short description (80 chars), full description, app icon 512×512, feature graphic 1024×500,
   at least 2 phone screenshots (see `screenshots/`).
6. **App content forms** — content rating questionnaire (IARC), target audience, Data safety (answer: no data collected
   or shared), ads: none.
7. **Closed test** — new *personal* developer accounts (created after Nov 13, 2023) must run a closed test with
   **at least 12 testers opted in for 14 days in a row** before you can apply for production access.
   Organization accounts are exempt.
8. Keep **Play App Signing** on (default). Upload `app-release.aab` signed with the upload key in `_SIGNING-KEEP-SAFE/`.

Sources checked Oct 26, 2026: Play Console Help — Target API level requirements (answer 11926878), App testing
requirements for new personal developer accounts (14151465), Get started with Play Console (6112435), Create a payments
profile (7161426), Set up your app's prices (6334373).

## Changelog
- **1.0.1** (versionCode 2): board grid/disc alignment fixed (code-drawn board), portrait layout without dead space, compact HUD buttons, rounded eval label.
- **1.0.0** (versionCode 1): first Android build.
