-- ============================================
-- Diabetes Tracking Database Schema
-- ระบบติดตามผลโปรแกรมโรงเรียนเบาหวาน + LINE
-- ============================================

CREATE DATABASE IF NOT EXISTS diabetes_tracking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE diabetes_tracking;

-- ============================================
-- 1. patients - ข้อมูลพื้นฐานผู้เข้าร่วมวิจัย (Section 1)
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    patient_id VARCHAR(20) PRIMARY KEY,
    enrollment_date DATE NOT NULL,
    study_group ENUM('experimental', 'control') NOT NULL COMMENT 'กลุ่มทดลอง (DSME+LINE) / กลุ่มควบคุม (Usual care)',
    gender ENUM('male', 'female', 'other') NOT NULL,
    age INT NOT NULL,
    education_level ENUM('primary', 'secondary', 'diploma', 'bachelor_plus') NOT NULL COMMENT 'ประถม/มัธยม/อนุปริญญา/ปริญญาตรี+',
    occupation VARCHAR(50) NOT NULL COMMENT 'เกษตร/รับจ้าง/ราชการ/ค้าขาย/อื่นๆ',
    diabetes_duration_years DECIMAL(4,1) NOT NULL COMMENT 'ระยะเวลาที่เป็นเบาหวาน (ปี)',
    comorbidities JSON COMMENT 'โรคร่วม: ["hypertension","dyslipidemia","cvd","ckd","gout","none","other"]',
    comorbidity_other VARCHAR(100) DEFAULT NULL,
    diabetes_treatment ENUM('oral', 'insulin', 'oral_insulin') NOT NULL COMMENT 'ยากิน/อินซูลิน/ยากิน+อินซูลิน',
    line_usage ENUM('regular', 'occasional', 'rarely', 'cannot_use') NOT NULL COMMENT 'ความถี่ใช้ LINE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- 2. clinical_outcomes - ผลลัพธ์ทางคลินิก (Section 2)
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_outcomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    hba1c_baseline DECIMAL(4,1) COMMENT 'HbA1c Baseline (%)',
    hba1c_6month DECIMAL(4,1) COMMENT 'HbA1c 6 เดือน (%)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 3. paid5_scores - PAID-5 Thai Version (Section 3)
--    คะแนน 0-4 ต่อข้อ (ไม่เป็นปัญหา → เป็นปัญหามาก)
--    รวม 0-20, แปลง ×5 = 0-100
--    Distress: ต่ำ (<40) / สูง (≥40)
-- ============================================
CREATE TABLE IF NOT EXISTS paid5_scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    q1_baseline TINYINT COMMENT 'ข้อ 1: Baseline (0-4)',
    q1_6month TINYINT COMMENT 'ข้อ 1: 6 เดือน (0-4)',
    q2_baseline TINYINT,
    q2_6month TINYINT,
    q3_baseline TINYINT,
    q3_6month TINYINT,
    q4_baseline TINYINT,
    q4_6month TINYINT,
    q5_baseline TINYINT,
    q5_6month TINYINT,
    total_baseline INT COMMENT 'คะแนนรวม Baseline (0-20)',
    total_6month INT COMMENT 'คะแนนรวม 6 เดือน (0-20)',
    converted_baseline INT COMMENT 'คะแนนแปลง Baseline (0-100)',
    converted_6month INT COMMENT 'คะแนนแปลง 6 เดือน (0-100)',
    distress_baseline ENUM('low', 'high') COMMENT 'ระดับ Distress Baseline',
    distress_6month ENUM('low', 'high') COMMENT 'ระดับ Distress 6 เดือน',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 4. program_participation - การเข้าร่วมโปรแกรม (Section 4)
--    เฉพาะกลุ่มทดลอง (experimental)
-- ============================================
CREATE TABLE IF NOT EXISTS program_participation (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    sessions_attended ENUM('0-1', '2-3', '4_plus') NOT NULL COMMENT 'จำนวนครั้งที่เข้าร่วม',
    line_engagement ENUM('regular', 'sometimes', 'rarely') NOT NULL COMMENT 'การอ่านข้อความ LINE',
    line_interaction ENUM('regular', 'sometimes', 'never') NOT NULL COMMENT 'การตอบโต้ใน LINE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 5. adverse_events - เหตุการณ์ไม่พึงประสงค์ (Section 5)
-- ============================================
CREATE TABLE IF NOT EXISTS adverse_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    has_event BOOLEAN DEFAULT FALSE,
    description TEXT COMMENT 'รายละเอียดเหตุการณ์',
    event_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 6. follow_up_status - สถานะการติดตาม (Section 6)
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    status ENUM('complete', 'lost', 'withdrawn') NOT NULL COMMENT 'ติดตามครบ/ขาดการติดตาม/ถอนตัว',
    withdrawal_reason TEXT COMMENT 'เหตุผลที่ถอนตัว',
    end_date DATE COMMENT 'วันที่สิ้นสุด',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 7. health_literacy - ความรอบรู้ด้านสุขภาพ (10 ข้อ)
--    คะแนน 1-5 (ง่ายมาก → ยากมาก)
-- ============================================
CREATE TABLE IF NOT EXISTS health_literacy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    q1_find_food_info TINYINT COMMENT 'หาข้อมูลอาหาร (1-5)',
    q2_ask_medication TINYINT COMMENT 'ถามเจ้าหน้าที่เรื่องยา (1-5)',
    q3_read_med_label TINYINT COMMENT 'อ่านฉลากยา (1-5)',
    q4_foot_care_inst TINYINT COMMENT 'เข้าใจคำแนะนำดูแลเท้า (1-5)',
    q5_hypo_symptoms TINYINT COMMENT 'รู้อาการน้ำตาลต่ำ (1-5)',
    q6_reliable_info TINYINT COMMENT 'หาข้อมูลที่เชื่อถือได้ (1-5)',
    q7_choose_food TINYINT COMMENT 'เลือกอาหารเหมาะสม (1-5)',
    q8_adjust_eating TINYINT COMMENT 'ปรับพฤติกรรมการกิน (1-5)',
    q9_med_on_time TINYINT COMMENT 'กินยาตรงเวลา (1-5)',
    q10_exercise TINYINT COMMENT 'ออกกำลังกายเหมาะสม (1-5)',
    total_score INT COMMENT 'คะแนนรวม (10-50)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 8. self_care - พฤติกรรมการดูแลตนเอง (12 ข้อ)
--    คะแนน 1-4 (ไม่เคย → ทุกวัน)
-- ============================================
CREATE TABLE IF NOT EXISTS self_care (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    q1_rice_portion TINYINT COMMENT 'ควบคุมข้าว/แป้ง (1-4)',
    q2_avoid_sweets TINYINT COMMENT 'งดเครื่องดื่มหวาน/ขนม (1-4)',
    q3_vegetables TINYINT COMMENT 'กินผักครึ่งจาน (1-4)',
    q4_exercise_30min TINYINT COMMENT 'ออกกำลังกาย 30+ นาที (1-4)',
    q5_move_body TINYINT COMMENT 'ขยับร่างกายแม้ไม่ออกกำลัง (1-4)',
    q6_stop_abnormal TINYINT COMMENT 'หยุดเมื่อมีอาการผิดปกติ (1-4)',
    q7_med_daily TINYINT COMMENT 'กินยาตรงเวลาทุกวัน (1-4)',
    q8_no_stop_med TINYINT COMMENT 'ไม่หยุดยาเมื่อน้ำตาลดี (1-4)',
    q9_carry_sweets TINYINT COMMENT 'พกของหวานป้องกันน้ำตาลต่ำ (1-4)',
    q10_foot_inspect TINYINT COMMENT 'ตรวจเท้าทุกวัน (1-4)',
    q11_closed_shoes TINYINT COMMENT 'สวมรองเท้าหุ้มส้น (1-4)',
    q12_see_provider TINYINT COMMENT 'พบแพทย์เมื่อมีแผล (1-4)',
    total_score INT COMMENT 'คะแนนรวม (12-48)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;
