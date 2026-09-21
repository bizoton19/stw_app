# Split the Wine — native app (Expo)

A real React Native client. It talks to the same Next.js Route Handlers as the web prototype. The OpenRouter key stays on the server and is never in this bundle.

Two ways to run it: **Expo Go** (scan a QR, no Xcode) and **`npx expo run:ios`** (Xcode / Simulator). Both stay Expo-Go compatible — no custom dev client.

## 0. Start the API first

From the **repo root** (not this folder):

```bash
npm install
cp .env.example .env.local   # optional: set OPENROUTER_API_KEY here, never in the native app
npm run build
npm run start
```

That serves the parse/claims API at **port 43147 on all interfaces** (`0.0.0.0`). A phone cannot reach `localhost` on your Mac — it needs your Mac's LAN IP.

Find the LAN IP (Mac, Wi-Fi):

```bash
ipconfig getifaddr en0
```

If that prints nothing, try `ipconfig getifaddr en1` or System Settings → Wi-Fi → Details → IP address. Example: `192.168.1.12`.

Keep the Mac and the phone on the **same Wi-Fi**. If the Mac firewall asks, allow Node to accept incoming connections on 43147.

---

## 1. Expo Go (scan a QR, run on a real phone immediately)

On the Mac:

```bash
cd apps/mobile
npm install
cp .env.example .env.local
```

Put the LAN URL in `.env.local` (replace the IP):

```bash
echo 'EXPO_PUBLIC_API_URL=http://192.168.1.12:43147' > .env.local
```

Then:

```bash
npx expo start --lan
```

- Install **Expo Go** from the App Store / Play Store.
- Scan the QR code Expo prints (Camera on iOS, Expo Go on Android).
- Same Wi-Fi as the Mac.

If Metro already started before you edited `.env.local`, stop it (ctrl+c) and start again.

The home screen shows the API URL and whether the server is reachable. If it says it can't reach the server, tap that line and type `http://YOUR_LAN_IP:43147`, then Save. That override is stored on the phone so you don't need to rebuild.

Do **not** use `expo start --tunnel` unless the API is also on a public URL. The tunnel host is not the parse server.

---

## 2. Xcode (`npx expo run:ios`)

Needs a Mac with Xcode installed, Command Line Tools, and (once) an iOS Simulator runtime.

Same API server as above. Same `.env.local` with the LAN URL if you will run on a **physical** iPhone. The iOS Simulator can use localhost:

```bash
# Simulator only
echo 'EXPO_PUBLIC_API_URL=http://127.0.0.1:43147' > .env.local

# Physical iPhone (replace the IP)
echo 'EXPO_PUBLIC_API_URL=http://192.168.1.12:43147' > .env.local
```

Then:

```bash
cd apps/mobile
npm install
npx expo run:ios
```

First run compiles native code (slow). It opens the iOS Simulator. To a plugged-in iPhone:

```bash
npx expo run:ios --device
```

Or open the generated `ios/` project in Xcode after the first prebuild (`npx expo run:ios` creates it) and pick a simulator/device there. `ios/` and `android/` are generated and gitignored; don't commit them.

Signing: for a personal device, Xcode → Signing & Capabilities → your Apple ID team. Bundle id is `com.splitthewine.app`.

---

## What only works on a physical device

| Feature | Simulator / Expo web | Physical phone (Expo Go or Xcode build) |
|---|---|---|
| System camera | No — falls back to library / sample tab | Yes (`expo-image-picker` in Expo Go) |
| Photo library | Expo web: file picker. Simulator: limited | Yes |
| Share sheet | Clipboard fallback | Native share |
| Haptics | No-op | Light selection feedback |
| API at `localhost` | Yes (this computer) | **No** — must be LAN IP |

Vision (OpenRouter) always runs on the **server**. The native app never ships the key.

---

## Env vars (native)

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `apps/mobile/.env.local` | Base URL of the Next.js API. Empty = infer Metro LAN host + port 43147 |
| `EXPO_PUBLIC_API_PORT` | optional | Port used when inferring (default `43147`) |
| `EXPO_PUBLIC_SHARE_URL` | optional | Origin used when sharing a claim link (defaults to the API URL) |

**Do not** put `OPENROUTER_API_KEY` in this app. Copy it only into the **repo-root** `.env.local`.

---

## Expo web (this VM / browser preview)

```bash
cd apps/mobile
npx expo start --web --port 43149 --lan
```

Uses React Native for Web, not the Next.js UI. Point `EXPO_PUBLIC_API_URL` at `http://127.0.0.1:43147` when the API is on the same machine.
