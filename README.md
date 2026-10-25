# Open Loops

A mobile app for closing open loops: get what's on your mind out of your head, then give every item a decision. Built with Expo (SDK 58), local-first: all data lives in SQLite on the device.

## Install the app

The **preview build** is the app on its own: install it once and it runs without a computer. Open the build's link on your Android phone, download the APK, and install it (allow installs from your browser when Android asks). Anyone you share the link with can install it too.

New versions arrive over the air. Every push to `main` publishes an update (`.eas/workflows/publish-update.yml`); the app downloads it in the background when it opens and switches to it the next time it opens. To get it right away: **Settings → App version → Check for updates**. Your loops are kept.

An update only reaches builds made from the same native code (the `fingerprint` runtime version in `app.json`). After adding a library with native code or changing `app.json`, make a new preview build and install it over the old one.

A build only takes updates published after it bundled its own code, since the app always runs the newest version it has. An update published while a build is running is older than that build's code and is ignored, so publish again once the build finishes (push to `main`, or run the workflow by hand).

## Run it from your computer (Expo Go)

You need a computer (Windows, macOS or Linux) and a phone on the same Wi-Fi network.

1. On the computer, install [Node.js](https://nodejs.org) (the LTS version) and [Git](https://git-scm.com/downloads).
2. On the phone, install **Expo Go** from the App Store or Google Play.
3. On the computer, open a terminal (Terminal on macOS, PowerShell on Windows) and run:

   ```bash
   git clone https://github.com/efac-2718/OpenLoops.git
   cd OpenLoops
   npm install
   npx expo start
   ```

4. A QR code appears in the terminal. On Android, open Expo Go and tap **Scan QR code**. On iPhone, point the Camera app at the QR code and tap the banner. The app opens inside Expo Go.

When you save a change to the code, the app on your phone reloads by itself. Press `Ctrl+C` in the terminal to stop.

If the phone can't connect (for example on a work or university network that blocks devices from seeing each other), stop the server and run `npx expo start --tunnel` instead. If Expo Go says the project needs a different SDK version, update Expo Go from the store.

## The development build

Some features need native code that Expo Go doesn't have: the home-screen widget and the app shortcuts. To work on them, use a **development build**: an install that works like Expo Go (start the dev server, the app loads the latest code and reloads as you edit) but carries these extra native pieces.

The development build is a separate app, **Open Loops Dev** (`com.efac2781.openloops.dev`, link scheme `openloops-dev`), set by `app.config.js` when `APP_VARIANT=development`. It sits next to the real app with its own data, so trying things out never touches your loops.

1. **Install it once** from the build's link, like the preview build.
2. **Start the dev server** on your computer, in this folder:

   ```bash
   git pull
   npm install
   npm run dev
   ```

   On Windows, `npm run dev` doesn't work in PowerShell; run `$env:APP_VARIANT="development"; npx expo start` instead.

3. **Open Open Loops Dev on the phone.** It lists the dev server running on your network; tap it (or scan the QR code with the phone's camera). If the phone can't see your computer, add `--tunnel`.

Code changes don't need a new build; only adding native modules or changing `app.json` plugins does. To use Expo Go instead, run `npx expo start --go`.

Each install has its own data. To move loops between them, export a JSON backup in one and restore it in the other (Settings → Restore from a backup).

### Home-screen widget and shortcuts

- **Widget:** long-press the home screen → **Widgets** → **Open Loops**. It shows how many loops are waiting for a decision, what's due today, and whether today is closed. It updates whenever the app changes something. On Android, `expo-widgets` can't open the app from a widget tap, so the widget only shows information.
- **Shortcuts:** long-press the app icon for **Capture** and **Tonight**. Drag one onto the home screen to get a one-tap icon. They're added by `plugins/with-android-shortcuts.js` and open the app through its `openloops://` links.

## Commands

```bash
npm test               # unit tests (domain rules, dates, formatting)
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm run db:generate    # add a migration after changing src/db/schema.ts
```

## How it's organised

```
src/
  app/                 Screens (Expo Router)
    (tabs)/index.tsx   Capture: fast entry into the inbox; a brain dump becomes one loop per thought
    (tabs)/inbox.tsx   Inbox: everything still waiting for a decision; AI suggestions to accept or change
    (tabs)/active.tsx  Active: scheduled, next actions, waiting on someone; quick "Done"
    (tabs)/thinking.tsx  Thinking: loops left open on purpose, with their revisit day
    (tabs)/close.tsx   Tonight: the nightly close and its reminder time
    decide/[id].tsx    Decide: give a loop a decision or change one; edit its wording and notes
    settings.tsx       Settings: active-loop limit, AI suggestions, export, restore, app version and updates
    review.tsx         Weekly review: a step-by-step look at every open loop
    api/sort+api.ts    The AI server's one endpoint, POST /api/sort (runs on EAS Hosting, not in the app)
  domain/              The rules, as plain TypeScript (no React, no database)
    loop.ts            States, decisions, active-loop cap, what the nightly close asks about
    dates.ts           Calendar-day helpers and one-tap date choices
    reminder.ts        Nightly reminder times
    export.ts          Markdown and JSON export formats
    backup.ts          Reads a JSON backup and plans a merge: newer change wins, nothing deleted
    brain-dump.ts      Splits dictated or typed text into separate thoughts
    review.ts          Weekly review steps, what each one asks about, keeping, when one is due
    ai-sort.ts         What an AI sorting request may contain, and how answers become checked suggestions
  db/                  SQLite via Drizzle
    schema.ts          Tables: loops, daily_closes, weekly_reviews, settings
    migrations/        Generated by drizzle-kit; applied at startup
    client.ts          Opens the database and runs migrations
    loops.ts           The only module that writes loops; always goes through domain rules
    closes.ts          Records a nightly close (refused while anything needs a decision)
    settings.ts        Active-loop cap and reminder time
    reviews.ts         Starts, resumes, and finishes weekly reviews
    export.ts          Reads everything for an export
    restore.ts         Previews and applies a restore, all or nothing
  services/
    close-reminder.ts  Daily local notification; tapping it opens Tonight
    share-file.ts      Opens the share sheet for an export (downloads on web)
    home-widget.ts     Pushes the summary to the home-screen widget (only where its native code exists)
    pick-text-file.ts  Lets the user choose a backup file and reads it
    app-updates.ts     Which version is running, and checking for an over-the-air update
    ai-sort.ts         Calls the AI server
  server/
    suggest-decisions.ts  Server-only: picks the AI service (AI_PROVIDER) behind /api/sort
    sort-prompt.ts     What every AI service is asked, and the answer's JSON schema
    gemini.ts, claude.ts  The two services' requests
  widgets/
    loops-widget.tsx   The Android home-screen widget's layout (runs in the widget's own runtime)
  components/, hooks/, utils/, constants/
plugins/
  with-android-shortcuts.js  Adds the Capture and Tonight app shortcuts on Android
```

### The loop rules

Every loop starts in `inbox` and leaves with one decision:

| Decision | State | Requires |
|---|---|---|
| Do it now (2-minute rule) | `done` | nothing |
| Next action | `next` | the next physical action |
| Schedule it | `scheduled` | next action + a day (today or later) |
| Delegate | `waiting` | who you're waiting on |
| Thinking on this | `thinking` | a day to revisit |
| Drop it | `dropped` | nothing |

`next`, `scheduled` and `waiting` count as active, and the number of active loops is capped (default 7). Parking, finishing and dropping are never blocked.

### The nightly close

The Tonight tab lists every loop that needs a decision before bed: anything still in the inbox, anything scheduled for today or overdue, and anything whose "thinking" revisit day has come. Once everything has a home, **Close the day** records it in `daily_closes`. Pick a reminder time and the app sends a local notification every night at that time; nothing goes through a server. **Send a test reminder** checks that reminders arrive.

The app imports only the local-notification files of `expo-notifications` (see `src/services/local-notifications.ts`), never the package itself: its main entry also loads a push-only native module that Expo Go on Android doesn't include, which crashes the app at startup. Notifications load on first use, after checking the native modules exist, so if they're missing the reminder card says so instead of the app crashing.

### The weekly review

Once a week the Tonight tab offers a weekly review: a guided look at every open loop so the system stays trustworthy. It goes step by step: empty your head (capture anything new), decide everything in the inbox, then look at each scheduled loop, next action, wait, and "thinking" loop and **Keep**, **Done**, **Drop**, or tap it to change it. A loop whose decision no longer holds (overdue, or its revisit day has come) can't just be kept. Each loop records when it was last reviewed, so a review can be interrupted and picks up at the first step that still has something to look at. Finishing records it in `weekly_reviews`; the next one is due seven days later.

### Ready for sync later

Rows use UUID ids, every table has `updated_at`, and deletes are soft (`deleted_at`). All writes go through `src/db/loops.ts`, so a sync layer has one place to hook in.

### Voice capture

Tap the mic on your phone's keyboard (for example Gboard) on the Capture screen and say everything on your mind at once. If what you said has more than one sentence or line, the app shows the separate thoughts it found and offers **Add N loops** or **Add as one loop**. This uses the keyboard's own dictation, so it works in Expo Go; an in-app mic button would need a development build.

### AI suggestions

Turn on **Settings → AI suggestions** and the Inbox gets **Suggest decisions**: the AI suggests a decision for each loop, with the next action, day, or person filled in and a one-line reason. **Accept** applies it as it is; tapping the loop opens Decide with the suggestion filled in, to change anything first. Nothing is decided without a tap, and the usual rules still apply (a suggestion that would go over the active-loop limit can't be accepted). Suggestions are kept in memory until the app closes, and one stops being offered once its loop is edited.

How it works:

- The app sends up to 25 inbox loops (wording, notes, the day they were captured), today's date, and the active-loop numbers to `POST /api/sort` (`src/app/api/sort+api.ts`). Nothing is sent until you tap **Suggest decisions**, and the setting is per phone: a restore never turns it on.
- The endpoint checks the request (`validateSortRequest`) and asks the AI service for one suggestion per loop, as JSON matching a schema (`src/server/sort-prompt.ts`). The server logs only counts, never the loops.
- Which service is set by `AI_PROVIDER` in `src/constants/ai.ts`, read by both the app (for its wording and privacy note) and the server:
  - `gemini` (now): Google's `gemini-flash-latest` on the Gemini API's free tier (`src/server/gemini.ts`). It calls the REST API with `fetch` and a 45-second limit: through Google's SDK, requests from EAS Hosting hung until the platform's 100-second cutoff. On the free tier, Google may use what's sent to improve its products and its reviewers may read it; the Settings card says so. The free tier also has per-minute and daily limits; hitting one shows "busy".
  - `claude`: Anthropic's Claude Opus 5.5 (`claude-opus-5-5`, low effort, `src/server/claude.ts`). If Claude's safety checks decline, the request falls back to Anthropic's recommended model (`fallbacks: "default"`).
- The app checks every suggestion (`parseSuggestions`) and drops anything that wouldn't be a valid decision, such as a day in the past or a next action with no action.
- The API key lives only on the server, as an EAS environment variable in the production environment with **Sensitive** visibility (EAS Hosting can't use Secret variables): `GEMINI_API_KEY` (from Google AI Studio) or `ANTHROPIC_API_KEY` (from the Anthropic Console). The app's bundle never contains either.
- `.eas/workflows/deploy-api.yml` deploys the endpoint to EAS Hosting on every push to `main`. `app.config.js` switches `web.output` to `server` for that export only, so the app's fingerprint runtime version doesn't change and the feature can ship as an over-the-air update.
- The server runs at `https://open-loops.expo.app` (set in `src/constants/ai.ts`). Its logs, requests and crashes are on the EAS Hosting dashboard. `.eas/workflows/check-api.yml` (run by hand) calls it from Expo's cloud and prints the answer. A failure carries a short detail, which the Inbox shows under the message. Only `/api/sort` is meant to be used there: the web pages of that deployment don't render.

To switch to Claude: add `ANTHROPIC_API_KEY` as above, set `AI_PROVIDER` to `'claude'`, and push to `main`. That redeploys the server and sends the app an update. With Claude, a sort of 20 loops costs a few US cents; set a monthly spend limit in the Anthropic Console.

### Your data

Your loops are stored only on the phone; AI suggestions, when you ask for them, are the one exception, and only for inbox loops. **Settings → Your data** exports a copy through the system share sheet (save to Drive or Files, email it, and so on): Markdown to read, grouped by decision with each loop's notes, or JSON with every loop, nightly close, weekly review, and setting, for backup or moving elsewhere.

**Settings → Restore from a backup** reads a JSON backup back in, for example when moving from Expo Go to an installed build, or to a new phone. It shows what would change before changing anything, and it merges rather than replaces: loops only in the backup are added, and where both have the same loop, the one changed more recently wins. Nothing is deleted, restoring the same file twice changes nothing, and the reminder time is left alone because it needs this phone's notification permission.

## Known issues

- **Tapping the nightly reminder doesn't open Tonight in Expo Go** (Android). It works in installed builds. The handling is in `useOpenCloseFromReminder` in `src/services/close-reminder.ts`.
- **The Capture and Tonight shortcuts showed an error in the first development build.** They work in the preview build.

## Cloud builds

`eas.json` has three profiles:

- `preview`: the app on its own (Android APK, internal distribution), receiving updates on the `preview` channel.
- `development`: the Open Loops Dev development build (Android APK).
- `simulator`: an iOS Simulator app and an Android APK.

Builds and updates run on Expo's servers from this GitHub repository, so `app.json` needs the Expo project's ID under `extra.eas.projectId`. Two workflows run on every push to `main`: `publish-update.yml` (an over-the-air update) and `deploy-api.yml` (the AI server).

## Web

The app also runs on the web, where `expo-sqlite` needs the page served with `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin`. `metro.config.js` adds them to Metro's responses, but in SDK 58 the dev server serves the HTML page before that middleware runs, so to try the web version, export it (`npx expo export --platform web`) and serve `dist/` from a server that sends those headers.
