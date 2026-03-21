// ============================================
// DAX-Style Dashboard Engine
// แนวคิด: Measures, Filter Context, Calculated Columns,
//          Time Intelligence, Iterator (RANKX), Relationships
// ============================================

const DAXEngine = {

    // Current filter context (like Power BI Slicer)
    filterContext: {
        studyGroup: ['experimental', 'control'],
        gender: ['male', 'female', 'other'],
        ageRange: [0, 120],
        diabetesDuration: [0, 50],
        comorbidities: [],
        bmiCategory: []
    },

    // Raw patients cache
    _allPatients: [],
    _initialized: false,

    // =====================
    // Initialize
    // =====================
    init(patients) {
        this._allPatients = patients || [];
        this._enrichPatients();
        this._initialized = true;
        this.applyContext();
    },

    // =====================
    // Calculated Columns — enrich each patient row
    // =====================
    _enrichPatients() {
        this._allPatients.forEach(p => {
            const toNum = v => v != null ? parseFloat(v) : NaN;
            const hb = toNum(p.hba1c_baseline);
            const h6 = toNum(p.hba1c_6month);
            const bmi = toNum(p.bmi);

            // HbA1c Change
            p._hba1cChange = (!isNaN(hb) && !isNaN(h6)) ? h6 - hb : null;
            p._hba1cChangePct = (p._hba1cChange != null && hb > 0) ? (p._hba1cChange / hb * 100) : null;
            p._hba1cImproved = p._hba1cChange != null ? p._hba1cChange < 0 : null;

            // HbA1c Category
            if (!isNaN(h6)) {
                p._hba1cCat = h6 < 7 ? 'good' : h6 < 9 ? 'moderate' : 'high';
            } else if (!isNaN(hb)) {
                p._hba1cCat = hb < 7 ? 'good' : hb < 9 ? 'moderate' : 'high';
            } else {
                p._hba1cCat = 'unknown';
            }

            // BMI Category (Asian criteria)
            if (!isNaN(bmi)) {
                p._bmiCat = bmi < 18.5 ? 'underweight' : bmi < 23 ? 'normal' : bmi < 25 ? 'overweight' : bmi < 30 ? 'obese1' : 'obese2';
            } else {
                p._bmiCat = 'unknown';
            }

            // Distress level
            const dist = p.distress;
            p._distressLevel = dist === 'high' ? 'high' : dist === 'low' ? 'low' : 'unknown';

            // Risk Segmentation Matrix
            if (p._hba1cCat !== 'unknown' && p._distressLevel !== 'unknown') {
                if (p._hba1cCat === 'good' && p._distressLevel === 'low') p._riskLevel = 'low';
                else if (p._hba1cCat === 'good' && p._distressLevel === 'high') p._riskLevel = 'medium';
                else if (p._hba1cCat === 'moderate' && p._distressLevel === 'low') p._riskLevel = 'medium';
                else if (p._hba1cCat === 'moderate' && p._distressLevel === 'high') p._riskLevel = 'high';
                else if (p._hba1cCat === 'high' && p._distressLevel === 'low') p._riskLevel = 'high';
                else if (p._hba1cCat === 'high' && p._distressLevel === 'high') p._riskLevel = 'critical';
                else p._riskLevel = 'unknown';
            } else {
                p._riskLevel = 'unknown';
            }

            // PAID-5 change
            const pb = toNum(p.paid5_baseline);
            const p6 = toNum(p.paid5_6month);
            p._paid5Change = (!isNaN(pb) && !isNaN(p6)) ? p6 - pb : null;

            // Group normalized (String() to handle numeric values)
            const g = String(p.study_group || p.group || '').toLowerCase().trim();
            p._group = (g === 'experimental' || g === 'intervention' || g === '1') ? 'experimental'
                      : (g === 'control' || g === '0' || g === '2') ? 'control' : 'other';

            // Gender normalized
            const gd = String(p.gender || '').toLowerCase().trim();
            p._gender = (gd === 'm' || gd === 'male' || gd === 'ชาย') ? 'male'
                       : (gd === 'f' || gd === 'female' || gd === 'หญิง') ? 'female' : 'other';

            // Comorbidity flags
            p._comorbidities = [];
            if (parseInt(p.d1)) p._comorbidities.push('hypertension');
            if (parseInt(p.d2)) p._comorbidities.push('dyslipidemia');
            if (parseInt(p.d3)) p._comorbidities.push('cvd');
            if (parseInt(p.d4)) p._comorbidities.push('ckd');
            if (parseInt(p.d5)) p._comorbidities.push('gout');
        });
    },

    // =====================
    // FILTER CONTEXT — apply slicer filters
    // =====================
    getFilteredPatients() {
        const ctx = this.filterContext;
        return this._allPatients.filter(p => {
            // Study group filter
            if (ctx.studyGroup.length > 0 && !ctx.studyGroup.includes(p._group)) return false;
            // Gender filter
            if (ctx.gender.length > 0 && !ctx.gender.includes(p._gender)) return false;
            // Age range
            const age = parseFloat(p.age);
            if (!isNaN(age) && (age < ctx.ageRange[0] || age > ctx.ageRange[1])) return false;
            // Diabetes duration
            const dur = parseFloat(p.diabetes_duration_years);
            if (!isNaN(dur) && (dur < ctx.diabetesDuration[0] || dur > ctx.diabetesDuration[1])) return false;
            // Comorbidities (if any selected, patient must have at least one)
            if (ctx.comorbidities.length > 0) {
                const hasMatch = ctx.comorbidities.some(c => p._comorbidities.includes(c));
                if (!hasMatch) return false;
            }
            // BMI category
            if (ctx.bmiCategory.length > 0 && !ctx.bmiCategory.includes(p._bmiCat)) return false;
            return true;
        });
    },

    // =====================
    // MEASURES — aggregate calculations
    // =====================
    calcMeasures(patients) {
        const n = patients.length;
        if (n === 0) return this._emptyMeasures();

        const toNum = v => v != null ? parseFloat(v) : NaN;
        const avg = arr => { const valid = arr.filter(v => !isNaN(v)); return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null; };

        const hba1cBL = patients.map(p => toNum(p.hba1c_baseline));
        const hba1c6m = patients.map(p => toNum(p.hba1c_6month));
        const bmiVals = patients.map(p => toNum(p.bmi));
        const fbsVals = patients.map(p => toNum(p.fbs));
        const gfrVals = patients.map(p => toNum(p.gfr));
        const dtxVals = patients.map(p => toNum(p.dtx_avg));
        const paid5BL = patients.map(p => toNum(p.paid5_baseline));
        const paid56m = patients.map(p => toNum(p.paid5_6month));
        const ageVals = patients.map(p => toNum(p.age));

        // Improved count
        const improvedCount = patients.filter(p => p._hba1cImproved === true).length;
        const hba1cPairCount = patients.filter(p => p._hba1cChange != null).length;

        // Distress counts
        const highDistress = patients.filter(p => p._distressLevel === 'high').length;
        const lowDistress = patients.filter(p => p._distressLevel === 'low').length;

        // Risk segmentation matrix
        const riskMatrix = {
            good_low: 0, good_high: 0,
            moderate_low: 0, moderate_high: 0,
            high_low: 0, high_high: 0
        };
        patients.forEach(p => {
            const key = p._hba1cCat + '_' + p._distressLevel;
            if (riskMatrix[key] !== undefined) riskMatrix[key]++;
        });

        // By group
        const exp = patients.filter(p => p._group === 'experimental');
        const ctrl = patients.filter(p => p._group === 'control');

        // HbA1c by group
        const expHba1cBL = avg(exp.map(p => toNum(p.hba1c_baseline)));
        const expHba1c6m = avg(exp.map(p => toNum(p.hba1c_6month)));
        const ctrlHba1cBL = avg(ctrl.map(p => toNum(p.hba1c_baseline)));
        const ctrlHba1c6m = avg(ctrl.map(p => toNum(p.hba1c_6month)));

        // PAID-5 by group
        const expPaid5BL = avg(exp.map(p => toNum(p.paid5_baseline)));
        const expPaid56m = avg(exp.map(p => toNum(p.paid5_6month)));
        const ctrlPaid5BL = avg(ctrl.map(p => toNum(p.paid5_baseline)));
        const ctrlPaid56m = avg(ctrl.map(p => toNum(p.paid5_6month)));

        // Health Literacy by group
        const getHL = (p, period) => p.healthLiteracy ? toNum(p.healthLiteracy['total_' + period]) : NaN;
        const getSC = (p, period) => p.selfCare ? toNum(p.selfCare['total_' + period]) : NaN;

        // BMI distribution
        const bmiDist = { underweight: 0, normal: 0, overweight: 0, obese1: 0, obese2: 0 };
        patients.forEach(p => { if (p._bmiCat !== 'unknown') bmiDist[p._bmiCat]++; });

        // Age distribution
        const ageDist = { '<40': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70+': 0 };
        patients.forEach(p => {
            const a = toNum(p.age);
            if (isNaN(a)) return;
            if (a < 40) ageDist['<40']++;
            else if (a < 50) ageDist['40-49']++;
            else if (a < 60) ageDist['50-59']++;
            else if (a < 70) ageDist['60-69']++;
            else ageDist['70+']++;
        });

        // Comorbidity counts
        const comorbCounts = { hypertension: 0, dyslipidemia: 0, cvd: 0, ckd: 0, gout: 0 };
        patients.forEach(p => {
            p._comorbidities.forEach(c => { if (comorbCounts[c] !== undefined) comorbCounts[c]++; });
        });

        // Risk level counts
        const riskCounts = { low: 0, medium: 0, high: 0, critical: 0 };
        patients.forEach(p => { if (riskCounts[p._riskLevel] !== undefined) riskCounts[p._riskLevel]++; });

        // RANKX — rank patients by HbA1c improvement
        const ranked = patients
            .filter(p => p._hba1cChange != null)
            .sort((a, b) => a._hba1cChange - b._hba1cChange)
            .map((p, i) => ({ ...p, _rank: i + 1 }));

        return {
            totalPatients: n,
            experimental: exp.length,
            control: ctrl.length,
            avgHba1c: avg(hba1cBL),
            avgHba1c6m: avg(hba1c6m),
            avgHba1cChange: avg(patients.map(p => p._hba1cChange).filter(v => v != null)),
            improvedCount,
            improvedPct: hba1cPairCount > 0 ? (improvedCount / hba1cPairCount * 100) : null,
            avgBmi: avg(bmiVals),
            avgFbs: avg(fbsVals),
            avgGfr: avg(gfrVals),
            avgDtx: avg(dtxVals),
            avgAge: avg(ageVals),
            avgPaid5BL: avg(paid5BL),
            avgPaid56m: avg(paid56m),
            highDistress,
            lowDistress,
            riskMatrix,
            riskCounts,
            hba1c: { expBaseline: expHba1cBL, expSixMonth: expHba1c6m, ctrlBaseline: ctrlHba1cBL, ctrlSixMonth: ctrlHba1c6m },
            paid5: { expBaseline: expPaid5BL, expSixMonth: expPaid56m, ctrlBaseline: ctrlPaid5BL, ctrlSixMonth: ctrlPaid56m },
            healthLiteracy: {
                expBaseline: avg(exp.map(p => getHL(p, 'baseline'))),
                expSixMonth: avg(exp.map(p => getHL(p, '6month'))),
                ctrlBaseline: avg(ctrl.map(p => getHL(p, 'baseline'))),
                ctrlSixMonth: avg(ctrl.map(p => getHL(p, '6month')))
            },
            selfCare: {
                expBaseline: avg(exp.map(p => getSC(p, 'baseline'))),
                expSixMonth: avg(exp.map(p => getSC(p, '6month'))),
                ctrlBaseline: avg(ctrl.map(p => getSC(p, 'baseline'))),
                ctrlSixMonth: avg(ctrl.map(p => getSC(p, '6month')))
            },
            distress: { low: lowDistress, high: highDistress },
            bmiDist,
            ageDist,
            comorbCounts,
            rankedPatients: ranked,
            patients: patients
        };
    },

    _emptyMeasures() {
        return {
            totalPatients: 0, experimental: 0, control: 0,
            avgHba1c: null, avgHba1c6m: null, avgHba1cChange: null,
            improvedCount: 0, improvedPct: null,
            avgBmi: null, avgFbs: null, avgGfr: null, avgDtx: null, avgAge: null,
            avgPaid5BL: null, avgPaid56m: null,
            highDistress: 0, lowDistress: 0,
            riskMatrix: { good_low: 0, good_high: 0, moderate_low: 0, moderate_high: 0, high_low: 0, high_high: 0 },
            riskCounts: { low: 0, medium: 0, high: 0, critical: 0 },
            hba1c: {}, paid5: {}, healthLiteracy: {}, selfCare: {},
            distress: { low: 0, high: 0 }, bmiDist: {}, ageDist: {}, comorbCounts: {},
            rankedPatients: [], patients: []
        };
    },

    // =====================
    // Apply context → recalculate everything → update UI
    // =====================
    applyContext() {
        try {
            const filtered = this.getFilteredPatients();
            console.log('[DAX] Filtered:', filtered.length, '/', this._allPatients.length, 'patients');
            const measures = this.calcMeasures(filtered);
            DAXDashboard.render(measures);
        } catch (err) {
            console.error('[DAX] applyContext error:', err);
        }
    },

    // Reset all filters
    resetFilters() {
        this.filterContext = {
            studyGroup: ['experimental', 'control'],
            gender: ['male', 'female', 'other'],
            ageRange: [0, 120],
            diabetesDuration: [0, 50],
            comorbidities: [],
            bmiCategory: []
        };
        // Reset UI checkboxes
        document.querySelectorAll('#dax-slicer input[type="checkbox"]').forEach(cb => cb.checked = true);
        document.querySelectorAll('#dax-slicer input[type="checkbox"][data-filter="comorbidity"]').forEach(cb => cb.checked = false);
        const ageMin = document.getElementById('dax-age-min');
        const ageMax = document.getElementById('dax-age-max');
        if (ageMin) ageMin.value = 0;
        if (ageMax) ageMax.value = 120;
        this.applyContext();
    }
};


// ============================================
// DAX Dashboard — Render UI
// ============================================

const DAXDashboard = {
    charts: {},

    render(m) {
        this.renderKPICards(m);
        this.renderRiskMatrix(m);
        this.renderTimeIntelligence(m);
        this.renderRiskDonut(m);
        this.renderCrossAnalysis(m);
        this.renderRankingTable(m);
        this.renderFilterSummary(m);
    },

    // =====================
    // KPI Measure Cards
    // =====================
    renderKPICards(m) {
        const fmt = (v, d) => v != null ? v.toFixed(d || 0) : '-';
        const fmtPct = v => v != null ? v.toFixed(0) + '%' : '-';
        const delta = (v, good) => {
            if (v == null) return '';
            const arrow = v < 0 ? '<span class="dax-delta dax-delta-down">' : v > 0 ? '<span class="dax-delta dax-delta-up">' : '<span class="dax-delta">';
            const sign = v > 0 ? '+' : '';
            return arrow + sign + v.toFixed(1) + '</span>';
        };

        this._setKPI('dax-kpi-total', m.totalPatients, 'Exp: ' + m.experimental + ' | Ctrl: ' + m.control);
        this._setKPI('dax-kpi-hba1c', fmt(m.avgHba1c, 1) + '%', m.avgHba1cChange != null ? delta(m.avgHba1cChange) + ' (Baseline → 6m)' : '');
        this._setKPI('dax-kpi-distress', m.highDistress, '<span style="color:#16a34a">Low: ' + m.lowDistress + '</span> | <span style="color:#dc2626">High: ' + m.highDistress + '</span>');
        this._setKPI('dax-kpi-improved', fmtPct(m.improvedPct), m.improvedCount + ' / ' + m.totalPatients + ' ราย HbA1c ดีขึ้น');
        this._setKPI('dax-kpi-bmi', fmt(m.avgBmi, 1), '');
        this._setKPI('dax-kpi-fbs', fmt(m.avgFbs, 0), 'mg/dL');
        this._setKPI('dax-kpi-dtx', fmt(m.avgDtx, 0), 'mg/dL');
        this._setKPI('dax-kpi-age', fmt(m.avgAge, 0), 'ปี');
    },

    _setKPI(id, value, sub) {
        const el = document.getElementById(id);
        if (!el) return;
        const valEl = el.querySelector('.dax-kpi-value');
        const subEl = el.querySelector('.dax-kpi-sub');
        if (valEl) valEl.innerHTML = value;
        if (subEl) subEl.innerHTML = sub || '';
    },

    // =====================
    // Filter Summary Badge
    // =====================
    renderFilterSummary(m) {
        const el = document.getElementById('dax-filter-count');
        if (el) el.textContent = m.totalPatients + ' ราย';
    },

    // =====================
    // Risk Segmentation Matrix (Calculated Columns)
    // =====================
    renderRiskMatrix(m) {
        const rm = m.riskMatrix;
        const cells = {
            'rm-good-low': rm.good_low,
            'rm-good-high': rm.good_high,
            'rm-mod-low': rm.moderate_low,
            'rm-mod-high': rm.moderate_high,
            'rm-high-low': rm.high_low,
            'rm-high-high': rm.high_high
        };
        Object.keys(cells).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = cells[id];
        });
    },

    // =====================
    // Time Intelligence — HbA1c Baseline vs 6-Month by group
    // =====================
    renderTimeIntelligence(m) {
        const canvas = document.getElementById('dax-chart-time');
        if (!canvas) return;
        if (this.charts.time) { this.charts.time.destroy(); this.charts.time = null; }

        const h = m.hba1c || {};
        this.charts.time = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Baseline', '6 เดือน'],
                datasets: [
                    {
                        label: 'กลุ่มทดลอง',
                        data: [h.expBaseline || 0, h.expSixMonth || 0],
                        backgroundColor: 'rgba(44,175,254,0.8)',
                        borderColor: '#2caffe', borderWidth: 1, borderRadius: 6,
                        barPercentage: 0.7, categoryPercentage: 0.6
                    },
                    {
                        label: 'กลุ่มควบคุม',
                        data: [h.ctrlBaseline || 0, h.ctrlSixMonth || 0],
                        backgroundColor: 'rgba(254,106,53,0.8)',
                        borderColor: '#fe6a35', borderWidth: 1, borderRadius: 6,
                        barPercentage: 0.7, categoryPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { font: { family: 'Athiti', size: 12 }, usePointStyle: true, pointStyle: 'rectRounded' } },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' },
                        callbacks: { label: ctx => ctx.dataset.label + ': ' + (ctx.raw || 0).toFixed(1) + '%' } }
                },
                scales: {
                    y: { min: 5, max: 12, title: { display: true, text: 'HbA1c (%)', font: { family: 'Athiti' } },
                         ticks: { font: { family: 'Athiti' }, callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { ticks: { font: { family: 'Athiti', size: 13 } }, grid: { display: false } }
                }
            }
        });

        // Delta labels
        const expDelta = document.getElementById('dax-time-exp-delta');
        const ctrlDelta = document.getElementById('dax-time-ctrl-delta');
        if (expDelta && h.expBaseline && h.expSixMonth) {
            const d = h.expSixMonth - h.expBaseline;
            expDelta.innerHTML = 'ทดลอง: <strong style="color:' + (d < 0 ? '#16a34a' : '#dc2626') + '">' + (d > 0 ? '+' : '') + d.toFixed(1) + '%</strong>';
        }
        if (ctrlDelta && h.ctrlBaseline && h.ctrlSixMonth) {
            const d = h.ctrlSixMonth - h.ctrlBaseline;
            ctrlDelta.innerHTML = 'ควบคุม: <strong style="color:' + (d < 0 ? '#16a34a' : '#dc2626') + '">' + (d > 0 ? '+' : '') + d.toFixed(1) + '%</strong>';
        }
    },

    // =====================
    // Risk Level Donut
    // =====================
    renderRiskDonut(m) {
        const canvas = document.getElementById('dax-chart-risk');
        if (!canvas) return;
        if (this.charts.risk) { this.charts.risk.destroy(); this.charts.risk = null; }

        const rc = m.riskCounts;
        const total = rc.low + rc.medium + rc.high + rc.critical;

        this.charts.risk = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk', 'Critical'],
                datasets: [{
                    data: [rc.low, rc.medium, rc.high, rc.critical],
                    backgroundColor: ['rgba(0,226,114,0.8)', 'rgba(251,191,36,0.8)', 'rgba(254,106,53,0.8)', 'rgba(250,75,66,0.8)'],
                    borderWidth: 2, borderColor: '#fff', hoverOffset: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Athiti', size: 11 }, usePointStyle: true, pointStyle: 'circle', padding: 10 } },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' },
                        callbacks: { label: ctx => ctx.label + ': ' + ctx.raw + ' ราย (' + (total > 0 ? (ctx.raw / total * 100).toFixed(0) : 0) + '%)' } }
                }
            },
            plugins: [{
                id: 'riskCenterText',
                afterDraw(chart) {
                    const ctx = chart.ctx;
                    const cx = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const cy = (chart.chartArea.top + chart.chartArea.bottom) / 2;
                    ctx.save();
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.font = '700 24px Athiti'; ctx.fillStyle = '#19191B';
                    ctx.fillText(total.toString(), cx, cy - 6);
                    ctx.font = '400 11px Athiti'; ctx.fillStyle = '#61646B';
                    ctx.fillText('ประเมินแล้ว', cx, cy + 12);
                    ctx.restore();
                }
            }]
        });
    },

    // =====================
    // Cross-Table Analysis (Relationships)
    // =====================
    renderCrossAnalysis(m) {
        const canvas = document.getElementById('dax-chart-cross');
        if (!canvas) return;
        if (this.charts.cross) { this.charts.cross.destroy(); this.charts.cross = null; }

        const p5 = m.paid5 || {};
        const hl = m.healthLiteracy || {};
        const sc = m.selfCare || {};

        // Radar chart: Experimental vs Control across dimensions
        const expData = [
            p5.expBaseline || 0, p5.expSixMonth || 0,
            hl.expBaseline || 0, hl.expSixMonth || 0,
            sc.expBaseline || 0, sc.expSixMonth || 0
        ];
        const ctrlData = [
            p5.ctrlBaseline || 0, p5.ctrlSixMonth || 0,
            hl.ctrlBaseline || 0, hl.ctrlSixMonth || 0,
            sc.ctrlBaseline || 0, sc.ctrlSixMonth || 0
        ];

        // Normalize to 0-100 scale
        const maxVal = Math.max(...expData, ...ctrlData, 1);
        const norm = arr => arr.map(v => v / maxVal * 100);

        this.charts.cross = new Chart(canvas, {
            type: 'radar',
            data: {
                labels: ['PAID-5 BL', 'PAID-5 6m', 'HL BL', 'HL 6m', 'SC BL', 'SC 6m'],
                datasets: [
                    { label: 'กลุ่มทดลอง', data: norm(expData), borderColor: '#2caffe', backgroundColor: 'rgba(44,175,254,0.15)', pointBackgroundColor: '#2caffe', borderWidth: 2 },
                    { label: 'กลุ่มควบคุม', data: norm(ctrlData), borderColor: '#fe6a35', backgroundColor: 'rgba(254,106,53,0.15)', pointBackgroundColor: '#fe6a35', borderWidth: 2 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { font: { family: 'Athiti', size: 12 }, usePointStyle: true } },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' } }
                },
                scales: {
                    r: { beginAtZero: true, max: 100, ticks: { display: false }, pointLabels: { font: { family: 'Athiti', size: 11 } },
                         grid: { color: 'rgba(0,0,0,0.06)' } }
                }
            }
        });
    },

    // =====================
    // Patient Ranking Table (Iterator / RANKX)
    // =====================
    renderRankingTable(m) {
        const tbody = document.getElementById('dax-ranking-body');
        if (!tbody) return;

        const ranked = m.rankedPatients || [];
        const top = ranked.slice(0, 20); // show top 20

        if (top.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8">ยังไม่มีข้อมูลเพียงพอสำหรับจัดอันดับ</td></tr>';
            return;
        }

        const esc = s => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
        let html = '';
        top.forEach(p => {
            const change = p._hba1cChange;
            const changeColor = change < 0 ? '#16a34a' : change > 0 ? '#dc2626' : '#64748b';
            const changeStr = (change > 0 ? '+' : '') + change.toFixed(1) + '%';
            const riskBadge = {
                low: '<span class="dax-badge dax-badge-low">Low</span>',
                medium: '<span class="dax-badge dax-badge-med">Medium</span>',
                high: '<span class="dax-badge dax-badge-high">High</span>',
                critical: '<span class="dax-badge dax-badge-crit">Critical</span>',
                unknown: '<span class="dax-badge">-</span>'
            };
            const gender = p._gender === 'male' ? 'ชาย' : p._gender === 'female' ? 'หญิง' : '-';
            const group = p._group === 'experimental' ? 'ทดลอง' : p._group === 'control' ? 'ควบคุม' : '-';

            html += '<tr>';
            html += '<td style="font-weight:700;color:#2A86FF;text-align:center">' + p._rank + '</td>';
            html += '<td style="font-weight:600">' + esc(p.patient_id) + '</td>';
            html += '<td>' + gender + '</td>';
            html += '<td>' + (p.age || '-') + '</td>';
            html += '<td>' + (p.hba1c_baseline != null ? parseFloat(p.hba1c_baseline).toFixed(1) : '-') + '</td>';
            html += '<td>' + (p.hba1c_6month != null ? parseFloat(p.hba1c_6month).toFixed(1) : '-') + '</td>';
            html += '<td style="font-weight:700;color:' + changeColor + '">' + changeStr + '</td>';
            html += '<td>' + (riskBadge[p._riskLevel] || '-') + '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;

        // Update count
        const countEl = document.getElementById('dax-ranking-count');
        if (countEl) countEl.textContent = ranked.length + ' ราย';
    }
};


// ============================================
// Slicer Event Binding
// ============================================
function initDAXSlicers() {
    // Study group checkboxes
    document.querySelectorAll('#dax-slicer input[data-filter="group"]').forEach(cb => {
        cb.addEventListener('change', () => {
            DAXEngine.filterContext.studyGroup = [];
            document.querySelectorAll('#dax-slicer input[data-filter="group"]:checked').forEach(el => {
                DAXEngine.filterContext.studyGroup.push(el.value);
            });
            DAXEngine.applyContext();
        });
    });

    // Gender checkboxes
    document.querySelectorAll('#dax-slicer input[data-filter="gender"]').forEach(cb => {
        cb.addEventListener('change', () => {
            DAXEngine.filterContext.gender = [];
            document.querySelectorAll('#dax-slicer input[data-filter="gender"]:checked').forEach(el => {
                DAXEngine.filterContext.gender.push(el.value);
            });
            DAXEngine.applyContext();
        });
    });

    // Age range
    const ageMin = document.getElementById('dax-age-min');
    const ageMax = document.getElementById('dax-age-max');
    let ageTimer;
    [ageMin, ageMax].forEach(el => {
        if (!el) return;
        el.addEventListener('input', () => {
            clearTimeout(ageTimer);
            ageTimer = setTimeout(() => {
                DAXEngine.filterContext.ageRange = [
                    parseInt(ageMin.value) || 0,
                    parseInt(ageMax.value) || 120
                ];
                DAXEngine.applyContext();
            }, 300);
        });
    });

    // Comorbidities
    document.querySelectorAll('#dax-slicer input[data-filter="comorbidity"]').forEach(cb => {
        cb.addEventListener('change', () => {
            DAXEngine.filterContext.comorbidities = [];
            document.querySelectorAll('#dax-slicer input[data-filter="comorbidity"]:checked').forEach(el => {
                DAXEngine.filterContext.comorbidities.push(el.value);
            });
            DAXEngine.applyContext();
        });
    });

    // Reset button
    const resetBtn = document.getElementById('dax-reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => DAXEngine.resetFilters());
    }

    // Slicer toggle (mobile)
    const toggleBtn = document.getElementById('dax-slicer-toggle');
    const slicer = document.getElementById('dax-slicer');
    if (toggleBtn && slicer) {
        toggleBtn.addEventListener('click', () => {
            slicer.classList.toggle('dax-slicer-open');
        });
    }
}
