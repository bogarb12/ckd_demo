// DiabetesDashboard - Dashboard with Charts and Patient Data Table
const DiabetesDashboard = {
    charts: {},
    currentFilter: 'all',
    initialized: false,
    currentPage: 1,
    pageSize: 10,
    filteredPatients: [],

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
                this.setupImport();
                this.setupTemplateDownload();
                this.setupPrintReport();
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
    // Patient Table
    // =====================

    renderPatientTable(patients, filter) {
        const tbody = document.getElementById('dash-patient-table');
        if (!tbody) return;

        // Apply filter
        let filtered = patients || [];
        if (filter && filter !== 'all') {
            filtered = filtered.filter(p => p.group === filter);
        }

        // Store filtered patients for pagination
        this.filteredPatients = filtered;

        // Reset to page 1 when filter changes
        if (this._lastFilter !== filter) {
            this.currentPage = 1;
            this._lastFilter = filter;
        }

        // If no data, show placeholder
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:32px;color:#94a3b8;font-family:Athiti,sans-serif;font-size:14px;">ยังไม่มีข้อมูล</td></tr>';
            this.renderPagination(0);
            return;
        }

        // Pagination calculation
        const totalPages = Math.ceil(filtered.length / this.pageSize);
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        const startIdx = (this.currentPage - 1) * this.pageSize;
        const endIdx = Math.min(startIdx + this.pageSize, filtered.length);
        const pageData = filtered.slice(startIdx, endIdx);

        let html = '';
        pageData.forEach((p, idx) => {
            // HbA1c change color coding
            const hba1cBL = p.hba1c_baseline;
            const hba1c6m = p.hba1c_6month;
            let hba1cBLDisplay = hba1cBL != null ? hba1cBL.toFixed(1) : '-';
            let hba1c6mDisplay = hba1c6m != null ? hba1c6m.toFixed(1) : '-';
            let hba1c6mStyle = '';

            if (hba1cBL != null && hba1c6m != null) {
                if (hba1c6m < hba1cBL) {
                    hba1c6mStyle = 'color:#16a34a;font-weight:600;';
                } else if (hba1c6m > hba1cBL) {
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
        this.renderPagination(filtered.length);
    },

    renderPagination(totalItems) {
        const wrapper = document.querySelector('.data-table-wrapper');
        if (!wrapper) return;

        // Remove existing pagination
        const existingPag = wrapper.parentNode.querySelector('.table-pagination-wrap');
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

        wrapper.insertAdjacentHTML('afterend', pagHtml);

        // Bind pagination events
        const pagWrap = wrapper.parentNode.querySelector('.table-pagination-wrap');
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
                    const fetchFn = window.authFetch || fetch;
                    const response = await fetchFn(baseUrl + '/api/export/csv');
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

        // Define CSV columns matching the research template (89 columns)
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

        const groupMap = { 'experimental': '1', 'control': '0' };
        const sexMap = { 'male': '1', 'female': '2', 'other': '3' };

        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        };

        const getVal = (obj, ...keys) => {
            for (const k of keys) {
                const v = obj[k];
                if (v != null && v !== '') return v;
            }
            return '';
        };

        const getPaid = (p, q, period) => {
            const keys = period === 'baseline'
                ? [`paid5.q${q}_baseline`, `paid5_q${q}_baseline`]
                : [`paid5.q${q}_6month`, `paid5_q${q}_6month`, `paid5_q${q}_6m`];
            for (const k of keys) {
                const parts = k.split('.');
                let v = p;
                for (const part of parts) { v = v && v[part]; }
                if (v != null && v !== '') return v;
            }
            return '';
        };

        const getHL = (p, q, period) => {
            const pre = period === 'baseline' ? 'baseline' : '6month';
            if (p.health_literacy && p.health_literacy[`q${q}_${pre}`] != null) return p.health_literacy[`q${q}_${pre}`];
            return '';
        };

        const getSC = (p, q, period) => {
            const pre = period === 'baseline' ? 'baseline' : '6month';
            if (p.self_care && p.self_care[`q${q}_${pre}`] != null) return p.self_care[`q${q}_${pre}`];
            return '';
        };

        const rows = [headers.map(escapeCSV).join(',')];

        patients.forEach(p => {
            const grp = p.study_group || p.group || p.enrollment_group || '';
            const gen = p.gender || '';
            const row = [
                p.patient_id || p.id || '',
                groupMap[grp] || grp,
                sexMap[gen] || gen,
                p.first_name || '', p.last_name || '',
                getVal(p, 'weight', 'bw'), getVal(p, 'height', 'ht'), getVal(p, 'bmi'), getVal(p, 'waist'), getVal(p, 'age'),
                getVal(p, 'education_level'), getVal(p, 'occupation'), getVal(p, 'occupation_note'),
                getVal(p, 'diabetes_duration_years', 'dm_duration'),
                getVal(p, 'd1'), getVal(p, 'd2'), getVal(p, 'd3'), getVal(p, 'd4'),
                getVal(p, 'd5'), getVal(p, 'd6'), getVal(p, 'd7'),
                getVal(p, 'comorbidity_note'), getVal(p, 'medication'), getVal(p, 'line_usage'),
                getVal(p, 'hba1c_baseline'), getVal(p, 'fbs'), getVal(p, 'gfr'), getVal(p, 'dtx1'), getVal(p, 'hba1c_6month', 'hba1c_6m'),
                getPaid(p, 1, 'baseline'), getPaid(p, 2, 'baseline'), getPaid(p, 3, 'baseline'), getPaid(p, 4, 'baseline'), getPaid(p, 5, 'baseline'),
                getPaid(p, 1, '6m'), getPaid(p, 2, '6m'), getPaid(p, 3, '6m'), getPaid(p, 4, '6m'), getPaid(p, 5, '6m'),
                getVal(p, 'paid_total_baseline', 'paid5_total_baseline'), getVal(p, 'paid_total_6m', 'paid5_total_6month'),
                getHL(p, 1, 'baseline'), getHL(p, 2, 'baseline'), getHL(p, 3, 'baseline'), getHL(p, 4, 'baseline'), getHL(p, 5, 'baseline'),
                getHL(p, 6, 'baseline'), getHL(p, 7, 'baseline'), getHL(p, 8, 'baseline'), getHL(p, 9, 'baseline'), getHL(p, 10, 'baseline'),
                getHL(p, 1, '6m'), getHL(p, 2, '6m'), getHL(p, 3, '6m'), getHL(p, 4, '6m'), getHL(p, 5, '6m'),
                getHL(p, 6, '6m'), getHL(p, 7, '6m'), getHL(p, 8, '6m'), getHL(p, 9, '6m'), getHL(p, 10, '6m'),
                getVal(p, 'hl_total_baseline'), getVal(p, 'hl_total_6m'),
                getSC(p, 1, 'baseline'), getSC(p, 2, 'baseline'), getSC(p, 3, 'baseline'), getSC(p, 4, 'baseline'), getSC(p, 5, 'baseline'), getSC(p, 6, 'baseline'),
                getSC(p, 7, 'baseline'), getSC(p, 8, 'baseline'), getSC(p, 9, 'baseline'), getSC(p, 10, 'baseline'), getSC(p, 11, 'baseline'), getSC(p, 12, 'baseline'),
                getSC(p, 1, '6m'), getSC(p, 2, '6m'), getSC(p, 3, '6m'), getSC(p, 4, '6m'), getSC(p, 5, '6m'), getSC(p, 6, '6m'),
                getSC(p, 7, '6m'), getSC(p, 8, '6m'), getSC(p, 9, '6m'), getSC(p, 10, '6m'), getSC(p, 11, '6m'), getSC(p, 12, '6m'),
                getVal(p, 'h_total_baseline', 'sc_total_baseline'), getVal(p, 'h_total_6m', 'sc_total_6month')
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
                // Always import to localStorage first (primary data source)
                const csvText = await file.text();
                const localResult = this.importCSVLocal(csvText);

                // Also try API import if DB connected
                if (typeof DiabetesApp !== 'undefined' && DiabetesApp.dbConnected) {
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const baseUrl = (window.API && window.API.baseUrl) ? window.API.baseUrl : '';
                        const response = await fetch(baseUrl + '/api/import/csv', {
                            method: 'POST',
                            body: formData
                        });
                        if (response.ok) {
                            const apiResult = await response.json();
                            console.log('API import also succeeded:', apiResult);
                        }
                    } catch (apiErr) {
                        console.warn('API import skipped:', apiErr.message);
                    }
                }

                this._showImportResult(localResult);
                hideLoading();
                await this.init();
            } catch (err) {
                hideLoading();
                console.error('Import error:', err);
                showToast('เกิดข้อผิดพลาดในการนำเข้า: ' + err.message, 'error');
            }
        });
    },

    _showImportResult(result) {
        const banner = document.getElementById('import-result');
        const text = document.getElementById('import-result-text');
        if (banner && text) {
            let msg = 'นำเข้าสำเร็จ ' + result.imported + '/' + result.total + ' รายการ';
            if (result.errors && result.errors.length > 0) {
                msg += ' (ข้อผิดพลาด ' + result.errors.length + ' รายการ)';
            }
            text.textContent = msg;
            banner.classList.remove('hidden');
            setTimeout(() => banner.classList.add('hidden'), 8000);
        }
        showToast('นำเข้าข้อมูลสำเร็จ ' + result.imported + ' รายการ', 'success');
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

    // Import CSV to localStorage
    importCSVLocal(csvText) {
        const content = csvText.replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV ต้องมี header + อย่างน้อย 1 แถวข้อมูล');

        const rawHeaders = this._parseCSVLine(lines[0]);
        const headers = this._normalizeHeaders(rawHeaders);
        const idIdx = headers.indexOf('ID');
        if (idIdx < 0) throw new Error('ไม่พบคอลัมน์ ID');

        const groupMap = { '1': 'experimental', '0': 'control' };
        const sexMap = { '1': 'male', '2': 'female', '3': 'other' };

        let imported = 0;
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this._parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] || null; });

            if (!row.ID) { errors.push('Row ' + (i + 1) + ': missing ID'); continue; }

            const patient = {
                patient_id: row.ID,
                study_group: groupMap[row.Group] || row.Group || null,
                gender: sexMap[row.Sex] || row.Sex || null,
                first_name: row.first_name || null,
                last_name: row.last_name || null,
                weight: row.BW ? parseFloat(row.BW) : null,
                height: row.Ht ? parseFloat(row.Ht) : null,
                bmi: row.BMI ? parseFloat(row.BMI) : null,
                waist: row.waist ? parseFloat(row.waist) : null,
                age: row.Age ? parseInt(row.Age) : null,
                education_level: row.education_level ? parseInt(row.education_level) : null,
                occupation: row.occupation ? parseInt(row.occupation) : null,
                occupation_note: row.occupation_note || null,
                diabetes_duration_years: row.dm_duration ? parseFloat(row.dm_duration) : null,
                d1: row.D1 ? parseInt(row.D1) : 0,
                d2: row.D2 ? parseInt(row.D2) : 0,
                d3: row.D3 ? parseInt(row.D3) : 0,
                d4: row.D4 ? parseInt(row.D4) : 0,
                d5: row.D5 ? parseInt(row.D5) : 0,
                d6: row.D6 ? parseInt(row.D6) : 0,
                d7: row.D7 ? parseInt(row.D7) : 0,
                comorbidity_note: row.comorbidity_note || null,
                medication: row.medication ? parseInt(row.medication) : null,
                line_usage: row.Line ? parseInt(row.Line) : null,
                hba1c_baseline: row.HbA1c_baseline ? parseFloat(row.HbA1c_baseline) : null,
                fbs: row.FBS ? parseFloat(row.FBS) : null,
                gfr: row.GFR ? parseFloat(row.GFR) : null,
                dtx1: row.DTX1 ? parseFloat(row.DTX1) : null,
                hba1c_6month: row.HbA1c_6m ? parseFloat(row.HbA1c_6m) : null,
                paid5: {},
                health_literacy: {},
                self_care: {}
            };

            // PAID-5
            for (let q = 1; q <= 5; q++) {
                if (row['PAID' + q + '_baseline']) patient.paid5['q' + q + '_baseline'] = parseInt(row['PAID' + q + '_baseline']);
                if (row['PAID' + q + '_6m']) patient.paid5['q' + q + '_6month'] = parseInt(row['PAID' + q + '_6m']);
            }
            if (row.PAID_total_baseline) patient.paid5.total_baseline = parseInt(row.PAID_total_baseline);
            if (row.PAID_total_6m) patient.paid5.total_6month = parseInt(row.PAID_total_6m);

            // Health Literacy
            for (let q = 1; q <= 10; q++) {
                if (row['HL' + q + '_baseline']) patient.health_literacy['q' + q + '_baseline'] = parseInt(row['HL' + q + '_baseline']);
                if (row['HL' + q + '_6m']) patient.health_literacy['q' + q + '_6month'] = parseInt(row['HL' + q + '_6m']);
            }
            if (row.HL_total_baseline) patient.health_literacy.total_baseline = parseInt(row.HL_total_baseline);
            if (row.HL_total_6m) patient.health_literacy.total_6month = parseInt(row.HL_total_6m);

            // Self-Care
            for (let q = 1; q <= 12; q++) {
                if (row['H' + q + '_baseline']) patient.self_care['q' + q + '_baseline'] = parseInt(row['H' + q + '_baseline']);
                if (row['H' + q + '_6m']) patient.self_care['q' + q + '_6month'] = parseInt(row['H' + q + '_6m']);
            }
            if (row.H_baseline) patient.self_care.total_baseline = parseInt(row.H_baseline);
            if (row.H_6month) patient.self_care.total_6month = parseInt(row.H_6month);

            // Save to localStorage
            if (typeof LocalDB !== 'undefined') {
                try {
                    const existing = LocalDB.getAll();
                    const idx = existing.findIndex(p => p.patient_id === patient.patient_id);
                    if (idx >= 0) {
                        existing[idx] = Object.assign(existing[idx], patient);
                    } else {
                        existing.push(patient);
                    }
                    localStorage.setItem('diabetes_patients', JSON.stringify(existing));
                    imported++;
                } catch (e) {
                    errors.push('Row ' + (i + 1) + ': ' + e.message);
                }
            } else {
                errors.push('Row ' + (i + 1) + ': LocalDB not available');
            }
        }

        return { success: true, imported, total: lines.length - 1, errors };
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
            const hBL = p.hba1c_baseline != null ? p.hba1c_baseline.toFixed(1) : '-';
            const h6m = p.hba1c_6month != null ? p.hba1c_6month.toFixed(1) : '-';
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
