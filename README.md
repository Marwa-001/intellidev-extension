# IntelliDev 🧠
### Privacy-Preserving Cognitive Load Detection for Developers

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Node](https://img.shields.io/badge/node-18+-green)
![VS Code](https://img.shields.io/badge/vscode-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

IntelliDev is a VS Code extension that monitors developer behavioral metadata in real time — without ever capturing source code or personal content. When signs of cognitive overload are detected, the system delivers alerts directly inside VS Code and logs them for review in the built-in sidebar dashboard.

---

## How It Works

```
VS Code Extension          Node.js Backend             Sidebar Dashboard
──────────────────         ──────────────────          ──────────────────
Keystroke patterns    →    Feature extraction    →     Score gauge
Error frequency       →    Rule-based scoring    →     Trend charts
File switching        →    Alert generation      →     VS Code notifications
Session duration      →    Baseline learning     →     Heatmap + comparison
```

No source code is ever read, stored, or transmitted. The system observes only behavioral metadata — typing rhythm, error frequency, navigation patterns, and session duration. All processing happens locally inside VS Code — no external servers, no Python, no background processes.

---

## Features

- **Real-time telemetry** — tracks 18 behavioral signals as you code
- **Rule-based inference** — 20 scoring rules across 4 cognitive dimensions
- **Personal baseline** — learns your unique coding patterns and scores relative to your own norm, with automatic drift adjustment every 30 sessions
- **In-editor alerts** — VS Code notifications for overload and burnout risk with 5-minute cooldown
- **Live dashboard** — sidebar panel with gauge, trend chart, heatmap, breakdown chart, and period comparisons
- **Privacy-first** — fully local, no external API calls, no telemetry sent anywhere

---

## Project Structure

```
intellidev/
├── extension/intellidev/        # VS Code extension (TypeScript) — the entire system
│   └── src/
│       ├── extension.ts         # Entry point, path resolution, engine wiring
│       ├── dashboardProvider.ts # Sidebar webview with all charts and visualizations
│       ├── Baselinemanager.ts   # Personal baseline calibration and drift adjustment
│       ├── backend/             # Node.js processing pipeline (runs inside the extension)
│       │   ├── featureExtractor.ts   # 18-feature extraction from session JSON
│       │   ├── scorer.ts             # 20-rule cognitive load scorer
│       │   ├── alertGenerator.ts     # Contextual alert messages with cooldowns
│       │   └── backendEngine.ts      # File watcher + orchestrator
│       ├── telemetry/           # 4 trackers: typing, error, context, session
│       ├── logger/              # Buffered JSON event logger
│       └── utils/               # Time utilities
│
└── data/
    ├── sessions/                # Raw telemetry JSON (local only, auto-created)
    ├── features/                # Extracted feature vectors (auto-created)
    ├── alerts/                  # Generated alert logs (auto-created)
    └── evaluation/              # Survey responses and analysis reports
```

---

## Prerequisites

- **Node.js** 18+
- **VS Code** 1.85+

That's it. No Python. No external services. No API keys required.

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/intellidev.git
cd intellidev/extension/intellidev
```

### 2. Install dependencies

```bash
npm install
```

### 3. Compile

```bash
npm run compile
```

### 4. Launch

Open the `extension/intellidev` folder in VS Code and press **F5**.

A new **Extension Development Host** window opens with IntelliDev running. Start coding — session data, feature extraction, and scoring all happen automatically.

---

## Optional: Configure a custom data path

By default IntelliDev stores all session data in VS Code's global storage (`AppData/Roaming/Code/User/globalStorage/.../sessions`). To use a custom location, open VS Code Settings (`Ctrl+,`) and add:

```json
"intellidev.dataPath": "D:\\intellidev\\data\\sessions"
```

Leave this empty and the default location is used automatically.

---

## Cognitive Score Levels

| Score | Level | Action |
|-------|-------|--------|
| 0 – 29 | 🟢 Stable Focus | Keep it up |
| 30 – 59 | 🟡 Mild Strain | Consider a short break |
| 60 – 79 | 🟠 High Cognitive Load | Take a 10-15 minute break |
| 80 – 100 | 🔴 Burnout Risk | Stop coding, rest 30+ minutes |

---

## Scoring Rules

The inference engine applies 20 rules across 4 categories:

| Category | Rules | Max Points |
|----------|-------|------------|
| Typing | Variability, backspace rate, KPM, pause count | 45 |
| Errors | Error rate, burst count, debug sessions | 43 |
| Context | Switch frequency, rapid switches, unique files | 30 |
| Session | Duration, idle ratio, night activity, deep work | 50 |

Raw scores are capped at 100.

---

## Personal Baseline

After 3 sessions, IntelliDev locks a personal baseline calibrated to your individual coding style. All subsequent scores are shown relative to your own norm — so a naturally fast typer won't be penalised for high KPM, and a developer who works late won't be flagged unfairly.

The baseline drift-adjusts automatically every 30 sessions using exponential smoothing (α = 0.3) to account for how your patterns evolve over time.

---

## Privacy

IntelliDev is designed with privacy as a first principle:

- The VS Code API (`onDidChangeTextDocument`) provides **metadata only** — it is technically incapable of capturing code content
- Session files contain only numerical behavioral metrics — no file names, no code snippets
- All data is stored **locally** on the developer's machine
- The entire processing pipeline runs **in-process** inside VS Code — no external servers, no background processes, no network calls
- 90-day automatic pruning removes old session files to limit local storage growth

---

## Evaluation Results

A preliminary evaluation with 5 participants and 10 sessions produced the following results:

**RQ1 — System Validity (Pearson Correlation)**
| Comparison | r | Strength |
|------------|---|----------|
| Score vs Focus | -0.966 | Strong |
| Score vs Stress | +0.973 | Strong |
| Score vs Productivity | -0.949 | Strong |

**RQ2 — Alert Effectiveness (1-sample t-test vs neutral 3.0)**
| Metric | Mean | t-statistic | Significant |
|--------|------|-------------|-------------|
| Helpfulness | 4.38/5.0 | 5.227 | Yes (p < 0.05) |
| Timing | 4.00/5.0 | 3.742 | Yes (p < 0.05) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| IDE Extension | TypeScript, VS Code API |
| Feature Extraction | TypeScript (Node.js, built-in fs) |
| Inference Engine | TypeScript (rule-based, no ML dependencies) |
| Dashboard | VS Code Webview API, Canvas 2D |
| Baseline System | TypeScript (Pearson z-score, exponential drift) |
| Evaluation Data | JSON + CSV (collected separately) |

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

Zara & Marwa