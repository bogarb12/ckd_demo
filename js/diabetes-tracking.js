// ============================================================================
// Daily Behavior Tracking Module
// บันทึกพฤติกรรมสุขภาพประจำวัน: อาหาร, ออกกำลังกาย, น้ำตาล, ยา, เท้า
// ============================================================================

const DailyTracking = {

    STORAGE_KEY: 'diabetes_daily_tracking',

    init() {
        this.setupDatePicker();
        this.setupSaveButton();
        this.setupExportButton();
        this.renderHistory();
    },

    // =====================
    // Setup
    // =====================

    setupDatePicker() {
        const dateInput = document.getElementById('tracking-date');
        if (dateInput) {
            dateInput.value = this._todayStr();
        }
    },

    setupSaveButton() {
        const btn = document.getElementById('btn-save-tracking');
        if (!btn) return;
        btn.addEventListener('click', () => this.saveEntry());
    },

    setupExportButton() {
        const btn = document.getElementById('btn-export-tracking');
        if (!btn) return;
        btn.addEventListener('click', () => this.exportCSV());
    },

    // =====================
    // Data Collection
    // =====================

    collectEntry() {
        const date = document.getElementById('tracking-date')?.value || this._todayStr();

        // Blood sugar
        const bsFasting = this._numVal('tr-bs-fasting');
        const bsPostmeal = this._numVal('tr-bs-postmeal');
        const bsBedtime = this._numVal('tr-bs-bedtime');

        // Diet - collect per meal
        const meals = {};
        document.querySelectorAll('.diet-meal-entry').forEach(entry => {
            const meal = entry.getAttribute('data-meal');
            meals[meal] = {
                food: entry.querySelector('.diet-food-input')?.value?.trim() || '',
                carbs: entry.querySelector('.diet-carb-input')?.value || '',
                vegetables: entry.querySelector('.diet-veg-input')?.value || ''
            };
        });

        const sweetDrink = document.getElementById('tr-sweet-drink')?.checked || false;
        const snack = document.getElementById('tr-snack')?.checked || false;

        // Exercise
        const exerciseTypes = [];
        document.querySelectorAll('input[name="tr_exercise_type"]:checked').forEach(el => {
            exerciseTypes.push(el.value);
        });
        const exerciseMinutes = this._numVal('tr-exercise-minutes');
        const exerciseIntensity = document.getElementById('tr-exercise-intensity')?.value || '';

        // Medication
        const medication = this._radioVal('tr_medication');

        // Foot care
        const footInspect = document.getElementById('tr-foot-inspect')?.checked || false;
        const footCream = document.getElementById('tr-foot-cream')?.checked || false;
        const footWound = document.getElementById('tr-foot-wound')?.checked || false;

        // Notes
        const notes = document.getElementById('tr-notes')?.value?.trim() || '';

        return {
            date: date,
            timestamp: new Date().toISOString(),
            blood_sugar: {
                fasting: bsFasting,
                postmeal: bsPostmeal,
                bedtime: bsBedtime
            },
            diet: {
                meals: meals,
                sweet_drink: sweetDrink,
                snack: snack
            },
            exercise: {
                types: exerciseTypes,
                minutes: exerciseMinutes,
                intensity: exerciseIntensity
            },
            medication: medication,
            foot_care: {
                inspected: footInspect,
                cream: footCream,
                wound: footWound
            },
            notes: notes
        };
    },

    // =====================
    // Save & Load
    // =====================

    saveEntry() {
        const entry = this.collectEntry();

        if (!entry.date) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('กรุณาเลือกวันที่', 'error');
            }
            return;
        }

        const records = this._loadAll();

        // Replace if same date exists, otherwise add
        const existingIndex = records.findIndex(r => r.date === entry.date);
        if (existingIndex >= 0) {
            records[existingIndex] = entry;
        } else {
            records.push(entry);
        }

        // Sort by date descending
        records.sort((a, b) => b.date.localeCompare(a.date));

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));

        if (typeof DiabetesApp !== 'undefined') {
            DiabetesApp.showToast('บันทึกข้อมูลวันที่ ' + entry.date + ' แล้ว', 'success');
        }

        this.renderHistory();
        this._clearForm();
    },

    _loadAll() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    },

    // =====================
    // History Display
    // =====================

    renderHistory() {
        const container = document.getElementById('tracking-history');
        if (!container) return;

        const records = this._loadAll();
        const recent = records.slice(0, 7);

        if (recent.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted)">ยังไม่มีข้อมูล</div>';
            return;
        }

        let html = '';
        recent.forEach(r => {
            const bs = r.blood_sugar || {};
            const ex = r.exercise || {};
            const med = r.medication;
            const foot = r.foot_care || {};

            // Status badges
            const bsText = bs.fasting ? (bs.fasting + ' mg/dL') : '-';
            const bsClass = this._bsLevel(bs.fasting);
            const exText = ex.minutes ? (ex.minutes + ' นาที') : '-';
            const medEmoji = med === 'all' ? '✅' : med === 'some' ? '⚠️' : med === 'none' ? '❌' : '—';
            const footEmoji = foot.inspected ? '✅' : '—';

            html += `<div style="padding:10px 0;border-bottom:1px solid var(--border);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <strong style="font-size:0.8rem;">${this._formatDate(r.date)}</strong>
                    <button class="btn btn-sm btn-outline tracking-load-btn" data-date="${r.date}" style="font-size:0.6rem;padding:2px 6px;">โหลด</button>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:0.65rem;">
                    <span class="tracking-badge ${bsClass}">🩸 ${bsText}</span>
                    <span class="tracking-badge">🏃 ${exText}</span>
                    <span class="tracking-badge">💊 ${medEmoji}</span>
                    <span class="tracking-badge">👣 ${footEmoji}</span>
                </div>
            </div>`;
        });

        container.innerHTML = html;

        // Setup load buttons
        container.querySelectorAll('.tracking-load-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.loadEntry(btn.getAttribute('data-date'));
            });
        });
    },

    loadEntry(date) {
        const records = this._loadAll();
        const entry = records.find(r => r.date === date);
        if (!entry) return;

        // Set date
        const dateInput = document.getElementById('tracking-date');
        if (dateInput) dateInput.value = entry.date;

        // Blood sugar
        this._setVal('tr-bs-fasting', entry.blood_sugar?.fasting);
        this._setVal('tr-bs-postmeal', entry.blood_sugar?.postmeal);
        this._setVal('tr-bs-bedtime', entry.blood_sugar?.bedtime);

        // Diet meals
        if (entry.diet?.meals) {
            document.querySelectorAll('.diet-meal-entry').forEach(el => {
                const meal = el.getAttribute('data-meal');
                const data = entry.diet.meals[meal];
                if (data) {
                    const foodInput = el.querySelector('.diet-food-input');
                    const carbInput = el.querySelector('.diet-carb-input');
                    const vegInput = el.querySelector('.diet-veg-input');
                    if (foodInput) foodInput.value = data.food || '';
                    if (carbInput) carbInput.value = data.carbs || '';
                    if (vegInput) vegInput.value = data.vegetables || '';
                }
            });
        }

        this._setChecked('tr-sweet-drink', entry.diet?.sweet_drink);
        this._setChecked('tr-snack', entry.diet?.snack);

        // Exercise
        document.querySelectorAll('input[name="tr_exercise_type"]').forEach(cb => {
            cb.checked = (entry.exercise?.types || []).includes(cb.value);
        });
        this._setVal('tr-exercise-minutes', entry.exercise?.minutes);
        const intensityEl = document.getElementById('tr-exercise-intensity');
        if (intensityEl) intensityEl.value = entry.exercise?.intensity || '';

        // Medication
        if (entry.medication) {
            const radio = document.querySelector(`input[name="tr_medication"][value="${entry.medication}"]`);
            if (radio) radio.checked = true;
        }

        // Foot care
        this._setChecked('tr-foot-inspect', entry.foot_care?.inspected);
        this._setChecked('tr-foot-cream', entry.foot_care?.cream);
        this._setChecked('tr-foot-wound', entry.foot_care?.wound);

        // Notes
        this._setVal('tr-notes', entry.notes);

        if (typeof DiabetesApp !== 'undefined') {
            DiabetesApp.showToast('โหลดข้อมูลวันที่ ' + date, 'info');
        }
    },

    // =====================
    // Export CSV
    // =====================

    exportCSV() {
        const records = this._loadAll();
        if (records.length === 0) {
            if (typeof DiabetesApp !== 'undefined') {
                DiabetesApp.showToast('ไม่มีข้อมูลให้ Export', 'error');
            }
            return;
        }

        const headers = [
            'date', 'bs_fasting', 'bs_postmeal', 'bs_bedtime',
            'breakfast_food', 'breakfast_carbs', 'breakfast_veg',
            'lunch_food', 'lunch_carbs', 'lunch_veg',
            'dinner_food', 'dinner_carbs', 'dinner_veg',
            'sweet_drink', 'snack',
            'exercise_types', 'exercise_minutes', 'exercise_intensity',
            'medication', 'foot_inspected', 'foot_cream', 'foot_wound', 'notes'
        ];

        let csv = '\uFEFF' + headers.join(',') + '\n';

        records.forEach(r => {
            const bs = r.blood_sugar || {};
            const meals = r.diet?.meals || {};
            const ex = r.exercise || {};
            const foot = r.foot_care || {};

            const row = [
                r.date,
                bs.fasting || '',
                bs.postmeal || '',
                bs.bedtime || '',
                this._csvSafe(meals.breakfast?.food),
                meals.breakfast?.carbs || '',
                meals.breakfast?.vegetables || '',
                this._csvSafe(meals.lunch?.food),
                meals.lunch?.carbs || '',
                meals.lunch?.vegetables || '',
                this._csvSafe(meals.dinner?.food),
                meals.dinner?.carbs || '',
                meals.dinner?.vegetables || '',
                r.diet?.sweet_drink ? 1 : 0,
                r.diet?.snack ? 1 : 0,
                (ex.types || []).join(';'),
                ex.minutes || '',
                ex.intensity || '',
                r.medication || '',
                foot.inspected ? 1 : 0,
                foot.cream ? 1 : 0,
                foot.wound ? 1 : 0,
                this._csvSafe(r.notes)
            ];

            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'daily_tracking_' + this._todayStr() + '.csv';
        a.click();
        URL.revokeObjectURL(url);

        if (typeof DiabetesApp !== 'undefined') {
            DiabetesApp.showToast('Export CSV สำเร็จ (' + records.length + ' รายการ)', 'success');
        }
    },

    // =====================
    // Helpers
    // =====================

    _todayStr() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },

    _formatDate(dateStr) {
        if (!dateStr) return '-';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
        const d = new Date(dateStr);
        return dayNames[d.getDay()] + ' ' + parseInt(parts[2]) + '/' + parseInt(parts[1]) + '/' + (parseInt(parts[0]) + 543);
    },

    _numVal(id) {
        const el = document.getElementById(id);
        return el && el.value ? parseFloat(el.value) : null;
    },

    _radioVal(name) {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? el.value : null;
    },

    _setVal(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    },

    _setChecked(id, value) {
        const el = document.getElementById(id);
        if (el) el.checked = !!value;
    },

    _bsLevel(val) {
        if (!val) return '';
        if (val < 70) return 'bs-low';
        if (val <= 130) return 'bs-normal';
        if (val <= 180) return 'bs-high';
        return 'bs-very-high';
    },

    _csvSafe(str) {
        if (!str) return '';
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    },

    _clearForm() {
        // Reset to today
        this.setupDatePicker();

        // Clear blood sugar
        ['tr-bs-fasting', 'tr-bs-postmeal', 'tr-bs-bedtime'].forEach(id => this._setVal(id, ''));

        // Clear diet
        document.querySelectorAll('.diet-food-input').forEach(el => el.value = '');
        document.querySelectorAll('.diet-carb-input, .diet-veg-input').forEach(el => el.value = '');
        this._setChecked('tr-sweet-drink', false);
        this._setChecked('tr-snack', false);

        // Clear exercise
        document.querySelectorAll('input[name="tr_exercise_type"]').forEach(cb => cb.checked = false);
        this._setVal('tr-exercise-minutes', '');
        const intensityEl = document.getElementById('tr-exercise-intensity');
        if (intensityEl) intensityEl.value = '';

        // Clear medication
        document.querySelectorAll('input[name="tr_medication"]').forEach(r => r.checked = false);

        // Clear foot care
        this._setChecked('tr-foot-inspect', false);
        this._setChecked('tr-foot-cream', false);
        this._setChecked('tr-foot-wound', false);

        // Clear notes
        this._setVal('tr-notes', '');
    }
};

window.DailyTracking = DailyTracking;
