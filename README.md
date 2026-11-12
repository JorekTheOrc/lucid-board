# 🧠 Lucid Board

**Lucid Board** is a modern, client-first interactive whiteboard designed for language learning and tutoring. It allows teachers to create complex, interactive exercises on an infinite canvas, share them with students, and track their progress.

Built on top of [tldraw](https://tldraw.dev/) and React, it combines the freedom of a whiteboard with the structure of a learning management system.

---

## ✨ Features

- **🎨 Infinite Canvas:** Powered by `tldraw` v5. Add text, images, PDF pages, and audio anywhere.
- **🧩 Interactive Exercises:**
  - **Multiple Choice:** Select the correct option with instant feedback.
  - **Fill in the Blank:** Type the missing words (supports multiple correct answers).
  - **Matching:** Connect pairs of words or concepts.
  - **Rich Text (Reading):** Beautifully formatted HTML blocks for reading comprehension.
  - **Audio Player:** Built-in player with transcript support.
- **✨ AI Studio:** Generate complex exercises using ChatGPT/Claude. Paste the JSON, and the app will automatically lay out the exercises and reading texts on the board.
- **👨‍🏫 Role Separation:**
  - **Teacher Mode:** Full control over the board, exercise editing, and AI generation.
  - **Student Mode:** Locks the canvas to prevent accidental edits (Anti-cheat). Students can only interact with exercises.
- **📦 Offline-First & Export:** 
  - All data is stored locally in the browser (`IndexedDB`).
  - Boards and progress can be exported/imported as `.zip` archives (including images and audio).
- **📡 Live P2P Session (WebSocket):** Connect a teacher and a student in real-time using a 6-character room code to see each other's changes instantly.

---

## 🛠 Tech Stack

**Frontend:**
- React 19 + Vite
- TypeScript
- tldraw (Canvas engine)
- Dexie (IndexedDB wrapper for offline storage)
- fflate (ZIP compression)
- pdfjs-dist (PDF rendering)

**Backend (Live Mode Only):**
- Node.js
- `ws` (WebSocket server for real-time sync)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- npm

### 1. Installation (Frontend)
Clone the repository and install dependencies:
```bash
git clone https://github.com/JorekTheOrc/lucid-board.git
cd lucid-board
npm install
