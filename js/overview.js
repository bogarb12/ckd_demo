// Overview Tab - Charts and Statistics
class OverviewTab {
    constructor(patients) {
        this.patients = patients;
        this.charts = {};
    }

    render() {
        this.updateSummaryCards();
        this.renderCKDStageChart();
        this.renderRiskFactorChart();
        this.renderEgfrDistChart();
        this.renderAgeEgfrScatter();
        this.renderBPScatter();
        this.renderUrineProteinChart();
    }

    updateSummaryCards() {
        const p = this.patients;
        const total = p.length;
        const progressionCount = p.filter(pt => pt.ckd_progression_1yr === 1).length;
        const progressionRate = ((progressionCount / total) * 100).toFixed(1);

        const egfrValues = p.map(pt => CKDDataGenerator.getEffectiveEgfr(pt)).filter(v => v != null);
        const avgEgfr = (egfrValues.reduce((a, b) => a + b, 0) / egfrValues.length).toFixed(1);

        const ages = p.map(pt => pt.age).filter(a => a != null && a <= 120);
        const avgAge = (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(0);

        const diabetesCount = p.filter(pt => pt.has_diabetes === 1).length;
        const diabetesRate = ((diabetesCount / total) * 100).toFixed(1);

        const hypertensionCount = p.filter(pt => pt.has_hypertension === 1).length;
        const hypertensionRate = ((hypertensionCount / total) * 100).toFixed(1);

        document.getElementById('total-patients').textContent = total.toLocaleString();
        document.getElementById('header-total').textContent = total.toLocaleString();
        document.getElementById('progression-rate').textContent = progressionRate + '%';
        document.getElementById('header-progression').textContent = progressionCount.toLocaleString();
        document.getElementById('avg-egfr').textContent = avgEgfr;
        document.getElementById('avg-age').textContent = avgAge;
        document.getElementById('diabetes-rate').textContent = diabetesRate + '%';
        document.getElementById('hypertension-rate').textContent = hypertensionRate + '%';
    }

    renderCKDStageChart() {
        const stages = { 'Stage 1': 0, 'Stage 2': 0, 'Stage 3a': 0, 'Stage 3b': 0, 'Stage 4': 0, 'Stage 5': 0, 'ไม่ทราบ': 0 };
        this.patients.forEach(pt => {
            const egfr = CKDDataGenerator.getEffectiveEgfr(pt);
            const stage = CKDDataGenerator.getCKDStage(egfr);
            stages[stage]++;
        });

        const labels = Object.keys(stages).filter(k => stages[k] > 0);
        const data = labels.map(k => stages[k]);
        const colors = labels.map(k => CKDDataGenerator.getCKDStageColor(k));

        this.charts.ckdStage = new Chart(document.getElementById('chart-ckd-stage'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { padding: 12, font: { family: 'Sarabun', size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return `${ctx.label}: ${ctx.raw} ราย (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    renderRiskFactorChart() {
        const factors = [
            { label: 'เบาหวาน', key: 'has_diabetes' },
            { label: 'ความดันสูง', key: 'has_hypertension' },
            { label: 'โรคหัวใจ', key: 'has_cvd' },
            { label: 'Proteinuria 2+/3+', key: null },
            { label: 'ACE/ARBs', key: null },
            { label: 'อายุ > 65', key: null }
        ];

        const ratesWithFactor = [];
        const ratesWithoutFactor = [];

        factors.forEach(f => {
            let withFactor, withoutFactor;
            if (f.key) {
                withFactor = this.patients.filter(pt => pt[f.key] === 1);
                withoutFactor = this.patients.filter(pt => pt[f.key] === 0);
            } else if (f.label === 'Proteinuria 2+/3+') {
                withFactor = this.patients.filter(pt => pt.urine_protein === '2+' || pt.urine_protein === '3+');
                withoutFactor = this.patients.filter(pt => pt.urine_protein != null && pt.urine_protein !== '2+' && pt.urine_protein !== '3+');
            } else if (f.label === 'ACE/ARBs') {
                withFactor = this.patients.filter(pt => pt.ace_inhibitor === 1 || pt.arbs === 1);
                withoutFactor = this.patients.filter(pt => pt.ace_inhibitor === 0 && pt.arbs === 0);
            } else if (f.label === 'อายุ > 65') {
                withFactor = this.patients.filter(pt => pt.age > 65 && pt.age <= 120);
                withoutFactor = this.patients.filter(pt => pt.age != null && pt.age <= 65);
            }

            const rateWith = withFactor.length > 0 ? (withFactor.filter(pt => pt.ckd_progression_1yr === 1).length / withFactor.length * 100) : 0;
            const rateWithout = withoutFactor.length > 0 ? (withoutFactor.filter(pt => pt.ckd_progression_1yr === 1).length / withoutFactor.length * 100) : 0;

            ratesWithFactor.push(parseFloat(rateWith.toFixed(1)));
            ratesWithoutFactor.push(parseFloat(rateWithout.toFixed(1)));
        });

        this.charts.riskFactors = new Chart(document.getElementById('chart-risk-factors'), {
            type: 'bar',
            data: {
                labels: factors.map(f => f.label),
                datasets: [
                    { label: 'มีปัจจัยเสี่ยง', data: ratesWithFactor, backgroundColor: '#ef4444', borderRadius: 4 },
                    { label: 'ไม่มีปัจจัยเสี่ยง', data: ratesWithoutFactor, backgroundColor: '#93c5fd', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Progression Rate (%)', font: { family: 'Sarabun' } }, ticks: { font: { family: 'Sarabun' } } },
                    x: { ticks: { font: { family: 'Sarabun', size: 11 } } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Sarabun' } } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}%` } }
                }
            }
        });
    }

    renderEgfrDistChart() {
        const bins = [
            { label: '< 15', min: 0, max: 15 },
            { label: '15-29', min: 15, max: 30 },
            { label: '30-44', min: 30, max: 45 },
            { label: '45-59', min: 45, max: 60 },
            { label: '60-89', min: 60, max: 90 },
            { label: '≥ 90', min: 90, max: 999 }
        ];

        const progCounts = bins.map(() => 0);
        const nonProgCounts = bins.map(() => 0);

        this.patients.forEach(pt => {
            const egfr = CKDDataGenerator.getEffectiveEgfr(pt);
            if (egfr == null) return;
            for (let i = 0; i < bins.length; i++) {
                if (egfr >= bins[i].min && egfr < bins[i].max) {
                    if (pt.ckd_progression_1yr === 1) progCounts[i]++;
                    else nonProgCounts[i]++;
                    break;
                }
            }
        });

        this.charts.egfrDist = new Chart(document.getElementById('chart-egfr-dist'), {
            type: 'bar',
            data: {
                labels: bins.map(b => b.label),
                datasets: [
                    { label: 'Progression', data: progCounts, backgroundColor: '#ef4444', borderRadius: 4 },
                    { label: 'No Progression', data: nonProgCounts, backgroundColor: '#3b82f6', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, title: { display: true, text: 'eGFR (mL/min/1.73m²)', font: { family: 'Sarabun' } }, ticks: { font: { family: 'Sarabun' } } },
                    y: { stacked: true, title: { display: true, text: 'จำนวนผู้ป่วย', font: { family: 'Sarabun' } }, ticks: { font: { family: 'Sarabun' } } }
                },
                plugins: { legend: { labels: { font: { family: 'Sarabun' } } } }
            }
        });
    }

    renderAgeEgfrScatter() {
        const prog = [];
        const nonProg = [];

        this.patients.forEach(pt => {
            const egfr = CKDDataGenerator.getEffectiveEgfr(pt);
            if (egfr == null || pt.age == null || pt.age > 120) return;
            const point = { x: pt.age, y: egfr };
            if (pt.ckd_progression_1yr === 1) prog.push(point);
            else nonProg.push(point);
        });

        this.charts.ageEgfr = new Chart(document.getElementById('chart-age-egfr'), {
            type: 'scatter',
            data: {
                datasets: [
                    { label: 'No Progression', data: nonProg, backgroundColor: 'rgba(59, 130, 246, 0.4)', pointRadius: 3 },
                    { label: 'Progression', data: prog, backgroundColor: 'rgba(239, 68, 68, 0.5)', pointRadius: 3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'อายุ (ปี)', font: { family: 'Sarabun' } }, min: 25, max: 95, ticks: { font: { family: 'Sarabun' } } },
                    y: { title: { display: true, text: 'eGFR (mL/min/1.73m²)', font: { family: 'Sarabun' } }, min: 0, max: 160, ticks: { font: { family: 'Sarabun' } } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Sarabun' } } },
                    tooltip: { callbacks: { label: ctx => `อายุ: ${ctx.raw.x}, eGFR: ${ctx.raw.y}` } }
                }
            }
        });
    }

    renderBPScatter() {
        const prog = [];
        const nonProg = [];

        this.patients.forEach(pt => {
            if (pt.sbp == null || pt.dbp == null || pt.sbp > 250 || pt.dbp > 150) return;
            const point = { x: pt.sbp, y: pt.dbp };
            if (pt.ckd_progression_1yr === 1) prog.push(point);
            else nonProg.push(point);
        });

        this.charts.bp = new Chart(document.getElementById('chart-bp'), {
            type: 'scatter',
            data: {
                datasets: [
                    { label: 'No Progression', data: nonProg, backgroundColor: 'rgba(59, 130, 246, 0.35)', pointRadius: 3 },
                    { label: 'Progression', data: prog, backgroundColor: 'rgba(239, 68, 68, 0.5)', pointRadius: 3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'SBP (mmHg)', font: { family: 'Sarabun' } }, min: 80, max: 210, ticks: { font: { family: 'Sarabun' } } },
                    y: { title: { display: true, text: 'DBP (mmHg)', font: { family: 'Sarabun' } }, min: 40, max: 140, ticks: { font: { family: 'Sarabun' } } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Sarabun' } } },
                    tooltip: { callbacks: { label: ctx => `SBP: ${ctx.raw.x}, DBP: ${ctx.raw.y}` } }
                }
            }
        });
    }

    renderUrineProteinChart() {
        const levels = ['Negative', 'Trace', '1+', '2+', '3+'];
        const progCounts = levels.map(() => 0);
        const nonProgCounts = levels.map(() => 0);

        this.patients.forEach(pt => {
            if (pt.urine_protein == null) return;
            const idx = levels.indexOf(pt.urine_protein);
            if (idx === -1) return;
            if (pt.ckd_progression_1yr === 1) progCounts[idx]++;
            else nonProgCounts[idx]++;
        });

        this.charts.urineProtein = new Chart(document.getElementById('chart-urine-protein'), {
            type: 'bar',
            data: {
                labels: levels,
                datasets: [
                    { label: 'Progression', data: progCounts, backgroundColor: '#ef4444', borderRadius: 4 },
                    { label: 'No Progression', data: nonProgCounts, backgroundColor: '#3b82f6', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'ระดับโปรตีนในปัสสาวะ', font: { family: 'Sarabun' } }, ticks: { font: { family: 'Sarabun' } } },
                    y: { title: { display: true, text: 'จำนวนผู้ป่วย', font: { family: 'Sarabun' } }, ticks: { font: { family: 'Sarabun' } } }
                },
                plugins: { legend: { labels: { font: { family: 'Sarabun' } } } }
            }
        });
    }

    destroy() {
        Object.values(this.charts).forEach(c => c && c.destroy());
        this.charts = {};
    }
}

window.OverviewTab = OverviewTab;
