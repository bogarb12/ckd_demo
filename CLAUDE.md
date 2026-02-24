# CLAUDE.md

## Project Overview

CKD Progression Dashboard — a static, single-page web application that visualizes synthetic Chronic Kidney Disease (CKD) patient data. The UI is in Thai. It generates 1,530 synthetic patients client-side and displays them across three tabs: overview charts, individual patient drill-down, and data quality analysis.

## Tech Stack

- **Vanilla HTML/CSS/JavaScript** — no build tools, no framework, no bundler
- **Chart.js 4.4.7** — loaded via CDN for all charts (bar, scatter, doughnut, radar, etc.)
- **Google Fonts (Sarabun)** — Thai-language font loaded via CDN
- No server-side code; everything runs in the browser

## Project Structure

```
index.html              # Single-page app entry point (Thai language)
css/style.css           # All styles (~1085 lines)
js/
  data-generator.js     # CKDDataGenerator class — synthetic patient generation (seed=42)
  overview.js           # OverviewTab class — summary cards and 6 charts
  individual.js         # IndividualTab class — patient list, filters, detail panel, radar chart
  dashboard.js          # Main controller — IIFE that wires everything together
data/
  patients.json         # Static sample patient data (separate from generated data)
```

## How It Works

- `dashboard.js` runs on `DOMContentLoaded`: instantiates `CKDDataGenerator`, generates 1,530 patients, initializes `OverviewTab` and `IndividualTab`, and sets up tab navigation.
- Data is generated deterministically (seeded RNG, seed=42) — output is reproducible.
- The data quality tab is lazily rendered on first click.
- `data/patients.json` contains a separate static dataset with more detailed patient records (Thai names, lab history over time, medications).

## Key Classes

- **`CKDDataGenerator`** (`js/data-generator.js`) — Generates synthetic patient records with clinically-correlated values (eGFR, creatinine, blood pressure, comorbidities). Includes ~2% duplicates, ~1% outliers, and configurable missing-value rates. Exposes static helpers like `getCKDStage()`, `normalizeCreatinine()`, `getEffectiveEgfr()`.
- **`OverviewTab`** (`js/overview.js`) — Renders summary cards and 6 Chart.js visualizations (CKD stage distribution, risk factors, eGFR distribution, age vs eGFR, blood pressure, urine protein).
- **`IndividualTab`** (`js/individual.js`) — Patient list with search, multi-filter (stage, progression, gender, comorbidity), sorting, pagination (50/page), and a detail panel with a radar/spider chart for health profiles.
- **Dashboard controller** (`js/dashboard.js`) — IIFE that orchestrates initialization and tab switching.

## Development Notes

- **No build step.** Open `index.html` directly in a browser or serve with any static file server.
- **No package manager.** No `package.json`, no npm dependencies.
- **No tests.** There is no test suite.
- **No linting/formatting configuration.**
- CKD stages follow standard clinical thresholds: Stage 1 (eGFR >= 90), Stage 2 (>= 60), Stage 3a (>= 45), Stage 3b (>= 30), Stage 4 (>= 15), Stage 5 (< 15).
- Creatinine values use two units: mg/dL (85%) and mmol/L (15%) — `normalizeCreatinine()` converts to mg/dL.
- All classes are attached to `window` for cross-file access (no module system).

## Conventions

- Classes use PascalCase; methods and variables use camelCase.
- Private/internal properties prefixed with underscore (e.g., `_base_egfr`, `_isDuplicate`, `_is_outlier`).
- Patient data fields use snake_case (e.g., `patient_id`, `ckd_progression_1yr`, `fbs_mg_dl`).
- UI text is in Thai; code comments and variable names are in English.
- Chart colors use Tailwind-style hex values (e.g., `#22c55e`, `#ef4444`).
