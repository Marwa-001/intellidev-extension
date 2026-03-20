# Changelog

All notable changes to IntelliDev will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] — 2026-02-26

### Added
- Real-time telemetry tracking across 18 behavioural signals (typing rhythm, error frequency, context switching, session duration)
- Rule-based cognitive load scoring engine with 20 rules across 4 categories (typing, errors, context, session)
- Personal baseline calibration using Pearson z-scores; drift-adjusts automatically every 30 sessions
- In-editor VS Code notifications for overload (≥60) and burnout risk (≥80) with 5-minute cooldown
- Long-session alert after 120 minutes of continuous coding
- Late-night coding warning after 15 minutes of activity between 22:00 and 04:59
- Live sidebar dashboard with gauge, trend chart, score breakdown, error density, context switching, deep work vs idle, and heatmap visualisations
- Weekly and monthly performance comparison with period-over-period deltas
- Data management panel: reset baseline, delete session data, or full wipe with new identity
- 90-day automatic pruning of old session files
- Custom data path setting (`intellidev.dataPath`) for storing session files in a user-specified location
- Privacy-first design: all processing runs locally inside VS Code with no external network calls