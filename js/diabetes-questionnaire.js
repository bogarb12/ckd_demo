// DiabetesQuestionnaire - แบบประเมินความรอบรู้ด้านสุขภาพและพฤติกรรมการดูแลตนเอง
// Health Literacy & Self-Care Assessment Module
const DiabetesQuestionnaire = {

    // DB column name to question number mapping for health literacy
    _hlColumnMap: {
        q1_find_food_info: 'q1',
        q2_ask_medication: 'q2',
        q3_read_med_label: 'q3',
        q4_foot_care_inst: 'q4',
        q5_hypo_symptoms: 'q5',
        q6_reliable_info: 'q6',
        q7_choose_food: 'q7',
        q8_adjust_eating: 'q8',
        q9_med_on_time: 'q9',
        q10_exercise: 'q10'
    },

    // DB column name to question number mapping for self-care
    _scColumnMap: {
        q1_rice_portion: 'q1',
        q2_avoid_sweets: 'q2',
        q3_vegetables: 'q3',
        q4_exercise_30min: 'q4',
        q5_move_body: 'q5',
        q6_stop_abnormal: 'q6',
        q7_med_daily: 'q7',
        q8_no_stop_med: 'q8',
        q9_carry_sweets: 'q9',
        q10_foot_inspect: 'q10',
        q11_closed_shoes: 'q11',
        q12_see_provider: 'q12'
    },

    // =====================
    // Initialization
    // =====================

    init() {
        this.setupPatientSelector();
        this.setupAutoCalculation();
        this.setupSaveButton();
    },

    // =====================
    // Patient Selector
    // =====================

    setupPatientSelector() {
        const select = document.getElementById('quest-patient-select');
        if (!select) return;

        // Clear existing options except placeholder
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add placeholder if none exists
        if (select.options.length === 0) {
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = '-- เลือกผู้ป่วย --';
            placeholder.disabled = true;
            placeholder.selected = true;
            select.appendChild(placeholder);
        }

        // Populate from DiabetesApp.patients
        if (typeof DiabetesApp !== 'undefined' && Array.isArray(DiabetesApp.patients)) {
            DiabetesApp.patients.forEach(patient => {
                const option = document.createElement('option');
                option.value = patient.patient_id;
                const name = patient.name || patient.patient_name || '';
                const group = patient.group || patient.enrollment_group || '';
                let label = patient.patient_id;
                if (name) {
                    label += ` - ${name}`;
                }
                if (group) {
                    label += ` (${group})`;
                }
                option.textContent = label;
                select.appendChild(option);
            });
        }

        // Change handler - load existing questionnaire data for selected patient
        select.addEventListener('change', async () => {
            const patientId = select.value;
            if (patientId) {
                this.reset();
                await this.loadPatientData(patientId);
            } else {
                this.reset();
            }
        });
    },

    // =====================
    // Save Button
    // =====================

    setupSaveButton() {
        const saveBtn = document.getElementById('quest-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true;
                saveBtn.textContent = 'กำลังบันทึก...';
                try {
                    await this.save();
                } catch (err) {
                    console.error('เกิดข้อผิดพลาดในการบันทึกแบบประเมิน:', err);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'บันทึกแบบประเมิน';
                }
            });
        }
    },

    // =====================
    // Health Literacy Collection (10 items, scale 1-5)
    // Items: radio buttons with names hl_q1 through hl_q10
    // Scale:
    //   1 = ง่ายมาก (Very Easy)
    //   2 = ง่าย (Easy)
    //   3 = ปานกลาง (Moderate)
    //   4 = ยาก (Difficult)
    //   5 = ยากมาก (Very Difficult)
    // Total score range: 10-50
    // =====================

    collectHealthLiteracy() {
        const data = {};
        for (let i = 1; i <= 10; i++) {
            const checked = document.querySelector(`input[name="hl_q${i}"]:checked`);
            data[`q${i}`] = checked ? parseInt(checked.value) : null;
        }
        // Calculate total score (10-50), only when all 10 items are answered
        const scores = Object.values(data).filter(v => v !== null);
        data.total_score = scores.length === 10 ? scores.reduce((a, b) => a + b, 0) : null;
        return data;
    },

    // =====================
    // Self-Care Behavior Collection (12 items, scale 1-4)
    // Items: radio buttons with names sc_q1 through sc_q12
    // Scale:
    //   1 = ไม่เคยทำ (Never)
    //   2 = ทำบางครั้ง (Sometimes)
    //   3 = ทำบ่อยครั้ง (Often)
    //   4 = ทำทุกวัน/ทุกครั้ง (Always/Every time)
    // Total score range: 12-48
    // =====================

    collectSelfCare() {
        const data = {};
        for (let i = 1; i <= 12; i++) {
            const checked = document.querySelector(`input[name="sc_q${i}"]:checked`);
            data[`q${i}`] = checked ? parseInt(checked.value) : null;
        }
        // Calculate total score (12-48), only when all 12 items are answered
        const scores = Object.values(data).filter(v => v !== null);
        data.total_score = scores.length === 12 ? scores.reduce((a, b) => a + b, 0) : null;
        return data;
    },

    // =====================
    // Auto-Calculation on Radio Change
    // =====================

    setupAutoCalculation() {
        // Health Literacy radio inputs
        document.querySelectorAll('input[name^="hl_q"]').forEach(input => {
            input.addEventListener('change', () => this.updateHealthLiteracyScore());
        });

        // Self-Care radio inputs
        document.querySelectorAll('input[name^="sc_q"]').forEach(input => {
            input.addEventListener('change', () => this.updateSelfCareScore());
        });
    },

    updateHealthLiteracyScore() {
        const data = this.collectHealthLiteracy();
        const el = document.getElementById('hl-total-score');
        if (el && data.total_score !== null) {
            el.textContent = data.total_score;
            // Color code: low score (green) = good literacy, high score (red) = poor literacy
            // higher score = harder = worse health literacy
            el.className = data.total_score <= 20 ? 'score-good' :
                           data.total_score <= 35 ? 'score-moderate' : 'score-poor';
        } else if (el) {
            // Show partial score if some answers exist
            const scores = [];
            for (let i = 1; i <= 10; i++) {
                if (data[`q${i}`] !== null) scores.push(data[`q${i}`]);
            }
            if (scores.length > 0) {
                el.textContent = scores.reduce((a, b) => a + b, 0) + ' (ยังไม่ครบ)';
                el.className = 'score-pending';
            } else {
                el.textContent = '-';
                el.className = '';
            }
        }

        // Update interpretation badge
        const interpEl = document.getElementById('hl-interpretation');
        if (interpEl) {
            if (data.total_score === null) {
                interpEl.textContent = '';
                interpEl.className = '';
            } else if (data.total_score <= 20) {
                interpEl.textContent = 'ความรอบรู้ด้านสุขภาพดี';
                interpEl.className = 'badge-interpretation badge-green';
            } else if (data.total_score <= 35) {
                interpEl.textContent = 'ความรอบรู้ด้านสุขภาพปานกลาง';
                interpEl.className = 'badge-interpretation badge-yellow';
            } else {
                interpEl.textContent = 'ความรอบรู้ด้านสุขภาพต่ำ (ต้องการการส่งเสริม)';
                interpEl.className = 'badge-interpretation badge-red';
            }
        }
    },

    updateSelfCareScore() {
        const data = this.collectSelfCare();
        const el = document.getElementById('sc-total-score');
        if (el && data.total_score !== null) {
            el.textContent = data.total_score;
            // Color code: higher score = better self-care
            el.className = data.total_score >= 36 ? 'score-good' :
                           data.total_score >= 24 ? 'score-moderate' : 'score-poor';
        } else if (el) {
            // Show partial score if some answers exist
            const scores = [];
            for (let i = 1; i <= 12; i++) {
                if (data[`q${i}`] !== null) scores.push(data[`q${i}`]);
            }
            if (scores.length > 0) {
                el.textContent = scores.reduce((a, b) => a + b, 0) + ' (ยังไม่ครบ)';
                el.className = 'score-pending';
            } else {
                el.textContent = '-';
                el.className = '';
            }
        }

        // Update interpretation badge
        const interpEl = document.getElementById('sc-interpretation');
        if (interpEl) {
            if (data.total_score === null) {
                interpEl.textContent = '';
                interpEl.className = '';
            } else if (data.total_score >= 36) {
                interpEl.textContent = 'พฤติกรรมดูแลตนเองดี';
                interpEl.className = 'badge-interpretation badge-green';
            } else if (data.total_score >= 24) {
                interpEl.textContent = 'พฤติกรรมดูแลตนเองปานกลาง';
                interpEl.className = 'badge-interpretation badge-yellow';
            } else {
                interpEl.textContent = 'พฤติกรรมดูแลตนเองต่ำ (ต้องปรับปรุง)';
                interpEl.className = 'badge-interpretation badge-red';
            }
        }
    },

    // =====================
    // Save Questionnaire Data
    // =====================

    async save() {
        const patientId = document.getElementById('quest-patient-select')?.value;
        if (!patientId) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('กรุณาเลือกผู้ป่วยก่อนบันทึก', 'error');
            }
            return;
        }

        const healthLiteracy = this.collectHealthLiteracy();
        const selfCare = this.collectSelfCare();

        // Validate at least some answers are provided
        const hlAnswered = Object.entries(healthLiteracy).filter(([k, v]) => k.startsWith('q') && k !== 'total_score' && v !== null).length;
        const scAnswered = Object.entries(selfCare).filter(([k, v]) => k.startsWith('q') && k !== 'total_score' && v !== null).length;

        if (hlAnswered === 0 && scAnswered === 0) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('กรุณาตอบแบบประเมินอย่างน้อย 1 ข้อก่อนบันทึก', 'error');
            }
            return;
        }

        const questionnaireData = {
            healthLiteracy,
            selfCare,
            assessment_date: new Date().toISOString()
        };

        if (typeof DiabetesApp !== 'undefined' && DiabetesApp.dbConnected) {
            // Save via API
            try {
                await DiabetesApp.apiPost(`/api/questionnaire/${encodeURIComponent(patientId)}`, questionnaireData);
                DiabetesApp.showToast('บันทึกแบบประเมินสำเร็จ', 'success');
            } catch (err) {
                console.error('บันทึกแบบประเมินผ่าน API ล้มเหลว:', err);
                // Fallback to localStorage on API failure
                this._saveToLocalStorage(patientId, questionnaireData);
                if (typeof DiabetesApp !== 'undefined') {
                    DiabetesApp.showToast('บันทึกแบบประเมินสำเร็จ (localStorage)', 'info');
                }
            }
        } else {
            // Save to localStorage
            this._saveToLocalStorage(patientId, questionnaireData);
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('บันทึกแบบประเมินสำเร็จ', 'success');
            }
        }
    },

    _saveToLocalStorage(patientId, questionnaireData) {
        try {
            if (typeof DiabetesApp !== 'undefined') {
                const patients = DiabetesApp.loadAllFromLocal();
                const idx = patients.findIndex(p => p.patient_id === patientId);
                if (idx >= 0) {
                    patients[idx].healthLiteracy = questionnaireData.healthLiteracy;
                    patients[idx].selfCare = questionnaireData.selfCare;
                    patients[idx].questionnaire_date = questionnaireData.assessment_date;
                    localStorage.setItem('diabetes_patients', JSON.stringify(patients));
                } else {
                    // Patient not found in main list; save as standalone questionnaire record
                    const key = `questionnaire_${patientId}`;
                    localStorage.setItem(key, JSON.stringify(questionnaireData));
                }
            } else {
                const key = `questionnaire_${patientId}`;
                localStorage.setItem(key, JSON.stringify(questionnaireData));
            }
        } catch (err) {
            console.error('ไม่สามารถบันทึกลง localStorage ได้:', err);
        }
    },

    // =====================
    // Load Existing Questionnaire Data
    // =====================

    async loadPatientData(patientId) {
        if (!patientId) return;

        let data = null;

        if (typeof DiabetesApp !== 'undefined' && DiabetesApp.dbConnected) {
            // Load via API
            try {
                const response = await DiabetesApp.apiGet(`/api/patients/${encodeURIComponent(patientId)}`);
                if (response) {
                    data = {
                        healthLiteracy: response.healthLiteracy || null,
                        selfCare: response.selfCare || null
                    };
                }
            } catch (err) {
                console.warn('โหลดข้อมูลแบบประเมินจาก API ล้มเหลว ลอง localStorage:', err.message);
                data = this._loadFromLocalStorage(patientId);
            }
        } else {
            data = this._loadFromLocalStorage(patientId);
        }

        if (data) {
            this.populateHealthLiteracy(data.healthLiteracy);
            this.populateSelfCare(data.selfCare);
        }
    },

    _loadFromLocalStorage(patientId) {
        try {
            if (typeof DiabetesApp !== 'undefined') {
                const patientData = DiabetesApp.loadFromLocal(patientId);
                if (patientData) {
                    return {
                        healthLiteracy: patientData.healthLiteracy || null,
                        selfCare: patientData.selfCare || null
                    };
                }
            }
            // Try standalone questionnaire record
            const key = `questionnaire_${patientId}`;
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    healthLiteracy: parsed.healthLiteracy || null,
                    selfCare: parsed.selfCare || null
                };
            }
        } catch (err) {
            console.error('ไม่สามารถโหลดข้อมูลจาก localStorage ได้:', err);
        }
        return null;
    },

    // =====================
    // Populate Form Fields from Loaded Data
    // =====================

    populateHealthLiteracy(data) {
        if (!data) return;
        for (let i = 1; i <= 10; i++) {
            // Support both key formats: q1, q1_find_food_info, etc.
            const qKey = `q${i}`;
            let val = data[qKey];

            // Try DB column name format if direct key not found
            if (val == null) {
                for (const [colName, mappedKey] of Object.entries(this._hlColumnMap)) {
                    if (mappedKey === qKey && data[colName] != null) {
                        val = data[colName];
                        break;
                    }
                }
            }

            if (val != null) {
                const radio = document.querySelector(`input[name="hl_q${i}"][value="${val}"]`);
                if (radio) radio.checked = true;
            }
        }
        this.updateHealthLiteracyScore();
    },

    populateSelfCare(data) {
        if (!data) return;
        for (let i = 1; i <= 12; i++) {
            // Support both key formats: q1, q1_rice_portion, etc.
            const qKey = `q${i}`;
            let val = data[qKey];

            // Try DB column name format if direct key not found
            if (val == null) {
                for (const [colName, mappedKey] of Object.entries(this._scColumnMap)) {
                    if (mappedKey === qKey && data[colName] != null) {
                        val = data[colName];
                        break;
                    }
                }
            }

            if (val != null) {
                const radio = document.querySelector(`input[name="sc_q${i}"][value="${val}"]`);
                if (radio) radio.checked = true;
            }
        }
        this.updateSelfCareScore();
    },

    // =====================
    // Reset All Questionnaire Inputs
    // =====================

    reset() {
        // Uncheck all health literacy and self-care radio buttons
        document.querySelectorAll('input[name^="hl_q"], input[name^="sc_q"]').forEach(radio => {
            radio.checked = false;
        });

        // Reset Health Literacy score display
        const hlEl = document.getElementById('hl-total-score');
        const scEl = document.getElementById('sc-total-score');
        if (hlEl) {
            hlEl.textContent = '-';
            hlEl.className = '';
        }
        if (scEl) {
            scEl.textContent = '-';
            scEl.className = '';
        }

        // Reset interpretation badges
        const hlInterp = document.getElementById('hl-interpretation');
        const scInterp = document.getElementById('sc-interpretation');
        if (hlInterp) {
            hlInterp.textContent = '';
            hlInterp.className = '';
        }
        if (scInterp) {
            scInterp.textContent = '';
            scInterp.className = '';
        }
    },

    // =====================
    // Utility: Get Interpretation Text
    // =====================

    getHealthLiteracyInterpretation(totalScore) {
        if (totalScore === null || totalScore === undefined) {
            return {
                level: 'ไม่สามารถประเมินได้',
                class: 'level-pending',
                description: 'กรุณาตอบแบบประเมินให้ครบทุกข้อ'
            };
        }
        if (totalScore <= 20) {
            return {
                level: 'ดี',
                class: 'level-good',
                description: 'ผู้ป่วยมีความรอบรู้ด้านสุขภาพอยู่ในระดับดี สามารถเข้าถึง เข้าใจ ประเมิน และนำข้อมูลสุขภาพไปใช้ได้ดี'
            };
        }
        if (totalScore <= 35) {
            return {
                level: 'ปานกลาง',
                class: 'level-moderate',
                description: 'ผู้ป่วยมีความรอบรู้ด้านสุขภาพปานกลาง ควรได้รับการส่งเสริมความรู้เพิ่มเติมในบางประเด็น'
            };
        }
        return {
            level: 'ต่ำ',
            class: 'level-poor',
            description: 'ผู้ป่วยมีความรอบรู้ด้านสุขภาพต่ำ ต้องการการส่งเสริมความรู้อย่างเร่งด่วน ควรใช้สื่อที่เข้าใจง่ายและติดตามผลอย่างใกล้ชิด'
        };
    },

    getSelfCareInterpretation(totalScore) {
        if (totalScore === null || totalScore === undefined) {
            return {
                level: 'ไม่สามารถประเมินได้',
                class: 'level-pending',
                description: 'กรุณาตอบแบบประเมินให้ครบทุกข้อ'
            };
        }
        if (totalScore >= 36) {
            return {
                level: 'ดี',
                class: 'level-good',
                description: 'ผู้ป่วยมีพฤติกรรมการดูแลตนเองดี ปฏิบัติตามคำแนะนำด้านโภชนาการ การออกกำลังกาย การใช้ยา และการดูแลเท้าอย่างสม่ำเสมอ'
            };
        }
        if (totalScore >= 24) {
            return {
                level: 'ปานกลาง',
                class: 'level-moderate',
                description: 'ผู้ป่วยมีพฤติกรรมการดูแลตนเองปานกลาง ควรได้รับการกระตุ้นและสนับสนุนให้ปฏิบัติตามคำแนะนำอย่างต่อเนื่อง'
            };
        }
        return {
            level: 'ต่ำ',
            class: 'level-poor',
            description: 'ผู้ป่วยมีพฤติกรรมการดูแลตนเองต่ำ ต้องปรับปรุงอย่างเร่งด่วน ควรวางแผนการดูแลเฉพาะรายร่วมกับทีมสหวิชาชีพ'
        };
    },

    // =====================
    // Summary Report for a Patient
    // =====================

    generateSummary(patientId) {
        const healthLiteracy = this.collectHealthLiteracy();
        const selfCare = this.collectSelfCare();

        const hlInterpretation = this.getHealthLiteracyInterpretation(healthLiteracy.total_score);
        const scInterpretation = this.getSelfCareInterpretation(selfCare.total_score);

        return {
            patient_id: patientId || document.getElementById('quest-patient-select')?.value || null,
            assessment_date: new Date().toISOString(),
            healthLiteracy: {
                ...healthLiteracy,
                interpretation: hlInterpretation
            },
            selfCare: {
                ...selfCare,
                interpretation: scInterpretation
            },
            overall_recommendation: this._getOverallRecommendation(healthLiteracy.total_score, selfCare.total_score)
        };
    },

    _getOverallRecommendation(hlScore, scScore) {
        if (hlScore === null || scScore === null) {
            return 'กรุณาตอบแบบประเมินให้ครบทุกข้อเพื่อรับคำแนะนำ';
        }

        const recommendations = [];

        // Health literacy recommendations
        if (hlScore > 35) {
            recommendations.push('ควรใช้สื่อสุขศึกษาที่เข้าใจง่าย ภาพประกอบชัดเจน เพื่อเพิ่มความรอบรู้ด้านสุขภาพ');
            recommendations.push('ควรนัดพบทีมสุขศึกษาเพื่อให้ความรู้เป็นรายบุคคล');
        } else if (hlScore > 20) {
            recommendations.push('ควรทบทวนความรู้ด้านสุขภาพเป็นระยะ โดยเฉพาะเรื่องการอ่านฉลากอาหารและการใช้ยา');
        }

        // Self-care recommendations
        if (scScore < 24) {
            recommendations.push('ต้องปรับปรุงพฤติกรรมการดูแลตนเองอย่างเร่งด่วน ควรวางแผนร่วมกับทีมสหวิชาชีพ');
            recommendations.push('แนะนำให้มีผู้ดูแลหรือสมาชิกในครอบครัวร่วมติดตามพฤติกรรมสุขภาพ');
        } else if (scScore < 36) {
            recommendations.push('ควรกระตุ้นให้ปฏิบัติตามคำแนะนำอย่างสม่ำเสมอ โดยเฉพาะด้านการควบคุมอาหารและการออกกำลังกาย');
        }

        // Combined high-risk assessment
        if (hlScore > 35 && scScore < 24) {
            recommendations.push('ผู้ป่วยมีความรอบรู้ด้านสุขภาพต่ำร่วมกับพฤติกรรมการดูแลตนเองต่ำ จัดเป็นกลุ่มเสี่ยงสูง ควรได้รับการติดตามอย่างใกล้ชิด');
        }

        if (recommendations.length === 0) {
            recommendations.push('ผู้ป่วยมีความรอบรู้ด้านสุขภาพและพฤติกรรมการดูแลตนเองอยู่ในเกณฑ์ดี ควรรักษาระดับนี้ไว้และนัดติดตามตามปกติ');
        }

        return recommendations.join('\n');
    }
};

window.DiabetesQuestionnaire = DiabetesQuestionnaire;
