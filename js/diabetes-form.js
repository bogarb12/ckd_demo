// DiabetesForm - CRF (Case Report Form) 6-Step Wizard Handler
const DiabetesForm = {
    currentStep: 1,
    totalSteps: 6,
    formData: {},
    isExperimentalGroup: false,

    // =====================
    // Initialization
    // =====================

    init() {
        this.setupStepNavigation();
        this.setupConditionalFields();
        this.setupComorbidityLogic();
        this.setupScaleOptions();
        this.setupPAID5Calculation();
        this.setupHbA1cCalculation();
        this.setupBMICalculation();
        this.loadPatientList();
        this.goToStep(1);
    },

    // =====================
    // Step Wizard Navigation
    // =====================

    setupStepNavigation() {
        const nextBtn = document.getElementById('btn-next');
        const prevBtn = document.getElementById('btn-prev');
        const saveBtn = document.getElementById('btn-save-form');

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevStep());
        }
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveForm());
        }

        // Allow clicking step indicators to jump (only to completed or current steps)
        const stepIndicators = document.querySelectorAll('.step-indicator .step');
        stepIndicators.forEach((indicator, index) => {
            indicator.addEventListener('click', () => {
                const targetStep = index + 1;
                // Only allow jumping to completed steps or the current step
                if (targetStep < this.currentStep) {
                    this.goToStep(targetStep);
                } else if (targetStep === this.currentStep) {
                    // Already on this step, do nothing
                } else {
                    // Moving forward requires validation of current step
                    if (this.validateStep(this.currentStep)) {
                        this.goToStep(targetStep);
                    }
                }
            });
        });
    },

    goToStep(step) {
        // Clamp to valid range
        if (step < 1) step = 1;
        if (step > this.totalSteps) step = this.totalSteps;

        // If control group, skip step 4 (participation data)
        if (!this.isExperimentalGroup && step === 4) {
            step = this.currentStep < 4 ? 5 : 3;
        }

        // Hide all step content panels
        const allSteps = document.querySelectorAll('.step-content');
        allSteps.forEach(el => el.classList.remove('active'));

        // Show the target step
        const targetStep = document.querySelector(`.step-content[data-step="${step}"]`);
        if (targetStep) {
            targetStep.classList.add('active');
        }

        this.currentStep = step;
        this.updateStepIndicator();
        this.updateNavigationButtons();

        // Scroll to top of form area
        const formContainer = targetStep ? targetStep.closest('.crf-form') || targetStep.parentElement : null;
        if (formContainer) {
            formContainer.scrollTop = 0;
        }
    },

    nextStep() {
        if (!this.validateStep(this.currentStep)) {
            return;
        }

        let nextStep = this.currentStep + 1;

        // Skip step 4 for control group
        if (!this.isExperimentalGroup && nextStep === 4) {
            nextStep = 5;
        }

        if (nextStep <= this.totalSteps) {
            this.goToStep(nextStep);
        }
    },

    prevStep() {
        let prevStep = this.currentStep - 1;

        // Skip step 4 for control group
        if (!this.isExperimentalGroup && prevStep === 4) {
            prevStep = 3;
        }

        if (prevStep >= 1) {
            this.goToStep(prevStep);
        }
    },

    updateStepIndicator() {
        const indicators = document.querySelectorAll('.step-indicator .step');
        indicators.forEach((indicator, index) => {
            const stepNum = index + 1;
            indicator.classList.remove('active', 'completed', 'skipped');

            // Mark step 4 as skipped for control group
            if (stepNum === 4 && !this.isExperimentalGroup) {
                indicator.classList.add('skipped');
            }

            if (stepNum === this.currentStep) {
                indicator.classList.add('active');
            } else if (stepNum < this.currentStep) {
                indicator.classList.add('completed');
            }
        });
    },

    updateNavigationButtons() {
        const prevBtn = document.getElementById('btn-prev');
        const nextBtn = document.getElementById('btn-next');
        const saveBtn = document.getElementById('btn-save-form');

        const firstStep = 1;
        const lastStep = this.totalSteps;

        // Previous button: hide on first step
        if (prevBtn) {
            const effectivePrev = !this.isExperimentalGroup && (this.currentStep - 1) === 4
                ? 3
                : this.currentStep - 1;
            prevBtn.style.display = effectivePrev >= firstStep ? '' : 'none';
        }

        // Next button: hide on last step
        if (nextBtn) {
            const effectiveNext = !this.isExperimentalGroup && (this.currentStep + 1) === 4
                ? 5
                : this.currentStep + 1;
            nextBtn.style.display = effectiveNext <= lastStep ? '' : 'none';
        }

        // Save button: only show on last step
        if (saveBtn) {
            saveBtn.style.display = this.currentStep === lastStep ? '' : 'none';
        }
    },

    // =====================
    // Validation
    // =====================

    validateStep(step) {
        this.clearFieldErrors();

        switch (step) {
            case 1:
                return this.validateStep1();
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
                // Steps 2-6 have optional validation, always pass
                return true;
            default:
                return true;
        }
    },

    validateStep1() {
        let isValid = true;

        // Patient ID is required
        const patientIdEl = document.getElementById('f-patient-id');
        if (!patientIdEl || !patientIdEl.value.trim()) {
            this.showFieldError(patientIdEl, 'กรุณาระบุรหัสผู้ป่วย');
            isValid = false;
        }

        // Age is required
        const ageEl = document.getElementById('f-age');
        if (!ageEl || !ageEl.value || isNaN(parseInt(ageEl.value, 10))) {
            this.showFieldError(ageEl, 'กรุณาระบุอายุ');
            isValid = false;
        }

        if (!isValid) {
            this._showToast('กรุณากรอกข้อมูลที่จำเป็น', 'error');
        }

        return isValid;
    },

    showFieldError(element, message) {
        if (!element) return;

        // Find the closest form-group container
        const container = element.closest('.form-group') || element.parentElement;
        if (container) {
            container.classList.add('has-error');
        }
        element.classList.add('field-error');

        // Create error message element if not already present
        const existingError = container ? container.querySelector('.field-error-message') : null;
        if (!existingError && container) {
            const errorEl = document.createElement('div');
            errorEl.className = 'field-error-message';
            errorEl.textContent = message;
            errorEl.style.cssText = 'color:#dc3545;font-size:12px;margin-top:4px;';
            container.appendChild(errorEl);
        }
    },

    clearFieldErrors() {
        document.querySelectorAll('.field-error').forEach(el => {
            el.classList.remove('field-error');
        });
        document.querySelectorAll('.has-error').forEach(el => {
            el.classList.remove('has-error');
        });
        document.querySelectorAll('.field-error-message').forEach(el => {
            el.remove();
        });
    },

    // =====================
    // Conditional Field Visibility
    // =====================

    setupConditionalFields() {
        // Study group change -> show/hide Section 4 (participation)
        const studyGroupRadios = document.querySelectorAll('input[name="study_group"]');
        studyGroupRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.isExperimentalGroup = e.target.value === 'experimental';
                this.updateSection4Visibility();
                this.updateStepIndicator();
                this.updateNavigationButtons();
            });
        });

        // Adverse event radio -> show/hide adverse detail
        const adverseRadios = document.querySelectorAll('input[name="has_event"]');
        adverseRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateAdverseDetailVisibility(e.target.value === 'yes');
            });
        });

        // Follow-up status radio -> show/hide withdrawal detail
        const followUpRadios = document.querySelectorAll('input[name="follow_up_status"]');
        followUpRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateWithdrawalDetailVisibility(e.target.value === 'withdrawn');
            });
        });

        // Initialize all conditional visibility states
        this.updateSection4Visibility();
        this.updateAdverseDetailVisibility(false);
        this.updateWithdrawalDetailVisibility(false);
        this.updateComorbidityOtherVisibility();
    },

    updateSection4Visibility() {
        const sectionParticipation = document.getElementById('section-participation');
        if (sectionParticipation) {
            sectionParticipation.style.display = this.isExperimentalGroup ? '' : 'none';
        }

        // Also update the step 4 indicator visibility
        const stepIndicators = document.querySelectorAll('.step-indicator .step');
        if (stepIndicators.length >= 4) {
            const step4Indicator = stepIndicators[3]; // 0-indexed
            if (this.isExperimentalGroup) {
                step4Indicator.classList.remove('skipped');
                step4Indicator.style.display = '';
            } else {
                step4Indicator.classList.add('skipped');
                // Optionally dim it instead of hiding completely
            }
        }
    },

    updateAdverseDetailVisibility(showDetail) {
        const adverseDetail = document.getElementById('adverse-detail');
        if (adverseDetail) {
            adverseDetail.style.display = showDetail ? '' : 'none';
        }
    },

    updateWithdrawalDetailVisibility(showDetail) {
        const withdrawalDetail = document.getElementById('withdrawal-detail');
        if (withdrawalDetail) {
            withdrawalDetail.style.display = showDetail ? '' : 'none';
        }
    },

    updateComorbidityOtherVisibility() {
        const otherCheckbox = document.querySelector('input[name="comorbidities"][value="other"]');
        const otherInput = document.getElementById('f-comorbidity-other');
        const otherContainer = otherInput ? (otherInput.closest('.form-group') || otherInput.parentElement) : null;

        if (otherCheckbox && otherContainer) {
            if (otherCheckbox.checked) {
                otherContainer.style.display = '';
            } else {
                otherContainer.style.display = 'none';
                if (otherInput) otherInput.value = '';
            }
        }
    },

    // =====================
    // Comorbidity "none" Checkbox Logic
    // =====================

    setupComorbidityLogic() {
        const comorbidityCheckboxes = document.querySelectorAll('input[name="comorbidities"]');

        comorbidityCheckboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const changedValue = e.target.value;
                const isChecked = e.target.checked;

                if (changedValue === 'none' && isChecked) {
                    // "none" was checked: uncheck all other comorbidities
                    comorbidityCheckboxes.forEach(otherCb => {
                        if (otherCb.value !== 'none') {
                            otherCb.checked = false;
                        }
                    });
                } else if (changedValue !== 'none' && isChecked) {
                    // A specific comorbidity was checked: uncheck "none"
                    const noneCb = document.querySelector('input[name="comorbidities"][value="none"]');
                    if (noneCb) {
                        noneCb.checked = false;
                    }
                }

                // Update "other" text field visibility
                this.updateComorbidityOtherVisibility();
            });
        });
    },

    // =====================
    // Scale Options - Toggle selected class on labels
    // =====================

    setupScaleOptions() {
        document.querySelectorAll('.scale-options label').forEach(function(label) {
            label.addEventListener('click', function() {
                // Remove selected from sibling labels in the same group
                var parent = label.parentElement;
                if (parent) {
                    parent.querySelectorAll('label').forEach(function(sib) {
                        sib.classList.remove('selected');
                    });
                }
                label.classList.add('selected');
            });
        });
    },

    // =====================
    // PAID-5 Auto-Calculation
    // =====================

    setupPAID5Calculation() {
        // Listen to all PAID-5 radio inputs for both baseline and 6month
        for (let q = 1; q <= 5; q++) {
            const baselineRadios = document.querySelectorAll(`input[name="paid5_q${q}_baseline"]`);
            const sixMonthRadios = document.querySelectorAll(`input[name="paid5_q${q}_6month"]`);

            baselineRadios.forEach(radio => {
                radio.addEventListener('change', () => this.calculatePAID5());
            });
            sixMonthRadios.forEach(radio => {
                radio.addEventListener('change', () => this.calculatePAID5());
            });
        }
    },

    calculatePAID5() {
        let totalBaseline = 0;
        let totalBaselineCount = 0;
        let total6month = 0;
        let total6monthCount = 0;

        for (let q = 1; q <= 5; q++) {
            const bVal = this._getRadioNumericValue(`paid5_q${q}_baseline`);
            const mVal = this._getRadioNumericValue(`paid5_q${q}_6month`);

            if (bVal !== null) {
                totalBaseline += bVal;
                totalBaselineCount++;
            }
            if (mVal !== null) {
                total6month += mVal;
                total6monthCount++;
            }
        }

        // Update raw total displays
        const totalBaselineEl = document.getElementById('paid5-total-baseline');
        const total6monthEl = document.getElementById('paid5-total-6month');

        if (totalBaselineEl) {
            totalBaselineEl.textContent = totalBaselineCount === 5 ? totalBaseline : '-';
        }
        if (total6monthEl) {
            total6monthEl.textContent = total6monthCount === 5 ? total6month : '-';
        }

        // Converted scores (total x 5)
        const convertedBaseline = totalBaselineCount === 5 ? totalBaseline * 5 : null;
        const converted6month = total6monthCount === 5 ? total6month * 5 : null;

        const convertedBaselineEl = document.getElementById('paid5-converted-baseline');
        const converted6monthEl = document.getElementById('paid5-converted-6month');

        if (convertedBaselineEl) {
            convertedBaselineEl.textContent = convertedBaseline !== null ? convertedBaseline : '-';
        }
        if (converted6monthEl) {
            converted6monthEl.textContent = converted6month !== null ? converted6month : '-';
        }

        // Distress level: low (<40), high (>=40)
        const distressBaselineEl = document.getElementById('paid5-distress-baseline');
        const distress6monthEl = document.getElementById('paid5-distress-6month');

        if (distressBaselineEl) {
            if (convertedBaseline !== null) {
                const level = convertedBaseline < 40 ? 'low' : 'high';
                const label = level === 'low' ? 'ต่ำ (Low)' : 'สูง (High)';
                distressBaselineEl.textContent = label;
                distressBaselineEl.className = 'badge distress-badge distress-' + level;
            } else {
                distressBaselineEl.textContent = '-';
                distressBaselineEl.className = 'badge distress-badge';
            }
        }

        if (distress6monthEl) {
            if (converted6month !== null) {
                const level = converted6month < 40 ? 'low' : 'high';
                const label = level === 'low' ? 'ต่ำ (Low)' : 'สูง (High)';
                distress6monthEl.textContent = label;
                distress6monthEl.className = 'badge distress-badge distress-' + level;
            } else {
                distress6monthEl.textContent = '-';
                distress6monthEl.className = 'badge distress-badge';
            }
        }
    },

    // =====================
    // HbA1c Change Calculation
    // =====================

    setupHbA1cCalculation() {
        const baselineInput = document.getElementById('f-hba1c-baseline');
        const sixMonthInput = document.getElementById('f-hba1c-6month');

        const calculate = () => this.calculateHbA1cChange();

        if (baselineInput) {
            baselineInput.addEventListener('input', calculate);
        }
        if (sixMonthInput) {
            sixMonthInput.addEventListener('input', calculate);
        }
    },

    calculateHbA1cChange() {
        const baselineInput = document.getElementById('f-hba1c-baseline');
        const sixMonthInput = document.getElementById('f-hba1c-6month');
        const changeEl = document.getElementById('hba1c-change');

        if (!changeEl) return;

        const baseline = parseFloat(baselineInput ? baselineInput.value : '');
        const sixMonth = parseFloat(sixMonthInput ? sixMonthInput.value : '');

        if (!isNaN(baseline) && !isNaN(sixMonth)) {
            const change = parseFloat((sixMonth - baseline).toFixed(2));
            const sign = change > 0 ? '+' : '';
            changeEl.textContent = sign + change + '%';

            // Color coding: decrease = green (improved), increase = red (worsened)
            if (change < 0) {
                changeEl.style.color = '#28a745';
                changeEl.className = 'hba1c-change change-improved';
            } else if (change > 0) {
                changeEl.style.color = '#dc3545';
                changeEl.className = 'hba1c-change change-worsened';
            } else {
                changeEl.style.color = '#6c757d';
                changeEl.className = 'hba1c-change change-neutral';
            }
        } else {
            changeEl.textContent = '-';
            changeEl.style.color = '';
            changeEl.className = 'hba1c-change';
        }
    },

    // =====================
    // BMI Calculation
    // =====================

    setupBMICalculation() {
        const inputs = document.querySelectorAll('.bmi-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.calculateBMI());
        });
    },

    calculateBMI() {
        const heightCm = parseFloat(document.getElementById('f-height')?.value || '');
        const weightBL = parseFloat(document.getElementById('f-weight-baseline')?.value || '');
        const weight6m = parseFloat(document.getElementById('f-weight-6month')?.value || '');
        const heightM = heightCm / 100;

        this._updateBMIDisplay('bmi-baseline', weightBL, heightM);
        this._updateBMIDisplay('bmi-6month', weight6m, heightM);
    },

    _updateBMIDisplay(prefix, weight, heightM) {
        const display = document.getElementById(prefix + '-display');
        const valueEl = document.getElementById(prefix + '-value');
        const textEl = document.getElementById(prefix + '-text');
        if (!display || !valueEl) return;

        if (!isNaN(weight) && !isNaN(heightM) && heightM > 0) {
            const bmi = weight / (heightM * heightM);
            valueEl.textContent = bmi.toFixed(1);
            display.style.display = '';

            let label = '', color = '';
            if (bmi < 18.5) { label = 'น้ำหนักน้อย'; color = '#3b82f6'; }
            else if (bmi < 23) { label = 'ปกติ'; color = '#22c55e'; }
            else if (bmi < 25) { label = 'น้ำหนักเกิน'; color = '#f59e0b'; }
            else if (bmi < 30) { label = 'อ้วนระดับ 1'; color = '#f97316'; }
            else { label = 'อ้วนระดับ 2'; color = '#ef4444'; }

            if (textEl) { textEl.textContent = label; textEl.style.color = color; }
        } else {
            display.style.display = 'none';
        }
    },

    // =====================
    // Collect Form Data
    // =====================

    collectFormData() {
        const section1 = this.collectSection1();
        const section2 = this.collectSection2();
        const section3 = this.collectSection3();
        const section4 = this.collectSection4();
        const section5 = this.collectSection5();
        const section6 = this.collectSection6();

        this.formData = {
            ...section1,
            ...section2,
            ...section3,
            ...section4,
            ...section5,
            ...section6,
            _savedAt: new Date().toISOString()
        };

        return this.formData;
    },

    collectSection1() {
        const patientIdEl = document.getElementById('f-patient-id');
        const enrollmentDateEl = document.getElementById('f-enrollment-date');
        const ageEl = document.getElementById('f-age');
        const educationEl = document.getElementById('f-education');
        const occupationEl = document.getElementById('f-occupation');
        const diabetesDurationEl = document.getElementById('f-diabetes-duration');
        const comorbidityOtherEl = document.getElementById('f-comorbidity-other');

        const studyGroup = this._getRadioValue('study_group');
        const gender = this._getRadioValue('gender');
        const diabetesTreatment = this._getRadioValue('diabetes_treatment');
        const lineUsage = this._getRadioValue('line_usage');

        // Comorbidities: collect checked checkbox values
        const comorbidityEls = document.querySelectorAll('input[name="comorbidities"]:checked');
        const comorbidities = Array.from(comorbidityEls).map(el => el.value);

        return {
            patient_id: patientIdEl ? patientIdEl.value.trim() : '',
            enrollment_date: enrollmentDateEl ? enrollmentDateEl.value : '',
            study_group: studyGroup,
            gender: gender,
            age: ageEl ? (ageEl.value ? parseInt(ageEl.value, 10) : null) : null,
            education_level: educationEl ? educationEl.value : '',
            occupation: occupationEl ? occupationEl.value : '',
            diabetes_duration_years: diabetesDurationEl ? (diabetesDurationEl.value ? parseInt(diabetesDurationEl.value, 10) : null) : null,
            comorbidities: comorbidities,
            comorbidity_other: comorbidityOtherEl ? comorbidityOtherEl.value.trim() : '',
            diabetes_treatment: diabetesTreatment,
            line_usage: lineUsage
        };
    },

    collectSection2() {
        const _numVal = (id) => { const el = document.getElementById(id); return el && el.value ? parseFloat(el.value) : null; };

        const weightBL = _numVal('f-weight-baseline');
        const weight6m = _numVal('f-weight-6month');
        const heightCm = _numVal('f-height');
        const heightM = heightCm ? heightCm / 100 : null;

        const calcBMI = (w) => (w && heightM) ? parseFloat((w / (heightM * heightM)).toFixed(1)) : null;

        const hba1cBaseline = _numVal('f-hba1c-baseline');
        const hba1c6month = _numVal('f-hba1c-6month');
        let hba1cChange = null;
        if (hba1cBaseline !== null && hba1c6month !== null) {
            hba1cChange = parseFloat((hba1c6month - hba1cBaseline).toFixed(2));
        }

        return {
            weight_baseline: weightBL,
            weight_6month: weight6m,
            height: heightCm,
            bmi_baseline: calcBMI(weightBL),
            bmi_6month: calcBMI(weight6m),
            sbp_baseline: _numVal('f-sbp-baseline'),
            dbp_baseline: _numVal('f-dbp-baseline'),
            sbp_6month: _numVal('f-sbp-6month'),
            dbp_6month: _numVal('f-dbp-6month'),
            hba1c_baseline: hba1cBaseline,
            hba1c_6month: hba1c6month,
            hba1c_change: hba1cChange
        };
    },

    collectSection3() {
        const paid5 = {};

        for (let q = 1; q <= 5; q++) {
            paid5['q' + q + '_baseline'] = this._getRadioNumericValue('paid5_q' + q + '_baseline');
            paid5['q' + q + '_6month'] = this._getRadioNumericValue('paid5_q' + q + '_6month');
        }

        // Calculate totals
        let totalBaseline = 0;
        let totalBaselineValid = true;
        let total6month = 0;
        let total6monthValid = true;

        for (let q = 1; q <= 5; q++) {
            if (paid5['q' + q + '_baseline'] !== null) {
                totalBaseline += paid5['q' + q + '_baseline'];
            } else {
                totalBaselineValid = false;
            }
            if (paid5['q' + q + '_6month'] !== null) {
                total6month += paid5['q' + q + '_6month'];
            } else {
                total6monthValid = false;
            }
        }

        paid5.total_baseline = totalBaselineValid ? totalBaseline : null;
        paid5.total_6month = total6monthValid ? total6month : null;
        paid5.converted_baseline = paid5.total_baseline !== null ? paid5.total_baseline * 5 : null;
        paid5.converted_6month = paid5.total_6month !== null ? paid5.total_6month * 5 : null;
        paid5.distress_baseline = paid5.converted_baseline !== null
            ? (paid5.converted_baseline < 40 ? 'low' : 'high')
            : null;
        paid5.distress_6month = paid5.converted_6month !== null
            ? (paid5.converted_6month < 40 ? 'low' : 'high')
            : null;

        return { paid5: paid5 };
    },

    collectSection4() {
        // Only collect if experimental group
        if (!this.isExperimentalGroup) {
            return { participation: null };
        }

        const sessionsAttended = this._getRadioValue('sessions_attended');
        const lineEngagement = this._getRadioValue('line_engagement');
        const lineInteraction = this._getRadioValue('line_interaction');

        return {
            participation: {
                sessions_attended: sessionsAttended,
                line_engagement: lineEngagement,
                line_interaction: lineInteraction
            }
        };
    },

    collectSection5() {
        const hasEvent = this._getRadioValue('has_event');
        const descEl = document.getElementById('f-adverse-desc');
        const dateEl = document.getElementById('f-adverse-date');

        return {
            adverse: {
                has_event: hasEvent === 'yes',
                description: hasEvent === 'yes' && descEl ? descEl.value.trim() : '',
                event_date: hasEvent === 'yes' && dateEl ? dateEl.value : ''
            }
        };
    },

    collectSection6() {
        const status = this._getRadioValue('follow_up_status');
        const reasonEl = document.getElementById('f-withdrawal-reason');
        const endDateEl = document.getElementById('f-end-date');

        return {
            followUp: {
                status: status,
                withdrawal_reason: status === 'withdrawn' && reasonEl ? reasonEl.value.trim() : '',
                end_date: endDateEl ? endDateEl.value : ''
            }
        };
    },

    // =====================
    // Save Form
    // =====================

    async saveForm() {
        // Validate that step 1 required fields are filled
        const patientIdEl = document.getElementById('f-patient-id');
        const ageEl = document.getElementById('f-age');

        if (!patientIdEl || !patientIdEl.value.trim()) {
            this._showToast('กรุณากรอกรหัสผู้ป่วยก่อนบันทึก', 'error');
            this.goToStep(1);
            this.validateStep(1);
            return;
        }

        if (!ageEl || !ageEl.value) {
            this._showToast('กรุณากรอกอายุก่อนบันทึก', 'error');
            this.goToStep(1);
            this.validateStep(1);
            return;
        }

        try {
            const data = this.collectFormData();

            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showLoading();
                await DiabetesApp.savePatient(data);
                DiabetesApp.hideLoading();
                // Refresh patient dropdown after successful save
                await this.loadPatientList();
            } else {
                console.warn('DiabetesApp is not available - cannot save');
                this._showToast('ไม่สามารถบันทึกข้อมูลได้ (DiabetesApp ไม่พร้อมใช้งาน)', 'error');
            }
        } catch (err) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.hideLoading();
            }
            console.error('Error saving form:', err);
        }
    },

    // =====================
    // Load Patient Data
    // =====================

    async loadPatient(patientId) {
        if (!patientId) return;

        try {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showLoading();
            }

            let data = null;
            if (typeof DiabetesApp !== 'undefined') {
                data = await DiabetesApp.loadPatient(patientId);
            }

            if (data) {
                this.populateForm(data);
                this.goToStep(1);
                this._showToast('โหลดข้อมูลผู้ป่วย ' + patientId + ' สำเร็จ', 'success');
            } else {
                this._showToast('ไม่พบข้อมูลผู้ป่วย ' + patientId, 'error');
            }

            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.hideLoading();
            }
        } catch (err) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.hideLoading();
            }
            this._showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
            console.error('Error loading patient data:', err);
        }
    },

    // =====================
    // Populate Form from Loaded Data
    // =====================

    populateForm(data) {
        if (!data) return;

        // The API may return a nested structure { patient: {...}, clinical: {...}, paid5: {...}, ... }
        // or a flat structure. Handle both.
        const patient = data.patient || data;
        const clinical = data.clinical || data;
        const paid5Data = data.paid5 || (data.paid5 ? data.paid5 : null);
        const participation = data.participation || null;
        const adverse = data.adverse || null;
        const followUp = data.followUp || null;

        // Section 1: Baseline demographics
        this._setElementValue('f-patient-id', patient.patient_id);
        this._setElementValue('f-enrollment-date', patient.enrollment_date);
        this._setRadioValue('study_group', patient.study_group);
        this._setRadioValue('gender', patient.gender);
        this._setElementValue('f-age', patient.age);
        this._setElementValue('f-education', patient.education_level);
        this._setElementValue('f-occupation', patient.occupation);
        this._setElementValue('f-diabetes-duration', patient.diabetes_duration_years);
        this._setRadioValue('diabetes_treatment', patient.diabetes_treatment);
        this._setRadioValue('line_usage', patient.line_usage);

        // Comorbidities checkboxes
        const comorbidityCheckboxes = document.querySelectorAll('input[name="comorbidities"]');
        comorbidityCheckboxes.forEach(cb => { cb.checked = false; });

        const comorbidities = patient.comorbidities || [];
        const comorbiditiesArray = Array.isArray(comorbidities) ? comorbidities : [];
        comorbiditiesArray.forEach(val => {
            const cb = document.querySelector('input[name="comorbidities"][value="' + val + '"]');
            if (cb) cb.checked = true;
        });

        this._setElementValue('f-comorbidity-other', patient.comorbidity_other);

        // Update experimental group state and visibility
        this.isExperimentalGroup = patient.study_group === 'experimental';
        this.updateSection4Visibility();
        this.updateComorbidityOtherVisibility();

        // Section 2: HbA1c
        this._setElementValue('f-hba1c-baseline', clinical.hba1c_baseline);
        this._setElementValue('f-hba1c-6month', clinical.hba1c_6month);

        // Section 3: PAID-5
        if (paid5Data) {
            for (let q = 1; q <= 5; q++) {
                this._setRadioValue('paid5_q' + q + '_baseline', paid5Data['q' + q + '_baseline']);
                this._setRadioValue('paid5_q' + q + '_6month', paid5Data['q' + q + '_6month']);
            }
        }

        // Section 4: Participation (experimental group only)
        if (participation && this.isExperimentalGroup) {
            this._setRadioValue('sessions_attended', participation.sessions_attended);
            this._setRadioValue('line_engagement', participation.line_engagement);
            this._setRadioValue('line_interaction', participation.line_interaction);
        }

        // Section 5: Adverse events
        if (adverse) {
            // Handle array of adverse events (API may return array)
            const adverseData = Array.isArray(adverse) ? adverse[0] : adverse;
            if (adverseData) {
                const hasEvent = adverseData.has_event;
                this._setRadioValue('has_event', hasEvent ? 'yes' : 'no');
                this.updateAdverseDetailVisibility(!!hasEvent);
                if (hasEvent) {
                    this._setElementValue('f-adverse-desc', adverseData.description);
                    this._setElementValue('f-adverse-date', adverseData.event_date);
                }
            }
        }

        // Section 6: Follow-up
        if (followUp) {
            this._setRadioValue('follow_up_status', followUp.status);
            this.updateWithdrawalDetailVisibility(followUp.status === 'withdrawn');
            if (followUp.status === 'withdrawn') {
                this._setElementValue('f-withdrawal-reason', followUp.withdrawal_reason);
            }
            this._setElementValue('f-end-date', followUp.end_date);
        }

        // Trigger auto-calculations after populating
        this.calculatePAID5();
        this.calculateHbA1cChange();

        // Update step indicator and navigation
        this.updateStepIndicator();
        this.updateNavigationButtons();
    },

    // =====================
    // Patient Selector Dropdown
    // =====================

    async loadPatientList() {
        const selector = document.getElementById('form-patient-select');
        if (!selector) return;

        // Ensure patients are loaded
        if (typeof DiabetesApp !== 'undefined') {
            await DiabetesApp.loadAllPatients();
            DiabetesApp.populatePatientSelector(selector);
        }

        // Remove old listener to avoid duplicates (clone-and-replace technique)
        const newSelector = selector.cloneNode(true);
        selector.parentNode.replaceChild(newSelector, selector);

        // Set up the change listener on the fresh clone
        newSelector.addEventListener('change', (e) => {
            const patientId = e.target.value;
            if (patientId) {
                this.loadPatient(patientId);
            }
        });
    },

    // =====================
    // Reset Form
    // =====================

    resetForm() {
        // Find the form container
        const formContainer = document.querySelector('.crf-form') || document.querySelector('form');
        if (formContainer) {
            // Clear text, number, and date inputs
            const inputs = formContainer.querySelectorAll('input[type="text"], input[type="number"], input[type="date"], textarea');
            inputs.forEach(input => { input.value = ''; });

            // Uncheck all radios
            const radios = formContainer.querySelectorAll('input[type="radio"]');
            radios.forEach(radio => { radio.checked = false; });

            // Uncheck all checkboxes
            const checkboxes = formContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => { cb.checked = false; });

            // Reset selects to first option (skip the patient selector)
            const selects = formContainer.querySelectorAll('select');
            selects.forEach(select => {
                if (select.id !== 'form-patient-select') {
                    select.selectedIndex = 0;
                }
            });
        }

        // Clear selected class from scale-options labels
        const selectedLabels = document.querySelectorAll('.scale-options label.selected');
        selectedLabels.forEach(function(label) { label.classList.remove('selected'); });

        // Reset state
        this.isExperimentalGroup = false;
        this.formData = {};

        // Reset conditional visibility
        this.updateSection4Visibility();
        this.updateComorbidityOtherVisibility();
        this.updateAdverseDetailVisibility(false);
        this.updateWithdrawalDetailVisibility(false);

        // Reset PAID-5 displays
        const paid5Displays = [
            'paid5-total-baseline', 'paid5-total-6month',
            'paid5-converted-baseline', 'paid5-converted-6month'
        ];
        paid5Displays.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
        });

        // Reset distress badges
        const distressDisplays = ['paid5-distress-baseline', 'paid5-distress-6month'];
        distressDisplays.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '-';
                el.className = 'badge distress-badge';
            }
        });

        // Reset HbA1c change
        const hba1cChange = document.getElementById('hba1c-change');
        if (hba1cChange) {
            hba1cChange.textContent = '-';
            hba1cChange.style.color = '';
            hba1cChange.className = 'hba1c-change';
        }

        // Clear errors and go to step 1
        this.clearFieldErrors();
        this.goToStep(1);
    },

    // =====================
    // Utility Helpers
    // =====================

    _getRadioValue(name) {
        const checked = document.querySelector('input[name="' + name + '"]:checked');
        return checked ? checked.value : null;
    },

    _getRadioNumericValue(name) {
        const val = this._getRadioValue(name);
        if (val === null || val === '') return null;
        const num = parseInt(val, 10);
        return isNaN(num) ? null : num;
    },

    _setElementValue(elementId, value) {
        const el = document.getElementById(elementId);
        if (el && value !== null && value !== undefined) {
            el.value = value;
        }
    },

    _setRadioValue(name, value) {
        if (value === null || value === undefined) return;
        const radio = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
        if (radio) {
            radio.checked = true;
            // Update selected class on scale-options labels
            var label = radio.closest('label');
            if (label && label.parentElement && label.parentElement.classList.contains('scale-options')) {
                label.parentElement.querySelectorAll('label').forEach(function(sib) {
                    sib.classList.remove('selected');
                });
                label.classList.add('selected');
            }
        }
    },

    _showToast(message, type) {
        if (typeof DiabetesApp !== 'undefined' && DiabetesApp.showToast) {
            DiabetesApp.showToast(message, type);
        } else {
            console.log('[' + type + '] ' + message);
        }
    }
};

// Expose globally
window.DiabetesForm = DiabetesForm;
