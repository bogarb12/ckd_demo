// DiabetesDashboard - Dashboard with Charts and Patient Data Table
const DiabetesDashboard = {
    charts: {},
    currentFilter: 'all',
    initialized: false,
    currentPage: 1,
    pageSize: 10,
    filteredPatients: [],
    searchTerm: '',

    // =====================
    // Initialization
    // =====================

    async init() {
        // Auth guard: only logged-in admin can see patient data
        var authOverlay = document.getElementById('dashboard-auth-overlay');
        var dashContent = document.getElementById('dashboard-content');
        var loginBtn = document.getElementById('btn-dashboard-login');

        if (loginBtn && !loginBtn._bound) {
            loginBtn._bound = true;
            loginBtn.addEventListener('click', function() {
                if (window.Auth) Auth.showLoginModal();
            });
        }

        var isAdmin = window.Auth && Auth.isLoggedIn() && Auth.isAdmin();
        if (!isAdmin) {
            if (authOverlay) authOverlay.classList.remove('hidden');
            if (dashContent) dashContent.style.display = 'none';
            return;
        }

        if (authOverlay) authOverlay.classList.add('hidden');
        if (dashContent) dashContent.style.display = '';

        // Show admin-only columns (patient name)
        document.querySelectorAll('.admin-only-col').forEach(el => {
            el.style.display = 'table-cell';
        });

        try {
            // Load patient data from server API
            let patients = [];
            let usingDemo = false;

            if (typeof DiabetesApp !== 'undefined') {
                patients = await DiabetesApp.loadAllPatients();
            }

            if (!patients || patients.length === 0) {
                usingDemo = true;
            }

            // Get summary data
            const summaryData = usingDemo
                ? this.getDemoData()
                : this.buildSummaryFromPatients(patients);

            // Show demo notice banner if using demo data
            this.toggleDemoBanner(usingDemo);

            // Update summary cards
            this.updateSummaryCards(summaryData);

            // Create/update charts
            this.createHbA1cChart(summaryData);
            this.createPAID5Chart(summaryData);
            this.createDistressChart(summaryData);
            this.createHealthLiteracyChart(summaryData);
            this.createSelfCareChart(summaryData);
            this.createBMIChart(summaryData);
            this.createComorbidityChart(summaryData);
            this.createDTXGroupChart(summaryData);
            this.createAgeChart(summaryData);

            // Render patient table
            this.renderPatientTable(summaryData.patients, this.currentFilter);

            // Set up filter and export (only once)
            if (!this.initialized) {
                this.setupFilter(summaryData);
                this.setupExport();
                this.setupImport();
                this.setupTemplateDownload();
                this.setupPrintReport();
                this.setupCRUD();
                this.setupSearch();
                this.initialized = true;
            }

        } catch (err) {
            console.error('DiabetesDashboard init error:', err);
            // Fallback to demo data on error
            const demoData = this.getDemoData();
            this.toggleDemoBanner(true);
            this.updateSummaryCards(demoData);
            this.createHbA1cChart(demoData);
            this.createPAID5Chart(demoData);
            this.createDistressChart(demoData);
            this.createHealthLiteracyChart(demoData);
            this.createSelfCareChart(demoData);
            this.createBMIChart(demoData);
            this.createComorbidityChart(demoData);
            this.createDTXGroupChart(demoData);
            this.createAgeChart(demoData);
            this.renderPatientTable(demoData.patients, 'all');
        }

        // Always setup buttons (even if data loading fails)
        if (!this.initialized) {
            this.setupFilter(this._cachedSummaryData || this.getDemoData());
            this.setupExport();
            this.setupImport();
            this.setupTemplateDownload();
            this.setupPrintReport();
            this.setupCRUD();
            this.initialized = true;
        }
    },

    // =====================
    // Demo Banner
    // =====================

    toggleDemoBanner(show) {
        let banner = document.getElementById('demo-data-banner');

        if (show) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'demo-data-banner';
                banner.style.cssText = 'background:#fff3ed;color:#92400e;padding:10px 16px;border-radius:8px;margin-bottom:16px;font-size:14px;font-family:Athiti,sans-serif;display:flex;align-items:center;gap:8px;border:1px solid rgba(254,106,53,0.3);';
                banner.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><span>กำลังแสดงข้อมูลตัวอย่าง (Demo Data) - เพิ่มข้อมูลผู้ป่วยจริงผ่านแบบฟอร์ม CRF เพื่อแสดงข้อมูลจริง</span>';

                // Insert at top of dashboard tab content
                const dashTab = document.getElementById('tab-dashboard')
                    || document.querySelector('.tab-content[data-tab="dashboard"]');
                if (dashTab) {
                    dashTab.insertBefore(banner, dashTab.firstChild);
                }
            }
            banner.style.display = 'flex';
        } else {
            if (banner) {
                banner.style.display = 'none';
            }
        }
    },

    // =====================
    // Build Summary from Real Patients
    // =====================

    buildSummaryFromPatients(patients) {
        const experimental = patients.filter(p => {
            const g = (p.study_group || p.enrollment_group || '').toLowerCase();
            return g === 'experimental' || g === 'intervention' || g === '1';
        });
        const control = patients.filter(p => {
            const g = (p.study_group || p.enrollment_group || '').toLowerCase();
            return g === 'control' || g === '0' || g === '2';
        });

        // Calculate average HbA1c across all patients
        const toNum = v => v != null ? parseFloat(v) : NaN;
        const allHba1c = patients
            .map(p => toNum(p.hba1c_baseline))
            .filter(v => !isNaN(v));
        const avgHba1c = allHba1c.length > 0
            ? (allHba1c.reduce((a, b) => a + b, 0) / allHba1c.length).toFixed(1)
            : '-';

        // HbA1c averages by group
        const expBaseline = experimental.map(p => toNum(p.hba1c_baseline)).filter(v => !isNaN(v));
        const expSixMonth = experimental.map(p => toNum(p.hba1c_6month)).filter(v => !isNaN(v));
        const ctrlBaseline = control.map(p => toNum(p.hba1c_baseline)).filter(v => !isNaN(v));
        const ctrlSixMonth = control.map(p => toNum(p.hba1c_6month)).filter(v => !isNaN(v));

        const avg = arr => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0;

        // PAID-5 converted scores by group (fallback: calculate from total if converted missing)
        const getConverted = (p, period) => {
            if (!p.paid5) return null;
            if (p.paid5[`converted_${period}`] != null) return parseFloat(p.paid5[`converted_${period}`]);
            if (p.paid5[`total_${period}`] != null) return parseFloat(p.paid5[`total_${period}`]) * 5;
            return null;
        };

        const expPaid5BL = experimental.map(p => getConverted(p, 'baseline')).filter(v => v != null);
        const expPaid5_6m = experimental.map(p => getConverted(p, '6month')).filter(v => v != null);
        const ctrlPaid5BL = control.map(p => getConverted(p, 'baseline')).filter(v => v != null);
        const ctrlPaid5_6m = control.map(p => getConverted(p, '6month')).filter(v => v != null);

        // Distress levels (from latest available - prefer 6month, fallback to baseline, then calculate)
        let lowDistress = 0;
        let highDistress = 0;
        patients.forEach(p => {
            if (!p.paid5) return;
            let level = p.paid5.distress_6month || p.paid5.distress_baseline;
            if (!level) {
                // Fallback: calculate from converted or total
                const conv = getConverted(p, '6month') || getConverted(p, 'baseline');
                if (conv != null) level = conv >= 40 ? 'high' : 'low';
            }
            if (level === 'low') lowDistress++;
            else if (level === 'high') highDistress++;
        });

        // BMI, FBS, GFR averages
        const allBmi = patients.map(p => toNum(p.bmi)).filter(v => !isNaN(v));
        const avgBmi = allBmi.length > 0 ? (allBmi.reduce((a, b) => a + b, 0) / allBmi.length).toFixed(1) : '-';
        const allFbs = patients.map(p => toNum(p.fbs)).filter(v => !isNaN(v));
        const avgFbs = allFbs.length > 0 ? (allFbs.reduce((a, b) => a + b, 0) / allFbs.length).toFixed(0) : '-';
        const allGfr = patients.map(p => toNum(p.gfr)).filter(v => !isNaN(v));
        const avgGfr = allGfr.length > 0 ? (allGfr.reduce((a, b) => a + b, 0) / allGfr.length).toFixed(1) : '-';

        // DTX average across all patients
        const allDtxAvg = patients.map(p => toNum(p.dtx_avg)).filter(v => !isNaN(v));
        const avgDtx = allDtxAvg.length > 0 ? (allDtxAvg.reduce((a, b) => a + b, 0) / allDtxAvg.length).toFixed(0) : '-';

        // DTX by group
        const expDtxAvg = experimental.map(p => toNum(p.dtx_avg)).filter(v => !isNaN(v));
        const ctrlDtxAvg = control.map(p => toNum(p.dtx_avg)).filter(v => !isNaN(v));

        // Follow-up rate
        const completedCount = patients.filter(p => p.followUp && (p.followUp.status === 'complete' || p.followUp.status === 'completed')).length;
        const lostCount = patients.filter(p => p.followUp && (p.followUp.status === 'lost' || p.followUp.status === 'withdrawn')).length;
        const followUpRate = patients.length > 0 ? (((patients.length - lostCount) / patients.length) * 100).toFixed(0) : '-';

        // Health Literacy by group
        const getHL = (p, period) => {
            if (!p.healthLiteracy) return null;
            const v = toNum(p.healthLiteracy[`total_${period}`]);
            return isNaN(v) ? null : v;
        };
        const expHLBL = experimental.map(p => getHL(p, 'baseline')).filter(v => v != null);
        const expHL6m = experimental.map(p => getHL(p, '6month')).filter(v => v != null);
        const ctrlHLBL = control.map(p => getHL(p, 'baseline')).filter(v => v != null);
        const ctrlHL6m = control.map(p => getHL(p, '6month')).filter(v => v != null);

        // Self-care by group
        const getSC = (p, period) => {
            if (!p.selfCare) return null;
            const v = toNum(p.selfCare[`total_${period}`]);
            return isNaN(v) ? null : v;
        };
        const expSCBL = experimental.map(p => getSC(p, 'baseline')).filter(v => v != null);
        const expSC6m = experimental.map(p => getSC(p, '6month')).filter(v => v != null);
        const ctrlSCBL = control.map(p => getSC(p, 'baseline')).filter(v => v != null);
        const ctrlSC6m = control.map(p => getSC(p, '6month')).filter(v => v != null);

        // BMI distribution
        const bmiDist = { underweight: 0, normal: 0, overweight: 0, obese1: 0, obese2: 0 };
        allBmi.forEach(b => {
            if (b < 18.5) bmiDist.underweight++;
            else if (b < 23) bmiDist.normal++;
            else if (b < 25) bmiDist.overweight++;
            else if (b < 30) bmiDist.obese1++;
            else bmiDist.obese2++;
        });

        // Comorbidity counts
        const comorbCounts = { hypertension: 0, dyslipidemia: 0, cvd: 0, ckd: 0, gout: 0 };
        patients.forEach(p => {
            if (parseInt(p.d1)) comorbCounts.hypertension++;
            if (parseInt(p.d2)) comorbCounts.dyslipidemia++;
            if (parseInt(p.d3)) comorbCounts.cvd++;
            if (parseInt(p.d4)) comorbCounts.ckd++;
            if (parseInt(p.d5)) comorbCounts.gout++;
        });

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

        return {
            totalPatients: patients.length,
            experimental: experimental.length,
            control: control.length,
            avgHba1c: avgHba1c,
            avgBmi: avgBmi,
            avgFbs: avgFbs,
            avgGfr: avgGfr,
            avgDtx: avgDtx,
            followUpRate: followUpRate,
            hba1c: {
                expBaseline: avg(expBaseline),
                expSixMonth: avg(expSixMonth),
                ctrlBaseline: avg(ctrlBaseline),
                ctrlSixMonth: avg(ctrlSixMonth)
            },
            paid5: {
                expBaseline: avg(expPaid5BL),
                expSixMonth: avg(expPaid5_6m),
                ctrlBaseline: avg(ctrlPaid5BL),
                ctrlSixMonth: avg(ctrlPaid5_6m)
            },
            healthLiteracy: {
                expBaseline: avg(expHLBL), expSixMonth: avg(expHL6m),
                ctrlBaseline: avg(ctrlHLBL), ctrlSixMonth: avg(ctrlHL6m)
            },
            selfCare: {
                expBaseline: avg(expSCBL), expSixMonth: avg(expSC6m),
                ctrlBaseline: avg(ctrlSCBL), ctrlSixMonth: avg(ctrlSC6m)
            },
            distress: { low: lowDistress, high: highDistress },
            bmiDist: bmiDist,
            comorbCounts: comorbCounts,
            dtxGroup: {
                expAvg: avg(expDtxAvg), ctrlAvg: avg(ctrlDtxAvg)
            },
            ageDist: ageDist,
            patients: patients.map(p => this.normalizePatientForTable(p))
        };
    },

    normalizePatientForTable(p) {
        const getConverted = (period) => {
            if (!p.paid5) return null;
            if (p.paid5[`converted_${period}`] != null) return parseFloat(p.paid5[`converted_${period}`]);
            if (p.paid5[`total_${period}`] != null) return parseFloat(p.paid5[`total_${period}`]) * 5;
            return null;
        };

        const getDistress = () => {
            if (!p.paid5) return null;
            if (p.paid5.distress_6month || p.paid5.distress_baseline) {
                return p.paid5.distress_6month || p.paid5.distress_baseline;
            }
            // Fallback: calculate from converted/total
            var conv = getConverted('6month') || getConverted('baseline');
            if (conv != null) return conv >= 40 ? 'high' : 'low';
            return null;
        };

        const getStatus = () => {
            if (p.followUp && p.followUp.status) return p.followUp.status;
            return 'active';
        };

        return {
            patient_id: p.patient_id || '-',
            first_name: p.first_name || '',
            last_name: p.last_name || '',
            gender: p.gender || '-',
            age: p.age != null ? p.age : '-',
            group: p.study_group || p.enrollment_group || '-',
            study_group: p.study_group || p.enrollment_group || '',
            weight: p.weight != null ? parseFloat(p.weight) : null,
            height: p.height != null ? parseFloat(p.height) : null,
            bmi: p.bmi != null ? parseFloat(p.bmi) : null,
            hba1c_baseline: p.hba1c_baseline != null ? parseFloat(p.hba1c_baseline) : null,
            hba1c_6month: p.hba1c_6month != null ? parseFloat(p.hba1c_6month) : null,
            fbs: p.fbs != null ? parseFloat(p.fbs) : null,
            gfr: p.gfr != null ? parseFloat(p.gfr) : null,
            dtx_avg: p.dtx_avg != null ? parseFloat(p.dtx_avg) : null,
            paid5_baseline: getConverted('baseline'),
            paid5_6month: getConverted('6month'),
            distress: getDistress(),
            status: getStatus()
        };
    },

    // =====================
    // Summary Cards
    // =====================

    updateSummaryCards(data) {
        const totalEl = document.getElementById('dash-total');
        const expEl = document.getElementById('dash-experimental');
        const ctrlEl = document.getElementById('dash-control');
        const avgEl = document.getElementById('dash-avg-hba1c');

        if (totalEl) totalEl.textContent = data.totalPatients;
        if (expEl) expEl.textContent = data.experimental;
        if (ctrlEl) ctrlEl.textContent = data.control;

        if (avgEl) {
            if (data.avgHba1c && data.avgHba1c !== '-') {
                avgEl.textContent = data.avgHba1c + '%';
            } else {
                avgEl.textContent = '-';
            }
        }

        // Row 2 cards
        const bmiEl = document.getElementById('dash-avg-bmi');
        const fbsEl = document.getElementById('dash-avg-fbs');
        const gfrEl = document.getElementById('dash-avg-gfr');
        const fuEl = document.getElementById('dash-follow-up');
        if (bmiEl) bmiEl.textContent = data.avgBmi || '-';
        if (fbsEl) fbsEl.textContent = data.avgFbs || '-';
        if (gfrEl) gfrEl.textContent = data.avgGfr || '-';
        if (fuEl) fuEl.textContent = data.followUpRate || '-';

        // Row 3 DTX card
        const dtxEl = document.getElementById('dash-avg-dtx');
        if (dtxEl) dtxEl.textContent = data.avgDtx || '-';
    },

    // =====================
    // HbA1c Chart (Grouped Bar)
    // =====================

    createHbA1cChart(data) {
        const canvas = document.getElementById('chart-hba1c');
        if (!canvas) return;

        // Destroy existing chart to prevent canvas reuse error
        if (this.charts.hba1c) {
            this.charts.hba1c.destroy();
            this.charts.hba1c = null;
        }

        const hba1c = data.hba1c || {};

        // Use data values, or demo defaults if all zeros
        const expBL = hba1c.expBaseline || 8.5;
        const exp6m = hba1c.expSixMonth || 7.2;
        const ctrlBL = hba1c.ctrlBaseline || 8.4;
        const ctrl6m = hba1c.ctrlSixMonth || 8.1;

        this.charts.hba1c = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Baseline', '6 เดือน'],
                datasets: [
                    {
                        label: 'กลุ่มทดลอง (Experimental)',
                        data: [expBL, exp6m],
                        backgroundColor: 'rgba(44, 175, 254, 0.8)',
                        borderColor: '#2caffe',
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    },
                    {
                        label: 'กลุ่มควบคุม (Control)',
                        data: [ctrlBL, ctrl6m],
                        backgroundColor: 'rgba(254, 106, 53, 0.8)',
                        borderColor: '#fe6a35',
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: 'Athiti', size: 13 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        titleFont: { family: 'Athiti' },
                        bodyFont: { family: 'Athiti' },
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + '%';
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'ค่าเฉลี่ย HbA1c เปรียบเทียบ Baseline กับ 6 เดือน',
                        font: { family: 'Athiti', size: 15, weight: '600' },
                        color: '#19191B'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: 5,
                        max: 12,
                        title: {
                            display: true,
                            text: 'HbA1c (%)',
                            font: { family: 'Athiti', size: 13 }
                        },
                        ticks: {
                            font: { family: 'Athiti', size: 12 },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.06)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { family: 'Athiti', size: 13 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },

    // =====================
    // PAID-5 Chart (Grouped Bar)
    // =====================

    createPAID5Chart(data) {
        const canvas = document.getElementById('chart-paid5');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.paid5) {
            this.charts.paid5.destroy();
            this.charts.paid5 = null;
        }

        const paid5 = data.paid5 || {};

        // Use data values, or demo defaults if all zeros
        const expBL = paid5.expBaseline || 55;
        const exp6m = paid5.expSixMonth || 35;
        const ctrlBL = paid5.ctrlBaseline || 53;
        const ctrl6m = paid5.ctrlSixMonth || 48;

        this.charts.paid5 = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Baseline', '6 เดือน'],
                datasets: [
                    {
                        label: 'กลุ่มทดลอง (Experimental)',
                        data: [expBL, exp6m],
                        backgroundColor: 'rgba(0, 226, 114, 0.8)',
                        borderColor: '#00e272',
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    },
                    {
                        label: 'กลุ่มควบคุม (Control)',
                        data: [ctrlBL, ctrl6m],
                        backgroundColor: 'rgba(84, 79, 197, 0.8)',
                        borderColor: '#544fc5',
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: 'Athiti', size: 13 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        titleFont: { family: 'Athiti' },
                        bodyFont: { family: 'Athiti' },
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + ctx.raw.toFixed(0) + ' คะแนน';
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'คะแนน PAID-5 (ค่าแปลง) เปรียบเทียบ Baseline กับ 6 เดือน',
                        font: { family: 'Athiti', size: 15, weight: '600' },
                        color: '#19191B'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'คะแนน PAID-5 (0-100)',
                            font: { family: 'Athiti', size: 13 }
                        },
                        ticks: {
                            font: { family: 'Athiti', size: 12 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.06)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { family: 'Athiti', size: 13 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },

    // =====================
    // Distress Doughnut Chart
    // =====================

    createDistressChart(data) {
        const canvas = document.getElementById('chart-distress');
        if (!canvas) return;

        // Destroy existing chart
        if (this.charts.distress) {
            this.charts.distress.destroy();
            this.charts.distress = null;
        }

        const distress = data.distress || {};
        const lowCount = distress.low || 0;
        const highCount = distress.high || 0;
        const totalCount = lowCount + highCount;

        // If no distress data at all, show placeholder
        if (totalCount === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            this.charts.distress = new Chart(canvas, {
                type: 'doughnut',
                data: {
                    labels: ['ยังไม่มีข้อมูล'],
                    datasets: [{
                        data: [1],
                        backgroundColor: ['rgba(203, 213, 225, 0.5)'],
                        borderColor: ['rgba(203, 213, 225, 0.8)'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            enabled: false
                        },
                        title: {
                            display: true,
                            text: 'ระดับ Diabetes Distress',
                            font: { family: 'Athiti', size: 15, weight: '600' },
                            color: '#19191B'
                        }
                    }
                },
                plugins: [{
                    id: 'centerTextPlaceholder',
                    afterDraw: function(chart) {
                        const ctx = chart.ctx;
                        const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                        const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        ctx.font = '600 14px Athiti';
                        ctx.fillStyle = '#AFB1B6';
                        ctx.fillText('ยังไม่มีข้อมูล', centerX, centerY);

                        ctx.restore();
                    }
                }]
            });
            return;
        }

        this.charts.distress = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: [
                    'Distress ต่ำ (Low)',
                    'Distress สูง (High)'
                ],
                datasets: [{
                    data: [lowCount, highCount],
                    backgroundColor: [
                        'rgba(0, 226, 114, 0.8)',
                        'rgba(250, 75, 66, 0.8)'
                    ],
                    borderColor: [
                        '#00e272',
                        '#fa4b42'
                    ],
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Athiti', size: 13 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16
                        }
                    },
                    tooltip: {
                        titleFont: { family: 'Athiti' },
                        bodyFont: { family: 'Athiti' },
                        callbacks: {
                            label: function(ctx) {
                                const pct = ((ctx.raw / totalCount) * 100).toFixed(1);
                                return ctx.label + ': ' + ctx.raw + ' ราย (' + pct + '%)';
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'ระดับ Diabetes Distress',
                        font: { family: 'Athiti', size: 15, weight: '600' },
                        color: '#19191B'
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                afterDraw: function(chart) {
                    const ctx = chart.ctx;
                    const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
                    const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    // Total count number
                    ctx.font = '700 28px Athiti';
                    ctx.fillStyle = '#19191B';
                    ctx.fillText(totalCount.toString(), centerX, centerY - 8);

                    // Label below
                    ctx.font = '400 12px Athiti';
                    ctx.fillStyle = '#61646B';
                    ctx.fillText('รายทั้งหมด', centerX, centerY + 14);

                    ctx.restore();
                }
            }]
        });
    },

    // =====================
    // Health Literacy Chart
    // =====================

    createHealthLiteracyChart(data) {
        const canvas = document.getElementById('chart-health-literacy');
        if (!canvas) return;
        if (this.charts.healthLiteracy) { this.charts.healthLiteracy.destroy(); this.charts.healthLiteracy = null; }

        const hl = data.healthLiteracy || {};
        this.charts.healthLiteracy = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Baseline', '6 เดือน'],
                datasets: [
                    {
                        label: 'กลุ่มทดลอง (Experimental)',
                        data: [hl.expBaseline || 0, hl.expSixMonth || 0],
                        backgroundColor: ['rgba(69,117,243,0.7)', 'rgba(69,117,243,0.7)'],
                        borderColor: '#4575F3', borderWidth: 1, borderRadius: 4
                    },
                    {
                        label: 'กลุ่มควบคุม (Control)',
                        data: [hl.ctrlBaseline || 0, hl.ctrlSixMonth || 0],
                        backgroundColor: ['rgba(254,106,53,0.7)', 'rgba(254,106,53,0.7)'],
                        borderColor: '#FE6A35', borderWidth: 1, borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 50, title: { display: true, text: 'คะแนน (10-50)', font: { family: 'Athiti' } },
                         ticks: { font: { family: 'Athiti' } } },
                    x: { ticks: { font: { family: 'Athiti', size: 13 } } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Athiti', size: 12 }, usePointStyle: true, pointStyle: 'rect' } },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' },
                        callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + ' คะแนน' } }
                }
            }
        });
    },

    // =====================
    // Self-care Chart
    // =====================

    createSelfCareChart(data) {
        const canvas = document.getElementById('chart-self-care');
        if (!canvas) return;
        if (this.charts.selfCare) { this.charts.selfCare.destroy(); this.charts.selfCare = null; }

        const sc = data.selfCare || {};
        this.charts.selfCare = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['Baseline', '6 เดือน'],
                datasets: [
                    {
                        label: 'กลุ่มทดลอง (Experimental)',
                        data: [sc.expBaseline || 0, sc.expSixMonth || 0],
                        backgroundColor: ['rgba(69,117,243,0.7)', 'rgba(69,117,243,0.7)'],
                        borderColor: '#4575F3', borderWidth: 1, borderRadius: 4
                    },
                    {
                        label: 'กลุ่มควบคุม (Control)',
                        data: [sc.ctrlBaseline || 0, sc.ctrlSixMonth || 0],
                        backgroundColor: ['rgba(254,106,53,0.7)', 'rgba(254,106,53,0.7)'],
                        borderColor: '#FE6A35', borderWidth: 1, borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 48, title: { display: true, text: 'คะแนน (12-48)', font: { family: 'Athiti' } },
                         ticks: { font: { family: 'Athiti' } } },
                    x: { ticks: { font: { family: 'Athiti', size: 13 } } }
                },
                plugins: {
                    legend: { labels: { font: { family: 'Athiti', size: 12 }, usePointStyle: true, pointStyle: 'rect' } },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' },
                        callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + ' คะแนน' } }
                }
            }
        });
    },

    // =====================
    // BMI Distribution Chart
    // =====================

    createBMIChart(data) {
        const canvas = document.getElementById('chart-bmi');
        if (!canvas) return;
        if (this.charts.bmi) { this.charts.bmi.destroy(); this.charts.bmi = null; }

        const dist = data.bmiDist || {};
        this.charts.bmi = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: ['ผอม (<18.5)', 'ปกติ (18.5-22.9)', 'น้ำหนักเกิน (23-24.9)', 'อ้วนระดับ 1 (25-29.9)', 'อ้วนระดับ 2 (≥30)'],
                datasets: [{
                    data: [dist.underweight || 0, dist.normal || 0, dist.overweight || 0, dist.obese1 || 0, dist.obese2 || 0],
                    backgroundColor: ['rgba(56,189,248,0.8)', 'rgba(0,226,114,0.8)', 'rgba(251,191,36,0.8)', 'rgba(251,146,60,0.8)', 'rgba(250,75,66,0.8)'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '50%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Athiti', size: 11 }, usePointStyle: true, pointStyle: 'circle', padding: 8 } },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' } }
                }
            }
        });
    },

    // =====================
    // Comorbidity Chart
    // =====================

    createComorbidityChart(data) {
        const canvas = document.getElementById('chart-comorbidity');
        if (!canvas) return;
        if (this.charts.comorbidity) { this.charts.comorbidity.destroy(); this.charts.comorbidity = null; }

        const c = data.comorbCounts || {};
        this.charts.comorbidity = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['ความดันสูง', 'ไขมันสูง', 'หัวใจ', 'ไต', 'เกาต์'],
                datasets: [{
                    label: 'จำนวนผู้ป่วย',
                    data: [c.hypertension || 0, c.dyslipidemia || 0, c.cvd || 0, c.ckd || 0, c.gout || 0],
                    backgroundColor: ['rgba(139,92,246,0.7)', 'rgba(245,158,11,0.7)', 'rgba(239,68,68,0.7)', 'rgba(6,182,212,0.7)', 'rgba(16,185,129,0.7)'],
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Athiti' } } },
                    y: { ticks: { font: { family: 'Athiti', size: 12 } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' } }
                }
            }
        });
    },

    // =====================
    // Age Distribution Chart
    // =====================

    createDTXGroupChart(data) {
        const canvas = document.getElementById('chart-dtx-group');
        if (!canvas) return;
        if (this.charts.dtxGroup) { this.charts.dtxGroup.destroy(); this.charts.dtxGroup = null; }

        const dtx = data.dtxGroup || {};
        this.charts.dtxGroup = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['กลุ่มทดลอง', 'กลุ่มควบคุม'],
                datasets: [{
                    label: 'DTX เฉลี่ย (mg/dL)',
                    data: [dtx.expAvg || 0, dtx.ctrlAvg || 0],
                    backgroundColor: ['rgba(44,175,254,0.7)', 'rgba(254,106,53,0.7)'],
                    borderColor: ['#2CAFFE', '#FE6A35'],
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return 'DTX เฉลี่ย: ' + ctx.parsed.y.toFixed(1) + ' mg/dL';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'mg/dL', font: { family: 'Athiti' } }
                    },
                    x: { ticks: { font: { family: 'Athiti' } } }
                }
            }
        });
    },

    createAgeChart(data) {
        const canvas = document.getElementById('chart-age');
        if (!canvas) return;
        if (this.charts.age) { this.charts.age.destroy(); this.charts.age = null; }

        const a = data.ageDist || {};
        this.charts.age = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['<40 ปี', '40-49 ปี', '50-59 ปี', '60-69 ปี', '70+ ปี'],
                datasets: [{
                    label: 'จำนวนผู้ป่วย',
                    data: [a['<40'] || 0, a['40-49'] || 0, a['50-59'] || 0, a['60-69'] || 0, a['70+'] || 0],
                    backgroundColor: 'rgba(69,117,243,0.6)',
                    borderColor: '#4575F3', borderWidth: 1, borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Athiti' } },
                         title: { display: true, text: 'จำนวน (ราย)', font: { family: 'Athiti' } } },
                    x: { ticks: { font: { family: 'Athiti', size: 12 } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { titleFont: { family: 'Athiti' }, bodyFont: { family: 'Athiti' } }
                }
            }
        });
    },

    // =====================
    // Patient Table
    // =====================

    // =====================
    // Shared helpers for patient data formatting
    // =====================
    _formatPatient(p) {
        const hba1cBL = p.hba1c_baseline != null ? parseFloat(p.hba1c_baseline) : null;
        const hba1c6m = p.hba1c_6month != null ? parseFloat(p.hba1c_6month) : null;
        const bmiVal = p.bmi != null ? parseFloat(p.bmi) : null;
        const fbsVal = p.fbs != null ? parseFloat(p.fbs) : null;
        const gfrVal = p.gfr != null ? parseFloat(p.gfr) : null;
        const dtxAvgVal = p.dtx_avg != null ? parseFloat(p.dtx_avg) : null;
        const paid5BL = p.paid5_baseline;
        const paid56m = p.paid5_6month;

        // Color classes
        function valClass(val, thresholds) {
            if (val == null || isNaN(val)) return 'v-na';
            for (var i = 0; i < thresholds.length; i++) {
                if (thresholds[i][0](val)) return thresholds[i][1];
            }
            return '';
        }
        const hba1cBLClass = valClass(hba1cBL, [[v => v >= 9, 'v-bad'], [v => v >= 7, 'v-warn']]);
        let hba1c6mClass = valClass(hba1c6m, []);
        if (hba1cBL != null && hba1c6m != null) {
            hba1c6mClass = hba1c6m < hba1cBL ? 'v-good' : hba1c6m > hba1cBL ? 'v-bad' : '';
        }
        const bmiClass = valClass(bmiVal, [[v => v >= 30, 'v-bad'], [v => v >= 25, 'v-warn'], [v => v >= 23, 'v-warn']]);
        const fbsClass = valClass(fbsVal, [[v => v > 130, 'v-bad'], [v => v >= 100, 'v-warn']]);
        const gfrClass = valClass(gfrVal, [[v => v < 30, 'v-bad'], [v => v < 60, 'v-warn']]);
        const dtxClass = valClass(dtxAvgVal, [[v => v > 250, 'v-bad'], [v => v > 180, 'v-warn'], [v => v < 70, 'v-warn'], [v => v >= 70 && v <= 130, 'v-good']]);

        const distress = p.distress;
        const distressClass = distress === 'high' ? 'v-bad' : distress === 'low' ? 'v-good' : 'v-na';
        const distressDisplay = distress === 'high' ? 'สูง' : distress === 'low' ? 'ต่ำ' : '-';

        const groupDisplay = p.group === 'experimental' ? 'ทดลอง' : p.group === 'control' ? 'ควบคุม' : p.group || '-';
        const genderDisplay = (p.gender === 'M' || p.gender === 'male') ? 'ชาย' : (p.gender === 'F' || p.gender === 'female') ? 'หญิง' : p.gender || '-';
        const genderClass = (p.gender === 'M' || p.gender === 'male') ? 'pc-badge-male' : (p.gender === 'F' || p.gender === 'female') ? 'pc-badge-female' : '';

        return {
            hba1cBL: hba1cBL != null && !isNaN(hba1cBL) ? hba1cBL.toFixed(1) : '-',
            hba1c6m: hba1c6m != null && !isNaN(hba1c6m) ? hba1c6m.toFixed(1) : '-',
            hba1cBLClass, hba1c6mClass,
            bmi: bmiVal != null && !isNaN(bmiVal) ? bmiVal.toFixed(1) : '-', bmiClass,
            fbs: fbsVal != null && !isNaN(fbsVal) ? fbsVal.toFixed(0) : '-', fbsClass,
            gfr: gfrVal != null && !isNaN(gfrVal) ? gfrVal.toFixed(0) : '-', gfrClass,
            dtxAvg: dtxAvgVal != null && !isNaN(dtxAvgVal) ? dtxAvgVal.toFixed(0) : '-', dtxClass,
            paid5BL: paid5BL != null ? paid5BL : '-',
            paid56m: paid56m != null ? paid56m : '-',
            distressDisplay, distressClass,
            groupDisplay, genderDisplay, genderClass,
            firstName: p.first_name || '', lastName: p.last_name || '',
            fullName: ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || '-',
            age: p.age || '-',
            patientId: p.patient_id
        };
    },

    // =====================
    // Render patient card (mobile)
    // =====================
    _renderCard(p, f, isAdmin) {
        var esc = this.escapeHtml.bind(this);
        var h = '<div class="patient-card" data-id="' + esc(f.patientId) + '">';
        // Row 1: ID, Name, Gender badge, Age
        h += '<div class="pc-row">';
        h += '<span class="pc-id">#' + esc(f.patientId) + '</span>';
        if (isAdmin && f.fullName !== '-') {
            h += '<span class="pc-name">' + esc(f.fullName) + '</span>';
        }
        h += '<span class="pc-badge ' + f.genderClass + '">' + f.genderDisplay + '</span>';
        if (f.age !== '-') h += '<span class="pc-badge pc-badge-age">' + f.age + ' ปี</span>';
        if (f.groupDisplay !== '-') h += '<span class="pc-badge pc-badge-group">' + f.groupDisplay + '</span>';
        h += '</div>';

        // Row 2: Metrics
        h += '<div class="pc-metrics">';
        h += this._metricCell('BMI', f.bmi, f.bmiClass);
        h += this._metricCell('HbA1c', f.hba1cBL, f.hba1cBLClass);
        h += this._metricCell('HbA1c 6m', f.hba1c6m, f.hba1c6mClass);
        h += this._metricCell('FBS', f.fbs, f.fbsClass);
        h += this._metricCell('GFR', f.gfr, f.gfrClass);
        h += this._metricCell('DTX', f.dtxAvg, f.dtxClass);
        h += this._metricCell('PAID-5', f.paid5BL, f.paid5BL !== '-' && parseFloat(f.paid5BL) >= 40 ? 'v-bad' : f.paid5BL !== '-' ? '' : 'v-na');
        h += this._metricCell('Distress', f.distressDisplay, f.distressClass);
        h += '</div>';

        // Row 3: Admin actions
        if (isAdmin) {
            h += '<div class="pc-actions">';
            h += '<button class="btn-icon btn-edit-patient" data-id="' + esc(f.patientId) + '" title="แก้ไข"><i class="fa-solid fa-pen-to-square"></i></button>';
            h += '<button class="btn-icon btn-delete-patient" data-id="' + esc(f.patientId) + '" title="ลบ"><i class="fa-solid fa-trash"></i></button>';
            h += '</div>';
        }
        h += '</div>';
        return h;
    },

    _metricCell(label, value, cls) {
        return '<div class="pc-metric"><span class="pc-metric-label">' + label + '</span><span class="pc-metric-value ' + (cls || '') + '">' + value + '</span></div>';
    },

    // =====================
    // Render patient table row (desktop)
    // =====================
    _renderRow(p, f, isAdmin, adminColStyle) {
        var esc = this.escapeHtml.bind(this);
        function tdS(cls) {
            if (cls === 'v-good') return 'color:#16a34a;font-weight:600';
            if (cls === 'v-warn') return 'color:#f59e0b;font-weight:600';
            if (cls === 'v-bad') return 'color:#dc2626;font-weight:600';
            if (cls === 'v-na') return 'color:#ccc';
            return '';
        }
        var h = '<tr data-id="' + esc(f.patientId) + '">';
        h += '<td class="col-id" style="font-weight:500">' + esc(f.patientId) + '</td>';
        h += '<td class="col-name admin-only-col" style="' + adminColStyle + '" title="' + esc(f.fullName) + '">' + esc(f.fullName) + '</td>';
        h += '<td class="col-gender">' + f.genderDisplay + '</td>';
        h += '<td class="col-age">' + f.age + '</td>';
        h += '<td class="col-num col-secondary">' + f.groupDisplay + '</td>';
        h += '<td class="col-num" style="' + tdS(f.bmiClass) + '">' + f.bmi + '</td>';
        h += '<td class="col-num" style="' + tdS(f.hba1cBLClass) + '">' + f.hba1cBL + '</td>';
        h += '<td class="col-num" style="' + tdS(f.hba1c6mClass) + '">' + f.hba1c6m + '</td>';
        h += '<td class="col-num col-secondary" style="' + tdS(f.fbsClass) + '">' + f.fbs + '</td>';
        h += '<td class="col-num col-secondary" style="' + tdS(f.gfrClass) + '">' + f.gfr + '</td>';
        h += '<td class="col-num col-secondary" style="' + tdS(f.dtxClass) + '">' + f.dtxAvg + '</td>';
        h += '<td class="col-num">' + f.paid5BL + '</td>';
        h += '<td class="col-distress" style="' + tdS(f.distressClass) + '">' + f.distressDisplay + '</td>';
        h += '<td class="col-actions admin-only-col" style="' + adminColStyle + '">';
        h += '<button class="btn-icon btn-edit-patient" data-id="' + esc(f.patientId) + '" title="แก้ไข"><i class="fa-solid fa-pen-to-square"></i></button> ';
        h += '<button class="btn-icon btn-delete-patient" data-id="' + esc(f.patientId) + '" title="ลบ" style="color:#dc2626"><i class="fa-solid fa-trash"></i></button>';
        h += '</td>';
        h += '</tr>';
        return h;
    },

    renderPatientTable(patients, filter) {
        const tbody = document.getElementById('dash-patient-table');
        const cardsEl = document.getElementById('patient-cards');
        if (!tbody && !cardsEl) return;

        // Apply group filter
        let filtered = patients || [];
        if (filter && filter !== 'all') {
            filtered = filtered.filter(p => p.group === filter);
        }

        // Apply search filter
        if (this.searchTerm) {
            const term = this.searchTerm;
            filtered = filtered.filter(p => {
                const id = (p.patient_id || p.id || p.hn || '').toString().toLowerCase();
                const firstName = (p.first_name || '').toLowerCase();
                const lastName = (p.last_name || '').toLowerCase();
                const fullName = firstName + ' ' + lastName;
                return id.includes(term) || firstName.includes(term) || lastName.includes(term) || fullName.includes(term);
            });
        }

        this.filteredPatients = filtered;

        if (this._lastFilter !== filter) {
            this.currentPage = 1;
            this._lastFilter = filter;
        }

        // Empty state
        if (filtered.length === 0) {
            var emptyMsg = '<div style="text-align:center;padding:32px;color:#94a3b8">ยังไม่มีข้อมูล</div>';
            if (cardsEl) cardsEl.innerHTML = emptyMsg;
            if (tbody) tbody.innerHTML = '<tr><td colspan="14" class="text-center text-muted" style="padding:24px">ยังไม่มีข้อมูล</td></tr>';
            this.renderPagination(0);
            return;
        }

        // Pagination
        const totalPages = Math.ceil(filtered.length / this.pageSize);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const startIdx = (this.currentPage - 1) * this.pageSize;
        const endIdx = Math.min(startIdx + this.pageSize, filtered.length);
        const pageData = filtered.slice(startIdx, endIdx);

        const _isAdmin = window.Auth && Auth.isLoggedIn() && Auth.isAdmin();
        const adminColStyle = _isAdmin ? 'display:table-cell' : 'display:none';

        var cardHtml = '';
        var tableHtml = '';
        var self = this;

        pageData.forEach(function(p) {
            var f = self._formatPatient(p);
            cardHtml += self._renderCard(p, f, _isAdmin);
            tableHtml += self._renderRow(p, f, _isAdmin, adminColStyle);
        });

        if (cardsEl) cardsEl.innerHTML = cardHtml;
        if (tbody) tbody.innerHTML = tableHtml;

        this.renderPagination(filtered.length);
        this.bindTableActions();

        // Show admin-only columns in table
        if (_isAdmin) {
            document.querySelectorAll('.admin-only-col').forEach(function(el) {
                el.style.display = 'table-cell';
            });
        }
    },

    renderPagination(totalItems) {
        const container = document.getElementById('patient-list-container');
        if (!container) return;

        // Remove existing pagination
        const existingPag = container.querySelector('.table-pagination-wrap');
        if (existingPag) existingPag.remove();

        if (totalItems <= this.pageSize) return;

        const totalPages = Math.ceil(totalItems / this.pageSize);
        const currentPage = this.currentPage;

        let pagHtml = '<div class="table-pagination-wrap">';
        pagHtml += '<div class="pagination-info">แสดง ' + ((currentPage - 1) * this.pageSize + 1) + '-' + Math.min(currentPage * this.pageSize, totalItems) + ' จาก ' + totalItems + ' รายการ</div>';
        pagHtml += '<div class="pagination">';

        // Previous button
        pagHtml += '<button class="pagination-btn" data-page="prev"' + (currentPage === 1 ? ' disabled' : '') + '>&laquo;</button>';

        // Page buttons
        const maxVisible = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) {
            pagHtml += '<button class="pagination-btn" data-page="1">1</button>';
            if (startPage > 2) pagHtml += '<span style="padding:0 4px;color:#AFB1B6">...</span>';
        }

        for (let i = startPage; i <= endPage; i++) {
            pagHtml += '<button class="pagination-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) pagHtml += '<span style="padding:0 4px;color:#AFB1B6">...</span>';
            pagHtml += '<button class="pagination-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
        }

        // Next button
        pagHtml += '<button class="pagination-btn" data-page="next"' + (currentPage === totalPages ? ' disabled' : '') + '>&raquo;</button>';

        pagHtml += '</div>';

        // Page size selector
        pagHtml += '<div class="pagination-size"><span>แสดง</span><select id="dash-page-size">';
        [10, 20, 50].forEach(size => {
            pagHtml += '<option value="' + size + '"' + (size === this.pageSize ? ' selected' : '') + '>' + size + '</option>';
        });
        pagHtml += '</select><span>รายการ/หน้า</span></div>';
        pagHtml += '</div>';

        container.insertAdjacentHTML('beforeend', pagHtml);

        // Bind pagination events
        const pagWrap = container.querySelector('.table-pagination-wrap');
        if (pagWrap) {
            pagWrap.querySelectorAll('.pagination-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = btn.getAttribute('data-page');
                    if (page === 'prev') this.currentPage = Math.max(1, this.currentPage - 1);
                    else if (page === 'next') this.currentPage = Math.min(totalPages, this.currentPage + 1);
                    else this.currentPage = parseInt(page);
                    this.renderPatientTable(this._cachedSummaryData ? this._cachedSummaryData.patients : this.filteredPatients, this.currentFilter);
                });
            });

            const pageSizeSelect = pagWrap.querySelector('#dash-page-size');
            if (pageSizeSelect) {
                pageSizeSelect.addEventListener('change', (e) => {
                    this.pageSize = parseInt(e.target.value);
                    this.currentPage = 1;
                    this.renderPatientTable(this._cachedSummaryData ? this._cachedSummaryData.patients : this.filteredPatients, this.currentFilter);
                });
            }
        }
    },

    // =====================
    // CRUD Patient Management
    // =====================

    setupCRUD() {
        const addBtn = document.getElementById('btn-add-patient');
        if (addBtn && !addBtn._bound) {
            addBtn._bound = true;
            addBtn.addEventListener('click', () => this.openPatientModal());
        }

        const closeBtn = document.getElementById('patient-modal-close');
        const cancelBtn = document.getElementById('pm-cancel-btn');
        const saveBtn = document.getElementById('pm-save-btn');
        const modal = document.getElementById('patient-crud-modal');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closePatientModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closePatientModal());
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closePatientModal();
        });
        if (saveBtn && !saveBtn._bound) {
            saveBtn._bound = true;
            saveBtn.addEventListener('click', () => this.savePatient());
        }
    },

    _editingPatientId: null,

    openPatientModal(patientId) {
        const modal = document.getElementById('patient-crud-modal');
        const title = document.getElementById('patient-modal-title');
        const idInput = document.getElementById('pm-patient-id');
        if (!modal) return;

        // Reset form
        ['pm-patient-id', 'pm-first-name', 'pm-last-name', 'pm-gender', 'pm-age', 'pm-study-group', 'pm-weight', 'pm-height'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        if (patientId) {
            // Edit mode
            this._editingPatientId = patientId;
            title.textContent = 'แก้ไขข้อมูลผู้ป่วย';
            idInput.value = patientId;
            idInput.readOnly = true;
            idInput.style.background = '#f3f4f6';

            // Find patient data
            const patients = (this._cachedSummaryData && this._cachedSummaryData.patients) || [];
            const p = patients.find(pt => pt.patient_id === patientId);
            if (p) {
                document.getElementById('pm-first-name').value = p.first_name || '';
                document.getElementById('pm-last-name').value = p.last_name || '';
                document.getElementById('pm-gender').value = p.gender || '';
                document.getElementById('pm-age').value = p.age || '';
                document.getElementById('pm-study-group').value = p.study_group || p.group || '';
                document.getElementById('pm-weight').value = p.weight || '';
                document.getElementById('pm-height').value = p.height || '';
            }
        } else {
            // Add mode
            this._editingPatientId = null;
            title.textContent = 'เพิ่มผู้ป่วยใหม่';
            idInput.readOnly = false;
            idInput.style.background = '';
        }

        modal.style.display = 'flex';
    },

    closePatientModal() {
        const modal = document.getElementById('patient-crud-modal');
        if (modal) modal.style.display = 'none';
        this._editingPatientId = null;
    },

    async savePatient() {
        const patientId = document.getElementById('pm-patient-id').value.trim();
        if (!patientId) {
            showToast('กรุณาระบุรหัสผู้ป่วย', 'error');
            return;
        }

        const data = {
            patient_id: patientId,
            first_name: document.getElementById('pm-first-name').value.trim() || null,
            last_name: document.getElementById('pm-last-name').value.trim() || null,
            gender: document.getElementById('pm-gender').value || null,
            age: document.getElementById('pm-age').value ? parseInt(document.getElementById('pm-age').value) : null,
            study_group: document.getElementById('pm-study-group').value || null,
            weight: document.getElementById('pm-weight').value ? parseFloat(document.getElementById('pm-weight').value) : null,
            height: document.getElementById('pm-height').value ? parseFloat(document.getElementById('pm-height').value) : null
        };

        // Calculate BMI if weight and height provided
        if (data.weight && data.height) {
            const hm = data.height / 100;
            data.bmi = parseFloat((data.weight / (hm * hm)).toFixed(1));
        }

        try {
            const isEdit = !!this._editingPatientId;
            const url = isEdit
                ? API.baseUrl + '/api/patients/' + encodeURIComponent(this._editingPatientId)
                : API.baseUrl + '/api/patients';
            const method = isEdit ? 'PUT' : 'POST';

            const response = await authFetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'บันทึกไม่สำเร็จ');
            }

            showToast(isEdit ? 'แก้ไขข้อมูลผู้ป่วยสำเร็จ' : 'เพิ่มผู้ป่วยสำเร็จ', 'success');
            this.closePatientModal();
            await this.init(); // Reload dashboard
        } catch (err) {
            showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
        }
    },

    async deletePatient(patientId) {
        if (!confirm('ต้องการลบผู้ป่วย ' + patientId + ' หรือไม่?\nข้อมูลที่เกี่ยวข้องทั้งหมดจะถูกลบ')) {
            return;
        }

        try {
            const response = await authFetch(API.baseUrl + '/api/patients/' + encodeURIComponent(patientId), {
                method: 'DELETE'
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || 'ลบไม่สำเร็จ');
            }

            showToast('ลบผู้ป่วย ' + patientId + ' สำเร็จ', 'success');
            await this.init(); // Reload dashboard
        } catch (err) {
            showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
        }
    },

    bindTableActions() {
        document.querySelectorAll('.btn-edit-patient').forEach(btn => {
            btn.addEventListener('click', () => {
                this.openPatientModal(btn.dataset.id);
            });
        });
        document.querySelectorAll('.btn-delete-patient').forEach(btn => {
            btn.addEventListener('click', () => {
                this.deletePatient(btn.dataset.id);
            });
        });
    },

    escapeHtml(str) {
        if (str == null) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    // =====================
    // Filter Setup
    // =====================

    setupFilter(summaryData) {
        const filterSelect = document.getElementById('dash-filter-group');
        if (!filterSelect) return;

        // Store summaryData reference for filter updates
        this._cachedSummaryData = summaryData;

        filterSelect.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            const data = this._cachedSummaryData;

            if (data) {
                this.renderPatientTable(data.patients, this.currentFilter);

                // Update charts based on filter
                if (this.currentFilter === 'all') {
                    this.createHbA1cChart(data);
                    this.createPAID5Chart(data);
                    this.createDistressChart(data);
                    this.createHealthLiteracyChart(data);
                    this.createSelfCareChart(data);
                    this.createBMIChart(data);
                    this.createComorbidityChart(data);
                    this.createAgeChart(data);
                } else {
                    const filteredData = this.getFilteredChartData(data, this.currentFilter);
                    this.createHbA1cChart(filteredData);
                    this.createPAID5Chart(filteredData);
                    this.createDistressChart(filteredData);
                    this.createHealthLiteracyChart(filteredData);
                    this.createSelfCareChart(filteredData);
                    this.createBMIChart(filteredData);
                    this.createComorbidityChart(filteredData);
                    this.createAgeChart(filteredData);
                }
            }
        });
    },

    setupSearch() {
        const input = document.getElementById('patient-search-input');
        if (!input) return;

        let debounceTimer;
        input.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.searchTerm = e.target.value.trim().toLowerCase();
                this.currentPage = 1;
                const data = this._cachedSummaryData;
                if (data) {
                    this.renderPatientTable(data.patients, this.currentFilter);
                }
            }, 200);
        });
    },

    getFilteredChartData(data, group) {
        // Build filtered chart data for a single group
        const patients = data.patients.filter(p => p.group === group);

        const hba1cBLVals = patients.map(p => p.hba1c_baseline).filter(v => v != null);
        const hba1c6mVals = patients.map(p => p.hba1c_6month).filter(v => v != null);
        const paid5BLVals = patients.map(p => p.paid5_baseline).filter(v => v != null);
        const paid56mVals = patients.map(p => p.paid5_6month).filter(v => v != null);

        const avg = arr => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0;

        let lowDistress = 0;
        let highDistress = 0;
        patients.forEach(p => {
            if (p.distress === 'low') lowDistress++;
            else if (p.distress === 'high') highDistress++;
        });

        // When filtering to a single group, show that group in both dataset slots
        // so the chart still renders meaningfully
        return {
            totalPatients: patients.length,
            experimental: group === 'experimental' ? patients.length : 0,
            control: group === 'control' ? patients.length : 0,
            avgHba1c: avg(hba1cBLVals.concat(hba1c6mVals)) || '-',
            hba1c: {
                expBaseline: group === 'experimental' ? avg(hba1cBLVals) : 0,
                expSixMonth: group === 'experimental' ? avg(hba1c6mVals) : 0,
                ctrlBaseline: group === 'control' ? avg(hba1cBLVals) : 0,
                ctrlSixMonth: group === 'control' ? avg(hba1c6mVals) : 0
            },
            paid5: {
                expBaseline: group === 'experimental' ? avg(paid5BLVals) : 0,
                expSixMonth: group === 'experimental' ? avg(paid56mVals) : 0,
                ctrlBaseline: group === 'control' ? avg(paid5BLVals) : 0,
                ctrlSixMonth: group === 'control' ? avg(paid56mVals) : 0
            },
            distress: {
                low: lowDistress,
                high: highDistress
            },
            patients: patients
        };
    },

    // =====================
    // Export Setup
    // =====================

    setupExport() {
        const exportBtn = document.getElementById('btn-export-csv');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', () => {
            this.exportCSV();
        });
    },

    // =====================
    // CSV Export
    // =====================

    async exportCSV() {
        try {
            const baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
            const fetchFn = window.authFetch || fetch;
            const response = await fetchFn(baseUrl + '/api/export/csv');
            if (!response.ok) throw new Error('Export API failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diabetes_patients_' + new Date().toISOString().slice(0, 10) + '.csv';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);

            showToast('ส่งออกข้อมูล CSV สำเร็จ', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showToast('เกิดข้อผิดพลาดในการส่งออกข้อมูล', 'error');
        }
    },


    // =====================
    // CSV Import
    // =====================

    setupImport() {
        const importBtn = document.getElementById('btn-import-csv');
        const fileInput = document.getElementById('csv-file-input');
        if (!importBtn || !fileInput) return;

        importBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Reset file input so same file can be selected again
            fileInput.value = '';

            if (!file.name.toLowerCase().endsWith('.csv')) {
                showToast('กรุณาเลือกไฟล์ CSV เท่านั้น', 'error');
                return;
            }

            showLoading();

            try {
                // Send CSV to server API
                const baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
                const formData = new FormData();
                formData.append('file', file);

                const headers = (window.Auth) ? Auth.getAuthHeaders() : {};
                const response = await fetch(baseUrl + '/api/import/csv', {
                    method: 'POST',
                    headers: headers,
                    body: formData
                });

                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error || 'นำเข้าข้อมูลไม่สำเร็จ');
                }

                this._showImportResult(result);
                hideLoading();
                // Reload from DB
                await this.init();
            } catch (err) {
                hideLoading();
                console.error('Import error:', err);
                showToast('เกิดข้อผิดพลาดในการนำเข้า: ' + err.message, 'error');
            }
        });
    },

    _showImportResult(result) {
        var self = this;

        // Update banner summary
        var banner = document.getElementById('import-result');
        var text = document.getElementById('import-result-text');
        if (banner && text) {
            var hasErrors = result.errors && result.errors.length > 0;
            var hasWarnings = result.warnings && result.warnings.length > 0;
            var msg = 'นำเข้าสำเร็จ ' + result.imported + '/' + result.total + ' รายการ';
            if (result.newCount) msg += ' (ใหม่ ' + result.newCount + ')';
            if (result.updatedCount) msg += ' (อัปเดต ' + result.updatedCount + ')';
            if (hasErrors) msg += ' | ข้อผิดพลาด ' + result.errors.length;
            if (hasWarnings) msg += ' | คำเตือน ' + result.warnings.length;
            text.textContent = msg;

            // Color banner based on status
            if (hasErrors) {
                banner.style.background = '#fef2f2'; banner.style.borderColor = '#fca5a5'; banner.style.color = '#991b1b';
                banner.querySelector('i').className = 'fa-solid fa-circle-exclamation';
            } else if (hasWarnings) {
                banner.style.background = '#fffbeb'; banner.style.borderColor = '#fcd34d'; banner.style.color = '#92400e';
                banner.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
            } else {
                banner.style.background = '#f0fdf4'; banner.style.borderColor = '#86efac'; banner.style.color = '#166534';
                banner.querySelector('i').className = 'fa-solid fa-circle-check';
            }

            banner.classList.remove('hidden');
            // Click banner to show detail modal
            banner.onclick = function() { self._showImportReportModal(result); };
        }

        // Auto-show modal
        this._showImportReportModal(result);

        if (result.imported > 0) {
            showToast('นำเข้าข้อมูลสำเร็จ ' + result.imported + ' รายการ', 'success');
        } else {
            showToast('ไม่สามารถนำเข้าข้อมูลได้', 'error');
        }
    },

    _showImportReportModal(result) {
        var modal = document.getElementById('import-report-modal');
        if (!modal) return;

        var hasErrors = result.errors && result.errors.length > 0;
        var hasWarnings = result.warnings && result.warnings.length > 0;

        // Header icon & color
        var iconEl = document.getElementById('import-report-icon');
        var titleEl = document.getElementById('import-report-title');
        var subtitleEl = document.getElementById('import-report-subtitle');

        if (hasErrors && result.imported === 0) {
            iconEl.style.background = '#fef2f2'; iconEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:#dc2626"></i>';
            titleEl.textContent = 'นำเข้าไม่สำเร็จ';
        } else if (hasErrors) {
            iconEl.style.background = '#fffbeb'; iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#d97706"></i>';
            titleEl.textContent = 'นำเข้าสำเร็จบางส่วน';
        } else if (hasWarnings) {
            iconEl.style.background = '#fffbeb'; iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#d97706"></i>';
            titleEl.textContent = 'นำเข้าสำเร็จ (มีคำเตือน)';
        } else {
            iconEl.style.background = '#f0fdf4'; iconEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#16a34a"></i>';
            titleEl.textContent = 'นำเข้าสำเร็จ';
        }
        subtitleEl.textContent = 'ประมวลผล ' + result.total + ' แถว, ' + result.columnCount + ' คอลัมน์';

        // Build body
        var body = document.getElementById('import-report-body');
        var html = '';

        // ── Summary Cards ──
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px">';
        html += this._reportCard(result.imported, 'นำเข้าสำเร็จ', '#16a34a', '#f0fdf4', 'fa-check');
        html += this._reportCard(result.newCount || 0, 'เพิ่มใหม่', '#2563eb', '#eff6ff', 'fa-plus');
        html += this._reportCard(result.updatedCount || 0, 'อัปเดต', '#7c3aed', '#f5f3ff', 'fa-pen');
        html += this._reportCard(result.errors ? result.errors.length : 0, 'ข้อผิดพลาด', '#dc2626', '#fef2f2', 'fa-xmark');
        html += this._reportCard(result.warnings ? result.warnings.length : 0, 'คำเตือน', '#d97706', '#fffbeb', 'fa-exclamation');
        html += '</div>';

        // ── Group Distribution ──
        if (result.groupCounts) {
            var gc = result.groupCounts;
            var totalG = gc.experimental + gc.control + gc.unknown;
            html += '<div style="margin-bottom:16px">';
            html += '<div style="font-weight:700;font-size:14px;margin-bottom:8px"><i class="fa-solid fa-users" style="color:#6366f1;margin-right:6px"></i>การกระจายกลุ่ม</div>';
            html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">';
            if (gc.experimental > 0) {
                var pctExp = Math.round(gc.experimental / totalG * 100);
                html += '<div style="flex:' + gc.experimental + ';background:#dbeafe;border-radius:6px;padding:8px 12px;text-align:center;font-size:13px">';
                html += '<div style="font-weight:700;color:#1d4ed8">' + gc.experimental + '</div><div style="color:#3b82f6;font-size:11px">ทดลอง (' + pctExp + '%)</div></div>';
            }
            if (gc.control > 0) {
                var pctCtrl = Math.round(gc.control / totalG * 100);
                html += '<div style="flex:' + gc.control + ';background:#fce7f3;border-radius:6px;padding:8px 12px;text-align:center;font-size:13px">';
                html += '<div style="font-weight:700;color:#be185d">' + gc.control + '</div><div style="color:#ec4899;font-size:11px">ควบคุม (' + pctCtrl + '%)</div></div>';
            }
            if (gc.unknown > 0) {
                html += '<div style="flex:' + gc.unknown + ';background:#f3f4f6;border-radius:6px;padding:8px 12px;text-align:center;font-size:13px">';
                html += '<div style="font-weight:700;color:#6b7280">' + gc.unknown + '</div><div style="color:#9ca3af;font-size:11px">ไม่ระบุ</div></div>';
            }
            html += '</div></div>';
        }

        // ── Field Coverage ──
        if (result.fieldCoverage) {
            html += '<div style="margin-bottom:16px">';
            html += '<div style="font-weight:700;font-size:14px;margin-bottom:8px"><i class="fa-solid fa-chart-bar" style="color:#8b5cf6;margin-right:6px"></i>ความครบถ้วนของข้อมูล</div>';
            html += '<div style="display:flex;flex-direction:column;gap:6px">';
            Object.keys(result.fieldCoverage).forEach(function(key) {
                var sec = result.fieldCoverage[key];
                var pct = sec.total > 0 ? Math.round(sec.filled / sec.total * 100) : 0;
                var barColor = pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
                html += '<div style="display:flex;align-items:center;gap:10px;font-size:13px">';
                html += '<div style="min-width:120px;font-weight:600">' + sec.label + '</div>';
                html += '<div style="flex:1;background:#f3f4f6;border-radius:999px;height:10px;overflow:hidden">';
                html += '<div style="width:' + pct + '%;background:' + barColor + ';height:100%;border-radius:999px;transition:width 0.5s"></div></div>';
                html += '<div style="min-width:48px;text-align:right;font-weight:700;color:' + barColor + '">' + pct + '%</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        // ── Errors Section ──
        if (hasErrors) {
            html += '<div style="margin-bottom:16px">';
            html += '<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#dc2626"><i class="fa-solid fa-circle-xmark" style="margin-right:6px"></i>ข้อผิดพลาด (' + result.errors.length + ')</div>';
            html += '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;overflow:hidden;max-height:180px;overflow-y:auto">';
            html += '<table style="width:100%;font-size:12px;border-collapse:collapse">';
            html += '<thead><tr style="background:#fee2e2"><th style="padding:6px 10px;text-align:left">แถว</th><th style="padding:6px 10px;text-align:left">ID</th><th style="padding:6px 10px;text-align:left">รายละเอียด</th></tr></thead><tbody>';
            result.errors.forEach(function(e) {
                html += '<tr style="border-top:1px solid #fecaca"><td style="padding:5px 10px">' + (e.row || '-') + '</td><td style="padding:5px 10px;font-family:monospace">' + (e.id || '-') + '</td><td style="padding:5px 10px">' + (e.message || e) + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // ── Warnings Section ──
        if (hasWarnings) {
            html += '<div style="margin-bottom:16px">';
            html += '<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#d97706"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px"></i>คำเตือน (' + result.warnings.length + ')</div>';
            html += '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;overflow:hidden;max-height:180px;overflow-y:auto">';
            html += '<table style="width:100%;font-size:12px;border-collapse:collapse">';
            html += '<thead><tr style="background:#fef3c7"><th style="padding:6px 10px;text-align:left">แถว</th><th style="padding:6px 10px;text-align:left">ID</th><th style="padding:6px 10px;text-align:left">รายละเอียด</th></tr></thead><tbody>';
            result.warnings.forEach(function(w) {
                html += '<tr style="border-top:1px solid #fde68a"><td style="padding:5px 10px">' + w.row + '</td><td style="padding:5px 10px;font-family:monospace">' + w.id + '</td><td style="padding:5px 10px">' + w.message + '</td></tr>';
            });
            html += '</tbody></table></div></div>';
        }

        // ── Row Details (collapsible) ──
        if (result.rowDetails && result.rowDetails.length > 0) {
            html += '<div style="margin-bottom:8px">';
            html += '<details><summary style="font-weight:700;font-size:14px;cursor:pointer;padding:6px 0"><i class="fa-solid fa-list-check" style="color:#2563eb;margin-right:6px"></i>รายละเอียดแต่ละแถว (' + result.rowDetails.length + ' รายการ)</summary>';
            html += '<div style="margin-top:8px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;max-height:240px;overflow-y:auto">';
            html += '<table style="width:100%;font-size:12px;border-collapse:collapse">';
            html += '<thead><tr style="background:#f9fafb;position:sticky;top:0"><th style="padding:6px 10px;text-align:left">แถว</th><th style="padding:6px 10px;text-align:left">ID</th><th style="padding:6px 10px;text-align:left">สถานะ</th><th style="padding:6px 10px;text-align:left">หมายเหตุ</th></tr></thead><tbody>';
            var statusIcons = {
                'new': '<span style="color:#16a34a"><i class="fa-solid fa-plus-circle"></i> เพิ่มใหม่</span>',
                'updated': '<span style="color:#7c3aed"><i class="fa-solid fa-pen-to-square"></i> อัปเดต</span>',
                'error': '<span style="color:#dc2626"><i class="fa-solid fa-circle-xmark"></i> ผิดพลาด</span>'
            };
            result.rowDetails.forEach(function(rd) {
                var warnNote = (rd.warnings && rd.warnings.length > 0) ? '<br><span style="color:#d97706;font-size:11px"><i class="fa-solid fa-exclamation"></i> ' + rd.warnings.join(', ') + '</span>' : '';
                html += '<tr style="border-top:1px solid #f3f4f6">';
                html += '<td style="padding:5px 10px">' + rd.row + '</td>';
                html += '<td style="padding:5px 10px;font-family:monospace;font-weight:600">' + rd.id + '</td>';
                html += '<td style="padding:5px 10px">' + (statusIcons[rd.status] || rd.status) + '</td>';
                html += '<td style="padding:5px 10px">' + rd.message + warnNote + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div></details></div>';
        }

        body.innerHTML = html;

        // Show modal
        modal.style.display = 'flex';

        // Close handlers
        var closeBtn = document.getElementById('import-report-close');
        var okBtn = document.getElementById('import-report-ok');
        var closeModal = function() { modal.style.display = 'none'; };
        closeBtn.onclick = closeModal;
        okBtn.onclick = closeModal;
        modal.onclick = function(e) { if (e.target === modal) closeModal(); };
    },

    _reportCard(value, label, color, bg, icon) {
        return '<div style="background:' + bg + ';border-radius:10px;padding:12px;text-align:center">'
            + '<div style="font-size:24px;font-weight:800;color:' + color + '">' + value + '</div>'
            + '<div style="font-size:11px;color:' + color + ';opacity:0.8;margin-top:2px"><i class="fa-solid ' + icon + '" style="margin-right:3px"></i>' + label + '</div>'
            + '</div>';
    },

    // Parse CSV line respecting quoted fields
    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
                else if (ch === '"') { inQuotes = false; }
                else { current += ch; }
            } else {
                if (ch === '"') { inQuotes = true; }
                else if (ch === ',') { result.push(current.trim()); current = ''; }
                else { current += ch; }
            }
        }
        result.push(current.trim());
        return result;
    },

    // Normalize CSV headers (handles duplicate "note" columns positionally)
    _normalizeHeaders(rawHeaders) {
        let noteCount = 0;
        return rawHeaders.map(raw => {
            const h = raw.trim();
            if (/^ID$/i.test(h)) return 'ID';
            if (/^Group/i.test(h)) return 'Group';
            if (/^Sex/i.test(h)) return 'Sex';
            if (h === 'ชื่อ') return 'first_name';
            if (h === 'นามสกุล') return 'last_name';
            if (/^BW$/i.test(h)) return 'BW';
            if (/^Ht$/i.test(h)) return 'Ht';
            if (/^BMI$/i.test(h)) return 'BMI';
            if (h === 'เอว') return 'waist';
            if (/^Age$/i.test(h)) return 'Age';
            if (h === 'ระดับการศึกษา') return 'education_level';
            if (h === 'อาชีพ') return 'occupation';
            if (/^note$/i.test(h)) {
                noteCount++;
                return noteCount === 1 ? 'occupation_note' : 'comorbidity_note';
            }
            if (h === 'ระยะเวลา DM' || h === 'ระยะเวลาDM') return 'dm_duration';
            if (/^D[1-7]$/.test(h)) return h.toUpperCase();
            if (h === 'ยา') return 'medication';
            if (/^Line$/i.test(h)) return 'Line';
            if (/^HbA1c_baseline$/i.test(h)) return 'HbA1c_baseline';
            if (/^FBS$/i.test(h)) return 'FBS';
            if (/^GFR$/i.test(h)) return 'GFR';
            if (/^DTX\s*1$/i.test(h)) return 'DTX1';
            if (/^HbA1c_6m$/i.test(h)) return 'HbA1c_6m';
            const paidMatch = h.match(/^PAID(\d+)_(baseline|6m)$/i);
            if (paidMatch) return 'PAID' + paidMatch[1] + '_' + paidMatch[2].toLowerCase();
            if (/^PAID_total_baseline$/i.test(h)) return 'PAID_total_baseline';
            if (/^PAID_total_6m$/i.test(h)) return 'PAID_total_6m';
            const hlMatch = h.match(/^HL(\d+)_(baseline|6m)$/i);
            if (hlMatch) return 'HL' + hlMatch[1] + '_' + hlMatch[2].toLowerCase();
            if (/^HL_total_baseline$/i.test(h)) return 'HL_total_baseline';
            if (/^HL_total_6m$/i.test(h)) return 'HL_total_6m';
            const hMatch = h.match(/^H(\d+)_(baseline|6m)$/i);
            if (hMatch) return 'H' + hMatch[1] + '_' + hMatch[2].toLowerCase();
            if (/^H_\s*baseline$/i.test(h)) return 'H_baseline';
            if (/^H_\s*6\s*month$/i.test(h)) return 'H_6month';
            if (/^patient_id$/i.test(h)) return 'ID';
            return h;
        });
    },


    // =====================
    // Template Download
    // =====================

    setupTemplateDownload() {
        const btn = document.getElementById('btn-download-template');
        if (!btn) return;

        btn.addEventListener('click', () => {
            // Try API first, fallback to client-side generation
            if (typeof DiabetesApp !== 'undefined' && DiabetesApp.dbConnected) {
                const baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
                window.location.href = baseUrl + '/api/import/template';
                return;
            }

            // Generate template client-side (89 columns)
            const headers = [
                'ID', 'Group (1=Intervention,0=Control)', 'Sex (1=Male,2=Female,3=Other)',
                'ชื่อ', 'นามสกุล', 'BW', 'Ht', 'BMI', 'เอว', 'Age',
                'ระดับการศึกษา', 'อาชีพ', 'note', 'ระยะเวลา DM',
                'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'note', 'ยา', 'Line',
                'HbA1c_baseline', 'FBS', 'GFR', 'DTX 1', 'HbA1c_6m',
                'PAID1_baseline', 'PAID2_baseline', 'PAID3_baseline', 'PAID4_baseline', 'PAID5_baseline',
                'PAID1_6m', 'PAID2_6m', 'PAID3_6m', 'PAID4_6m', 'PAID5_6m',
                'PAID_total_baseline', 'PAID_total_6m',
                'HL1_baseline', 'HL2_baseline', 'HL3_baseline', 'HL4_baseline', 'HL5_baseline',
                'HL6_baseline', 'HL7_baseline', 'HL8_baseline', 'HL9_baseline', 'HL10_baseline',
                'HL1_6m', 'HL2_6m', 'HL3_6m', 'HL4_6m', 'HL5_6m',
                'HL6_6m', 'HL7_6m', 'HL8_6m', 'HL9_6m', 'HL10_6m',
                'HL_total_baseline', 'HL_total_6m',
                'H1_baseline', 'H2_baseline', 'H3_baseline', 'H4_baseline', 'H5_baseline', 'H6_baseline',
                'H7_baseline', 'H8_baseline', 'H9_baseline', 'H10_baseline', 'H11_baseline', 'H12_baseline',
                'H1_6m', 'H2_6m', 'H3_6m', 'H4_6m', 'H5_6m', 'H6_6m',
                'H7_6m', 'H8_6m', 'H9_6m', 'H10_6m', 'H11_6m', 'H12_6m',
                'H_baseline', 'H_6month'
            ];
            const example = [
                'DM-001', '1', '2', 'สมศรี', 'มั่นคง',
                '65', '158', '26.0', '88', '55',
                '1', '5', '', '5',
                '1', '1', '0', '0', '0', '0', '0', '', '1', '1',
                '8.5', '130', '75', '180', '7.2',
                '3', '2', '3', '2', '4', '1', '1', '2', '1', '2', '14', '7',
                '3', '3', '2', '3', '2', '3', '2', '3', '3', '2',
                '2', '3', '3', '3', '3', '3', '3', '3', '3', '3', '26', '29',
                '2', '3', '2', '2', '3', '2', '3', '3', '2', '3', '2', '3',
                '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '30', '36'
            ];
            const csv = '\uFEFF' + headers.join(',') + '\n' + example.join(',') + '\n';
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'diabetes_import_template.csv';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
        });
    },

    // =====================
    // Print Report
    // =====================

    setupPrintReport() {
        const btn = document.getElementById('btn-print-report');
        if (!btn) return;

        btn.addEventListener('click', () => {
            this.generateReport();
        });
    },

    generateReport() {
        const data = this._cachedSummaryData;
        if (!data) {
            showToast('ไม่มีข้อมูลสำหรับพิมพ์รายงาน', 'info');
            return;
        }

        const hba1c = data.hba1c || {};
        const paid5 = data.paid5 || {};
        const distress = data.distress || {};
        const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

        // Build patient table rows
        let tableRows = '';
        (data.patients || []).forEach((p, i) => {
            const genderTh = p.gender === 'male' || p.gender === 'M' ? 'ชาย' : p.gender === 'female' || p.gender === 'F' ? 'หญิง' : p.gender || '-';
            const groupTh = p.group === 'experimental' ? 'ทดลอง' : p.group === 'control' ? 'ควบคุม' : p.group || '-';
            const hBL = p.hba1c_baseline != null ? parseFloat(p.hba1c_baseline).toFixed(1) : '-';
            const h6m = p.hba1c_6month != null ? parseFloat(p.hba1c_6month).toFixed(1) : '-';
            const pBL = p.paid5_baseline != null ? p.paid5_baseline : '-';
            const p6m = p.paid5_6month != null ? p.paid5_6month : '-';
            const dist = p.distress === 'low' ? 'ต่ำ' : p.distress === 'high' ? 'สูง' : '-';
            tableRows += '<tr><td>' + (i + 1) + '</td><td>' + (p.patient_id || '-') + '</td><td>' + genderTh +
                '</td><td>' + (p.age || '-') + '</td><td>' + groupTh + '</td><td>' + hBL + '</td><td>' + h6m +
                '</td><td>' + pBL + '</td><td>' + p6m + '</td><td>' + dist + '</td></tr>';
        });

        const reportHTML = '<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">' +
            '<title>รายงานผลโปรแกรมโรงเรียนเบาหวาน</title>' +
            '<style>' +
            'body{font-family:Athiti,sans-serif;margin:40px;color:#19191B;font-size:14px}' +
            'h1{font-size:20px;text-align:center;margin-bottom:4px}' +
            'h2{font-size:16px;margin-top:24px;margin-bottom:8px;border-bottom:2px solid #2A86FF;padding-bottom:4px;color:#2A86FF}' +
            '.subtitle{text-align:center;color:#61646B;font-size:13px;margin-bottom:24px}' +
            '.stats{display:flex;gap:16px;margin-bottom:20px}' +
            '.stat-box{flex:1;background:#F5FAFF;border:1px solid #E5E7EB;border-radius:8px;padding:12px;text-align:center}' +
            '.stat-box .val{font-size:24px;font-weight:700;color:#2A86FF}' +
            '.stat-box .lbl{font-size:12px;color:#61646B}' +
            'table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}' +
            'th{background:#F5FAFF;padding:6px 4px;text-align:left;border-bottom:2px solid #E5E7EB;font-weight:600;white-space:nowrap}' +
            'td{padding:5px 4px;border-bottom:1px solid #F3F4F6;white-space:nowrap}' +
            '.summary-table{width:auto;margin:0 auto}' +
            '.summary-table td{padding:4px 16px}' +
            '.footer{margin-top:32px;text-align:center;font-size:11px;color:#AFB1B6;border-top:1px solid #E5E7EB;padding-top:12px}' +
            '@media print{body{margin:20px}@page{size:A4 landscape;margin:15mm}}' +
            '</style></head><body>' +
            '<h1>รายงานผลโปรแกรมโรงเรียนเบาหวาน + LINE</h1>' +
            '<div class="subtitle">วันที่พิมพ์: ' + today + '</div>' +

            '<h2>สรุปภาพรวม</h2>' +
            '<div class="stats">' +
            '<div class="stat-box"><div class="val">' + data.totalPatients + '</div><div class="lbl">ผู้ป่วยทั้งหมด</div></div>' +
            '<div class="stat-box"><div class="val">' + data.experimental + '</div><div class="lbl">กลุ่มทดลอง</div></div>' +
            '<div class="stat-box"><div class="val">' + data.control + '</div><div class="lbl">กลุ่มควบคุม</div></div>' +
            '<div class="stat-box"><div class="val">' + (data.avgHba1c || '-') + '%</div><div class="lbl">HbA1c เฉลี่ย</div></div>' +
            '</div>' +

            '<h2>ผลลัพธ์ HbA1c เปรียบเทียบ</h2>' +
            '<table class="summary-table"><tr><th></th><th>Baseline</th><th>6 เดือน</th><th>เปลี่ยนแปลง</th></tr>' +
            '<tr><td><b>กลุ่มทดลอง</b></td><td>' + (hba1c.expBaseline || '-') + '%</td><td>' + (hba1c.expSixMonth || '-') + '%</td><td style="color:' + (hba1c.expSixMonth < hba1c.expBaseline ? '#16a34a' : '#dc2626') + '">' + (hba1c.expBaseline && hba1c.expSixMonth ? (hba1c.expSixMonth - hba1c.expBaseline).toFixed(2) + '%' : '-') + '</td></tr>' +
            '<tr><td><b>กลุ่มควบคุม</b></td><td>' + (hba1c.ctrlBaseline || '-') + '%</td><td>' + (hba1c.ctrlSixMonth || '-') + '%</td><td style="color:' + (hba1c.ctrlSixMonth < hba1c.ctrlBaseline ? '#16a34a' : '#dc2626') + '">' + (hba1c.ctrlBaseline && hba1c.ctrlSixMonth ? (hba1c.ctrlSixMonth - hba1c.ctrlBaseline).toFixed(2) + '%' : '-') + '</td></tr></table>' +

            '<h2>ผลลัพธ์ PAID-5 เปรียบเทียบ</h2>' +
            '<table class="summary-table"><tr><th></th><th>Baseline</th><th>6 เดือน</th><th>เปลี่ยนแปลง</th></tr>' +
            '<tr><td><b>กลุ่มทดลอง</b></td><td>' + (paid5.expBaseline || '-') + '</td><td>' + (paid5.expSixMonth || '-') + '</td><td>' + (paid5.expBaseline && paid5.expSixMonth ? (paid5.expSixMonth - paid5.expBaseline).toFixed(1) : '-') + '</td></tr>' +
            '<tr><td><b>กลุ่มควบคุม</b></td><td>' + (paid5.ctrlBaseline || '-') + '</td><td>' + (paid5.ctrlSixMonth || '-') + '</td><td>' + (paid5.ctrlBaseline && paid5.ctrlSixMonth ? (paid5.ctrlSixMonth - paid5.ctrlBaseline).toFixed(1) : '-') + '</td></tr></table>' +

            '<h2>ระดับ Diabetes Distress</h2>' +
            '<table class="summary-table"><tr><td>Distress ต่ำ (Low)</td><td><b>' + (distress.low || 0) + '</b> ราย</td></tr>' +
            '<tr><td>Distress สูง (High)</td><td><b>' + (distress.high || 0) + '</b> ราย</td></tr></table>' +

            '<h2>รายชื่อผู้ป่วยทั้งหมด</h2>' +
            '<table><thead><tr><th>#</th><th>รหัส</th><th>เพศ</th><th>อายุ</th><th>กลุ่ม</th><th>HbA1c BL</th><th>HbA1c 6m</th><th>PAID-5 BL</th><th>PAID-5 6m</th><th>Distress</th></tr></thead><tbody>' +
            tableRows + '</tbody></table>' +

            '<div class="footer">ระบบติดตามผลโปรแกรมโรงเรียนเบาหวาน + LINE &mdash; Diabetes Tracking System</div>' +
            '</body></html>';

        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.write(reportHTML);
            reportWindow.document.close();
            setTimeout(() => reportWindow.print(), 500);
        } else {
            showToast('กรุณาอนุญาต popup สำหรับพิมพ์รายงาน', 'error');
        }
    },

    // =====================
    // Demo Data Generator
    // =====================

    getDemoData() {
        // Seed-based pseudo-random for consistent demo data
        let seed = 42;
        const seededRandom = () => {
            seed = (seed * 16807 + 0) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        const gaussianRandom = (mean, stddev) => {
            const u1 = seededRandom();
            const u2 = seededRandom();
            const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
            return mean + stddev * z;
        };

        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

        const totalPatients = 60;
        const expCount = 30;
        const ctrlCount = 30;
        const patients = [];

        // Generate experimental group patients
        const expHba1cBL = [];
        const expHba1c6m = [];
        const expPaid5BL = [];
        const expPaid56m = [];
        let expLowDistress = 0;
        let expHighDistress = 0;

        for (let i = 1; i <= expCount; i++) {
            const age = Math.round(clamp(gaussianRandom(55, 10), 30, 80));
            const gender = seededRandom() > 0.45 ? 'F' : 'M';
            const hba1cBL = parseFloat(clamp(gaussianRandom(8.5, 1.2), 6.5, 13.0).toFixed(1));
            // Experimental group shows more improvement
            const hba1c6m = parseFloat(clamp(hba1cBL - gaussianRandom(1.3, 0.6), 5.5, 12.0).toFixed(1));
            const paid5BL = Math.round(clamp(gaussianRandom(55, 15), 10, 95));
            // Experimental group PAID-5 improves more
            const paid56m = Math.round(clamp(paid5BL - gaussianRandom(20, 8), 5, 90));
            const distress = paid56m >= 40 ? 'high' : 'low';

            if (distress === 'low') expLowDistress++;
            else expHighDistress++;

            expHba1cBL.push(hba1cBL);
            expHba1c6m.push(hba1c6m);
            expPaid5BL.push(paid5BL);
            expPaid56m.push(paid56m);

            patients.push({
                patient_id: 'EXP-' + String(i).padStart(3, '0'),
                gender: gender,
                age: age,
                group: 'experimental',
                hba1c_baseline: hba1cBL,
                hba1c_6month: hba1c6m,
                paid5_baseline: paid5BL,
                paid5_6month: paid56m,
                distress: distress,
                status: seededRandom() > 0.05 ? 'active' : 'withdrawn'
            });
        }

        // Generate control group patients
        const ctrlHba1cBL = [];
        const ctrlHba1c6m = [];
        const ctrlPaid5BL = [];
        const ctrlPaid56m = [];
        let ctrlLowDistress = 0;
        let ctrlHighDistress = 0;

        for (let i = 1; i <= ctrlCount; i++) {
            const age = Math.round(clamp(gaussianRandom(56, 10), 30, 80));
            const gender = seededRandom() > 0.45 ? 'F' : 'M';
            const hba1cBL = parseFloat(clamp(gaussianRandom(8.4, 1.1), 6.5, 13.0).toFixed(1));
            // Control group shows only slight improvement
            const hba1c6m = parseFloat(clamp(hba1cBL - gaussianRandom(0.3, 0.5), 5.5, 12.5).toFixed(1));
            const paid5BL = Math.round(clamp(gaussianRandom(53, 14), 10, 95));
            // Control group PAID-5 slight improvement
            const paid56m = Math.round(clamp(paid5BL - gaussianRandom(5, 6), 5, 90));
            const distress = paid56m >= 40 ? 'high' : 'low';

            if (distress === 'low') ctrlLowDistress++;
            else ctrlHighDistress++;

            ctrlHba1cBL.push(hba1cBL);
            ctrlHba1c6m.push(hba1c6m);
            ctrlPaid5BL.push(paid5BL);
            ctrlPaid56m.push(paid56m);

            patients.push({
                patient_id: 'CTRL-' + String(i).padStart(3, '0'),
                gender: gender,
                age: age,
                group: 'control',
                hba1c_baseline: hba1cBL,
                hba1c_6month: hba1c6m,
                paid5_baseline: paid5BL,
                paid5_6month: paid56m,
                distress: distress,
                status: seededRandom() > 0.08 ? 'active' : 'withdrawn'
            });
        }

        // Calculate averages
        const avg = arr => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0;

        const allHba1cBL = expHba1cBL.concat(ctrlHba1cBL);
        const avgHba1c = avg(allHba1cBL).toFixed(1);

        return {
            totalPatients: totalPatients,
            experimental: expCount,
            control: ctrlCount,
            avgHba1c: avgHba1c,
            avgBmi: '26.3',
            avgFbs: '142',
            avgGfr: '72.5',
            avgDtx: '158',
            followUpRate: '92',
            hba1c: {
                expBaseline: avg(expHba1cBL),
                expSixMonth: avg(expHba1c6m),
                ctrlBaseline: avg(ctrlHba1cBL),
                ctrlSixMonth: avg(ctrlHba1c6m)
            },
            paid5: {
                expBaseline: avg(expPaid5BL),
                expSixMonth: avg(expPaid56m),
                ctrlBaseline: avg(ctrlPaid5BL),
                ctrlSixMonth: avg(ctrlPaid56m)
            },
            healthLiteracy: { expBaseline: 28, expSixMonth: 35, ctrlBaseline: 27, ctrlSixMonth: 29 },
            selfCare: { expBaseline: 24, expSixMonth: 34, ctrlBaseline: 25, ctrlSixMonth: 27 },
            distress: {
                low: expLowDistress + ctrlLowDistress,
                high: expHighDistress + ctrlHighDistress
            },
            bmiDist: { underweight: 2, normal: 12, overweight: 16, obese1: 22, obese2: 8 },
            comorbCounts: { hypertension: 38, dyslipidemia: 28, cvd: 8, ckd: 5, gout: 12 },
            dtxGroup: { expAvg: 148.5, ctrlAvg: 167.2 },
            ageDist: { '<40': 3, '40-49': 10, '50-59': 22, '60-69': 18, '70+': 7 },
            patients: patients
        };
    }
};

window.DiabetesDashboard = DiabetesDashboard;
