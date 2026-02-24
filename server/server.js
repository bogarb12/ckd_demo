const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const { query, testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dt-secret-2024-diabetes-tracking';
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Redirect root to diabetes.html
app.get('/', (req, res) => {
    res.redirect('diabetes.html');
});

let dbConnected = false;

// ============================================
// User File Management
// ============================================

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('Error loading users:', e.message);
    }
    return [];
}

function saveUsers(users) {
    const dir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function initDefaultAdmin() {
    const users = loadUsers();
    if (users.length === 0) {
        const hash = await bcrypt.hash('admin123', 10);
        users.push({
            username: 'admin',
            password: hash,
            role: 'admin',
            displayName: 'ผู้ดูแลระบบ',
            createdAt: new Date().toISOString()
        });
        saveUsers(users);
        console.log('Default admin created (admin / admin123)');
    }
}

// ============================================
// Auth Middleware
// ============================================

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
}

function adminOnly(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
    }
    next();
}

// ============================================
// API: Auth
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
        }

        const users = loadUsers();
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        const token = jwt.sign(
            { username: user.username, role: user.role, displayName: user.displayName },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                username: user.username,
                role: user.role,
                displayName: user.displayName
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

// ============================================
// API: User Management (Admin only)
// ============================================

app.get('/api/users', authMiddleware, adminOnly, (req, res) => {
    const users = loadUsers().map(u => ({
        username: u.username,
        role: u.role,
        displayName: u.displayName,
        createdAt: u.createdAt
    }));
    res.json(users);
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { username, password, role, displayName } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
        }

        const users = loadUsers();
        if (users.find(u => u.username === username)) {
            return res.status(409).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
        }

        const hash = await bcrypt.hash(password, 10);
        users.push({
            username,
            password: hash,
            role: role || 'user',
            displayName: displayName || username,
            createdAt: new Date().toISOString()
        });
        saveUsers(users);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/users/:username', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { username } = req.params;
        const { role, displayName, password } = req.body;

        const users = loadUsers();
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
        }

        if (role) user.role = role;
        if (displayName) user.displayName = displayName;
        if (password) user.password = await bcrypt.hash(password, 10);

        saveUsers(users);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:username', authMiddleware, adminOnly, (req, res) => {
    const { username } = req.params;
    if (username === 'admin') {
        return res.status(400).json({ error: 'ไม่สามารถลบบัญชี admin หลักได้' });
    }

    let users = loadUsers();
    const before = users.length;
    users = users.filter(u => u.username !== username);
    if (users.length === before) {
        return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    }
    saveUsers(users);
    res.json({ success: true });
});

// ============================================
// API: Patients (Public - guest accessible)
// ============================================

// GET all patients (with joined clinical + PAID-5 + follow-up data)
app.get('/api/patients', async (req, res) => {
    if (!dbConnected) return res.json([]);
    try {
        const rows = await query(
            `SELECT p.*,
             c.hba1c_baseline, c.hba1c_6month,
             s.total_baseline as paid5_total_baseline, s.total_6month as paid5_total_6month,
             s.converted_baseline as paid5_converted_baseline, s.converted_6month as paid5_converted_6month,
             s.distress_baseline as paid5_distress_baseline, s.distress_6month as paid5_distress_6month,
             fu.status as follow_up_status, fu.end_date as follow_up_end_date
             FROM patients p
             LEFT JOIN clinical_outcomes c ON p.patient_id = c.patient_id
             LEFT JOIN paid5_scores s ON p.patient_id = s.patient_id
             LEFT JOIN follow_up_status fu ON p.patient_id = fu.patient_id
             ORDER BY p.created_at DESC`
        );
        rows.forEach(r => {
            if (r.comorbidities && typeof r.comorbidities === 'string') {
                try { r.comorbidities = JSON.parse(r.comorbidities); } catch(e) {}
            }
            // Nest paid5 data for frontend compatibility
            r.paid5 = {
                total_baseline: r.paid5_total_baseline,
                total_6month: r.paid5_total_6month,
                converted_baseline: r.paid5_converted_baseline,
                converted_6month: r.paid5_converted_6month,
                distress_baseline: r.paid5_distress_baseline,
                distress_6month: r.paid5_distress_6month
            };
            r.followUp = {
                status: r.follow_up_status,
                end_date: r.follow_up_end_date
            };
        });
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single patient with all related data
app.get('/api/patients/:id', async (req, res) => {
    if (!dbConnected) return res.status(404).json({ error: 'DB not connected' });
    try {
        const id = req.params.id;
        const [patient] = await query('SELECT * FROM patients WHERE patient_id = ?', [id]);
        if (!patient) return res.status(404).json({ error: 'Patient not found' });

        if (patient.comorbidities && typeof patient.comorbidities === 'string') {
            try { patient.comorbidities = JSON.parse(patient.comorbidities); } catch(e) {}
        }

        const [clinical] = await query('SELECT * FROM clinical_outcomes WHERE patient_id = ?', [id]);
        const [paid5] = await query('SELECT * FROM paid5_scores WHERE patient_id = ?', [id]);
        const [participation] = await query('SELECT * FROM program_participation WHERE patient_id = ?', [id]);
        const adverse = await query('SELECT * FROM adverse_events WHERE patient_id = ?', [id]);
        const [followUp] = await query('SELECT * FROM follow_up_status WHERE patient_id = ?', [id]);
        const [healthLit] = await query('SELECT * FROM health_literacy WHERE patient_id = ?', [id]);
        const [selfCare] = await query('SELECT * FROM self_care WHERE patient_id = ?', [id]);

        res.json({
            patient,
            clinical: clinical || null,
            paid5: paid5 || null,
            participation: participation || null,
            adverse: adverse || [],
            followUp: followUp || null,
            healthLiteracy: healthLit || null,
            selfCare: selfCare || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create patient (all sections)
app.post('/api/patients', async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'DB not connected' });
    try {
        const d = req.body;

        // Section 1: Patient basics
        await query(
            `INSERT INTO patients (patient_id, enrollment_date, study_group, gender, age,
             education_level, occupation, diabetes_duration_years, comorbidities,
             comorbidity_other, diabetes_treatment, line_usage)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             enrollment_date=VALUES(enrollment_date), study_group=VALUES(study_group),
             gender=VALUES(gender), age=VALUES(age), education_level=VALUES(education_level),
             occupation=VALUES(occupation), diabetes_duration_years=VALUES(diabetes_duration_years),
             comorbidities=VALUES(comorbidities), comorbidity_other=VALUES(comorbidity_other),
             diabetes_treatment=VALUES(diabetes_treatment), line_usage=VALUES(line_usage)`,
            [d.patient_id, d.enrollment_date, d.study_group, d.gender, d.age,
             d.education_level, d.occupation, d.diabetes_duration_years,
             JSON.stringify(d.comorbidities || []), d.comorbidity_other || null,
             d.diabetes_treatment, d.line_usage]
        );

        // Section 2: Clinical outcomes
        if (d.hba1c_baseline !== undefined || d.hba1c_6month !== undefined) {
            await query(
                `INSERT INTO clinical_outcomes (patient_id, hba1c_baseline, hba1c_6month)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE hba1c_baseline=VALUES(hba1c_baseline), hba1c_6month=VALUES(hba1c_6month)`,
                [d.patient_id, d.hba1c_baseline || null, d.hba1c_6month || null]
            );
        }

        // Section 3: PAID-5
        if (d.paid5) {
            const p = d.paid5;
            await query(
                `INSERT INTO paid5_scores (patient_id, q1_baseline, q1_6month, q2_baseline, q2_6month,
                 q3_baseline, q3_6month, q4_baseline, q4_6month, q5_baseline, q5_6month,
                 total_baseline, total_6month, converted_baseline, converted_6month,
                 distress_baseline, distress_6month)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 q1_baseline=VALUES(q1_baseline), q1_6month=VALUES(q1_6month),
                 q2_baseline=VALUES(q2_baseline), q2_6month=VALUES(q2_6month),
                 q3_baseline=VALUES(q3_baseline), q3_6month=VALUES(q3_6month),
                 q4_baseline=VALUES(q4_baseline), q4_6month=VALUES(q4_6month),
                 q5_baseline=VALUES(q5_baseline), q5_6month=VALUES(q5_6month),
                 total_baseline=VALUES(total_baseline), total_6month=VALUES(total_6month),
                 converted_baseline=VALUES(converted_baseline), converted_6month=VALUES(converted_6month),
                 distress_baseline=VALUES(distress_baseline), distress_6month=VALUES(distress_6month)`,
                [d.patient_id, p.q1_baseline, p.q1_6month, p.q2_baseline, p.q2_6month,
                 p.q3_baseline, p.q3_6month, p.q4_baseline, p.q4_6month, p.q5_baseline, p.q5_6month,
                 p.total_baseline, p.total_6month, p.converted_baseline, p.converted_6month,
                 p.distress_baseline, p.distress_6month]
            );
        }

        // Section 4: Program participation (experimental only)
        if (d.participation && d.study_group === 'experimental') {
            const pp = d.participation;
            await query(
                `INSERT INTO program_participation (patient_id, sessions_attended, line_engagement, line_interaction)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 sessions_attended=VALUES(sessions_attended), line_engagement=VALUES(line_engagement),
                 line_interaction=VALUES(line_interaction)`,
                [d.patient_id, pp.sessions_attended, pp.line_engagement, pp.line_interaction]
            );
        }

        // Section 5: Adverse events
        if (d.adverse) {
            await query('DELETE FROM adverse_events WHERE patient_id = ?', [d.patient_id]);
            if (d.adverse.has_event) {
                await query(
                    'INSERT INTO adverse_events (patient_id, has_event, description, event_date) VALUES (?, ?, ?, ?)',
                    [d.patient_id, true, d.adverse.description || null, d.adverse.event_date || null]
                );
            } else {
                await query(
                    'INSERT INTO adverse_events (patient_id, has_event) VALUES (?, ?)',
                    [d.patient_id, false]
                );
            }
        }

        // Section 6: Follow-up status
        if (d.followUp) {
            const fu = d.followUp;
            await query(
                `INSERT INTO follow_up_status (patient_id, status, withdrawal_reason, end_date)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 status=VALUES(status), withdrawal_reason=VALUES(withdrawal_reason), end_date=VALUES(end_date)`,
                [d.patient_id, fu.status, fu.withdrawal_reason || null, fu.end_date || null]
            );
        }

        res.json({ success: true, patient_id: d.patient_id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST save questionnaire (health literacy + self care)
app.post('/api/questionnaire/:id', async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'DB not connected' });
    try {
        const id = req.params.id;
        const d = req.body;

        // Health Literacy
        if (d.healthLiteracy) {
            const hl = d.healthLiteracy;
            await query(
                `INSERT INTO health_literacy (patient_id, q1_find_food_info, q2_ask_medication,
                 q3_read_med_label, q4_foot_care_inst, q5_hypo_symptoms, q6_reliable_info,
                 q7_choose_food, q8_adjust_eating, q9_med_on_time, q10_exercise, total_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 q1_find_food_info=VALUES(q1_find_food_info), q2_ask_medication=VALUES(q2_ask_medication),
                 q3_read_med_label=VALUES(q3_read_med_label), q4_foot_care_inst=VALUES(q4_foot_care_inst),
                 q5_hypo_symptoms=VALUES(q5_hypo_symptoms), q6_reliable_info=VALUES(q6_reliable_info),
                 q7_choose_food=VALUES(q7_choose_food), q8_adjust_eating=VALUES(q8_adjust_eating),
                 q9_med_on_time=VALUES(q9_med_on_time), q10_exercise=VALUES(q10_exercise),
                 total_score=VALUES(total_score)`,
                [id, hl.q1, hl.q2, hl.q3, hl.q4, hl.q5, hl.q6, hl.q7, hl.q8, hl.q9, hl.q10, hl.total_score]
            );
        }

        // Self Care
        if (d.selfCare) {
            const sc = d.selfCare;
            await query(
                `INSERT INTO self_care (patient_id, q1_rice_portion, q2_avoid_sweets, q3_vegetables,
                 q4_exercise_30min, q5_move_body, q6_stop_abnormal, q7_med_daily, q8_no_stop_med,
                 q9_carry_sweets, q10_foot_inspect, q11_closed_shoes, q12_see_provider, total_score)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 q1_rice_portion=VALUES(q1_rice_portion), q2_avoid_sweets=VALUES(q2_avoid_sweets),
                 q3_vegetables=VALUES(q3_vegetables), q4_exercise_30min=VALUES(q4_exercise_30min),
                 q5_move_body=VALUES(q5_move_body), q6_stop_abnormal=VALUES(q6_stop_abnormal),
                 q7_med_daily=VALUES(q7_med_daily), q8_no_stop_med=VALUES(q8_no_stop_med),
                 q9_carry_sweets=VALUES(q9_carry_sweets), q10_foot_inspect=VALUES(q10_foot_inspect),
                 q11_closed_shoes=VALUES(q11_closed_shoes), q12_see_provider=VALUES(q12_see_provider),
                 total_score=VALUES(total_score)`,
                [id, sc.q1, sc.q2, sc.q3, sc.q4, sc.q5, sc.q6, sc.q7, sc.q8, sc.q9, sc.q10, sc.q11, sc.q12, sc.total_score]
            );
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT update patient
app.put('/api/patients/:id', async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'DB not connected' });
    try {
        req.body.patient_id = req.params.id;
        const d = req.body;

        await query(
            `UPDATE patients SET enrollment_date=?, study_group=?, gender=?, age=?,
             education_level=?, occupation=?, diabetes_duration_years=?, comorbidities=?,
             comorbidity_other=?, diabetes_treatment=?, line_usage=?
             WHERE patient_id=?`,
            [d.enrollment_date, d.study_group, d.gender, d.age,
             d.education_level, d.occupation, d.diabetes_duration_years,
             JSON.stringify(d.comorbidities || []), d.comorbidity_other || null,
             d.diabetes_treatment, d.line_usage, d.patient_id]
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE patient
app.delete('/api/patients/:id', async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'DB not connected' });
    try {
        await query('DELETE FROM patients WHERE patient_id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API: Public Stats (Guest accessible - counts only)
// ============================================
app.get('/api/stats/counts', async (req, res) => {
    if (!dbConnected) return res.json({ totalPatients: 0, experimental: 0, control: 0 });
    try {
        const [counts] = await query(
            `SELECT COUNT(*) as total,
             SUM(study_group='experimental') as experimental,
             SUM(study_group='control') as control
             FROM patients`
        );
        res.json({
            totalPatients: Number(counts.total) || 0,
            experimental: Number(counts.experimental) || 0,
            control: Number(counts.control) || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API: Dashboard Summary (Admin only)
// ============================================
app.get('/api/dashboard/summary', authMiddleware, adminOnly, async (req, res) => {
    if (!dbConnected) return res.json({ totalPatients: 0, experimental: 0, control: 0 });
    try {
        const [counts] = await query(
            `SELECT COUNT(*) as total,
             SUM(study_group='experimental') as experimental,
             SUM(study_group='control') as control
             FROM patients`
        );

        const hba1c = await query(
            `SELECT p.study_group, c.hba1c_baseline, c.hba1c_6month
             FROM clinical_outcomes c JOIN patients p ON c.patient_id = p.patient_id
             WHERE c.hba1c_baseline IS NOT NULL`
        );

        const paid5 = await query(
            `SELECT p.study_group, s.converted_baseline, s.converted_6month,
             s.distress_baseline, s.distress_6month
             FROM paid5_scores s JOIN patients p ON s.patient_id = p.patient_id`
        );

        const patients = await query(
            `SELECT p.*, c.hba1c_baseline, c.hba1c_6month,
             s.converted_baseline as paid5_baseline, s.converted_6month as paid5_6month,
             s.distress_baseline, s.distress_6month
             FROM patients p
             LEFT JOIN clinical_outcomes c ON p.patient_id = c.patient_id
             LEFT JOIN paid5_scores s ON p.patient_id = s.patient_id
             ORDER BY p.created_at DESC`
        );

        res.json({
            totalPatients: Number(counts.total) || 0,
            experimental: Number(counts.experimental) || 0,
            control: Number(counts.control) || 0,
            hba1c,
            paid5,
            patients
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API: Export CSV (Admin only)
// ============================================
app.get('/api/export/csv', authMiddleware, adminOnly, async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'DB not connected' });
    try {
        const rows = await query(
            `SELECT p.*,
             c.hba1c_baseline, c.hba1c_6month,
             s.q1_baseline as paid5_q1_bl, s.q1_6month as paid5_q1_6m,
             s.q2_baseline as paid5_q2_bl, s.q2_6month as paid5_q2_6m,
             s.q3_baseline as paid5_q3_bl, s.q3_6month as paid5_q3_6m,
             s.q4_baseline as paid5_q4_bl, s.q4_6month as paid5_q4_6m,
             s.q5_baseline as paid5_q5_bl, s.q5_6month as paid5_q5_6m,
             s.total_baseline as paid5_total_bl, s.total_6month as paid5_total_6m,
             s.converted_baseline as paid5_conv_bl, s.converted_6month as paid5_conv_6m,
             s.distress_baseline, s.distress_6month,
             pp.sessions_attended, pp.line_engagement, pp.line_interaction,
             ae.has_event as adverse_event, ae.description as adverse_desc,
             fu.status as follow_up_status, fu.withdrawal_reason, fu.end_date,
             hl.q1_find_food_info as hl_q1, hl.q2_ask_medication as hl_q2,
             hl.q3_read_med_label as hl_q3, hl.q4_foot_care_inst as hl_q4,
             hl.q5_hypo_symptoms as hl_q5, hl.q6_reliable_info as hl_q6,
             hl.q7_choose_food as hl_q7, hl.q8_adjust_eating as hl_q8,
             hl.q9_med_on_time as hl_q9, hl.q10_exercise as hl_q10,
             hl.total_score as hl_total,
             sc.q1_rice_portion as sc_q1, sc.q2_avoid_sweets as sc_q2,
             sc.q3_vegetables as sc_q3, sc.q4_exercise_30min as sc_q4,
             sc.q5_move_body as sc_q5, sc.q6_stop_abnormal as sc_q6,
             sc.q7_med_daily as sc_q7, sc.q8_no_stop_med as sc_q8,
             sc.q9_carry_sweets as sc_q9, sc.q10_foot_inspect as sc_q10,
             sc.q11_closed_shoes as sc_q11, sc.q12_see_provider as sc_q12,
             sc.total_score as sc_total
             FROM patients p
             LEFT JOIN clinical_outcomes c ON p.patient_id = c.patient_id
             LEFT JOIN paid5_scores s ON p.patient_id = s.patient_id
             LEFT JOIN program_participation pp ON p.patient_id = pp.patient_id
             LEFT JOIN adverse_events ae ON p.patient_id = ae.patient_id
             LEFT JOIN follow_up_status fu ON p.patient_id = fu.patient_id
             LEFT JOIN health_literacy hl ON p.patient_id = hl.patient_id
             LEFT JOIN self_care sc ON p.patient_id = sc.patient_id
             ORDER BY p.patient_id`
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data to export' });
        }

        const headers = Object.keys(rows[0]).filter(k => k !== 'meta');
        let csv = '\uFEFF' + headers.join(',') + '\n';
        rows.forEach(row => {
            const values = headers.map(h => {
                let val = row[h];
                if (val === null || val === undefined) return '';
                val = String(val).replace(/"/g, '""');
                if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                    return `"${val}"`;
                }
                return val;
            });
            csv += values.join(',') + '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=diabetes_data_export.csv');
        res.send(csv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API: CSV Import Template Download
// ============================================
app.get('/api/import/template', (req, res) => {
    const BOM = '\uFEFF';
    const headers = [
        'patient_id', 'enrollment_date', 'study_group', 'gender', 'age',
        'education_level', 'occupation', 'diabetes_duration_years',
        'comorbidities', 'diabetes_treatment', 'line_usage',
        'hba1c_baseline', 'hba1c_6month',
        'paid5_q1_baseline', 'paid5_q1_6month',
        'paid5_q2_baseline', 'paid5_q2_6month',
        'paid5_q3_baseline', 'paid5_q3_6month',
        'paid5_q4_baseline', 'paid5_q4_6month',
        'paid5_q5_baseline', 'paid5_q5_6month',
        'sessions_attended', 'line_engagement', 'line_interaction',
        'follow_up_status', 'end_date'
    ];
    const example = [
        'DM-001', '2025-01-15', 'experimental', 'female', '55',
        'primary', 'เกษตรกรรม', '5',
        'hypertension;dyslipidemia', 'oral', 'regular',
        '8.5', '7.2',
        '3', '1', '2', '1', '3', '2', '2', '1', '4', '2',
        '4_plus', 'regular', 'sometimes',
        'complete', '2025-07-15'
    ];
    const csv = BOM + headers.join(',') + '\n' + example.join(',') + '\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=diabetes_import_template.csv');
    res.send(csv);
});

// ============================================
// API: CSV Import (Admin only)
// ============================================
app.post('/api/import/csv', authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'DB not connected' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + at least 1 data row' });

        const headers = parseCSVLine(lines[0]);
        const pidIdx = headers.indexOf('patient_id');
        if (pidIdx < 0) return res.status(400).json({ error: 'Missing required column: patient_id' });

        let imported = 0;
        let errors = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] || null; });

            if (!row.patient_id) {
                errors.push(`Row ${i + 1}: missing patient_id`);
                continue;
            }

            try {
                // Insert patient
                await query(
                    `INSERT INTO patients (patient_id, enrollment_date, study_group, gender, age,
                     education_level, occupation, diabetes_duration_years, comorbidities,
                     diabetes_treatment, line_usage)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     enrollment_date=VALUES(enrollment_date), study_group=VALUES(study_group),
                     gender=VALUES(gender), age=VALUES(age), education_level=VALUES(education_level),
                     occupation=VALUES(occupation), diabetes_duration_years=VALUES(diabetes_duration_years),
                     comorbidities=VALUES(comorbidities),
                     diabetes_treatment=VALUES(diabetes_treatment), line_usage=VALUES(line_usage)`,
                    [
                        row.patient_id,
                        row.enrollment_date || null,
                        row.study_group || null,
                        row.gender || null,
                        row.age ? parseInt(row.age) : null,
                        row.education_level || null,
                        row.occupation || null,
                        row.diabetes_duration_years ? parseFloat(row.diabetes_duration_years) : null,
                        row.comorbidities ? JSON.stringify(row.comorbidities.split(';').map(s => s.trim())) : '[]',
                        row.diabetes_treatment || null,
                        row.line_usage || null
                    ]
                );

                // Insert clinical outcomes
                if (row.hba1c_baseline || row.hba1c_6month) {
                    await query(
                        `INSERT INTO clinical_outcomes (patient_id, hba1c_baseline, hba1c_6month)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE hba1c_baseline=VALUES(hba1c_baseline), hba1c_6month=VALUES(hba1c_6month)`,
                        [
                            row.patient_id,
                            row.hba1c_baseline ? parseFloat(row.hba1c_baseline) : null,
                            row.hba1c_6month ? parseFloat(row.hba1c_6month) : null
                        ]
                    );
                }

                // Insert PAID-5 scores
                const hasP5 = headers.some(h => h.startsWith('paid5_q'));
                if (hasP5) {
                    const p5 = {};
                    for (let q = 1; q <= 5; q++) {
                        p5[`q${q}_bl`] = row[`paid5_q${q}_baseline`] ? parseInt(row[`paid5_q${q}_baseline`]) : null;
                        p5[`q${q}_6m`] = row[`paid5_q${q}_6month`] ? parseInt(row[`paid5_q${q}_6month`]) : null;
                    }
                    const totalBL = [p5.q1_bl, p5.q2_bl, p5.q3_bl, p5.q4_bl, p5.q5_bl].filter(v => v != null);
                    const total6m = [p5.q1_6m, p5.q2_6m, p5.q3_6m, p5.q4_6m, p5.q5_6m].filter(v => v != null);
                    const sumBL = totalBL.length > 0 ? totalBL.reduce((a, b) => a + b, 0) : null;
                    const sum6m = total6m.length > 0 ? total6m.reduce((a, b) => a + b, 0) : null;
                    const convBL = sumBL != null ? (sumBL / 20) * 100 : null;
                    const conv6m = sum6m != null ? (sum6m / 20) * 100 : null;
                    const distBL = convBL != null ? (convBL >= 40 ? 'high' : 'low') : null;
                    const dist6m = conv6m != null ? (conv6m >= 40 ? 'high' : 'low') : null;

                    if (sumBL != null || sum6m != null) {
                        await query(
                            `INSERT INTO paid5_scores (patient_id, q1_baseline, q1_6month, q2_baseline, q2_6month,
                             q3_baseline, q3_6month, q4_baseline, q4_6month, q5_baseline, q5_6month,
                             total_baseline, total_6month, converted_baseline, converted_6month,
                             distress_baseline, distress_6month)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE
                             q1_baseline=VALUES(q1_baseline), q1_6month=VALUES(q1_6month),
                             q2_baseline=VALUES(q2_baseline), q2_6month=VALUES(q2_6month),
                             q3_baseline=VALUES(q3_baseline), q3_6month=VALUES(q3_6month),
                             q4_baseline=VALUES(q4_baseline), q4_6month=VALUES(q4_6month),
                             q5_baseline=VALUES(q5_baseline), q5_6month=VALUES(q5_6month),
                             total_baseline=VALUES(total_baseline), total_6month=VALUES(total_6month),
                             converted_baseline=VALUES(converted_baseline), converted_6month=VALUES(converted_6month),
                             distress_baseline=VALUES(distress_baseline), distress_6month=VALUES(distress_6month)`,
                            [
                                row.patient_id,
                                p5.q1_bl, p5.q1_6m, p5.q2_bl, p5.q2_6m,
                                p5.q3_bl, p5.q3_6m, p5.q4_bl, p5.q4_6m,
                                p5.q5_bl, p5.q5_6m,
                                sumBL, sum6m, convBL, conv6m, distBL, dist6m
                            ]
                        );
                    }
                }

                // Insert program participation (experimental only)
                if (row.study_group === 'experimental' && (row.sessions_attended || row.line_engagement || row.line_interaction)) {
                    await query(
                        `INSERT INTO program_participation (patient_id, sessions_attended, line_engagement, line_interaction)
                         VALUES (?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         sessions_attended=VALUES(sessions_attended), line_engagement=VALUES(line_engagement),
                         line_interaction=VALUES(line_interaction)`,
                        [row.patient_id, row.sessions_attended || null, row.line_engagement || null, row.line_interaction || null]
                    );
                }

                // Insert follow-up status
                if (row.follow_up_status) {
                    await query(
                        `INSERT INTO follow_up_status (patient_id, status, end_date)
                         VALUES (?, ?, ?)
                         ON DUPLICATE KEY UPDATE status=VALUES(status), end_date=VALUES(end_date)`,
                        [row.patient_id, row.follow_up_status, row.end_date || null]
                    );
                }

                imported++;
            } catch (rowErr) {
                errors.push(`Row ${i + 1} (${row.patient_id}): ${rowErr.message}`);
            }
        }

        res.json({ success: true, imported, total: lines.length - 1, errors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: parse a single CSV line respecting quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current.trim());
    return result;
}

// ============================================
// API: DB Status (Public - needed before login)
// ============================================
app.get('/api/status', (req, res) => {
    res.json({ dbConnected, mode: dbConnected ? 'database' : 'localStorage' });
});

// ============================================
// Start Server
// ============================================
async function start() {
    await initDefaultAdmin();
    dbConnected = await testConnection();
    app.listen(PORT, () => {
        console.log(`\nDiabetes Tracking App running at http://localhost:${PORT}/diabetes.html`);
        console.log(`Mode: ${dbConnected ? 'MariaDB Database' : 'localStorage (Demo)'}`);
        console.log(`API: http://localhost:${PORT}/api/status\n`);
    });
}

start();
