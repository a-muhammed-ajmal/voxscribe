# 🎙 VoxScribe — Voice to Polished Text

> Record your voice. Get clean, AI-polished written English. Instantly.

VoxScribe is a cross-platform **Progressive Web App (PWA)** that records audio, transcribes it with Google's Gemini AI, and delivers clear, professional written text — removing filler words, fixing grammar, and preserving your meaning.

---

## ✨ Features

- 🎙 **One-tap voice recording** with live waveform animation and timer
- ✦ **AI transcription** powered by Gemini (removes fillers, fixes grammar, polishes prose)
- ▶ **Audio playback** with duration display
- ↓ **Download audio** in WebM/OGG format
- ⧉ **One-tap copy** of transcript
- 📋 **Recording history** — last 10 recordings with play / copy / download / delete
- 📴 **Offline-capable** via Service Worker
- 📱 **PWA installable** — add to Home Screen on any device (iOS, Android, Desktop)
- 🔒 **Private** — audio is processed browser-to-Gemini, no intermediary server

---

## 🚀 Deploy on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Fork / clone this repo
2. Connect to [Vercel](https://vercel.com) — import the repo
3. Deploy (no build step needed — pure static PWA)

---

## 🔑 Setup

1. Get a free Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open the app → tap **⚙ Settings**
3. Paste your key → **Save**

---

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| UI | Vanilla HTML + CSS (glassmorphism dark mode) |
| Logic | Vanilla JavaScript (ES Modules) |
| AI | Google Gemini API (multimodal audio) |
| Storage | IndexedDB (local, private) |
| PWA | Service Worker + Web App Manifest |
| Deploy | Vercel (static, zero config) |

---

## 📂 File Structure

```
voxscribe/
├── index.html       # App shell + UI
├── app.js           # Core logic (recording, transcription, history)
├── db.js            # IndexedDB layer
├── style.css        # Premium dark UI
├── sw.js            # Service worker (offline + caching)
├── manifest.json    # PWA manifest
└── vercel.json      # Vercel deployment config
```

---

## 📄 License

MIT — use it, build on it, ship it.
