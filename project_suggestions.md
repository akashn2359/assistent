# VoicePilot: Professional Grade & Corporate Roadmap

This document outlines architectural, aesthetic, and functional upgrade options for **VoicePilot** to elevate it to a premium, enterprise-grade desktop productivity assistant.

---

## 1. Intelligence & Voice Command Enhancements (100% Offline)

### 🤖 Local Offline LLM Integration (Ollama)
* **Goal**: Enable general assistance (Q&A, scheduling, formatting) without sacrificing the **100% private** rule.
* **Implementation**: Connect the backend server to **Ollama** running locally on the system. When a voice command doesn't match a hardware macro (e.g., *"draft an email about task #3"*), VoicePilot can pipe it to a local model (like `llama3:8b`, `phi3:3.8b`, or `qwen2:7b`) for a private, on-device reply.
* **User Value**: Transforms the assistant from a simple command match-script into a smart chatbot.

### 🎙️ Upgraded Local Text-to-Speech (TTS)
* **Goal**: Ditch the default robot-sounding Windows SAPI voice for a rich, realistic assistant.
* **Implementation**: Bundle or bridge a fast, lightweight, on-device neural TTS engine (such as **Piper** or **Coqui TTS**). These run locally and can speak with highly expressive, realistic human voices.
* **User Value**: Gives the application a "Jarvis" or "HAL 9000" premium corporate feel.

---

## 2. Desktop & OS System Integration

### 🔔 Native Windows Notifications
* **Goal**: Alert the user when tasks are due or when reminders trigger.
* **Implementation**: Trigger native Windows Toast notifications from the Node/Express backend using the PowerShell `BurntToast` module or Node's `node-notifier`.
* **User Value**: The app does not need to be open on-screen to keep the user on schedule.

### 📅 Calendar & Scheduler Parser
* **Goal**: Support scheduling alarms, timers, and calendar entries using natural voice.
* **Implementation**: Extend the `dateTimeParser.ts` to schedule timers (e.g., *"remind me to stand up in 30 minutes"*). The background Node server can manage timers and alert the user.

---

## 3. High-Profile Design & UI Aesthetics

### 📈 Telemetry History Graphs
* **Goal**: Enhance the "System Telemetry" widget to feel alive.
* **Implementation**: Add canvas-based real-time line charts (using a lightweight library or raw HTML Canvas) that plot CPU and Memory utilization history over a 60-second window.
* **User Value**: Replaces simple status bars with dynamic scrolling graphs like Windows Task Manager.

### 🔊 Mechanical UI Sound Design (SFX)
* **Goal**: Create satisfying micro-interactions using audio.
* **Implementation**: Play subtle, clicky mechanical sounds, computer humming, and verification tones when:
  * Speech is successfully recognized.
  * A macro is executed (e.g. locking the PC).
  * A task is checked off.
* **User Value**: Dramatically enhances the satisfying tactile feedback of using a terminal.

### 🎨 Themes & Custom Color Palettes
* **Goal**: Allow customization while keeping the sleek dark mode.
* **Implementation**: Inject CSS variables to toggle between:
  * **Matrix Green**: Emerald accents (current theme).
  * **Cyberpunk Amber**: Warm orange accents.
  * **Outrun Neon**: Indigo/pink accents.
  * **Steel Corporate**: Platinum/blue slate accents.
