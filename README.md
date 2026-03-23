# IntelliDev 🧠

> **Know when to take a break before burnout takes you.**

IntelliDev watches how you code, not what you code, and tells you when your cognitive load is getting dangerously high. It lives entirely inside VS Code. No accounts, no cloud, no code ever leaves your machine.

&nbsp;

## How It Works

While you work, IntelliDev silently measures four things:

🎹 **Typing Patterns** — rhythm, variability, backspace rate, pauses

⚠️ **Errors** — how often compilation errors spike and how long they last

🔀 **Context Switching** — how rapidly you jump between files

⏱️ **Session Length** — how long you have been coding and how much of that is deep work vs idle

Every session produces a **cognitive load score from 0 to 100**. When that score gets too high, you get a notification inside VS Code telling you to take a break, with context about why.

&nbsp;

## Score Levels

| Score | Status | What To Do |
|-------|--------|------------|
| 0 to 29 | 🟢 Stable Focus | You are in flow. Keep going. |
| 30 to 59 | 🟡 Mild Strain | Consider a short break. |
| 60 to 79 | 🟠 High Cognitive Load | Take a 10 to 15 minute break. |
| 80 to 100 | 🔴 Burnout Risk | Stop coding. Rest for 30+ minutes. |

&nbsp;

## Personal Baseline

After 10 sessions (10+ hours of coding), IntelliDev locks a **personal baseline** calibrated to your individual patterns. From that point, scores are relative to **your** norm — so a naturally fast typer won't be penalised for high KPM, and someone who prefers working late won't get flagged unfairly.

The baseline automatically recalibrates every 30 sessions as your patterns evolve.

&nbsp;

## Dashboard

Open the IntelliDev panel from the activity bar to see everything at a glance:

| Panel | What It Shows |
|-------|--------------|
| 📊 Live Gauge | Your current cognitive load score in real time |
| 📈 Score Trend | Score history across all your sessions |
| 🧩 Category Breakdown | Typing, errors, context, and session contributions |
| 🔴 Error Density | Error rate spikes and peaks over time |
| 🔀 Context Switching | File switch frequency and rapid switch patterns |
| 🎯 Deep Work vs Idle | Focus blocks compared to idle time per session |
| 🗓️ Heatmap | Cognitive load patterns by time of day |
| 📅 Weekly and Monthly | Period comparisons with changes highlighted |
| 🔔 Alert History | Full log of every alert generated |

&nbsp;

## Alerts

IntelliDev fires VS Code notifications when:

- Your score reaches **60+** — overload warning
- Your score reaches **80+** — burnout risk shown as an error notification
- You have been coding for **2+ hours** without a meaningful break
- You have been coding **late at night** for more than 15 minutes

Alerts have a **5 minute cooldown** so they never spam you.

&nbsp;

## Privacy First

IntelliDev was designed from the ground up with privacy as a hard constraint, not an afterthought.

✅ **Cannot read your code** — the VS Code API used (`onDidChangeTextDocument`) provides typing metadata only. It is technically incapable of capturing source code content.

✅ **No filenames or snippets** — session files contain only numbers. No file names, no code, no personal information.

✅ **Fully local** — everything runs inside VS Code. No external servers, no network calls, no background processes.

✅ **Auto cleanup** — session files older than 90 days are automatically deleted.

&nbsp;

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `intellidev.alertThreshold` | `60` | Score threshold for overload alerts |
| `intellidev.dataPath` | *(empty)* | Custom path for session storage. Leave empty to use VS Code default storage. |

&nbsp;

## Pause Tracking

Click the **pause button** in the IntelliDev sidebar title bar to stop tracking during a meeting or break. Click play to resume. The status bar reflects the current state at all times.

&nbsp;

## Data Management

Inside the dashboard, the **Data Management** panel lets you:

🔄 **Reset Baseline Only** — wipe the calibration and start fresh while keeping session history

🗑️ **Delete All Session Data** — removes all local files and resets calibration

💥 **Full Wipe** — deletes everything and generates a new anonymous identity

&nbsp;

---

*Built with care by Zara and Marwa*
