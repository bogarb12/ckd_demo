// Main Dashboard Controller
(function () {
    let patients = [];
    let overviewTab = null;
    let individualTab = null;
    let qualityRendered = false;

    // Initialize
    window.addEventListener('DOMContentLoaded', async () => {
        showLoading(true);

        // Generate synthetic data
        const generator = new CKDDataGenerator(42);
        patients = generator.generatePatients(1530);

        // Initialize tabs
        overviewTab = new OverviewTab(patients);
        individualTab = new IndividualTab(patients);

        // Render default tab
        overviewTab.render();
        individualTab.render();

        // Setup tab navigation
        setupTabs();

        showLoading(false);
    });

    function setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;

                // Update buttons
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update panels
                document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                document.getElementById('tab-' + tabId).classList.add('active');

                // Render data quality tab on first visit
                if (tabId === 'quality' && !qualityRendered) {
                    renderDataQuality();
                    qualityRendered = true;
                }
            });
        });
    }

    function showLoading(show) {
        const el = document.getElementById('loading');
        if (show) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }

    function renderDataQuality() {
        // Missing values
        const fields = [
            { key: 'hba1c_percent', label: 'HbA1c' },
            { key: 'bmi', label: 'BMI' },
            { key: 'urine_protein', label: 'Urine Protein' },
            { key: 'egfr', label: 'eGFR' },
            { key: 'fbs_mg_dl', label: 'FBS' },
            { key: 'sbp', label: 'SBP' },
            { key: 'dbp', label: 'DBP' },
            { key: 'age', label: 'Age' },
            { key: 'gender', label: 'Gender' }
        ];

        const missingPcts = fields.map(f => {
            const missing = patients.filter(pt => pt[f.key] == null).length;
            return { label: f.label, pct: parseFloat(((missing / patients.length) * 100).toFixed(1)) };
        });

        missingPcts.sort((a, b) => b.pct - a.pct);

        new Chart(document.getElementById('chart-missing'), {
            type: 'bar',
            data: {
                labels: missingPcts.map(m => m.label),
                datasets: [{
                    label: 'Missing %',
                    data: missingPcts.map(m => m.pct),
                    backgroundColor: missingPcts.map(m =>
                        m.pct > 25 ? '#ef4444' : m.pct > 10 ? '#f59e0b' : '#22c55e'
                    ),
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 40,
                        title: { display: true, text: 'Missing (%)', font: { family: 'Sarabun' } },
                        ticks: { font: { family: 'Sarabun' } }
                    },
                    y: { ticks: { font: { family: 'Sarabun', size: 12 } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${ctx.raw}% missing` } }
                }
            }
        });

        // Quality stats
        const duplicates = patients.filter(pt => pt._isDuplicate).length;
        const outliers = patients.filter(pt => pt._is_outlier).length;
        const mmolCount = patients.filter(pt => pt.creatinine_unit === 'mmol/L').length;
        const mgdlCount = patients.filter(pt => pt.creatinine_unit === 'mg/dL').length;
        const totalWithOutcome = patients.filter(pt => pt.ckd_progression_1yr != null).length;
        const positiveCount = patients.filter(pt => pt.ckd_progression_1yr === 1).length;
        const classBalance = totalWithOutcome > 0 ? ((positiveCount / totalWithOutcome) * 100).toFixed(1) : 'N/A';
        const ageOutliers = patients.filter(pt => pt.age != null && pt.age > 120).length;

        const statsContainer = document.getElementById('quality-stats');
        statsContainer.innerHTML = `
            <div class="quality-stat-item">
                <span class="quality-stat-label">จำนวนผู้ป่วยทั้งหมด</span>
                <span class="quality-stat-value" style="background: #dbeafe; color: #1e40af;">${patients.length}</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">Duplicates</span>
                <span class="quality-stat-value" style="background: ${duplicates > 0 ? '#fef3c7' : '#dcfce7'}; color: ${duplicates > 0 ? '#92400e' : '#166534'};">${duplicates} (${((duplicates / patients.length) * 100).toFixed(1)}%)</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">Outliers (FBS)</span>
                <span class="quality-stat-value" style="background: ${outliers > 0 ? '#fee2e2' : '#dcfce7'}; color: ${outliers > 0 ? '#b91c1c' : '#166534'};">${outliers}</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">Age Outliers (> 120)</span>
                <span class="quality-stat-value" style="background: ${ageOutliers > 0 ? '#fee2e2' : '#dcfce7'}; color: ${ageOutliers > 0 ? '#b91c1c' : '#166534'};">${ageOutliers}</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">Creatinine mg/dL</span>
                <span class="quality-stat-value" style="background: #dbeafe; color: #1e40af;">${mgdlCount}</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">Creatinine mmol/L</span>
                <span class="quality-stat-value" style="background: #fef3c7; color: #92400e;">${mmolCount}</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">Class Balance (Positive)</span>
                <span class="quality-stat-value" style="background: #ede9fe; color: #6d28d9;">${classBalance}%</span>
            </div>
            <div class="quality-stat-item">
                <span class="quality-stat-label">มี Outcome</span>
                <span class="quality-stat-value" style="background: #dcfce7; color: #166534;">${totalWithOutcome}</span>
            </div>
        `;

        // Feature distribution box plot approximation
        const featureData = [
            { label: 'Age', values: patients.map(pt => pt.age).filter(v => v != null && v <= 120) },
            { label: 'eGFR', values: patients.map(pt => CKDDataGenerator.getEffectiveEgfr(pt)).filter(v => v != null) },
            { label: 'SBP', values: patients.map(pt => pt.sbp).filter(v => v != null && v <= 250) },
            { label: 'DBP', values: patients.map(pt => pt.dbp).filter(v => v != null && v <= 150) },
            { label: 'BMI', values: patients.map(pt => pt.bmi).filter(v => v != null && v < 50) },
            { label: 'FBS', values: patients.map(pt => pt.fbs_mg_dl).filter(v => v != null && v < 400) }
        ];

        const means = featureData.map(f => {
            const sum = f.values.reduce((a, b) => a + b, 0);
            return parseFloat((sum / f.values.length).toFixed(1));
        });

        const mins = featureData.map(f => Math.min(...f.values));
        const maxs = featureData.map(f => Math.max(...f.values));

        const q25 = featureData.map(f => {
            const sorted = [...f.values].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.25)];
        });

        const q75 = featureData.map(f => {
            const sorted = [...f.values].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * 0.75)];
        });

        new Chart(document.getElementById('chart-feature-dist'), {
            type: 'bar',
            data: {
                labels: featureData.map(f => f.label),
                datasets: [
                    { label: 'Min', data: mins, backgroundColor: '#93c5fd', borderRadius: 2 },
                    { label: 'Q25', data: q25.map((v, i) => v - mins[i]), backgroundColor: '#60a5fa', borderRadius: 2 },
                    { label: 'Mean', data: means.map((v, i) => v - q25[i]), backgroundColor: '#3b82f6', borderRadius: 2 },
                    { label: 'Q75', data: q75.map((v, i) => v - means[i]), backgroundColor: '#60a5fa', borderRadius: 2 },
                    { label: 'Max', data: maxs.map((v, i) => v - q75[i]), backgroundColor: '#93c5fd', borderRadius: 2 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { stacked: true, ticks: { font: { family: 'Sarabun', size: 12 } } },
                    y: { stacked: true, title: { display: true, text: 'ค่า', font: { family: 'Sarabun' } }, ticks: { font: { family: 'Sarabun' } } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Sarabun' } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const i = ctx.dataIndex;
                                return `${featureData[i].label}: Min=${mins[i]}, Q25=${q25[i]}, Mean=${means[i]}, Q75=${q75[i]}, Max=${maxs[i]}`;
                            }
                        }
                    }
                }
            }
        });
    }
})();
