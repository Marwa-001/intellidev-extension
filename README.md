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

[![Version](https://img.shields.io/badge/version-0.1.4-00B4D8?style=flat-square&labelColor=0D1117)](CHANGELOG.md)
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

These feed a **20-rule scoring engine** across all four categories. The result updates in real time — no polling delay, no background processes calling home.

<br/>

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
| 📊 &nbsp;**Live gauge** | Current cognitive load score, updated in real time |
| 📈 &nbsp;**Score trend** | Score history across all your sessions |
| 🧩 &nbsp;**Category breakdown** | Typing, errors, context, and session contributions |
| 🔴 &nbsp;**Error density** | Error rate spikes and peaks over time |
| 🔀 &nbsp;**Context switching** | File switch frequency and rapid-switch patterns |
| 🎯 &nbsp;**Deep work vs. idle** | Focus blocks compared to idle time per session |
| 🗓️ &nbsp;**Heatmap** | Cognitive load patterns by time of day |
| 📅 &nbsp;**Weekly and monthly** | Period comparisons with delta highlights |
| 🔔 &nbsp;**Alert history** | Full log of every alert, with timestamps and scores |

<br/>

---

<br/>

## 🔔 Alerts

IntelliDev fires VS Code notifications when your body needs a signal your brain is ignoring.

<br/>

| Trigger | Alert |
|:--------|:------|
| Score ≥ 60 | 🟠 &nbsp;Overload warning |
| Score ≥ 80 | 🔴 &nbsp;Burnout risk — shown as an error notification |
| 2+ hours continuous | ⏱️ &nbsp;Long session warning |
| After 10 pm (15 min+) | 🌙 &nbsp;Night coding alert |

<br/>

All alerts respect a **5-minute cooldown** so they never spam you. Night alerts use a separate **30-minute cooldown** — nobody wants to be pinged every five minutes at 11 pm.

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

## 📋 Changelog Highlights

<br/>

```
  v0.1.4  ──  Session data stored in VS Code private global storage.
              No more accidental commits of a data/ folder.

  v0.1.3  ──  Alert timestamps now correct on all platforms.
              Night alert cooldown raised to 30 minutes.

  v0.1.2  ──  Marketplace listing README updated.

  v0.1.1  ──  Marketplace icon fixed. README rewritten for end users.
              Night alert false positive threshold raised to 15 minutes.
              Night-time window corrected to 22:00–04:59.

  v0.1.0  ──  First release. 18 behavioral signals, 20 scoring rules,
              personal baseline, live dashboard, full alert system.
```

→ Full details in [CHANGELOG.md](CHANGELOG.md)

<br/>

---

<br/>

<div align="center">

*Built with care by Zara and Marwa*

<br/>

[GitHub](https://github.com/Marwa-001/intellidev-extension) &nbsp;·&nbsp; [Report a bug](https://github.com/Marwa-001/intellidev-extension/issues) &nbsp;·&nbsp; [Request a feature](https://github.com/Marwa-001/intellidev-extension/issues) &nbsp;·&nbsp; [Open VSX](https://open-vsx.org/extension/marwa-zara/intellidev)

</div>
