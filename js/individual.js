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
    }
}

window.IndividualTab = IndividualTab;
