const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
require('dotenv').config();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const { pool, query, testConnection } = require('./db');

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
            // Build comorbidities array from d1-d7 flags for backward compatibility
            if (!r.comorbidities && (r.d1 || r.d2 || r.d3 || r.d4 || r.d5 || r.d6 || r.d7)) {
                const cMap = { d1: 'hypertension', d2: 'dyslipidemia', d3: 'cvd', d4: 'ckd', d5: 'gout', d6: 'none', d7: 'other' };
                r.comorbidities = Object.entries(cMap).filter(([k]) => r[k]).map(([, v]) => v);
            }
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

        // Build comorbidities array from d1-d7 flags for backward compatibility
        if (!patient.comorbidities && (patient.d1 || patient.d2 || patient.d3 || patient.d4 || patient.d5 || patient.d6 || patient.d7)) {
            const cMap = { d1: 'hypertension', d2: 'dyslipidemia', d3: 'cvd', d4: 'ckd', d5: 'gout', d6: 'none', d7: 'other' };
            patient.comorbidities = Object.entries(cMap).filter(([k]) => patient[k]).map(([, v]) => v);
        }
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
        // Convert comorbidities array to d1-d7 flags
        const comorb = d.comorbidities || [];
        const cArray = Array.isArray(comorb) ? comorb : (typeof comorb === 'string' ? JSON.parse(comorb) : []);
        const d1 = cArray.includes('hypertension') ? 1 : (d.d1 || 0);
        const d2 = cArray.includes('dyslipidemia') ? 1 : (d.d2 || 0);
        const d3 = cArray.includes('cvd') ? 1 : (d.d3 || 0);
        const d4 = cArray.includes('ckd') ? 1 : (d.d4 || 0);
        const d5 = cArray.includes('gout') ? 1 : (d.d5 || 0);
        const d6 = cArray.includes('none') ? 1 : (d.d6 || 0);
        const d7 = cArray.includes('other') ? 1 : (d.d7 || 0);

        // Map diabetes_treatment text to int
        let medication = d.medication || null;
        if (!medication && d.diabetes_treatment) {
            const treatMap = { 'oral': 1, 'insulin': 2, 'oral_insulin': 3 };
            medication = treatMap[d.diabetes_treatment] || d.diabetes_treatment;
        }

        // Map line_usage text to int
        let lineUsage = d.line_usage;
        if (typeof lineUsage === 'string') {
            const lineMap = { 'regular': 1, 'occasional': 2, 'rarely': 3, 'cannot_use': 4 };
            lineUsage = lineMap[lineUsage] || lineUsage;
        }

        await query(
            `INSERT INTO patients (patient_id, enrollment_date, study_group, gender,
             first_name, last_name, weight, height, bmi, waist, age,
             education_level, occupation, occupation_note, diabetes_duration_years,
             d1, d2, d3, d4, d5, d6, d7, comorbidity_note,
             medication, line_usage, diabetes_treatment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             enrollment_date=VALUES(enrollment_date), study_group=VALUES(study_group),
             gender=VALUES(gender), first_name=VALUES(first_name), last_name=VALUES(last_name),
             weight=VALUES(weight), height=VALUES(height), bmi=VALUES(bmi), waist=VALUES(waist),
             age=VALUES(age), education_level=VALUES(education_level),
             occupation=VALUES(occupation), occupation_note=VALUES(occupation_note),
             diabetes_duration_years=VALUES(diabetes_duration_years),
             d1=VALUES(d1), d2=VALUES(d2), d3=VALUES(d3), d4=VALUES(d4),
             d5=VALUES(d5), d6=VALUES(d6), d7=VALUES(d7),
             comorbidity_note=VALUES(comorbidity_note),
             medication=VALUES(medication), line_usage=VALUES(line_usage),
             diabetes_treatment=VALUES(diabetes_treatment)`,
            [d.patient_id, d.enrollment_date || null, d.study_group, d.gender,
             d.first_name || null, d.last_name || null,
             d.weight || null, d.height || null, d.bmi || null, d.waist || null,
             d.age || null, d.education_level || null, d.occupation || null,
             d.occupation_note || d.comorbidity_other || null,
             d.diabetes_duration_years || null,
             d1, d2, d3, d4, d5, d6, d7,
             d.comorbidity_note || d.comorbidity_other || null,
             medication, lineUsage, d.diabetes_treatment || null]
        );

        // Section 2: Clinical outcomes
        if (d.hba1c_baseline !== undefined || d.hba1c_6month !== undefined || d.fbs !== undefined || d.gfr !== undefined || d.dtx1 !== undefined) {
            await query(
                `INSERT INTO clinical_outcomes (patient_id, hba1c_baseline, hba1c_6month, fbs, gfr, dtx1)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE hba1c_baseline=VALUES(hba1c_baseline), hba1c_6month=VALUES(hba1c_6month),
                 fbs=VALUES(fbs), gfr=VALUES(gfr), dtx1=VALUES(dtx1)`,
                [d.patient_id, d.hba1c_baseline || null, d.hba1c_6month || null,
                 d.fbs || null, d.gfr || null, d.dtx1 || null]
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

        // Health Literacy (save as baseline by default, or timepoint specified)
        if (d.healthLiteracy) {
            const hl = d.healthLiteracy;
            const tp = hl.timepoint || 'baseline'; // 'baseline' or '6month'
            const blCols = tp === 'baseline'
                ? 'q1_baseline, q2_baseline, q3_baseline, q4_baseline, q5_baseline, q6_baseline, q7_baseline, q8_baseline, q9_baseline, q10_baseline, total_baseline'
                : 'q1_6month, q2_6month, q3_6month, q4_6month, q5_6month, q6_6month, q7_6month, q8_6month, q9_6month, q10_6month, total_6month';
            const updateParts = blCols.split(', ').map(c => c + '=VALUES(' + c + ')').join(', ');
            await query(
                `INSERT INTO health_literacy (patient_id, ${blCols})
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE ${updateParts}`,
                [id, hl.q1, hl.q2, hl.q3, hl.q4, hl.q5, hl.q6, hl.q7, hl.q8, hl.q9, hl.q10, hl.total_score]
            );
        }

        // Self Care (save as baseline by default, or timepoint specified)
        if (d.selfCare) {
            const sc = d.selfCare;
            const tp = sc.timepoint || 'baseline';
            const blCols = tp === 'baseline'
                ? 'q1_baseline, q2_baseline, q3_baseline, q4_baseline, q5_baseline, q6_baseline, q7_baseline, q8_baseline, q9_baseline, q10_baseline, q11_baseline, q12_baseline, total_baseline'
                : 'q1_6month, q2_6month, q3_6month, q4_6month, q5_6month, q6_6month, q7_6month, q8_6month, q9_6month, q10_6month, q11_6month, q12_6month, total_6month';
            const updateParts = blCols.split(', ').map(c => c + '=VALUES(' + c + ')').join(', ');
            await query(
                `INSERT INTO self_care (patient_id, ${blCols})
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE ${updateParts}`,
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

        // Convert comorbidities array to d1-d7 flags
        const comorb = d.comorbidities || [];
        const cArr = Array.isArray(comorb) ? comorb : [];
        const ud1 = cArr.includes('hypertension') ? 1 : (d.d1 || 0);
        const ud2 = cArr.includes('dyslipidemia') ? 1 : (d.d2 || 0);
        const ud3 = cArr.includes('cvd') ? 1 : (d.d3 || 0);
        const ud4 = cArr.includes('ckd') ? 1 : (d.d4 || 0);
        const ud5 = cArr.includes('gout') ? 1 : (d.d5 || 0);
        const ud6 = cArr.includes('none') ? 1 : (d.d6 || 0);
        const ud7 = cArr.includes('other') ? 1 : (d.d7 || 0);

        let uMed = d.medication || null;
        if (!uMed && d.diabetes_treatment) {
            const tMap = { 'oral': 1, 'insulin': 2, 'oral_insulin': 3 };
            uMed = tMap[d.diabetes_treatment] || d.diabetes_treatment;
        }

        await query(
            `UPDATE patients SET enrollment_date=?, study_group=?, gender=?,
             first_name=?, last_name=?, weight=?, height=?, bmi=?, waist=?, age=?,
             education_level=?, occupation=?, occupation_note=?, diabetes_duration_years=?,
             d1=?, d2=?, d3=?, d4=?, d5=?, d6=?, d7=?, comorbidity_note=?,
             medication=?, line_usage=?, diabetes_treatment=?
             WHERE patient_id=?`,
            [d.enrollment_date || null, d.study_group, d.gender,
             d.first_name || null, d.last_name || null,
             d.weight || null, d.height || null, d.bmi || null, d.waist || null, d.age || null,
             d.education_level || null, d.occupation || null,
             d.occupation_note || d.comorbidity_other || null,
             d.diabetes_duration_years || null,
             ud1, ud2, ud3, ud4, ud5, ud6, ud7,
             d.comorbidity_note || d.comorbidity_other || null,
             uMed, d.line_usage || null, d.diabetes_treatment || null,
             d.patient_id]
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
    if (!dbConnected) return res.json({ totalPatients: 0, experimental: 0, control: 0, followUpComplete: 0 });
    try {
        const [counts] = await query(
            `SELECT COUNT(*) as total,
             SUM(study_group='experimental') as experimental,
             SUM(study_group='control') as control
             FROM patients`
        );
        let followUpComplete = 0;
        try {
            const [fuCount] = await query("SELECT COUNT(*) as cnt FROM follow_up_status WHERE status='complete'");
            followUpComplete = Number(fuCount.cnt) || 0;
        } catch(e) { /* table might not exist */ }
        res.json({
            totalPatients: Number(counts.total) || 0,
            experimental: Number(counts.experimental) || 0,
            control: Number(counts.control) || 0,
            followUpComplete
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
            `SELECT p.patient_id, p.study_group, p.gender, p.first_name, p.last_name,
             p.weight, p.height, p.bmi, p.waist, p.age,
             p.education_level, p.occupation, p.occupation_note,
             p.diabetes_duration_years,
             p.d1, p.d2, p.d3, p.d4, p.d5, p.d6, p.d7,
             p.comorbidity_note, p.medication, p.line_usage,
             c.hba1c_baseline, c.fbs, c.gfr, c.dtx1, c.hba1c_6month,
             s.q1_baseline as paid1_bl, s.q2_baseline as paid2_bl, s.q3_baseline as paid3_bl,
             s.q4_baseline as paid4_bl, s.q5_baseline as paid5_bl,
             s.q1_6month as paid1_6m, s.q2_6month as paid2_6m, s.q3_6month as paid3_6m,
             s.q4_6month as paid4_6m, s.q5_6month as paid5_6m,
             s.total_baseline as paid_total_bl, s.total_6month as paid_total_6m,
             hl.q1_baseline as hl1_bl, hl.q2_baseline as hl2_bl, hl.q3_baseline as hl3_bl,
             hl.q4_baseline as hl4_bl, hl.q5_baseline as hl5_bl, hl.q6_baseline as hl6_bl,
             hl.q7_baseline as hl7_bl, hl.q8_baseline as hl8_bl, hl.q9_baseline as hl9_bl,
             hl.q10_baseline as hl10_bl,
             hl.q1_6month as hl1_6m, hl.q2_6month as hl2_6m, hl.q3_6month as hl3_6m,
             hl.q4_6month as hl4_6m, hl.q5_6month as hl5_6m, hl.q6_6month as hl6_6m,
             hl.q7_6month as hl7_6m, hl.q8_6month as hl8_6m, hl.q9_6month as hl9_6m,
             hl.q10_6month as hl10_6m,
             hl.total_baseline as hl_total_bl, hl.total_6month as hl_total_6m,
             sc.q1_baseline as h1_bl, sc.q2_baseline as h2_bl, sc.q3_baseline as h3_bl,
             sc.q4_baseline as h4_bl, sc.q5_baseline as h5_bl, sc.q6_baseline as h6_bl,
             sc.q7_baseline as h7_bl, sc.q8_baseline as h8_bl, sc.q9_baseline as h9_bl,
             sc.q10_baseline as h10_bl, sc.q11_baseline as h11_bl, sc.q12_baseline as h12_bl,
             sc.q1_6month as h1_6m, sc.q2_6month as h2_6m, sc.q3_6month as h3_6m,
             sc.q4_6month as h4_6m, sc.q5_6month as h5_6m, sc.q6_6month as h6_6m,
             sc.q7_6month as h7_6m, sc.q8_6month as h8_6m, sc.q9_6month as h9_6m,
             sc.q10_6month as h10_6m, sc.q11_6month as h11_6m, sc.q12_6month as h12_6m,
             sc.total_baseline as h_total_bl, sc.total_6month as h_total_6m
             FROM patients p
             LEFT JOIN clinical_outcomes c ON p.patient_id = c.patient_id
             LEFT JOIN paid5_scores s ON p.patient_id = s.patient_id
             LEFT JOIN health_literacy hl ON p.patient_id = hl.patient_id
             LEFT JOIN self_care sc ON p.patient_id = sc.patient_id
             ORDER BY p.patient_id`
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No data to export' });
        }

        const csvHeaders = [
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

        let csv = '\uFEFF' + csvHeaders.join(',') + '\n';
        rows.forEach(row => {
            const values = [
                row.patient_id || '',
                groupMap[row.study_group] || '',
                sexMap[row.gender] || '',
                row.first_name || '', row.last_name || '',
                row.weight || '', row.height || '', row.bmi || '', row.waist || '', row.age || '',
                row.education_level || '', row.occupation || '', row.occupation_note || '',
                row.diabetes_duration_years || '',
                row.d1 || '', row.d2 || '', row.d3 || '', row.d4 || '', row.d5 || '', row.d6 || '', row.d7 || '',
                row.comorbidity_note || '', row.medication || '', row.line_usage || '',
                row.hba1c_baseline || '', row.fbs || '', row.gfr || '', row.dtx1 || '', row.hba1c_6month || '',
                row.paid1_bl || '', row.paid2_bl || '', row.paid3_bl || '', row.paid4_bl || '', row.paid5_bl || '',
                row.paid1_6m || '', row.paid2_6m || '', row.paid3_6m || '', row.paid4_6m || '', row.paid5_6m || '',
                row.paid_total_bl || '', row.paid_total_6m || '',
                row.hl1_bl || '', row.hl2_bl || '', row.hl3_bl || '', row.hl4_bl || '', row.hl5_bl || '',
                row.hl6_bl || '', row.hl7_bl || '', row.hl8_bl || '', row.hl9_bl || '', row.hl10_bl || '',
                row.hl1_6m || '', row.hl2_6m || '', row.hl3_6m || '', row.hl4_6m || '', row.hl5_6m || '',
                row.hl6_6m || '', row.hl7_6m || '', row.hl8_6m || '', row.hl9_6m || '', row.hl10_6m || '',
                row.hl_total_bl || '', row.hl_total_6m || '',
                row.h1_bl || '', row.h2_bl || '', row.h3_bl || '', row.h4_bl || '', row.h5_bl || '', row.h6_bl || '',
                row.h7_bl || '', row.h8_bl || '', row.h9_bl || '', row.h10_bl || '', row.h11_bl || '', row.h12_bl || '',
                row.h1_6m || '', row.h2_6m || '', row.h3_6m || '', row.h4_6m || '', row.h5_6m || '', row.h6_6m || '',
                row.h7_6m || '', row.h8_6m || '', row.h9_6m || '', row.h10_6m || '', row.h11_6m || '', row.h12_6m || '',
                row.h_total_bl || '', row.h_total_6m || ''
            ].map(v => {
                if (v === null || v === undefined) return '';
                const s = String(v).replace(/"/g, '""');
                return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s}"` : s;
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
        'DM-001', '1', '2',
        'สมศรี', 'มั่นคง', '65', '158', '26.0', '88', '55',
        '1', '5', '', '5',
        '1', '1', '0', '0', '0', '0', '0', '', '1', '1',
        '8.5', '130', '75', '180', '7.2',
        '3', '2', '3', '2', '4', '1', '1', '2', '1', '2', '14', '7',
        '3', '3', '2', '3', '2', '3', '2', '3', '3', '2',
        '2', '3', '3', '3', '3', '3', '3', '3', '3', '3', '26', '29',
        '2', '3', '2', '2', '3', '2', '3', '3', '2', '3', '2', '3',
        '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '3', '30', '36'
    ];
    const csv = BOM + headers.join(',') + '\n' + example.join(',') + '\n';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=diabetes_import_template.csv');
    res.send(csv);
});

// ============================================
// API: CSV Import (Public - no auth required)
// ============================================
app.post('/api/import/csv', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!dbConnected) return res.json({ success: true, imported: 0, total: 0, errors: [], message: 'DB not connected' });

    // Safe number parsers: return null instead of NaN
    const safeInt = (v) => { if (!v || v === '') return null; const n = parseInt(v); return isNaN(n) ? null : n; };
    const safeFloat = (v) => { if (!v || v === '') return null; const n = parseFloat(v); return isNaN(n) ? null : n; };

    // Map CSV header names to normalized keys
    // "note" appears twice: after อาชีพ (occupation_note) and after D7 (comorbidity_note)
    function normalizeHeaders(rawHeaders) {
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
            if (paidMatch) return `PAID${paidMatch[1]}_${paidMatch[2].toLowerCase()}`;
            if (/^PAID_total_baseline$/i.test(h)) return 'PAID_total_baseline';
            if (/^PAID_total_6m$/i.test(h)) return 'PAID_total_6m';
            const hlMatch = h.match(/^HL(\d+)_(baseline|6m)$/i);
            if (hlMatch) return `HL${hlMatch[1]}_${hlMatch[2].toLowerCase()}`;
            if (/^HL_total_baseline$/i.test(h)) return 'HL_total_baseline';
            if (/^HL_total_6m$/i.test(h)) return 'HL_total_6m';
            const hMatch = h.match(/^H(\d+)_(baseline|6m)$/i);
            if (hMatch) return `H${hMatch[1]}_${hMatch[2].toLowerCase()}`;
            if (/^H_\s*baseline$/i.test(h)) return 'H_baseline';
            if (/^H_\s*6\s*month$/i.test(h)) return 'H_6month';
            if (/^patient_id$/i.test(h)) return 'ID';
            return h;
        });
    }

    try {
        const content = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + at least 1 data row' });

        const rawHeaders = parseCSVLine(lines[0]);
        const headers = normalizeHeaders(rawHeaders);
        const idIdx = headers.indexOf('ID');
        if (idIdx < 0) return res.status(400).json({ error: 'Missing required column: ID (patient_id)' });

        let imported = 0;
        let errors = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const row = {};
            headers.forEach((h, idx) => { row[h] = values[idx] != null ? values[idx].trim() : null; });

            if (!row.ID) {
                errors.push(`Row ${i + 1}: missing ID`);
                continue;
            }

            // Map Group: 1=experimental, 0=control
            let studyGroup = null;
            if (row.Group === '1') studyGroup = 'experimental';
            else if (row.Group === '0') studyGroup = 'control';

            // Map Sex: 1=male, 2=female, 3=other
            let gender = null;
            if (row.Sex === '1') gender = 'male';
            else if (row.Sex === '2') gender = 'female';
            else if (row.Sex === '3') gender = 'other';

            try {
                // Insert patient
                await query(
                    `INSERT INTO patients (patient_id, study_group, gender, first_name, last_name,
                     weight, height, bmi, waist, age,
                     education_level, occupation, occupation_note, diabetes_duration_years,
                     d1, d2, d3, d4, d5, d6, d7, comorbidity_note, medication, line_usage)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     study_group=VALUES(study_group), gender=VALUES(gender),
                     first_name=VALUES(first_name), last_name=VALUES(last_name),
                     weight=VALUES(weight), height=VALUES(height), bmi=VALUES(bmi),
                     waist=VALUES(waist), age=VALUES(age),
                     education_level=VALUES(education_level), occupation=VALUES(occupation),
                     occupation_note=VALUES(occupation_note), diabetes_duration_years=VALUES(diabetes_duration_years),
                     d1=VALUES(d1), d2=VALUES(d2), d3=VALUES(d3), d4=VALUES(d4),
                     d5=VALUES(d5), d6=VALUES(d6), d7=VALUES(d7),
                     comorbidity_note=VALUES(comorbidity_note), medication=VALUES(medication),
                     line_usage=VALUES(line_usage)`,
                    [
                        row.ID,
                        studyGroup,
                        gender,
                        row.first_name || null,
                        row.last_name || null,
                        safeFloat(row.BW),
                        safeFloat(row.Ht),
                        safeFloat(row.BMI),
                        safeFloat(row.waist),
                        safeInt(row.Age),
                        safeInt(row.education_level),
                        safeInt(row.occupation),
                        row.occupation_note || null,
                        safeFloat(row.dm_duration),
                        safeInt(row.D1) || 0,
                        safeInt(row.D2) || 0,
                        safeInt(row.D3) || 0,
                        safeInt(row.D4) || 0,
                        safeInt(row.D5) || 0,
                        safeInt(row.D6) || 0,
                        safeInt(row.D7) || 0,
                        row.comorbidity_note || null,
                        safeInt(row.medication),
                        safeInt(row.Line)
                    ]
                );

                // Insert clinical outcomes
                if (row.HbA1c_baseline || row.HbA1c_6m || row.FBS || row.GFR || row.DTX1) {
                    await query(
                        `INSERT INTO clinical_outcomes (patient_id, hba1c_baseline, hba1c_6month, fbs, gfr, dtx1)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         hba1c_baseline=VALUES(hba1c_baseline), hba1c_6month=VALUES(hba1c_6month),
                         fbs=VALUES(fbs), gfr=VALUES(gfr), dtx1=VALUES(dtx1)`,
                        [
                            row.ID,
                            safeFloat(row.HbA1c_baseline),
                            safeFloat(row.HbA1c_6m),
                            safeFloat(row.FBS),
                            safeFloat(row.GFR),
                            safeFloat(row.DTX1)
                        ]
                    );
                }

                // Insert PAID-5 scores
                const hasPaid = headers.some(h => /^PAID\d+_/.test(h));
                if (hasPaid) {
                    const p5 = {};
                    for (let q = 1; q <= 5; q++) {
                        p5[`q${q}_bl`] = safeInt(row[`PAID${q}_baseline`]);
                        p5[`q${q}_6m`] = safeInt(row[`PAID${q}_6m`]);
                    }
                    // Use provided totals or calculate
                    const totalBL = safeInt(row.PAID_total_baseline) ||
                        ([p5.q1_bl, p5.q2_bl, p5.q3_bl, p5.q4_bl, p5.q5_bl].filter(v => v != null).length > 0
                            ? [p5.q1_bl, p5.q2_bl, p5.q3_bl, p5.q4_bl, p5.q5_bl].filter(v => v != null).reduce((a, b) => a + b, 0) : null);
                    const total6m = safeInt(row.PAID_total_6m) ||
                        ([p5.q1_6m, p5.q2_6m, p5.q3_6m, p5.q4_6m, p5.q5_6m].filter(v => v != null).length > 0
                            ? [p5.q1_6m, p5.q2_6m, p5.q3_6m, p5.q4_6m, p5.q5_6m].filter(v => v != null).reduce((a, b) => a + b, 0) : null);
                    const convBL = totalBL != null ? (totalBL / 20) * 100 : null;
                    const conv6m = total6m != null ? (total6m / 20) * 100 : null;
                    const distBL = convBL != null ? (convBL >= 40 ? 'high' : 'low') : null;
                    const dist6m = conv6m != null ? (conv6m >= 40 ? 'high' : 'low') : null;

                    if (totalBL != null || total6m != null) {
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
                                row.ID,
                                p5.q1_bl, p5.q1_6m, p5.q2_bl, p5.q2_6m,
                                p5.q3_bl, p5.q3_6m, p5.q4_bl, p5.q4_6m,
                                p5.q5_bl, p5.q5_6m,
                                totalBL, total6m, convBL, conv6m, distBL, dist6m
                            ]
                        );
                    }
                }

                // Insert Health Literacy (10 items, baseline + 6m)
                const hasHL = headers.some(h => /^HL\d+_/.test(h));
                if (hasHL) {
                    const hl = {};
                    for (let q = 1; q <= 10; q++) {
                        hl[`q${q}_bl`] = safeInt(row[`HL${q}_baseline`]);
                        hl[`q${q}_6m`] = safeInt(row[`HL${q}_6m`]);
                    }
                    const totalBL = safeInt(row.HL_total_baseline);
                    const total6m = safeInt(row.HL_total_6m);

                    if (totalBL != null || total6m != null || Object.values(hl).some(v => v != null)) {
                        await query(
                            `INSERT INTO health_literacy (patient_id,
                             q1_baseline, q1_6month, q2_baseline, q2_6month, q3_baseline, q3_6month,
                             q4_baseline, q4_6month, q5_baseline, q5_6month, q6_baseline, q6_6month,
                             q7_baseline, q7_6month, q8_baseline, q8_6month, q9_baseline, q9_6month,
                             q10_baseline, q10_6month, total_baseline, total_6month)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE
                             q1_baseline=VALUES(q1_baseline), q1_6month=VALUES(q1_6month),
                             q2_baseline=VALUES(q2_baseline), q2_6month=VALUES(q2_6month),
                             q3_baseline=VALUES(q3_baseline), q3_6month=VALUES(q3_6month),
                             q4_baseline=VALUES(q4_baseline), q4_6month=VALUES(q4_6month),
                             q5_baseline=VALUES(q5_baseline), q5_6month=VALUES(q5_6month),
                             q6_baseline=VALUES(q6_baseline), q6_6month=VALUES(q6_6month),
                             q7_baseline=VALUES(q7_baseline), q7_6month=VALUES(q7_6month),
                             q8_baseline=VALUES(q8_baseline), q8_6month=VALUES(q8_6month),
                             q9_baseline=VALUES(q9_baseline), q9_6month=VALUES(q9_6month),
                             q10_baseline=VALUES(q10_baseline), q10_6month=VALUES(q10_6month),
                             total_baseline=VALUES(total_baseline), total_6month=VALUES(total_6month)`,
                            [
                                row.ID,
                                hl.q1_bl, hl.q1_6m, hl.q2_bl, hl.q2_6m, hl.q3_bl, hl.q3_6m,
                                hl.q4_bl, hl.q4_6m, hl.q5_bl, hl.q5_6m, hl.q6_bl, hl.q6_6m,
                                hl.q7_bl, hl.q7_6m, hl.q8_bl, hl.q8_6m, hl.q9_bl, hl.q9_6m,
                                hl.q10_bl, hl.q10_6m, totalBL, total6m
                            ]
                        );
                    }
                }

                // Insert Self-Care (12 items, baseline + 6m)
                const hasH = headers.some(h => /^H\d+_/.test(h));
                if (hasH) {
                    const sc = {};
                    for (let q = 1; q <= 12; q++) {
                        sc[`q${q}_bl`] = safeInt(row[`H${q}_baseline`]);
                        sc[`q${q}_6m`] = safeInt(row[`H${q}_6m`]);
                    }
                    const totalBL = safeInt(row.H_baseline);
                    const total6m = safeInt(row.H_6month);

                    if (totalBL != null || total6m != null || Object.values(sc).some(v => v != null)) {
                        await query(
                            `INSERT INTO self_care (patient_id,
                             q1_baseline, q1_6month, q2_baseline, q2_6month, q3_baseline, q3_6month,
                             q4_baseline, q4_6month, q5_baseline, q5_6month, q6_baseline, q6_6month,
                             q7_baseline, q7_6month, q8_baseline, q8_6month, q9_baseline, q9_6month,
                             q10_baseline, q10_6month, q11_baseline, q11_6month, q12_baseline, q12_6month,
                             total_baseline, total_6month)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE
                             q1_baseline=VALUES(q1_baseline), q1_6month=VALUES(q1_6month),
                             q2_baseline=VALUES(q2_baseline), q2_6month=VALUES(q2_6month),
                             q3_baseline=VALUES(q3_baseline), q3_6month=VALUES(q3_6month),
                             q4_baseline=VALUES(q4_baseline), q4_6month=VALUES(q4_6month),
                             q5_baseline=VALUES(q5_baseline), q5_6month=VALUES(q5_6month),
                             q6_baseline=VALUES(q6_baseline), q6_6month=VALUES(q6_6month),
                             q7_baseline=VALUES(q7_baseline), q7_6month=VALUES(q7_6month),
                             q8_baseline=VALUES(q8_baseline), q8_6month=VALUES(q8_6month),
                             q9_baseline=VALUES(q9_baseline), q9_6month=VALUES(q9_6month),
                             q10_baseline=VALUES(q10_baseline), q10_6month=VALUES(q10_6month),
                             q11_baseline=VALUES(q11_baseline), q11_6month=VALUES(q11_6month),
                             q12_baseline=VALUES(q12_baseline), q12_6month=VALUES(q12_6month),
                             total_baseline=VALUES(total_baseline), total_6month=VALUES(total_6month)`,
                            [
                                row.ID,
                                sc.q1_bl, sc.q1_6m, sc.q2_bl, sc.q2_6m, sc.q3_bl, sc.q3_6m,
                                sc.q4_bl, sc.q4_6m, sc.q5_bl, sc.q5_6m, sc.q6_bl, sc.q6_6m,
                                sc.q7_bl, sc.q7_6m, sc.q8_bl, sc.q8_6m, sc.q9_bl, sc.q9_6m,
                                sc.q10_bl, sc.q10_6m, sc.q11_bl, sc.q11_6m, sc.q12_bl, sc.q12_6m,
                                totalBL, total6m
                            ]
                        );
                    }
                }

                imported++;
            } catch (rowErr) {
                errors.push(`Row ${i + 1} (${row.ID}): ${rowErr.message}`);
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
// API: Daily Tracking
// ============================================

// GET /api/tracking/:patientId - get all tracking entries for a patient
app.get('/api/tracking/:patientId', async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'Database not connected' });
    try {
        const conn = await pool.getConnection();
        const rows = await conn.query(
            'SELECT * FROM daily_tracking WHERE patient_id = ? ORDER BY tracking_date DESC',
            [req.params.patientId]
        );
        conn.release();
        // Parse diet JSON
        const entries = rows.map(r => ({
            id: r.id,
            patient_id: r.patient_id,
            date: r.tracking_date ? r.tracking_date.toISOString().split('T')[0] : null,
            blood_sugar: {
                fasting: r.bs_fasting ? parseFloat(r.bs_fasting) : null,
                postmeal: r.bs_postmeal ? parseFloat(r.bs_postmeal) : null,
                bedtime: r.bs_bedtime ? parseFloat(r.bs_bedtime) : null
            },
            diet: r.diet ? (typeof r.diet === 'string' ? JSON.parse(r.diet) : r.diet) : {},
            exercise: {
                types: r.exercise_types ? r.exercise_types.split(';').filter(Boolean) : [],
                minutes: r.exercise_minutes,
                intensity: r.exercise_intensity
            },
            medication: r.medication,
            foot_care: {
                inspected: !!r.foot_inspected,
                cream: !!r.foot_cream,
                wound: !!r.foot_wound
            },
            notes: r.notes
        }));
        res.json(entries);
    } catch (err) {
        console.error('GET /api/tracking error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tracking/:patientId - save/update a tracking entry
app.post('/api/tracking/:patientId', async (req, res) => {
    if (!dbConnected) return res.status(503).json({ error: 'Database not connected' });
    try {
        const patientId = req.params.patientId;
        const d = req.body;
        const trackingDate = d.date;
        if (!trackingDate) return res.status(400).json({ error: 'date is required' });

        const bs = d.blood_sugar || {};
        const ex = d.exercise || {};
        const foot = d.foot_care || {};
        const dietJson = JSON.stringify(d.diet || {});
        const exerciseTypes = (ex.types || []).join(';');

        const conn = await pool.getConnection();
        await conn.query(
            `INSERT INTO daily_tracking
             (patient_id, tracking_date, bs_fasting, bs_postmeal, bs_bedtime,
              diet, exercise_types, exercise_minutes, exercise_intensity,
              medication, foot_inspected, foot_cream, foot_wound, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
              bs_fasting=VALUES(bs_fasting), bs_postmeal=VALUES(bs_postmeal), bs_bedtime=VALUES(bs_bedtime),
              diet=VALUES(diet), exercise_types=VALUES(exercise_types),
              exercise_minutes=VALUES(exercise_minutes), exercise_intensity=VALUES(exercise_intensity),
              medication=VALUES(medication), foot_inspected=VALUES(foot_inspected),
              foot_cream=VALUES(foot_cream), foot_wound=VALUES(foot_wound), notes=VALUES(notes)`,
            [patientId, trackingDate,
             bs.fasting || null, bs.postmeal || null, bs.bedtime || null,
             dietJson, exerciseTypes, ex.minutes || null, ex.intensity || null,
             d.medication || null, foot.inspected ? 1 : 0, foot.cream ? 1 : 0, foot.wound ? 1 : 0,
             d.notes || null]
        );
        conn.release();
        res.json({ success: true });
    } catch (err) {
        console.error('POST /api/tracking error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// API: DB Status (Public - needed before login)
// ============================================
app.get('/api/status', (req, res) => {
    res.json({ dbConnected, mode: dbConnected ? 'database' : 'unavailable' });
});

// ============================================
// Start Server
// ============================================
async function ensureSchema() {
    try {
        const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
        // Split by semicolons, filter out USE/CREATE DATABASE, run CREATE TABLE statements
        const statements = schemaSQL.split(';')
            .map(s => s.trim())
            .filter(s => s.toUpperCase().startsWith('CREATE TABLE'));
        for (const stmt of statements) {
            await query(stmt);
        }
        console.log('Database schema ensured (' + statements.length + ' tables)');

        // Migration: add missing columns to existing tables
        const migrations = [
            // patients table - add columns that CSV import needs
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS weight DECIMAL(5,1) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS height DECIMAL(5,1) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS bmi DECIMAL(4,1) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS waist DECIMAL(5,1) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation_note VARCHAR(100) DEFAULT NULL",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d1 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d2 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d3 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d4 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d5 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d6 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS d7 TINYINT DEFAULT 0",
            "ALTER TABLE patients ADD COLUMN IF NOT EXISTS comorbidity_note VARCHAR(200) DEFAULT NULL",
            // clinical_outcomes - add fbs, gfr, dtx1
            "ALTER TABLE clinical_outcomes ADD COLUMN IF NOT EXISTS fbs DECIMAL(6,1) DEFAULT NULL",
            "ALTER TABLE clinical_outcomes ADD COLUMN IF NOT EXISTS gfr DECIMAL(6,1) DEFAULT NULL",
            "ALTER TABLE clinical_outcomes ADD COLUMN IF NOT EXISTS dtx1 DECIMAL(6,1) DEFAULT NULL",
            // Relax NOT NULL constraints on patients table
            "ALTER TABLE patients MODIFY COLUMN enrollment_date DATE DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN study_group VARCHAR(20) DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN gender VARCHAR(10) DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN age INT DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN education_level INT DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN occupation VARCHAR(50) DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN diabetes_duration_years DECIMAL(4,1) DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN line_usage INT DEFAULT NULL",
            "ALTER TABLE patients MODIFY COLUMN medication INT DEFAULT NULL",
            // Fix health_literacy: rename descriptive columns to q#_baseline/q#_6month if old schema
            // We'll use a try-catch approach for these
        ];

        for (const sql of migrations) {
            try {
                await query(sql);
            } catch (e) {
                // Ignore errors (column already exists, etc.)
            }
        }

        // Handle health_literacy table: check if it has old column names
        try {
            const hlCols = await query("SHOW COLUMNS FROM health_literacy");
            const colNames = hlCols.map(c => c.Field);
            if (colNames.includes('q1_find_food_info') && !colNames.includes('q1_baseline')) {
                // Old schema - drop and recreate
                await query("DROP TABLE IF EXISTS health_literacy");
                const hlCreate = statements.find(s => s.includes('health_literacy'));
                if (hlCreate) await query(hlCreate);
                console.log('health_literacy table recreated with new schema');
            }
        } catch (e) { /* table might not exist yet */ }

        // Handle self_care table: check if it has old column names
        try {
            const scCols = await query("SHOW COLUMNS FROM self_care");
            const colNames = scCols.map(c => c.Field);
            if (colNames.includes('q1_rice_portion') && !colNames.includes('q1_baseline')) {
                await query("DROP TABLE IF EXISTS self_care");
                const scCreate = statements.find(s => s.includes('self_care'));
                if (scCreate) await query(scCreate);
                console.log('self_care table recreated with new schema');
            }
        } catch (e) { /* table might not exist yet */ }

        // Handle paid5_scores: ensure distress columns are VARCHAR not ENUM
        try {
            await query("ALTER TABLE paid5_scores MODIFY COLUMN distress_baseline VARCHAR(10) DEFAULT NULL");
            await query("ALTER TABLE paid5_scores MODIFY COLUMN distress_6month VARCHAR(10) DEFAULT NULL");
        } catch (e) { /* ignore */ }

        // Handle follow_up_status: ensure status is VARCHAR not ENUM
        try {
            await query("ALTER TABLE follow_up_status MODIFY COLUMN status VARCHAR(20) DEFAULT NULL");
        } catch (e) { /* ignore */ }

        // Handle program_participation: ensure columns are VARCHAR not ENUM
        try {
            await query("ALTER TABLE program_participation MODIFY COLUMN sessions_attended VARCHAR(10) DEFAULT NULL");
            await query("ALTER TABLE program_participation MODIFY COLUMN line_engagement VARCHAR(20) DEFAULT NULL");
            await query("ALTER TABLE program_participation MODIFY COLUMN line_interaction VARCHAR(20) DEFAULT NULL");
        } catch (e) { /* ignore */ }

        // Remove diabetes_treatment NOT NULL if exists (CSV doesn't have this column)
        try {
            await query("ALTER TABLE patients MODIFY COLUMN diabetes_treatment VARCHAR(20) DEFAULT NULL");
        } catch (e) { /* ignore */ }

        // Drop old comorbidities JSON column if exists (replaced by d1-d7)
        try {
            const patCols = await query("SHOW COLUMNS FROM patients");
            const patColNames = patCols.map(c => c.Field);
            if (patColNames.includes('comorbidities') && !patColNames.includes('d1')) {
                try { await query("ALTER TABLE patients DROP COLUMN comorbidities"); } catch(e) {}
                try { await query("ALTER TABLE patients DROP COLUMN comorbidity_other"); } catch(e) {}
            }
        } catch (e) { /* ignore */ }

        console.log('Schema migrations complete');
    } catch (err) {
        console.warn('Schema migration warning:', err.message);
    }
}

async function start() {
    await initDefaultAdmin();
    dbConnected = await testConnection();
    if (dbConnected) {
        await ensureSchema();
    }
    app.listen(PORT, () => {
        console.log(`\nDiabetes Tracking App running at http://localhost:${PORT}/diabetes.html`);
        console.log(`Mode: ${dbConnected ? 'MariaDB Database' : 'DB unavailable'}`);
        console.log(`API: http://localhost:${PORT}/api/status\n`);
    });
}

start();
