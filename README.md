# IntelliDev 🧠

**Know when to take a break before burnout takes you.**

IntelliDev watches how you code — not what you code — and tells you when your cognitive load is getting dangerously high. It lives entirely inside VS Code. No accounts, no cloud, no code ever leaves your machine.

---

## What it does

While you work, IntelliDev silently measures four things:

- **Typing patterns** — rhythm, variability, backspace rate, pauses
- **Errors** — how often compilation errors spike, how long they last
- **Context switching** — how rapidly you jump between files
- **Session length** — how long you've been coding, how much of that is deep work vs idle

Every session it produces a **cognitive load score from 0 to 100**. When that score gets too high, you get a notification inside VS Code telling you to take a break — with context about why.

---

## Score levels

| Score | Status | What to do |
|-------|--------|------------|
| 0–29 | 🟢 Stable Focus | You're in flow. Keep going. |
| 30–59 | 🟡 Mild Strain | Consider a short break. |
| 60–79 | 🟠 High Cognitive Load | Take a 10–15 minute break. |
| 80–100 | 🔴 Burnout Risk | Stop coding. Rest for 30+ minutes. |

---

## Personal baseline

After 10 sessions (≥10 hours of coding), IntelliDev locks a **personal baseline** calibrated to your individual patterns. From that point, scores are relative to *your* norm — so a naturally fast typer won't be penalised for high KPM, and someone who prefers working late won't get flagged unfairly.

The baseline automatically recalibrates every 30 sessions as your patterns evolve.

---

## Dashboard

Open the IntelliDev panel from the activity bar (pulse icon on the left) to see:

- Live cognitive load gauge
- Score trend across all your sessions
- Breakdown by category (typing, errors, context, session)
- Error density chart
- Context switching frequency
- Deep work vs idle time
- Cognitive load heatmap by time of day
- Weekly and monthly comparisons with period-over-period changes
- Full alert history

---

## Alerts

IntelliDev fires VS Code notifications when:

- Your score reaches **60+** (overload warning)
- Your score reaches **80+** (burnout risk — shown as an error notification)
- You've been coding for **2+ hours** without a meaningful break
- You've been coding **late at night** (after 10pm) for more than 15 minutes

Alerts have a **5-minute cooldown** so they don't spam you.

---

## Privacy

- IntelliDev **cannot read your code**. The VS Code API it uses (`onDidChangeTextDocument`) provides typing metadata only — it is technically incapable of capturing source code content.
- Session files contain only numbers — no filenames, no code snippets, no personal information.
- Everything runs **locally inside VS Code**. No external servers, no network calls, no background processes.
- Session files older than **90 days are automatically deleted**.

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `intellidev.alertThreshold` | `60` | Score threshold for overload alerts |
| `intellidev.dataPath` | *(empty)* | Custom path for session storage. Leave empty to use VS Code's default global storage. |

---

## Pause tracking

Click the pause button in the IntelliDev sidebar title bar to stop tracking (e.g. during a meeting). Click play to resume. The status bar reflects the current state.

---

## Data management

Inside the dashboard, the **Data Management** panel lets you:

- **Reset baseline only** — wipe the calibration and start fresh while keeping session history
- **Delete all session data** — removes all local files and resets calibration
- **Full wipe** — deletes everything and generates a new anonymous identity

---

*Built by Zara & Marwa*