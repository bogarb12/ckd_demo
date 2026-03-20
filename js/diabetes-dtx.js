// DiabetesDTX - DTX Recording & Analysis Module
const DiabetesDTX = {
    charts: {},
    currentPatientId: null,

    // =====================
    // Initialization
    // =====================

    init() {
        this.setupPatientSelector();
        this.setupDTXInputs();
        this.setupSaveButton();
        this.refreshPatientList();
    },

    // =====================
    // Patient Selector
    // =====================

    setupPatientSelector() {
        const selector = document.getElementById('dtx-patient-select');
        if (!selector) return;

        selector.addEventListener('change', (e) => {
            const patientId = e.target.value;
            if (patientId) {
                this.currentPatientId = patientId;
                this.loadDTXData(patientId);
            } else {
                this.currentPatientId = null;
                this.clearForm();
                this.hideAnalysis();
            }
        });
    },

    async refreshPatientList() {
        const selector = document.getElementById('dtx-patient-select');
        if (!selector) return;

        if (typeof DiabetesApp !== 'undefined') {
            await DiabetesApp.loadAllPatients();
            DiabetesApp.populatePatientSelector(selector);
        }
    },

    // =====================
    // DTX Inputs & Auto-Average
    // =====================

    setupDTXInputs() {
        for (let i = 1; i <= 6; i++) {
            const input = document.getElementById('dtx-val-' + i);
            if (input) {
                input.addEventListener('input', () => this.calculateAverage());
            }
        }
    },

    calculateAverage() {
        const values = [];
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById('dtx-val-' + i);
            if (el && el.value) {
                const v = parseFloat(el.value);
                if (!isNaN(v)) values.push(v);
            }
        }

        const avgEl = document.getElementById('dtx-avg-display');
        if (avgEl) {
            if (values.length > 0) {
                const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
                let color = 'var(--primary)';
                if (avg < 70) color = '#f59e0b';
                else if (avg > 250) color = '#ef4444';
                else if (avg > 180) color = '#f97316';
                else if (avg >= 70 && avg <= 130) color = '#22c55e';
                avgEl.textContent = avg + ' mg/dL (' + values.length + '/6 ครั้ง)';
                avgEl.style.color = color;
            } else {
                avgEl.textContent = '- mg/dL';
                avgEl.style.color = 'var(--primary)';
            }
        }
    },

    // =====================
    // Save DTX
    // =====================

    setupSaveButton() {
        const btn = document.getElementById('btn-save-dtx');
        if (!btn) return;

        btn.addEventListener('click', () => this.saveDTX());
    },

    async saveDTX() {
        if (!this.currentPatientId) {
            showToast('กรุณาเลือกผู้ป่วยก่อน', 'error');
            return;
        }

        const data = {};
        let hasValue = false;
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById('dtx-val-' + i);
            if (el && el.value) {
                data['dtx' + i] = parseFloat(el.value);
                hasValue = true;
            }
        }

        if (!hasValue) {
            showToast('กรุณากรอกค่า DTX อย่างน้อย 1 ครั้ง', 'error');
            return;
        }

        try {
            showLoading();
            const result = await DiabetesApp.apiPost('/api/dtx/' + encodeURIComponent(this.currentPatientId), data);
            hideLoading();

            if (result.success) {
                showToast('บันทึกค่า DTX สำเร็จ (เฉลี่ย: ' + (result.dtx_avg || '-') + ' mg/dL)', 'success');
                // Reload analysis data
                this.loadDTXData(this.currentPatientId);
            }
        } catch (err) {
            hideLoading();
            showToast('เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error');
        }
    },

    // =====================
    // Load DTX Data & Analysis
    // =====================

    async loadDTXData(patientId) {
        try {
            showLoading();
            const result = await DiabetesApp.apiGet('/api/dtx/' + encodeURIComponent(patientId));
            hideLoading();

            // Populate form with existing DTX values
            if (result.dtx) {
                for (let i = 1; i <= 6; i++) {
                    const el = document.getElementById('dtx-val-' + i);
                    if (el) {
                        el.value = result.dtx['dtx' + i] || '';
                    }
                }
                this.calculateAverage();
            }

            // Show analysis if there's data
            const hasDTX = result.dtx && (result.dtx.dtx1 || result.dtx.dtx2 || result.dtx.dtx3 || result.dtx.dtx4 || result.dtx.dtx5 || result.dtx.dtx6);
            if (hasDTX) {
                this.showTrendChart(result.dtx);
                this.showAnalysis(result);
            } else {
                this.hideAnalysis();
            }
        } catch (err) {
            hideLoading();
            console.error('Load DTX error:', err);
        }
    },

    // =====================
    // DTX Trend Chart (6 ครั้ง)
    // =====================

    showTrendChart(dtx) {
        const card = document.getElementById('dtx-trend-card');
        const canvas = document.getElementById('chart-dtx-trend');
        if (!card || !canvas) return;

        card.style.display = '';

        if (this.charts.trend) {
            this.charts.trend.destroy();
            this.charts.trend = null;
        }

        const labels = ['ครั้งที่ 1', 'ครั้งที่ 2', 'ครั้งที่ 3', 'ครั้งที่ 4', 'ครั้งที่ 5', 'ครั้งที่ 6'];
        const values = [dtx.dtx1, dtx.dtx2, dtx.dtx3, dtx.dtx4, dtx.dtx5, dtx.dtx6].map(v => v ? parseFloat(v) : null);
        const avgVal = dtx.dtx_avg ? parseFloat(dtx.dtx_avg) : null;

        // Color each point based on value
        const pointColors = values.map(v => {
            if (v === null) return '#ccc';
            if (v < 70) return '#f59e0b';
            if (v > 250) return '#ef4444';
            if (v > 180) return '#f97316';
            return '#22c55e';
        });

        this.charts.trend = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'DTX (mg/dL)',
                    data: values,
                    borderColor: '#2A86FF',
                    backgroundColor: 'rgba(42,134,255,0.1)',
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointColors,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    spanGaps: true
                }, {
                    label: 'ค่าเฉลี่ย',
                    data: avgVal ? labels.map(() => avgVal) : [],
                    borderColor: '#8b5cf6',
                    borderDash: [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Athiti', size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                return ctx.dataset.label + ': ' + (ctx.parsed.y !== null ? ctx.parsed.y + ' mg/dL' : 'ไม่มีข้อมูล');
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: 'mg/dL', font: { family: 'Athiti' } }
                    }
                }
            }
        });
    },

    // =====================
    // Analysis Section
    // =====================

    showAnalysis(data) {
        const section = document.getElementById('dtx-analysis-section');
        if (section) section.style.display = '';

        this.renderDTXvsHbA1c(data);
        this.renderDTXvsPAID5(data);
        this.renderDTXvsHL(data);
        this.renderDTXvsBMI(data);
    },

    hideAnalysis() {
        const section = document.getElementById('dtx-analysis-section');
        if (section) section.style.display = 'none';
        const trendCard = document.getElementById('dtx-trend-card');
        if (trendCard) trendCard.style.display = 'none';
    },

    clearForm() {
        for (let i = 1; i <= 6; i++) {
            const el = document.getElementById('dtx-val-' + i);
            if (el) el.value = '';
        }
        this.calculateAverage();
    },

    // =====================
    // DTX vs HbA1c Chart
    // =====================

    renderDTXvsHbA1c(data) {
        const canvas = document.getElementById('chart-dtx-vs-hba1c');
        const info = document.getElementById('dtx-vs-hba1c-info');
        if (!canvas) return;

        if (this.charts.vsHba1c) { this.charts.vsHba1c.destroy(); this.charts.vsHba1c = null; }

        const dtxAvg = data.dtx.dtx_avg ? parseFloat(data.dtx.dtx_avg) : null;
        const hba1cBL = data.hba1c.baseline ? parseFloat(data.hba1c.baseline) : null;
        const hba1c6m = data.hba1c.sixMonth ? parseFloat(data.hba1c.sixMonth) : null;

        // Info text
        if (info) {
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">';
            html += '<div style="padding:8px;background:#f0f9ff;border-radius:8px;text-align:center;"><div style="font-size:0.7rem;color:#64748b;">DTX เฉลี่ย</div><div style="font-size:1.1rem;font-weight:700;color:#2A86FF;">' + (dtxAvg || '-') + ' <span style="font-size:0.7rem;">mg/dL</span></div></div>';
            html += '<div style="padding:8px;background:#fef3c7;border-radius:8px;text-align:center;"><div style="font-size:0.7rem;color:#64748b;">HbA1c BL / 6m</div><div style="font-size:1.1rem;font-weight:700;color:#f59e0b;">' + (hba1cBL || '-') + ' / ' + (hba1c6m || '-') + '%</div></div>';
            html += '</div>';

            // Interpretation
            if (dtxAvg && hba1cBL) {
                const eHba1c = ((dtxAvg + 46.7) / 28.7).toFixed(1);
                html += '<div style="padding:8px 12px;background:#f8fafc;border-radius:8px;font-size:0.75rem;line-height:1.7;">';
                html += '<strong>การแปลผล:</strong> DTX เฉลี่ย ' + dtxAvg + ' mg/dL ≈ eHbA1c ' + eHba1c + '%';
                if (hba1c6m && hba1c6m < hba1cBL) {
                    html += ' <span style="color:#22c55e;">| HbA1c ลดลง ✓</span>';
                } else if (hba1c6m && hba1c6m > hba1cBL) {
                    html += ' <span style="color:#ef4444;">| HbA1c เพิ่มขึ้น ✗</span>';
                }
                html += '</div>';
            }
            info.innerHTML = html;
        }

        this.charts.vsHba1c = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['DTX เฉลี่ย (mg/dL)', 'HbA1c BL (%)', 'HbA1c 6m (%)'],
                datasets: [{
                    label: 'ค่า',
                    data: [dtxAvg, hba1cBL ? hba1cBL * 10 : null, hba1c6m ? hba1c6m * 10 : null],
                    backgroundColor: ['rgba(42,134,255,0.7)', 'rgba(245,158,11,0.7)', 'rgba(34,197,94,0.7)'],
                    borderColor: ['#2A86FF', '#f59e0b', '#22c55e'],
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
                                const idx = ctx.dataIndex;
                                if (idx === 0) return 'DTX เฉลี่ย: ' + (dtxAvg || '-') + ' mg/dL';
                                if (idx === 1) return 'HbA1c BL: ' + (hba1cBL || '-') + '%';
                                return 'HbA1c 6m: ' + (hba1c6m || '-') + '%';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'ค่า (scaled)', font: { family: 'Athiti' } } }
                }
            }
        });
    },

    // =====================
    // DTX vs PAID-5 Chart
    // =====================

    renderDTXvsPAID5(data) {
        const canvas = document.getElementById('chart-dtx-vs-paid5');
        const info = document.getElementById('dtx-vs-paid5-info');
        if (!canvas) return;

        if (this.charts.vsPaid5) { this.charts.vsPaid5.destroy(); this.charts.vsPaid5 = null; }

        const dtxAvg = data.dtx.dtx_avg ? parseFloat(data.dtx.dtx_avg) : null;
        const paid5BL = data.paid5.converted_baseline ? parseFloat(data.paid5.converted_baseline) : null;
        const paid56m = data.paid5.converted_6month ? parseFloat(data.paid5.converted_6month) : null;
        const distressBL = data.paid5.distress_baseline || null;
        const distress6m = data.paid5.distress_6month || null;

        if (info) {
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">';
            html += '<div style="padding:8px;background:#f0f9ff;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">DTX เฉลี่ย</div><div style="font-size:1rem;font-weight:700;color:#2A86FF;">' + (dtxAvg || '-') + '</div></div>';
            html += '<div style="padding:8px;background:#fce7f3;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">PAID-5 BL</div><div style="font-size:1rem;font-weight:700;color:#ec4899;">' + (paid5BL || '-') + '</div></div>';
            html += '<div style="padding:8px;background:#dbeafe;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">PAID-5 6m</div><div style="font-size:1rem;font-weight:700;color:#3b82f6;">' + (paid56m || '-') + '</div></div>';
            html += '</div>';

            if (distressBL || distress6m) {
                html += '<div style="font-size:0.75rem;padding:6px 12px;background:#f8fafc;border-radius:8px;line-height:1.7;">';
                html += '<strong>ระดับ Distress:</strong> BL=' + this._distressLabel(distressBL) + ' | 6m=' + this._distressLabel(distress6m);
                if (dtxAvg && dtxAvg > 180 && (distressBL === 'high' || distress6m === 'high')) {
                    html += '<br><span style="color:#ef4444;">⚠️ DTX สูง + ความเครียดสูง → ควรให้ความช่วยเหลือเพิ่มเติม</span>';
                }
                html += '</div>';
            }
            info.innerHTML = html;
        }

        this.charts.vsPaid5 = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['DTX เฉลี่ย', 'PAID-5 BL', 'PAID-5 6m'],
                datasets: [{
                    label: 'คะแนน',
                    data: [dtxAvg ? (dtxAvg / 3).toFixed(1) : null, paid5BL, paid56m],
                    backgroundColor: ['rgba(42,134,255,0.7)', 'rgba(236,72,153,0.7)', 'rgba(59,130,246,0.7)'],
                    borderColor: ['#2A86FF', '#ec4899', '#3b82f6'],
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
                                const idx = ctx.dataIndex;
                                if (idx === 0) return 'DTX เฉลี่ย: ' + (dtxAvg || '-') + ' mg/dL';
                                if (idx === 1) return 'PAID-5 BL: ' + (paid5BL || '-') + '/100';
                                return 'PAID-5 6m: ' + (paid56m || '-') + '/100';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, max: 100, title: { display: true, text: 'คะแนน (scaled)', font: { family: 'Athiti' } } }
                }
            }
        });
    },

    // =====================
    // DTX vs Health Literacy
    // =====================

    renderDTXvsHL(data) {
        const canvas = document.getElementById('chart-dtx-vs-hl');
        const info = document.getElementById('dtx-vs-hl-info');
        if (!canvas) return;

        if (this.charts.vsHL) { this.charts.vsHL.destroy(); this.charts.vsHL = null; }

        const dtxAvg = data.dtx.dtx_avg ? parseFloat(data.dtx.dtx_avg) : null;
        const hlBL = data.healthLiteracy.total_baseline ? parseFloat(data.healthLiteracy.total_baseline) : null;
        const hl6m = data.healthLiteracy.total_6month ? parseFloat(data.healthLiteracy.total_6month) : null;

        if (info) {
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">';
            html += '<div style="padding:8px;background:#f0f9ff;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">DTX เฉลี่ย</div><div style="font-size:1rem;font-weight:700;color:#2A86FF;">' + (dtxAvg || '-') + '</div></div>';
            html += '<div style="padding:8px;background:#ecfdf5;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">HL BL</div><div style="font-size:1rem;font-weight:700;color:#059669;">' + (hlBL || '-') + '/50</div></div>';
            html += '<div style="padding:8px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">HL 6m</div><div style="font-size:1rem;font-weight:700;color:#16a34a;">' + (hl6m || '-') + '/50</div></div>';
            html += '</div>';

            if (hlBL && hl6m && dtxAvg) {
                html += '<div style="font-size:0.75rem;padding:6px 12px;background:#f8fafc;border-radius:8px;line-height:1.7;">';
                html += '<strong>การแปลผล:</strong> ';
                if (hl6m > hlBL) {
                    html += '<span style="color:#22c55e;">ความรอบรู้สุขภาพเพิ่มขึ้น (+' + (hl6m - hlBL) + ')</span>';
                } else if (hl6m < hlBL) {
                    html += '<span style="color:#ef4444;">ความรอบรู้สุขภาพลดลง (' + (hl6m - hlBL) + ')</span>';
                } else {
                    html += 'ความรอบรู้สุขภาพคงที่';
                }
                if (dtxAvg <= 130) {
                    html += ' | DTX อยู่ในเกณฑ์ดี';
                } else {
                    html += ' | DTX สูงกว่าเป้าหมาย';
                }
                html += '</div>';
            }
            info.innerHTML = html;
        }

        this.charts.vsHL = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['HL Baseline', 'HL 6 เดือน'],
                datasets: [{
                    label: 'Health Literacy',
                    data: [hlBL, hl6m],
                    backgroundColor: ['rgba(5,150,105,0.7)', 'rgba(22,163,74,0.7)'],
                    borderColor: ['#059669', '#16a34a'],
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: dtxAvg !== null,
                        text: 'DTX เฉลี่ย: ' + (dtxAvg || '-') + ' mg/dL',
                        font: { family: 'Athiti', size: 13 },
                        color: '#2A86FF'
                    }
                },
                scales: {
                    y: { beginAtZero: true, max: 50, title: { display: true, text: 'คะแนน (10-50)', font: { family: 'Athiti' } } }
                }
            }
        });
    },

    // =====================
    // DTX vs BMI & BW
    // =====================

    renderDTXvsBMI(data) {
        const canvas = document.getElementById('chart-dtx-vs-bmi');
        const info = document.getElementById('dtx-vs-bmi-info');
        if (!canvas) return;

        if (this.charts.vsBMI) { this.charts.vsBMI.destroy(); this.charts.vsBMI = null; }

        const dtxAvg = data.dtx.dtx_avg ? parseFloat(data.dtx.dtx_avg) : null;
        const bmi = data.patient.bmi ? parseFloat(data.patient.bmi) : null;
        const weight = data.patient.weight ? parseFloat(data.patient.weight) : null;
        const height = data.patient.height ? parseFloat(data.patient.height) : null;

        if (info) {
            let html = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px;">';
            html += '<div style="padding:8px;background:#f0f9ff;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">DTX เฉลี่ย</div><div style="font-size:1rem;font-weight:700;color:#2A86FF;">' + (dtxAvg || '-') + '</div></div>';
            html += '<div style="padding:8px;background:#faf5ff;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">BMI</div><div style="font-size:1rem;font-weight:700;color:#8b5cf6;">' + (bmi || '-') + '</div></div>';
            html += '<div style="padding:8px;background:#fff7ed;border-radius:8px;text-align:center;"><div style="font-size:0.65rem;color:#64748b;">น้ำหนัก</div><div style="font-size:1rem;font-weight:700;color:#f97316;">' + (weight || '-') + ' kg</div></div>';
            html += '</div>';

            if (bmi && dtxAvg) {
                html += '<div style="font-size:0.75rem;padding:6px 12px;background:#f8fafc;border-radius:8px;line-height:1.7;">';
                html += '<strong>การแปลผล:</strong> BMI ' + bmi + ' = ' + this._bmiLabel(bmi);
                if (bmi >= 25 && dtxAvg > 130) {
                    html += '<br><span style="color:#ef4444;">⚠️ BMI สูง + DTX สูง → ควรควบคุมน้ำหนักและอาหาร</span>';
                } else if (bmi < 23 && dtxAvg <= 130) {
                    html += '<br><span style="color:#22c55e;">✓ BMI ปกติ + DTX ดี → สุขภาพดี</span>';
                }
                html += '</div>';
            }
            info.innerHTML = html;
        }

        this.charts.vsBMI = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: ['DTX เฉลี่ย (mg/dL)', 'BMI (kg/m²)', 'น้ำหนัก (kg)'],
                datasets: [{
                    label: 'ค่า',
                    data: [dtxAvg, bmi, weight],
                    backgroundColor: ['rgba(42,134,255,0.7)', 'rgba(139,92,246,0.7)', 'rgba(249,115,22,0.7)'],
                    borderColor: ['#2A86FF', '#8b5cf6', '#f97316'],
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
                                const idx = ctx.dataIndex;
                                if (idx === 0) return 'DTX เฉลี่ย: ' + (dtxAvg || '-') + ' mg/dL';
                                if (idx === 1) return 'BMI: ' + (bmi || '-') + ' kg/m²';
                                return 'น้ำหนัก: ' + (weight || '-') + ' kg';
                            }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'ค่า', font: { family: 'Athiti' } } }
                }
            }
        });
    },

    // =====================
    // Utility
    // =====================

    _distressLabel(level) {
        if (level === 'high') return '<span style="color:#ef4444;font-weight:600;">สูง</span>';
        if (level === 'low') return '<span style="color:#22c55e;font-weight:600;">ต่ำ</span>';
        return '<span style="color:#94a3b8;">-</span>';
    },

    _bmiLabel(bmi) {
        if (bmi < 18.5) return '<span style="color:#3b82f6;">น้ำหนักน้อย</span>';
        if (bmi < 23) return '<span style="color:#22c55e;">ปกติ</span>';
        if (bmi < 25) return '<span style="color:#f59e0b;">น้ำหนักเกิน</span>';
        if (bmi < 30) return '<span style="color:#f97316;">อ้วนระดับ 1</span>';
        return '<span style="color:#ef4444;">อ้วนระดับ 2</span>';
    }
};

// Expose globally
window.DiabetesDTX = DiabetesDTX;
