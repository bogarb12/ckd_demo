// Individual Patient Tab
class IndividualTab {
    constructor(patients) {
        this.patients = patients;
        this.filteredPatients = [...patients];
        this.currentPage = 1;
        this.pageSize = 50;
        this.sortColumn = 'patient_id';
        this.sortDirection = 'asc';
        this.selectedPatientId = null;
        this.init();
    }

    init() {
        document.getElementById('patient-search').addEventListener('input', () => this.applyFilters());
        document.getElementById('filter-stage').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-progression').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-gender').addEventListener('change', () => this.applyFilters());
        document.getElementById('filter-comorbidity').addEventListener('change', () => this.applyFilters());

        document.querySelectorAll('.patient-table th.sortable').forEach(th => {
            th.addEventListener('click', () => this.sortBy(th.dataset.sort));
        });
    }

    render() {
        this.applyFilters();
    }

    applyFilters() {
        const search = document.getElementById('patient-search').value.trim().toUpperCase();
        const stage = document.getElementById('filter-stage').value;
        const progression = document.getElementById('filter-progression').value;
        const gender = document.getElementById('filter-gender').value;
        const comorbidity = document.getElementById('filter-comorbidity').value;

        this.filteredPatients = this.patients.filter(pt => {
            if (search && !pt.patient_id.toUpperCase().includes(search)) return false;

            if (stage) {
                const egfr = CKDDataGenerator.getEffectiveEgfr(pt);
                const ptStage = CKDDataGenerator.getCKDStage(egfr);
                const stageMap = { '1': 'Stage 1', '2': 'Stage 2', '3a': 'Stage 3a', '3b': 'Stage 3b', '4': 'Stage 4', '5': 'Stage 5' };
                if (ptStage !== stageMap[stage]) return false;
            }

            if (progression !== '' && pt.ckd_progression_1yr !== parseInt(progression)) return false;
            if (gender && pt.gender !== gender) return false;

            if (comorbidity === 'diabetes' && pt.has_diabetes !== 1) return false;
            if (comorbidity === 'hypertension' && pt.has_hypertension !== 1) return false;
            if (comorbidity === 'cvd' && pt.has_cvd !== 1) return false;

            return true;
        });

        this.sortPatients();
        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
        document.getElementById('filter-count').textContent = this.filteredPatients.length.toLocaleString();
    }

    sortBy(column) {
        document.querySelectorAll('.patient-table th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        const th = document.querySelector(`.patient-table th[data-sort="${column}"]`);
        if (th) th.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');

        this.sortPatients();
        this.renderTable();
    }

    sortPatients() {
        const col = this.sortColumn;
        const dir = this.sortDirection === 'asc' ? 1 : -1;
        this.filteredPatients.sort((a, b) => {
            let va = a[col];
            let vb = b[col];
            if (col === 'egfr') {
                va = CKDDataGenerator.getEffectiveEgfr(a);
                vb = CKDDataGenerator.getEffectiveEgfr(b);
            }
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'string') return va.localeCompare(vb) * dir;
            return (va - vb) * dir;
        });
    }

    renderTable() {
        const tbody = document.getElementById('patient-table-body');
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const page = this.filteredPatients.slice(start, end);

        tbody.innerHTML = page.map(pt => {
            const egfr = CKDDataGenerator.getEffectiveEgfr(pt);
            const stage = CKDDataGenerator.getCKDStage(egfr);
            const stageClass = stage.replace(' ', '').replace('.', '').toLowerCase();
            const isSelected = pt.patient_id === this.selectedPatientId;

            return `<tr class="${isSelected ? 'selected' : ''}" data-id="${pt.patient_id}">
                <td><strong>${pt.patient_id}</strong></td>
                <td>${pt.age != null && pt.age <= 120 ? pt.age : '<span class="badge badge-neutral">N/A</span>'}</td>
                <td>${pt.gender === 'M' ? 'ชาย' : pt.gender === 'F' ? 'หญิง' : '-'}</td>
                <td>${egfr != null ? egfr.toFixed(1) : '-'}</td>
                <td><span class="badge badge-${stageClass}">${stage}</span></td>
                <td>${pt.ckd_progression_1yr === 1
                    ? '<span class="badge badge-danger">Progression</span>'
                    : pt.ckd_progression_1yr === 0
                        ? '<span class="badge badge-success">Stable</span>'
                        : '<span class="badge badge-neutral">N/A</span>'}</td>
            </tr>`;
        }).join('');

        tbody.querySelectorAll('tr').forEach(tr => {
            tr.addEventListener('click', () => {
                const id = tr.dataset.id;
                this.selectPatient(id);
            });
        });
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredPatients.length / this.pageSize);
        const container = document.getElementById('pagination');

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<button ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">&laquo;</button>`;

        const maxVisible = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (startPage > 1) html += `<button data-page="1">1</button><span>...</span>`;

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }

        if (endPage < totalPages) html += `<span>...</span><button data-page="${totalPages}">${totalPages}</button>`;

        html += `<button ${this.currentPage === totalPages ? 'disabled' : ''} data-page="${this.currentPage + 1}">&raquo;</button>`;

        container.innerHTML = html;
        container.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                this.currentPage = parseInt(btn.dataset.page);
                this.renderTable();
                this.renderPagination();
            });
        });
    }

    selectPatient(patientId) {
        this.selectedPatientId = patientId;
        const patient = this.patients.find(pt => pt.patient_id === patientId);
        if (!patient) return;

        // Update table selection
        document.querySelectorAll('.patient-table tbody tr').forEach(tr => {
            tr.classList.toggle('selected', tr.dataset.id === patientId);
        });

        this.renderPatientDetail(patient);
    }

    renderPatientDetail(pt) {
        const panel = document.getElementById('patient-detail');
        const egfr = CKDDataGenerator.getEffectiveEgfr(pt);
        const stage = CKDDataGenerator.getCKDStage(egfr);
        const stageColor = CKDDataGenerator.getCKDStageColor(stage);
        const creatinineMgDl = CKDDataGenerator.normalizeCreatinine(pt.creatinine, pt.creatinine_unit);

        // Risk score calculation
        let riskScore = 0;
        const riskItems = [];
        if (pt.has_diabetes === 1) { riskScore += 2; riskItems.push('เบาหวาน'); }
        if (pt.has_hypertension === 1) { riskScore += 1; riskItems.push('ความดันสูง'); }
        if (pt.has_cvd === 1) { riskScore += 2; riskItems.push('โรคหัวใจ'); }
        if (egfr != null && egfr < 30) { riskScore += 3; riskItems.push('eGFR < 30'); }
        else if (egfr != null && egfr < 60) { riskScore += 2; riskItems.push('eGFR < 60'); }
        if (pt.urine_protein === '2+' || pt.urine_protein === '3+') { riskScore += 2; riskItems.push('Proteinuria ' + pt.urine_protein); }
        if (pt.age > 70 && pt.age <= 120) { riskScore += 1; riskItems.push('อายุ > 70'); }

        const riskLevel = riskScore >= 6 ? 'high' : riskScore >= 3 ? 'medium' : 'low';
        const riskLevelText = riskScore >= 6 ? 'ความเสี่ยงสูง' : riskScore >= 3 ? 'ความเสี่ยงปานกลาง' : 'ความเสี่ยงต่ำ';

        // Stage description
        const stageDescMap = {
            'Stage 1': 'ไตทำงานปกติ แต่มีความผิดปกติ',
            'Stage 2': 'ไตเสื่อมเล็กน้อย',
            'Stage 3a': 'ไตเสื่อมระดับเบา-ปานกลาง',
            'Stage 3b': 'ไตเสื่อมระดับปานกลาง-รุนแรง',
            'Stage 4': 'ไตเสื่อมรุนแรง',
            'Stage 5': 'ไตวายระยะสุดท้าย',
            'ไม่ทราบ': 'ไม่มีข้อมูล eGFR'
        };

        const formatValue = (val, unit) => val != null ? val + (unit ? ' ' + unit : '') : '<span class="missing">ไม่มีข้อมูล</span>';

        const getLabClass = (val, low, high) => {
            if (val == null) return 'missing';
            if (val < low || val > high) return 'danger';
            return 'normal';
        };

        // Radar chart metric status helpers
        const getEgfrStatus = (v) => v == null ? 'missing' : v >= 90 ? 'normal' : v >= 60 ? 'warning' : 'danger';
        const getCrStatus = (v) => v == null ? 'missing' : v <= 1.3 ? 'normal' : v <= 2.0 ? 'warning' : 'danger';
        const getHba1cStatus = (v) => v == null ? 'missing' : v < 5.7 ? 'normal' : v < 6.5 ? 'warning' : 'danger';
        const getSbpStatus = (v) => v == null ? 'missing' : v < 130 ? 'normal' : v < 140 ? 'warning' : 'danger';
        const getDbpStatus = (v) => v == null ? 'missing' : v < 80 ? 'normal' : v < 90 ? 'warning' : 'danger';
        const getBmiStatus = (v) => v == null ? 'missing' : (v >= 18.5 && v <= 24.9) ? 'normal' : (v >= 25 && v < 30) ? 'warning' : 'danger';

        const radarCrMgDl = creatinineMgDl != null ? creatinineMgDl : (pt.creatinine_unit === 'mg/dL' ? pt.creatinine : null);

        const statusDot = (status) => {
            const colors = { normal: '#22c55e', warning: '#f59e0b', danger: '#ef4444', missing: '#94a3b8' };
            const labels = { normal: 'ปกติ', warning: 'เฝ้าระวัง', danger: 'ผิดปกติ', missing: 'ไม่มีข้อมูล' };
            return `<span class="radar-status-dot" style="background:${colors[status]}"></span><span class="radar-status-text" style="color:${colors[status]}">${labels[status]}</span>`;
        };

        panel.innerHTML = `
            <div class="detail-header">
                <div class="detail-header-top">
                    <span class="detail-patient-id">${pt.patient_id}</span>
                    <span class="detail-progression-badge ${pt.ckd_progression_1yr === 1 ? 'positive' : 'negative'}">
                        ${pt.ckd_progression_1yr === 1 ? 'CKD Progression' : pt.ckd_progression_1yr === 0 ? 'Stable' : 'N/A'}
                    </span>
                </div>
                <div class="detail-demographics">
                    <span>${pt.age != null && pt.age <= 120 ? pt.age + ' ปี' : 'อายุไม่ทราบ'}</span>
                    <span>${pt.gender === 'M' ? 'ชาย' : pt.gender === 'F' ? 'หญิง' : '-'}</span>
                    <span>Index: ${pt.index_date || 'N/A'}</span>
                </div>
            </div>
            <div class="detail-body">
                <!-- CKD Stage -->
                <div class="ckd-stage-indicator">
                    <div class="stage-circle" style="background: ${stageColor}">
                        <span class="stage-num">${stage.replace('Stage ', '')}</span>
                        <span class="stage-label">Stage</span>
                    </div>
                    <div class="stage-info">
                        <div>
                            <span class="egfr-value">${egfr != null ? egfr.toFixed(1) : 'N/A'}</span>
                            <span class="egfr-unit">mL/min/1.73m²</span>
                        </div>
                        <div class="stage-desc">${stageDescMap[stage] || ''}</div>
                    </div>
                </div>

                <!-- Spider/Radar Chart Card -->
                <div class="detail-section">
                    <div class="detail-section-title">Health Profile (Spider Chart)</div>
                    <div class="radar-chart-card">
                        <div class="radar-chart-wrapper">
                            <canvas id="patient-radar-chart"></canvas>
                        </div>
                        <div class="radar-legend-grid">
                            <div class="radar-legend-item">
                                <div class="radar-legend-header">
                                    ${statusDot(getEgfrStatus(egfr))}
                                </div>
                                <div class="radar-legend-label">eGFR</div>
                                <div class="radar-legend-value">${egfr != null ? egfr.toFixed(1) : 'N/A'} <small>mL/min</small></div>
                                <div class="radar-legend-ref">ปกติ: &gt; 90</div>
                            </div>
                            <div class="radar-legend-item">
                                <div class="radar-legend-header">
                                    ${statusDot(getCrStatus(radarCrMgDl))}
                                </div>
                                <div class="radar-legend-label">Creatinine</div>
                                <div class="radar-legend-value">${radarCrMgDl != null ? radarCrMgDl.toFixed(2) : 'N/A'} <small>mg/dL</small></div>
                                <div class="radar-legend-ref">ปกติ: 0.7-1.3</div>
                            </div>
                            <div class="radar-legend-item">
                                <div class="radar-legend-header">
                                    ${statusDot(getHba1cStatus(pt.hba1c_percent))}
                                </div>
                                <div class="radar-legend-label">HbA1c</div>
                                <div class="radar-legend-value">${pt.hba1c_percent != null ? pt.hba1c_percent + '%' : 'N/A'}</div>
                                <div class="radar-legend-ref">ปกติ: &lt; 5.7%</div>
                            </div>
                            <div class="radar-legend-item">
                                <div class="radar-legend-header">
                                    ${statusDot(getSbpStatus(pt.sbp))}
                                </div>
                                <div class="radar-legend-label">SBP</div>
                                <div class="radar-legend-value">${pt.sbp != null ? pt.sbp : 'N/A'} <small>mmHg</small></div>
                                <div class="radar-legend-ref">ปกติ: &lt; 130</div>
                            </div>
                            <div class="radar-legend-item">
                                <div class="radar-legend-header">
                                    ${statusDot(getDbpStatus(pt.dbp))}
                                </div>
                                <div class="radar-legend-label">DBP</div>
                                <div class="radar-legend-value">${pt.dbp != null ? pt.dbp : 'N/A'} <small>mmHg</small></div>
                                <div class="radar-legend-ref">ปกติ: &lt; 80</div>
                            </div>
                            <div class="radar-legend-item">
                                <div class="radar-legend-header">
                                    ${statusDot(getBmiStatus(pt.bmi))}
                                </div>
                                <div class="radar-legend-label">BMI</div>
                                <div class="radar-legend-value">${pt.bmi != null ? pt.bmi.toFixed(1) : 'N/A'} <small>kg/m²</small></div>
                                <div class="radar-legend-ref">ปกติ: 18.5-24.9</div>
                            </div>
                        </div>
                        <div class="radar-description">
                            <div class="radar-desc-title">คำอธิบาย Spider Chart</div>
                            <p>แผนภูมิแสดง<strong>ระดับความผิดปกติ</strong>ของค่าตรวจ 6 รายการ โดยพื้นที่ <span style="color:#22c55e;font-weight:600;">สีเขียว</span> คือช่วงค่าปกติ ยิ่งค่าผู้ป่วยยื่นออกนอกขอบเขตปกติมากเท่าไร ยิ่งบ่งบอกถึงความเสี่ยงที่สูงขึ้น</p>
                            <ul class="radar-desc-list">
                                <li><strong>eGFR</strong> — อัตราการกรองของไต (ยิ่งสูงยิ่งดี)</li>
                                <li><strong>Creatinine</strong> — ค่าครีเอตินินในเลือด (ยิ่งต่ำยิ่งดี)</li>
                                <li><strong>HbA1c</strong> — น้ำตาลสะสม 3 เดือน (ยิ่งต่ำยิ่งดี)</li>
                                <li><strong>SBP</strong> — ความดันโลหิตตัวบน (ยิ่งต่ำยิ่งดี)</li>
                                <li><strong>DBP</strong> — ความดันโลหิตตัวล่าง (ยิ่งต่ำยิ่งดี)</li>
                                <li><strong>BMI</strong> — ดัชนีมวลกาย (ค่ากลางดีที่สุด)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Risk Assessment -->
                <div class="detail-section">
                    <div class="detail-section-title">การประเมินความเสี่ยง</div>
                    <div class="risk-assessment ${riskLevel}">
                        <div class="risk-score-circle">${riskScore}</div>
                        <div class="risk-detail">
                            <div class="risk-level">${riskLevelText}</div>
                            <div class="risk-factors-list">${riskItems.length > 0 ? riskItems.join(', ') : 'ไม่มีปัจจัยเสี่ยงหลัก'}</div>
                        </div>
                    </div>
                </div>

                <!-- Vital Signs -->
                <div class="detail-section">
                    <div class="detail-section-title">สัญญาณชีพ</div>
                    <div class="detail-grid-3">
                        <div class="detail-item">
                            <div class="detail-item-label">SBP</div>
                            <div class="detail-item-value ${pt.sbp != null && pt.sbp <= 250 ? (pt.sbp >= 140 ? 'danger' : pt.sbp >= 130 ? 'warning' : 'normal') : 'missing'}">${pt.sbp != null && pt.sbp <= 250 ? pt.sbp + ' mmHg' : 'ไม่มีข้อมูล'}</div>
                            <div class="detail-item-ref">ปกติ: < 120 mmHg</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">DBP</div>
                            <div class="detail-item-value ${pt.dbp != null && pt.dbp <= 150 ? (pt.dbp >= 90 ? 'danger' : pt.dbp >= 80 ? 'warning' : 'normal') : 'missing'}">${pt.dbp != null && pt.dbp <= 150 ? pt.dbp + ' mmHg' : 'ไม่มีข้อมูล'}</div>
                            <div class="detail-item-ref">ปกติ: < 80 mmHg</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">BMI</div>
                            <div class="detail-item-value ${pt.bmi != null && pt.bmi < 50 ? (pt.bmi >= 30 ? 'danger' : pt.bmi >= 25 ? 'warning' : 'normal') : 'missing'}">${pt.bmi != null && pt.bmi < 50 ? pt.bmi.toFixed(1) + ' kg/m²' : 'ไม่มีข้อมูล'}</div>
                            <div class="detail-item-ref">ปกติ: 18.5-24.9</div>
                        </div>
                    </div>
                </div>

                <!-- Lab Results -->
                <div class="detail-section">
                    <div class="detail-section-title">ผลตรวจทางห้องปฏิบัติการ</div>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-item-label">Creatinine</div>
                            <div class="detail-item-value">${pt.creatinine != null ? pt.creatinine + ' ' + pt.creatinine_unit : '<span class="missing">ไม่มีข้อมูล</span>'}</div>
                            ${creatinineMgDl != null && pt.creatinine_unit === 'mmol/L' ? `<div class="detail-item-ref">= ${creatinineMgDl} mg/dL (แปลงหน่วย)</div>` : '<div class="detail-item-ref">ปกติ: 0.7-1.3 mg/dL</div>'}
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">eGFR</div>
                            <div class="detail-item-value ${egfr != null ? (egfr < 30 ? 'danger' : egfr < 60 ? 'warning' : 'normal') : 'missing'}">${egfr != null ? egfr.toFixed(1) + ' mL/min' : 'ไม่มีข้อมูล'}</div>
                            <div class="detail-item-ref">ปกติ: > 90</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">FBS</div>
                            <div class="detail-item-value ${pt.fbs_mg_dl != null ? (pt.fbs_mg_dl >= 126 ? 'danger' : pt.fbs_mg_dl >= 100 ? 'warning' : 'normal') : 'missing'}">${pt.fbs_mg_dl != null ? pt.fbs_mg_dl + ' mg/dL' : 'ไม่มีข้อมูล'}</div>
                            <div class="detail-item-ref">ปกติ: 70-100 mg/dL</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">HbA1c</div>
                            <div class="detail-item-value ${pt.hba1c_percent != null ? (pt.hba1c_percent >= 6.5 ? 'danger' : pt.hba1c_percent >= 5.7 ? 'warning' : 'normal') : 'missing'}">${pt.hba1c_percent != null ? pt.hba1c_percent + '%' : 'ไม่มีข้อมูล'}</div>
                            <div class="detail-item-ref">ปกติ: < 5.7%</div>
                        </div>
                    </div>
                </div>

                <!-- Urine Protein -->
                <div class="detail-section">
                    <div class="detail-section-title">โปรตีนในปัสสาวะ</div>
                    <div class="detail-item">
                        <div class="detail-item-value ${pt.urine_protein ? (pt.urine_protein === '2+' || pt.urine_protein === '3+' ? 'danger' : pt.urine_protein === '1+' ? 'warning' : 'normal') : 'missing'}">
                            ${pt.urine_protein || 'ไม่ได้ตรวจ'}
                        </div>
                    </div>
                </div>

                <!-- Comorbidities -->
                <div class="detail-section">
                    <div class="detail-section-title">โรคร่วม</div>
                    <div class="comorbidity-badges">
                        <span class="comorbidity-badge ${pt.has_diabetes === 1 ? 'active' : 'inactive'}">
                            ${pt.has_diabetes === 1 ? '&#10003;' : '&#10007;'} เบาหวาน
                        </span>
                        <span class="comorbidity-badge ${pt.has_hypertension === 1 ? 'active' : 'inactive'}">
                            ${pt.has_hypertension === 1 ? '&#10003;' : '&#10007;'} ความดันสูง
                        </span>
                        <span class="comorbidity-badge ${pt.has_cvd === 1 ? 'active' : 'inactive'}">
                            ${pt.has_cvd === 1 ? '&#10003;' : '&#10007;'} โรคหัวใจ
                        </span>
                    </div>
                </div>

                <!-- Medications -->
                <div class="detail-section">
                    <div class="detail-section-title">ยาที่ได้รับ</div>
                    <div class="comorbidity-badges">
                        <span class="comorbidity-badge ${pt.ace_inhibitor === 1 ? 'active' : 'inactive'}">
                            ${pt.ace_inhibitor === 1 ? '&#10003;' : '&#10007;'} ACE Inhibitor
                        </span>
                        <span class="comorbidity-badge ${pt.arbs === 1 ? 'active' : 'inactive'}">
                            ${pt.arbs === 1 ? '&#10003;' : '&#10007;'} ARBs
                        </span>
                    </div>
                </div>

                <!-- Visit & Dates -->
                <div class="detail-section">
                    <div class="detail-section-title">ข้อมูลการติดตาม</div>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <div class="detail-item-label">จำนวนครั้งที่มา (1 ปี)</div>
                            <div class="detail-item-value">${pt.visit_count_1yr != null ? pt.visit_count_1yr + ' ครั้ง' : 'ไม่มีข้อมูล'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">วันที่ตรวจแล็บ</div>
                            <div class="detail-item-value" style="font-size: 0.9rem">${pt.lab_date || 'ไม่ทราบ'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">วันประเมิน Outcome</div>
                            <div class="detail-item-value" style="font-size: 0.9rem">${pt.outcome_date || 'ไม่ทราบ'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-item-label">หน่วย Creatinine</div>
                            <div class="detail-item-value" style="font-size: 0.9rem">${pt.creatinine_unit || 'ไม่ทราบ'}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render radar chart after DOM is updated
        this.renderRadarChart(pt, egfr, radarCrMgDl);
    }

    renderRadarChart(pt, egfr, creatinineMgDl) {
        // Destroy previous chart instance
        if (this.radarChart) {
            this.radarChart.destroy();
            this.radarChart = null;
        }

        const canvas = document.getElementById('patient-radar-chart');
        if (!canvas) return;

        // Normalize values to 0-100 "concern" scale
        // Higher score = more abnormal / more concerning
        const normalize = (value, normalLow, normalHigh, maxBad, invert) => {
            if (value == null) return 0;
            if (invert) {
                // For eGFR: higher is better, lower is worse
                if (value >= normalHigh) return 0;
                return Math.min(100, Math.max(0, ((normalHigh - value) / (normalHigh - maxBad)) * 100));
            } else {
                // For most metrics: lower is better, higher is worse
                if (value <= normalLow) return 0;
                return Math.min(100, Math.max(0, ((value - normalLow) / (maxBad - normalLow)) * 100));
            }
        };

        // BMI special: deviation from center of normal (22) in either direction
        const normalizeBmi = (value) => {
            if (value == null) return 0;
            const center = 22;
            const maxDev = 18; // max deviation (22 ± 18 = 4 to 40)
            const dev = Math.abs(value - center);
            return Math.min(100, (dev / maxDev) * 100);
        };

        const patientScores = [
            normalize(egfr, 0, 90, 0, true),                    // eGFR (inverted - high is good)
            normalize(creatinineMgDl, 0, 1.3, 5.0, false),      // Creatinine
            normalize(pt.hba1c_percent, 0, 5.7, 12.0, false),   // HbA1c
            normalize(pt.sbp, 0, 130, 200, false),               // SBP
            normalize(pt.dbp, 0, 80, 120, false),                // DBP
            normalizeBmi(pt.bmi)                                  // BMI
        ];

        // Normal zone boundary (the "safe" threshold for each metric)
        const normalZone = [0, 0, 0, 0, 0, 0]; // All at 0 = perfectly normal

        // Warning zone (values start to be concerning)
        const warningZone = [
            normalize(60, 0, 90, 0, true),     // eGFR 60
            normalize(2.0, 0, 1.3, 5.0, false), // Creatinine 2.0
            normalize(6.5, 0, 5.7, 12.0, false), // HbA1c 6.5
            normalize(140, 0, 130, 200, false),  // SBP 140
            normalize(90, 0, 80, 120, false),    // DBP 90
            normalizeBmi(25)                      // BMI 25
        ];

        const labels = ['eGFR', 'Creatinine', 'HbA1c', 'SBP', 'DBP', 'BMI'];

        // Determine patient line color based on overall concern
        const avgScore = patientScores.reduce((a, b) => a + b, 0) / patientScores.length;
        let lineColor, bgColor;
        if (avgScore > 50) {
            lineColor = 'rgba(239, 68, 68, 1)';
            bgColor = 'rgba(239, 68, 68, 0.15)';
        } else if (avgScore > 25) {
            lineColor = 'rgba(245, 158, 11, 1)';
            bgColor = 'rgba(245, 158, 11, 0.15)';
        } else {
            lineColor = 'rgba(37, 99, 235, 1)';
            bgColor = 'rgba(37, 99, 235, 0.15)';
        }

        // Actual display values for tooltip
        const actualValues = [
            egfr != null ? egfr.toFixed(1) + ' mL/min' : 'N/A',
            creatinineMgDl != null ? creatinineMgDl.toFixed(2) + ' mg/dL' : 'N/A',
            pt.hba1c_percent != null ? pt.hba1c_percent + '%' : 'N/A',
            pt.sbp != null ? pt.sbp + ' mmHg' : 'N/A',
            pt.dbp != null ? pt.dbp + ' mmHg' : 'N/A',
            pt.bmi != null ? pt.bmi.toFixed(1) + ' kg/m²' : 'N/A'
        ];

        this.radarChart = new Chart(canvas, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'เกณฑ์เฝ้าระวัง',
                        data: warningZone,
                        backgroundColor: 'rgba(34, 197, 94, 0.08)',
                        borderColor: 'rgba(34, 197, 94, 0.4)',
                        borderWidth: 1.5,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: true
                    },
                    {
                        label: 'ค่าผู้ป่วย',
                        data: patientScores,
                        backgroundColor: bgColor,
                        borderColor: lineColor,
                        borderWidth: 2.5,
                        pointBackgroundColor: lineColor,
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 25,
                            display: false
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.06)',
                            lineWidth: 1
                        },
                        angleLines: {
                            color: 'rgba(0, 0, 0, 0.08)',
                            lineWidth: 1
                        },
                        pointLabels: {
                            font: {
                                family: 'Sarabun',
                                size: 12,
                                weight: '600'
                            },
                            color: '#334155'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'Sarabun', size: 11 },
                            padding: 16,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: 'Sarabun', size: 13, weight: '600' },
                        bodyFont: { family: 'Sarabun', size: 12 },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(ctx) {
                                if (ctx.datasetIndex === 1) {
                                    return `${ctx.label}: ${actualValues[ctx.dataIndex]} (ระดับความกังวล: ${Math.round(ctx.raw)}%)`;
                                }
                                return `เกณฑ์เฝ้าระวัง: ${Math.round(ctx.raw)}%`;
                            }
                        }
                    }
                },
                animation: {
                    duration: 600,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
}

window.IndividualTab = IndividualTab;
