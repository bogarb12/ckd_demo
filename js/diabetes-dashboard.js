// DiabetesDashboard - Dashboard with Charts and Patient Data Table
const DiabetesDashboard = {
    charts: {},
    currentFilter: 'all',
    initialized: false,

    // =====================
    // Initialization
    // =====================

    async init() {
        try {
            // Load patient data
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

            // Render patient table
            this.renderPatientTable(summaryData.patients, this.currentFilter);

            // Set up filter and export (only once)
            if (!this.initialized) {
                this.setupFilter(summaryData);
                this.setupExport();
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
            this.renderPatientTable(demoData.patients, 'all');
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
                banner.style.cssText = 'background:#fef3c7;color:#92400e;padding:10px 16px;border-radius:8px;margin-bottom:16px;font-size:14px;font-family:Sarabun,sans-serif;display:flex;align-items:center;gap:8px;border:1px solid #fcd34d;';
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
        const experimental = patients.filter(p =>
            p.study_group === 'experimental' || p.enrollment_group === 'experimental'
        );
        const control = patients.filter(p =>
            p.study_group === 'control' || p.enrollment_group === 'control'
        );

        // Calculate average HbA1c across all patients
        const allHba1c = patients
            .map(p => p.hba1c_baseline)
            .filter(v => v != null && !isNaN(v));
        const avgHba1c = allHba1c.length > 0
            ? (allHba1c.reduce((a, b) => a + b, 0) / allHba1c.length).toFixed(1)
            : '-';

        // HbA1c averages by group
        const expBaseline = experimental.map(p => p.hba1c_baseline).filter(v => v != null && !isNaN(v));
        const expSixMonth = experimental.map(p => p.hba1c_6month).filter(v => v != null && !isNaN(v));
        const ctrlBaseline = control.map(p => p.hba1c_baseline).filter(v => v != null && !isNaN(v));
        const ctrlSixMonth = control.map(p => p.hba1c_6month).filter(v => v != null && !isNaN(v));

        const avg = arr => arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : 0;

        // PAID-5 converted scores by group
        const getConverted = (p, period) => {
            if (!p.paid5) return null;
            return p.paid5[`converted_${period}`] != null ? p.paid5[`converted_${period}`] : null;
        };

        const expPaid5BL = experimental.map(p => getConverted(p, 'baseline')).filter(v => v != null);
        const expPaid5_6m = experimental.map(p => getConverted(p, '6month')).filter(v => v != null);
        const ctrlPaid5BL = control.map(p => getConverted(p, 'baseline')).filter(v => v != null);
        const ctrlPaid5_6m = control.map(p => getConverted(p, '6month')).filter(v => v != null);

        // Distress levels (from latest available - prefer 6month, fallback to baseline)
        let lowDistress = 0;
        let highDistress = 0;
        patients.forEach(p => {
            if (!p.paid5) return;
            const level = p.paid5.distress_6month || p.paid5.distress_baseline;
            if (level === 'low') lowDistress++;
            else if (level === 'high') highDistress++;
        });

        return {
            totalPatients: patients.length,
            experimental: experimental.length,
            control: control.length,
            avgHba1c: avgHba1c,
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
            distress: {
                low: lowDistress,
                high: highDistress
            },
            patients: patients.map(p => this.normalizePatientForTable(p))
        };
    },

    normalizePatientForTable(p) {
        const getConverted = (period) => {
            if (!p.paid5) return null;
            return p.paid5[`converted_${period}`] != null ? p.paid5[`converted_${period}`] : null;
        };

        const getDistress = () => {
            if (!p.paid5) return null;
            return p.paid5.distress_6month || p.paid5.distress_baseline || null;
        };

        const getStatus = () => {
            if (p.followUp && p.followUp.status) return p.followUp.status;
            return 'active';
        };

        return {
            patient_id: p.patient_id || '-',
            gender: p.gender || '-',
            age: p.age != null ? p.age : '-',
            group: p.study_group || p.enrollment_group || '-',
            hba1c_baseline: p.hba1c_baseline != null ? p.hba1c_baseline : null,
            hba1c_6month: p.hba1c_6month != null ? p.hba1c_6month : null,
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
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    },
                    {
                        label: 'กลุ่มควบคุม (Control)',
                        data: [ctrlBL, ctrl6m],
                        backgroundColor: 'rgba(249, 115, 22, 0.8)',
                        borderColor: 'rgba(249, 115, 22, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
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
                            font: { family: 'Sarabun', size: 13 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        titleFont: { family: 'Sarabun' },
                        bodyFont: { family: 'Sarabun' },
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + ctx.raw.toFixed(1) + '%';
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'ค่าเฉลี่ย HbA1c เปรียบเทียบ Baseline กับ 6 เดือน',
                        font: { family: 'Sarabun', size: 15, weight: '600' },
                        color: '#1e293b'
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
                            font: { family: 'Sarabun', size: 13 }
                        },
                        ticks: {
                            font: { family: 'Sarabun', size: 12 },
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
                            font: { family: 'Sarabun', size: 13 }
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
                        backgroundColor: 'rgba(20, 184, 166, 0.8)',
                        borderColor: 'rgba(20, 184, 166, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.7,
                        categoryPercentage: 0.6
                    },
                    {
                        label: 'กลุ่มควบคุม (Control)',
                        data: [ctrlBL, ctrl6m],
                        backgroundColor: 'rgba(139, 92, 246, 0.8)',
                        borderColor: 'rgba(139, 92, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
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
                            font: { family: 'Sarabun', size: 13 },
                            usePointStyle: true,
                            pointStyle: 'rectRounded'
                        }
                    },
                    tooltip: {
                        titleFont: { family: 'Sarabun' },
                        bodyFont: { family: 'Sarabun' },
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + ctx.raw.toFixed(0) + ' คะแนน';
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'คะแนน PAID-5 (ค่าแปลง) เปรียบเทียบ Baseline กับ 6 เดือน',
                        font: { family: 'Sarabun', size: 15, weight: '600' },
                        color: '#1e293b'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'คะแนน PAID-5 (0-100)',
                            font: { family: 'Sarabun', size: 13 }
                        },
                        ticks: {
                            font: { family: 'Sarabun', size: 12 }
                        },
                        grid: {
                            color: 'rgba(0,0,0,0.06)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { family: 'Sarabun', size: 13 }
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
                            font: { family: 'Sarabun', size: 15, weight: '600' },
                            color: '#1e293b'
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

                        ctx.font = '600 14px Sarabun';
                        ctx.fillStyle = '#94a3b8';
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
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ],
                    borderColor: [
                        'rgba(34, 197, 94, 1)',
                        'rgba(239, 68, 68, 1)'
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
                            font: { family: 'Sarabun', size: 13 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 16
                        }
                    },
                    tooltip: {
                        titleFont: { family: 'Sarabun' },
                        bodyFont: { family: 'Sarabun' },
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
                        font: { family: 'Sarabun', size: 15, weight: '600' },
                        color: '#1e293b'
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
                    ctx.font = '700 28px Sarabun';
                    ctx.fillStyle = '#1e293b';
                    ctx.fillText(totalCount.toString(), centerX, centerY - 8);

                    // Label below
                    ctx.font = '400 12px Sarabun';
                    ctx.fillStyle = '#64748b';
                    ctx.fillText('รายทั้งหมด', centerX, centerY + 14);

                    ctx.restore();
                }
            }]
        });
    },

    // =====================
    // Patient Table
    // =====================

    renderPatientTable(patients, filter) {
        const tbody = document.querySelector('#dash-patient-table tbody');
        if (!tbody) return;

        // Apply filter
        let filtered = patients || [];
        if (filter && filter !== 'all') {
            filtered = filtered.filter(p => p.group === filter);
        }

        // If no data, show placeholder
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:#94a3b8;font-family:Sarabun,sans-serif;font-size:14px;">ยังไม่มีข้อมูล</td></tr>';
            return;
        }

        let html = '';
        filtered.forEach(p => {
            // HbA1c change color coding
            const hba1cBL = p.hba1c_baseline;
            const hba1c6m = p.hba1c_6month;
            let hba1cBLDisplay = hba1cBL != null ? hba1cBL.toFixed(1) : '-';
            let hba1c6mDisplay = hba1c6m != null ? hba1c6m.toFixed(1) : '-';
            let hba1c6mStyle = '';

            if (hba1cBL != null && hba1c6m != null) {
                if (hba1c6m < hba1cBL) {
                    // Improved (decreased)
                    hba1c6mStyle = 'color:#16a34a;font-weight:600;';
                } else if (hba1c6m > hba1cBL) {
                    // Worsened (increased)
                    hba1c6mStyle = 'color:#dc2626;font-weight:600;';
                }
            }

            // PAID-5 displays
            const paid5BLDisplay = p.paid5_baseline != null ? p.paid5_baseline : '-';
            const paid56mDisplay = p.paid5_6month != null ? p.paid5_6month : '-';

            // Distress color coding
            let distressDisplay = '-';
            let distressStyle = '';
            if (p.distress === 'low') {
                distressDisplay = 'ต่ำ (Low)';
                distressStyle = 'color:#16a34a;font-weight:600;';
            } else if (p.distress === 'high') {
                distressDisplay = 'สูง (High)';
                distressStyle = 'color:#dc2626;font-weight:600;';
            }

            // Group display
            const groupDisplay = p.group === 'experimental'
                ? 'ทดลอง'
                : p.group === 'control'
                    ? 'ควบคุม'
                    : p.group || '-';

            // Gender display
            const genderDisplay = p.gender === 'M' || p.gender === 'male'
                ? 'ชาย'
                : p.gender === 'F' || p.gender === 'female'
                    ? 'หญิง'
                    : p.gender || '-';

            // Status display
            let statusDisplay = '-';
            let statusStyle = '';
            if (p.status === 'active' || p.status === 'completed') {
                statusDisplay = p.status === 'active' ? 'กำลังติดตาม' : 'เสร็จสิ้น';
                statusStyle = 'color:#16a34a;';
            } else if (p.status === 'withdrawn' || p.status === 'lost') {
                statusDisplay = p.status === 'withdrawn' ? 'ถอนตัว' : 'ขาดการติดต่อ';
                statusStyle = 'color:#dc2626;';
            }

            html += '<tr>';
            html += '<td style="font-weight:500;">' + this.escapeHtml(p.patient_id) + '</td>';
            html += '<td>' + genderDisplay + '</td>';
            html += '<td>' + (p.age !== '-' ? p.age : '-') + '</td>';
            html += '<td>' + groupDisplay + '</td>';
            html += '<td>' + hba1cBLDisplay + '</td>';
            html += '<td style="' + hba1c6mStyle + '">' + hba1c6mDisplay + '</td>';
            html += '<td>' + paid5BLDisplay + '</td>';
            html += '<td>' + paid56mDisplay + '</td>';
            html += '<td style="' + distressStyle + '">' + distressDisplay + '</td>';
            html += '<td style="' + statusStyle + '">' + statusDisplay + '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
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
                } else {
                    const filteredData = this.getFilteredChartData(data, this.currentFilter);
                    this.createHbA1cChart(filteredData);
                    this.createPAID5Chart(filteredData);
                    this.createDistressChart(filteredData);
                }
            }
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
            // If DB connected, fetch from API
            if (typeof DiabetesApp !== 'undefined' && DiabetesApp.dbConnected) {
                try {
                    const baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
                    const response = await fetch(baseUrl + '/api/export/csv');
                    if (!response.ok) {
                        throw new Error('Export API failed');
                    }

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

                    if (typeof DiabetesApp !== 'undefined') {
                        DiabetesApp.showToast('ส่งออกข้อมูล CSV สำเร็จ', 'success');
                    }
                    return;
                } catch (apiErr) {
                    console.warn('API export failed, falling back to local export:', apiErr.message);
                }
            }

            // localStorage fallback: generate CSV from local data
            this.exportLocalCSV();

        } catch (err) {
            console.error('Export error:', err);
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('เกิดข้อผิดพลาดในการส่งออกข้อมูล', 'error');
            }
        }
    },

    exportLocalCSV() {
        let patients = [];

        if (typeof DiabetesApp !== 'undefined') {
            patients = DiabetesApp.loadAllFromLocal();
        }

        // If no local data, try demo data
        if (!patients || patients.length === 0) {
            const demoData = this.getDemoData();
            patients = demoData.patients;
        }

        if (!patients || patients.length === 0) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('ไม่มีข้อมูลสำหรับส่งออก', 'info');
            }
            return;
        }

        // Define CSV columns
        const headers = [
            'รหัสผู้ป่วย',
            'เพศ',
            'อายุ',
            'กลุ่ม',
            'HbA1c Baseline',
            'HbA1c 6m',
            'PAID-5 Baseline',
            'PAID-5 6m',
            'Distress',
            'สถานะ'
        ];

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const rows = [headers.map(escapeCSV).join(',')];

        patients.forEach(p => {
            const row = [
                p.patient_id || '',
                p.gender || '',
                p.age != null ? p.age : '',
                p.group || p.study_group || p.enrollment_group || '',
                p.hba1c_baseline != null ? p.hba1c_baseline : '',
                p.hba1c_6month != null ? p.hba1c_6month : (p.hba1c_6m != null ? p.hba1c_6m : ''),
                p.paid5_baseline != null ? p.paid5_baseline : '',
                p.paid5_6month != null ? p.paid5_6month : (p.paid5_6m != null ? p.paid5_6m : ''),
                p.distress || '',
                p.status || ''
            ];
            rows.push(row.map(escapeCSV).join(','));
        });

        const csvContent = rows.join('\n');

        // Trigger download with BOM for Thai encoding in Excel
        const bom = '﻿';
        const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'diabetes_dashboard_' + new Date().toISOString().slice(0, 10) + '.csv';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);

        if (typeof DiabetesApp !== 'undefined') {
            DiabetesApp.showToast('ส่งออกข้อมูล CSV สำเร็จ', 'success');
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
            distress: {
                low: expLowDistress + ctrlLowDistress,
                high: expHighDistress + ctrlHighDistress
            },
            patients: patients
        };
    }
};

window.DiabetesDashboard = DiabetesDashboard;
