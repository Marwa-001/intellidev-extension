<div align="center">

<br/>

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

[![Version](https://img.shields.io/badge/version-0.1.4-00B4D8?style=flat-square&labelColor=0D1117)](https://github.com/Marwa-001/intellidev-extension)
[![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85-007ACC?style=flat-square&labelColor=0D1117&logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/vscode)
[![License](https://img.shields.io/badge/license-MIT-1ABC9C?style=flat-square&labelColor=0D1117)](LICENSE)
[![Privacy](https://img.shields.io/badge/privacy-100%25%20local-FF4B7D?style=flat-square&labelColor=0D1117)]()

<br/>

</div>

---

## What is IntelliDev?

IntelliDev is a VS Code extension that watches **how** you code, not **what** you code. It silently measures your typing rhythm, error frequency, context switching, and session length — then translates those signals into a real-time **cognitive load score**. When that score gets dangerously high, it tells you to stop before you burn out.

Everything runs locally. No accounts. No cloud. Your code never leaves your machine.

---

## How it works

Every few seconds, IntelliDev samples four behavioral dimensions:

| Signal | What it measures |
|--------|-----------------|
| 🎹 **Typing patterns** | Rhythm, variability, backspace rate, and pauses |
| ⚠️ **Errors** | How often compilation errors spike and how long they persist |
| 🔀 **Context switching** | How rapidly you jump between files |
| ⏱️ **Session length** | Total time coded and how much of it is deep work vs. idle |

These signals feed a **20-rule scoring engine** across all four categories. The result is a cognitive load score from 0 to 100, updated continuously.

---

## Score levels

| Score | Status | What to do |
|-------|--------|-----------|
| **0 – 29** | 🟢 Stable Focus | You're in flow. Keep going. |
| **30 – 59** | 🟡 Mild Strain | Consider a short break. |
| **60 – 79** | 🟠 High Cognitive Load | Take a 10–15 minute break. Step away. |
| **80 – 100** | 🔴 Burnout Risk | Stop coding. Rest for 30+ minutes. |

---

## Personal baseline

> Generic thresholds punish fast typers and night owls equally. IntelliDev doesn't.

After **10 sessions** (10+ hours of coding), IntelliDev locks a **personal baseline** calibrated to your individual patterns using Pearson z-scores. From that point, every score is relative to *your* norm:

- A naturally fast typer won't be penalised for high KPM
- Someone who codes late won't get flagged unfairly for night sessions
- The baseline **auto-recalibrates every 30 sessions** as your patterns evolve

During calibration, scores shown are rule-based estimates. The banner in the dashboard shows exactly how far along calibration is.

---

## Dashboard

Open the IntelliDev panel from the activity bar to see your full picture at a glance.

| Panel | What it shows |
|-------|--------------|
| 📊 **Live gauge** | Current cognitive load score in real time |
| 📈 **Score trend** | Score history across all sessions |
| 🧩 **Category breakdown** | Typing, errors, context, and session contributions |
| 🔴 **Error density** | Error rate spikes and peaks over time |
| 🔀 **Context switching** | File switch frequency and rapid-switch patterns |
| 🎯 **Deep work vs. idle** | Focus blocks compared to idle time per session |
| 🗓️ **Heatmap** | Cognitive load patterns by time of day |
| 📅 **Weekly & monthly** | Period comparisons with changes highlighted |
| 🔔 **Alert history** | Full log of every alert generated |

---

## Alerts

IntelliDev fires VS Code notifications when:

- Your score reaches **60+** — overload warning
- Your score reaches **80+** — burnout risk (shown as an error notification)
- You've been coding for **2+ hours** without a meaningful break
- You've been coding **late at night** for more than 15 minutes

All alerts have a **5-minute cooldown** so they never spam you. Night alerts use a separate **30-minute cooldown** — because nobody wants to be interrupted every five minutes at 11 pm.

---

## Privacy

IntelliDev was built from the ground up with privacy as a hard constraint, not an afterthought.

**✅ Cannot read your code**
The VS Code API used (`onDidChangeTextDocument`) provides typing metadata only. It is technically incapable of capturing source code content.

**✅ No filenames or snippets stored**
Session files contain only numbers — no file names, no code, no personal information.

**✅ Fully local**
Everything runs inside VS Code. No external servers, no network calls, no background processes.

**✅ Auto cleanup**
Session files older than 90 days are automatically deleted.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `intellidev.alertThreshold` | `60` | Score threshold for overload alerts (0–100) |
| `intellidev.dataPath` | *(empty)* | Custom path for session storage. Leave empty to use VS Code's default global storage. |

---

## Pause tracking

Click the **pause button** in the IntelliDev sidebar title bar to stop tracking during a meeting or break. Click play to resume. The status bar always reflects the current state.

---

## Data management

Inside the dashboard, the **Data Management** panel gives you full control:

| Action | What it does |
|--------|-------------|
| 🔄 **Reset baseline only** | Wipes the calibration and restarts it — keeps all session history |
| 🗑️ **Delete all session data** | Removes all local files and resets calibration |
| 💥 **Full wipe** | Deletes everything and generates a new anonymous identity |

All actions require confirmation. All data is stored locally — there is nothing to contact or revoke on a server.

---

## Installation

Search for **IntelliDev** in the VS Code Extension Marketplace, or install from the [GitHub repository](https://github.com/Marwa-001/intellidev-extension).

IntelliDev requires **VS Code 1.85** or later. No additional dependencies or runtimes needed — everything is bundled.

---

## Changelog highlights

**v0.1.4** — Session data now stored in VS Code's private global storage, so it no longer appears as a `data/` folder inside your project and can't accidentally be committed to Git.

**v0.1.3** — Alert timestamps now correctly reflect local timezone on all platforms, including Windows machines where the extension host previously defaulted to UTC.

**v0.1.0** — Initial release: real-time telemetry across 18 behavioral signals, rule-based scoring engine, personal baseline calibration, live dashboard, and alert system.

Full changelog: [CHANGELOG.md](CHANGELOG.md)

---

<div align="center">

<br/>

*Built with care by Zara and Marwa*

<br/>

[GitHub](https://github.com/Marwa-001/intellidev-extension) · [Report a bug](https://github.com/Marwa-001/intellidev-extension/issues) · [Request a feature](https://github.com/Marwa-001/intellidev-extension/issues)

<br/>

</div>
