# Changelog

All notable changes to IntelliDev will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.4] — 2026-03-29

### Fixed
- Session data is now stored in VS Code's private global storage (`globalStorageUri`) instead of the currently opened workspace folder — data no longer appears as a `data/` folder inside the user's project and cannot accidentally be committed to Git

## [0.1.3] — 2026-03-28

### Fixed
- All alert timestamps now correctly reflect the developer's local timezone on all platforms — previously the VS Code extension host process could default to UTC on some Windows machines, causing alert times to appear shifted regardless of the OS timezone setting
- Session IDs now use local time in their filenames, so session files match the developer's clock
- Night alert detection (isNightTime) now uses the same timezone-safe calculation as all other time functions
- Night warning cooldown raised to 30 minutes (was 5 minutes) — developers who regularly code at night are no longer repeatedly interrupted
- Night alert message now shows the developer's confirmed local time and UTC offset (e.g. 23:14 UTC+5) for transparency

## [0.1.2] — 2026-03-23

### Fixed
- Marketplace listing README updated

## [0.1.1] — 2026-03-22

### Fixed
- Marketplace icon now displays correctly
- README rewritten for end users
- Night alert false positive threshold raised to 15 minutes
- Night-time window corrected to 22:00-04:59

## [0.1.0] — 2026-02-26

### Added
- Real-time telemetry tracking across 18 behavioural signals (typing rhythm, error frequency, context switching, session duration)
- Rule-based cognitive load scoring engine with 20 rules across 4 categories (typing, errors, context, session)
- Personal baseline calibration using Pearson z-scores; drift-adjusts automatically every 30 sessions
- In-editor VS Code notifications for overload (>=60) and burnout risk (>=80) with 5-minute cooldown
- Long-session alert after 120 minutes of continuous coding
- Late-night coding warning after 15 minutes of activity between 22:00 and 04:59
- Live sidebar dashboard with gauge, trend chart, score breakdown, error density, context switching, deep work vs idle, and heatmap visualisations
- Weekly and monthly performance comparison with period-over-period deltas
- Data management panel: reset baseline, delete session data, or full wipe with new identity
- 90-day automatic pruning of old session files
- Custom data path setting (intellidev.dataPath) for storing session files in a user-specified location
- Privacy-first design: all processing runs locally inside VS Code with no external network calls
