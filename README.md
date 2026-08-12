<div align="center">

```
██╗███╗   ██╗████████╗███████╗██╗     ██╗     ██╗██████╗ ███████╗██╗   ██╗
██║████╗  ██║╚══██╔══╝██╔════╝██║     ██║     ██║██╔══██╗██╔════╝██║   ██║
██║██╔██╗ ██║   ██║   █████╗  ██║     ██║     ██║██║  ██║█████╗  ██║   ██║
██║██║╚██╗██║   ██║   ██╔══╝  ██║     ██║     ██║██║  ██║██╔══╝  ╚██╗ ██╔╝
██║██║ ╚████║   ██║   ███████╗███████╗███████╗██║██████╔╝███████╗ ╚████╔╝ 
╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚══════╝╚══════╝╚═╝╚═════╝ ╚══════╝  ╚═══╝  
```

**Know when to take a break — before burnout takes you.**

<br/>

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install%20Now-007ACC?style=for-the-badge&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=marwa-zara.intellidev)&nbsp;&nbsp;[![Open VSX](https://img.shields.io/badge/Open%20VSX-Install%20Now-C160EF?style=for-the-badge&logo=eclipseide&logoColor=white)](https://open-vsx.org/extension/marwa-zara/intellidev)

<br/>

[![Version](https://img.shields.io/badge/version-0.1.7-00B4D8?style=flat-square&labelColor=0D1117)](CHANGELOG.md)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85-4A4A4A?style=flat-square&labelColor=0D1117)](https://code.visualstudio.com)
[![License](https://img.shields.io/badge/license-MIT-1ABC9C?style=flat-square&labelColor=0D1117)](LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20local-FF4B7D?style=flat-square&labelColor=0D1117)]()
[![Compatible](https://img.shields.io/badge/works%20with-VSCodium%20%7C%20Cursor%20%7C%20Gitpod-8B5CF6?style=flat-square&labelColor=0D1117)]()

<br/>

> 💡 **Works anywhere VS Code extensions run** — VS Code, VSCodium, Cursor, Gitpod, and any editor on the Open VSX registry.

</div>

<br/>

---

<br/>

<div align="center">

### What is IntelliDev?

**IntelliDev watches how you code — not what you code.**

It silently tracks your typing rhythm, error patterns, context switching, and session length, then turns those signals into a **real-time cognitive load score from 0–100**. When that score climbs too high, it tells you to step away before burnout sets in.

**No accounts. No cloud. Your code never leaves your machine.**

</div>

<br/>

---

<br/>

## 🧠 How It Works

IntelliDev samples **four behavioral dimensions** continuously while you work:

<br/>

| Signal | What's measured |
|:------:|:----------------|
| ⌨️ &nbsp;**TYPING** | Rhythm, variability, backspace rate, pauses between bursts |
| 🐛 &nbsp;**ERRORS** | Compilation error frequency, burst detection, debug session count |
| 🔀 &nbsp;**CONTEXT** | File switch frequency, rapid switches, unique files touched per window |
| ⏱️ &nbsp;**SESSION** | Total time coded, deep work blocks, idle ratio, night-time activity |

<br/>

These feed a multi-layered scoring architecture:
1. **Rule-Based Engine**: Computes scores using 20 heuristics normalized to your coding patterns.
2. **On-Device ML Scorer**: An online logistic regression classifier (using hand-rolled SGD) that trains incrementally on your sessions. It learns your unique patterns locally and blends its predictions (up to 60% weight) with the rule engine after 15 sessions.
3. **Temporal Fatigue Analyser**: A rolling cross-session analyzer that monitors score trends using exponential moving averages (EMA). It applies a cumulative fatigue penalty (+5 to +15 pts) for consecutive high-load sessions.
4. **Reading Mode Dampener**: Automatically detects code-reading/debugging sessions (low typing rate with moderate switches) and dampens context-switching scores to avoid false positives.

---

## 🔬 Advanced Composite Signals

To capture complex coding strain, IntelliDev extracts derived composite features:
- **Error-to-Type Ratio**: Measures linter/compile error rate relative to typing speed. A fast typer making frequent errors indicates a higher cognitive strain than a slow, methodical typer.
- **Context Fragmentation**: Computes rapid file switches per minute of active session, capturing fragmentation regardless of session duration.

---

<br/>

## 📊 Score Levels

Your cognitive load score sits on a spectrum with clear, actionable guidance at every stage:

<br/>

```
  0 ──────────── 30 ──────────── 60 ──────────── 80 ─────── 100
  │                │               │               │            │
  │  🟢 STABLE    │  🟡 MILD      │  🟠 HIGH      │  🔴 RISK  │
  │   FOCUS        │   STRAIN      │   LOAD        │            │
  │                │               │               │            │
  │  You're in     │  Consider a   │  Take a       │  Stop.     │
  │  flow.         │  short break. │  10–15 min    │  Rest 30+  │
  │  Keep going.   │               │  break.       │  minutes.  │
  │                │               │               │            │
  0 ──────────── 30 ──────────── 60 ──────────── 80 ─────── 100
```

<br/>

---

<br/>

## 🎯 Personal Baseline

Generic thresholds are unfair. A naturally fast typer looks "overloaded" to a dumb threshold. Someone who prefers coding at night gets flagged every evening. IntelliDev fixes this.

After **10 sessions** of coding, IntelliDev locks a **personal baseline** calibrated to your individual patterns using Pearson z-scores:

<br/>

- 📌 &nbsp;Scores are relative to **your** norm, not a population average
- ⚡ &nbsp;Fast typers are not penalised for high KPM
- 🌙 &nbsp;Night owls are not flagged unfairly for late sessions
- 🤖 &nbsp;**ML Model Activation**: On-device online learning activates automatically after 15 sessions.
- 🔄 &nbsp;The baseline **auto-recalibrates every 30 sessions** as your patterns evolve

<br/>

> During calibration, the dashboard shows rule-based estimates with a progress bar so you always know how far along you are.

<br/>

---

<br/>

## 🖥️ Dashboard

Open the IntelliDev panel from the activity bar. Everything you need is in one place.

<br/>

| Panel | What it shows |
|:------|:-------------|
| 📊 &nbsp;**Live gauge** | Current cognitive load score (blended rule-based + ML prediction) |
| ℹ️ &nbsp;**Interactive Tooltips** | Clicking the `ℹ` popover on any chart toggles detailed explanations and color-coded threshold keys |
| 📈 &nbsp;**Score trend** | Score history across all sessions with Burnout (80), High (60), and Mild (30) reference bands |
| 🧩 &nbsp;**Category breakdown** | Stacked bar chart showing Typing, Errors, Context, and Session contributions |
| 🔴 &nbsp;**Error density** | Spikes and peak compilation errors per 10-minute window |
| 🔀 &nbsp;**Context switching** | File switch frequency contrasted against rapid-switch lines |
| 🎯 &nbsp;**Deep work vs. idle** | Focus blocks compared to idle time per session against a 25-minute deep work goal |
| 🗓️ &nbsp;**Heatmap** | Hourly/daily cognitive load matrix (Hour of day vs Date) |
| 📅 &nbsp;**Weekly and monthly** | Period comparisons (Weekly/Monthly) with green/pink delta highlights |
| 🔔 &nbsp;**Alert history** | Detailed alert feed with type-specific glowing borders, local timestamps, messages, and triggered rule tags |

<br/>

---

<br/>

## 🔔 Alerts

IntelliDev surfaces cognitive load signals **non-intrusively** — no sudden popups while you're deep in code. Alerts are delivered in two silent ways:

<br/>

### Status Bar (bottom of VS Code)

The status bar item updates automatically every time a new score is produced. The icon, text, and background color all change based on your current load level:

| Score | Status Bar appearance |
|:------|:----------------------|
| 0–29 | `$(pulse) IntelliDev: Stable Focus (24/100)` — no highlight |
| 30–59 | `$(pulse) IntelliDev: Mild Strain (45/100)` — no highlight |
| 60–79 | `$(warning) IntelliDev: High Cognitive Load (72/100)` — **orange background** |
| ≥ 80 | `$(error) IntelliDev: Burnout Risk (85/100)` — **red background** |

Hover over the status bar item at any time to see a **tooltip** with your exact score, load level, and a personalised recommendation — without interrupting your flow.

<br/>

### Sidebar Alert History

Every alert is also saved locally and shown in the **Recent Alerts** panel inside the IntelliDev sidebar dashboard. You can review them at your own pace.

<br/>

| Trigger | Alert type |
|:--------|:-----------|
| Score ≥ 60 | 🟠 &nbsp;Overload |
| Score ≥ 80 | 🔴 &nbsp;Burnout risk |
| 2+ hours continuous | ⏱️ &nbsp;Long session |
| After 10 pm (15 min+) | 🌙 &nbsp;Night coding |

<br/>

All alerts respect a **5-minute cooldown** so they never flood the history. Night alerts use a separate **30-minute cooldown**.

Alert timestamps always reflect your **local timezone**, including on Windows machines where the VS Code extension host can default to UTC.

<br/>

---

<br/>

## 🔒 Privacy

IntelliDev was designed from the ground up with privacy as a **hard constraint**, not an afterthought.

<br/>

> ✅ &nbsp;**Cannot read your code** — The VS Code API used (`onDidChangeTextDocument`) provides typing metadata only. It is technically incapable of capturing source code content.

> ✅ &nbsp;**No filenames or snippets stored** — Session files contain only numbers. No file names, no code, no personal information.

> ✅ &nbsp;**Fully local** — Everything runs inside VS Code. No external servers, no network calls, no background processes.

> ✅ &nbsp;**Auto cleanup** — Session files older than 90 days are automatically deleted.

<br/>

---

<br/>

## ⚙️ Settings

<br/>

| Setting | Default | Description |
|:--------|:-------:|:------------|
| `intellidev.alertThreshold` | `60` | Score threshold for overload alerts (0–100) |
| `intellidev.dataPath` | *(empty)* | Custom path for session storage. Leave empty to use VS Code's default global storage. |

<br/>

---

<br/>

## ⏸️ Pause Tracking

Click the **pause button** in the IntelliDev sidebar title bar to stop tracking during a meeting or break. Click play to resume. The status bar always reflects the current state.

<br/>

---

<br/>

## 🗂️ Data Management

All data lives on your machine. The dashboard gives you full control.

<br/>

| Action | What it does |
|:-------|:-------------|
| 🔄 &nbsp;**Reset baseline only** | Wipes the calibration and restarts it, keeping all session history |
| 🗑️ &nbsp;**Delete all session data** | Removes all local files and resets calibration |
| 💥 &nbsp;**Full wipe** | Deletes everything and generates a new anonymous identity |

<br/>

> Every action requires a confirmation step. There is nothing on a server to contact or revoke.

<br/>

---

<br/>

## 📦 Installation

**VS Code / Cursor / Codium**

Search for `IntelliDev` in the Extensions panel, or use the install buttons at the top of this page.

**Open VSX — VSCodium, Gitpod, and compatible editors**

Available on the [Open VSX Registry](https://open-vsx.org/extension/marwa-zara/intellidev). Any editor that supports Open VSX can install IntelliDev directly from its Extensions panel — no manual steps needed.

**Requirements:** VS Code 1.85 or later. No additional runtimes or dependencies.

<br/>


---

<br/>

<div align="center">

*Built with care by Zara and Marwa*

<br/>

[GitHub](https://github.com/Marwa-001/intellidev-extension) &nbsp;·&nbsp; [Report a bug](https://github.com/Marwa-001/intellidev-extension/issues) &nbsp;·&nbsp; [Request a feature](https://github.com/Marwa-001/intellidev-extension/issues) &nbsp;·&nbsp; [Open VSX](https://open-vsx.org/extension/marwa-zara/intellidev)

</div>
