// CKD Progression Dataset Generator
// Generates 1,530 synthetic patients matching the data dictionary specification

class CKDDataGenerator {
    constructor(seed = 42) {
        this.seed = seed;
        this.rng = this._createRNG(seed);
    }

    _createRNG(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    _randomInt(min, max) {
        return Math.floor(this.rng() * (max - min + 1)) + min;
    }

    _randomFloat(min, max, decimals = 1) {
        return parseFloat((this.rng() * (max - min) + min).toFixed(decimals));
    }

    _randomDate(startYear, endYear) {
        const start = new Date(startYear, 0, 1).getTime();
        const end = new Date(endYear, 11, 31).getTime();
        const d = new Date(start + this.rng() * (end - start));
        return d.toISOString().split('T')[0];
    }

    _randomChoice(arr) {
        return arr[Math.floor(this.rng() * arr.length)];
    }

    _normalRandom(mean, stddev) {
        const u1 = this.rng();
        const u2 = this.rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + z * stddev;
    }

    _clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    generatePatients(n = 1530) {
        const patients = [];
        const duplicateCount = Math.floor(n * 0.02); // ~2% duplicates

        for (let i = 0; i < n; i++) {
            patients.push(this._generateOnePatient(i + 1));
        }

        // Add duplicates (~2%)
        for (let i = 0; i < duplicateCount; i++) {
            const srcIdx = this._randomInt(0, n - 1);
            const dup = { ...patients[srcIdx] };
            dup._isDuplicate = true;
            patients.push(dup);
        }

        return patients;
    }

    _generateOnePatient(index) {
        const patientId = 'P' + String(index).padStart(5, '0');
        const age = this._randomInt(30, 90);
        const gender = this.rng() < 0.52 ? 'M' : 'F';

        // Comorbidities - correlated with age
        const ageFactor = (age - 30) / 60; // 0 to 1
        const hasDiabetes = this.rng() < (0.25 + ageFactor * 0.2) ? 1 : 0;
        const hasHypertension = this.rng() < (0.35 + ageFactor * 0.25) ? 1 : 0;
        const hasCvd = this.rng() < (0.1 + ageFactor * 0.15) ? 1 : 0;

        // Index date: 2020-01-01 to 2021-12-31
        const indexDate = this._randomDate(2020, 2021);

        // Lab date: within ±7 days of index_date
        const indexDateObj = new Date(indexDate);
        const labOffset = this._randomInt(-7, 7);
        const labDateObj = new Date(indexDateObj.getTime() + labOffset * 86400000);
        const labDate = labDateObj.toISOString().split('T')[0];

        // === Lab Values with clinical correlations ===

        // Base eGFR influenced by age and comorbidities
        let baseEgfr = this._normalRandom(75, 25);
        if (hasDiabetes) baseEgfr -= this._randomFloat(5, 15);
        if (hasHypertension) baseEgfr -= this._randomFloat(3, 10);
        if (age > 65) baseEgfr -= this._randomFloat(5, 15);
        baseEgfr = this._clamp(baseEgfr, 10, 150);

        // Creatinine correlated with eGFR (inverse relationship)
        // eGFR formula approximation: higher eGFR = lower creatinine
        let creatinine;
        let creatinineUnit;
        const useMMol = this.rng() < 0.15; // 15% use mmol/L

        if (useMMol) {
            creatinineUnit = 'mmol/L';
            // Convert: approximate creatinine from eGFR
            creatinine = this._clamp(
                this._normalRandom(180 - baseEgfr * 1.5, 20),
                44, 442
            );
            creatinine = parseFloat(creatinine.toFixed(0));
        } else {
            creatinineUnit = 'mg/dL';
            creatinine = this._clamp(
                this._normalRandom(2.5 - baseEgfr * 0.015, 0.3),
                0.5, 5.0
            );
            creatinine = parseFloat(creatinine.toFixed(2));
        }

        // FBS - correlated with diabetes
        let fbsMgDl = null;
        if (this.rng() > 0.12) { // ~12% missing
            if (hasDiabetes) {
                fbsMgDl = this._clamp(this._normalRandom(145, 35), 80, 300);
            } else {
                fbsMgDl = this._clamp(this._normalRandom(90, 12), 70, 120);
            }
            fbsMgDl = parseFloat(fbsMgDl.toFixed(0));
        }

        // HbA1c - correlated with diabetes
        let hba1cPercent = null;
        if (this.rng() > 0.28) { // ~28% missing
            if (hasDiabetes) {
                hba1cPercent = this._clamp(this._normalRandom(7.5, 1.2), 5.5, 15.0);
            } else {
                hba1cPercent = this._clamp(this._normalRandom(5.3, 0.3), 4.0, 6.0);
            }
            hba1cPercent = parseFloat(hba1cPercent.toFixed(1));
        }

        // eGFR - ~22% missing
        let egfr = null;
        if (this.rng() > 0.22) {
            egfr = parseFloat(baseEgfr.toFixed(1));
        }

        // Blood Pressure - correlated with hypertension
        let sbp, dbp;
        if (hasHypertension) {
            sbp = this._clamp(Math.round(this._normalRandom(148, 15)), 110, 200);
            dbp = this._clamp(Math.round(this._normalRandom(92, 8)), 65, 120);
        } else {
            sbp = this._clamp(Math.round(this._normalRandom(118, 10)), 90, 140);
            dbp = this._clamp(Math.round(this._normalRandom(75, 7)), 50, 90);
        }

        // BMI - ~32% missing
        let bmi = null;
        if (this.rng() > 0.32) {
            bmi = this._clamp(this._normalRandom(25, 4), 15, 45);
            bmi = parseFloat(bmi.toFixed(1));
        }

        // Urine Protein - ~35% missing
        let urineProtein = null;
        if (this.rng() > 0.35) {
            const proteinOptions = ['Negative', 'Trace', '1+', '2+', '3+'];
            const weights = baseEgfr < 45
                ? [0.1, 0.15, 0.25, 0.3, 0.2]
                : baseEgfr < 60
                    ? [0.2, 0.2, 0.3, 0.2, 0.1]
                    : [0.4, 0.25, 0.2, 0.1, 0.05];
            urineProtein = this._weightedChoice(proteinOptions, weights);
        }

        // Medications
        const aceInhibitor = (hasHypertension || baseEgfr < 60) && this.rng() < 0.4 ? 1 : 0;
        const arbs = (hasHypertension || baseEgfr < 60) && !aceInhibitor && this.rng() < 0.35 ? 1 : 0;

        // Visit count (lookback 1 year)
        let visitCount1yr = this._randomInt(1, 8);
        if (hasDiabetes || hasHypertension) visitCount1yr += this._randomInt(1, 5);
        if (baseEgfr < 30) visitCount1yr += this._randomInt(2, 7);
        visitCount1yr = Math.min(visitCount1yr, 20);

        // === Outcome: CKD Progression ===
        let progressionProb = 0.15; // base rate
        if (baseEgfr < 30) progressionProb += 0.35;
        else if (baseEgfr < 45) progressionProb += 0.2;
        else if (baseEgfr < 60) progressionProb += 0.1;

        if (hasDiabetes) progressionProb += 0.1;
        if (hasHypertension) progressionProb += 0.05;
        if (hasCvd) progressionProb += 0.05;
        if (urineProtein === '2+' || urineProtein === '3+') progressionProb += 0.15;
        if (age > 70) progressionProb += 0.05;
        if (aceInhibitor || arbs) progressionProb -= 0.05;

        progressionProb = this._clamp(progressionProb, 0.05, 0.9);
        const ckdProgression1yr = this.rng() < progressionProb ? 1 : 0;

        // Outcome date: 365 ± 30 days after index date
        const outcomeDaysAfter = 365 + this._randomInt(-30, 30);
        const outcomeDateObj = new Date(indexDateObj.getTime() + outcomeDaysAfter * 86400000);
        const outcomeDate = outcomeDateObj.toISOString().split('T')[0];

        // Add ~1% outliers
        let outlierFlag = false;
        if (this.rng() < 0.01 && fbsMgDl !== null) {
            fbsMgDl = this._randomInt(350, 500); // abnormally high
            outlierFlag = true;
        }

        return {
            patient_id: patientId,
            age,
            gender,
            has_diabetes: hasDiabetes,
            has_hypertension: hasHypertension,
            has_cvd: hasCvd,
            index_date: indexDate,
            lab_date: labDate,
            fbs_mg_dl: fbsMgDl,
            hba1c_percent: hba1cPercent,
            creatinine,
            creatinine_unit: creatinineUnit,
            egfr,
            sbp,
            dbp,
            bmi,
            urine_protein: urineProtein,
            ace_inhibitor: aceInhibitor,
            arbs,
            visit_count_1yr: visitCount1yr,
            outcome_date: outcomeDate,
            ckd_progression_1yr: ckdProgression1yr,
            _base_egfr: parseFloat(baseEgfr.toFixed(1)),
            _is_outlier: outlierFlag,
            _isDuplicate: false
        };
    }

    _weightedChoice(items, weights) {
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let r = this.rng() * totalWeight;
        for (let i = 0; i < items.length; i++) {
            r -= weights[i];
            if (r <= 0) return items[i];
        }
        return items[items.length - 1];
    }

    // Helper: get CKD stage from eGFR
    static getCKDStage(egfr) {
        if (egfr === null || egfr === undefined) return 'ไม่ทราบ';
        if (egfr >= 90) return 'Stage 1';
        if (egfr >= 60) return 'Stage 2';
        if (egfr >= 45) return 'Stage 3a';
        if (egfr >= 30) return 'Stage 3b';
        if (egfr >= 15) return 'Stage 4';
        return 'Stage 5';
    }

    static getCKDStageNumber(egfr) {
        if (egfr === null || egfr === undefined) return -1;
        if (egfr >= 90) return 1;
        if (egfr >= 60) return 2;
        if (egfr >= 45) return 3;
        if (egfr >= 30) return 3.5;
        if (egfr >= 15) return 4;
        return 5;
    }

    static getCKDStageColor(stage) {
        const colors = {
            'Stage 1': '#22c55e',
            'Stage 2': '#84cc16',
            'Stage 3a': '#eab308',
            'Stage 3b': '#f97316',
            'Stage 4': '#ef4444',
            'Stage 5': '#991b1b',
            'ไม่ทราบ': '#9ca3af'
        };
        return colors[stage] || '#9ca3af';
    }

    // Normalize creatinine to mg/dL
    static normalizeCreatinine(value, unit) {
        if (value === null || value === undefined) return null;
        if (unit === 'mmol/L') {
            return parseFloat((value * 0.0113).toFixed(2));
        }
        return value;
    }

    // Get effective eGFR (use base_egfr if egfr is missing)
    static getEffectiveEgfr(patient) {
        return patient.egfr !== null ? patient.egfr : patient._base_egfr;
    }
}

// Make available globally
window.CKDDataGenerator = CKDDataGenerator;
