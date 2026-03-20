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
    enrollment_date DATE DEFAULT NULL,
    study_group VARCHAR(20) DEFAULT NULL COMMENT 'experimental / control',
    gender VARCHAR(10) DEFAULT NULL COMMENT 'male / female / other',
    first_name VARCHAR(100) DEFAULT NULL,
    last_name VARCHAR(100) DEFAULT NULL,
    weight DECIMAL(5,1) DEFAULT NULL COMMENT 'น้ำหนัก (kg)',
    height DECIMAL(5,1) DEFAULT NULL COMMENT 'ส่วนสูง (cm)',
    bmi DECIMAL(4,1) DEFAULT NULL,
    waist DECIMAL(5,1) DEFAULT NULL COMMENT 'รอบเอว (cm)',
    age INT DEFAULT NULL,
    education_level INT DEFAULT NULL COMMENT '1=ประถม 2=มัธยม 3=อนุปริญญา 4=ปริญญาตรี+',
    occupation INT DEFAULT NULL COMMENT '1=เกษตร 2=รับจ้าง 3=ราชการ 4=ค้าขาย 5=อื่นๆ',
    occupation_note VARCHAR(100) DEFAULT NULL,
    diabetes_duration_years DECIMAL(4,1) DEFAULT NULL COMMENT 'ระยะเวลาที่เป็นเบาหวาน (ปี)',
    d1 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: ความดันสูง',
    d2 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: ไขมันในเลือดสูง',
    d3 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: หัวใจ',
    d4 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: ไต',
    d5 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: เกาต์',
    d6 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: ไม่มี',
    d7 TINYINT DEFAULT 0 COMMENT 'โรคร่วม: อื่นๆ',
    comorbidity_note VARCHAR(200) DEFAULT NULL,
    medication INT DEFAULT NULL COMMENT '1=ยากิน 2=อินซูลิน 3=ยากิน+อินซูลิน',
    line_usage INT DEFAULT NULL COMMENT '1=ใช้เป็นประจำ 2=ใช้บ้าง 3=ไม่ค่อยใช้ 4=ใช้ไม่เป็น',
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
    fbs DECIMAL(6,1) DEFAULT NULL COMMENT 'Fasting Blood Sugar (mg/dL)',
    gfr DECIMAL(6,1) DEFAULT NULL COMMENT 'GFR (mL/min)',
    dtx1 DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX ครั้งที่ 1',
    dtx2 DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX ครั้งที่ 2',
    dtx3 DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX ครั้งที่ 3',
    dtx4 DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX ครั้งที่ 4',
    dtx5 DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX ครั้งที่ 5',
    dtx6 DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX ครั้งที่ 6',
    dtx_avg DECIMAL(6,1) DEFAULT NULL COMMENT 'DTX เฉลี่ย (คำนวณอัตโนมัติ)',
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
    distress_baseline VARCHAR(10) COMMENT 'ระดับ Distress Baseline (low/high)',
    distress_6month VARCHAR(10) COMMENT 'ระดับ Distress 6 เดือน (low/high)',
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
    sessions_attended VARCHAR(10) DEFAULT NULL COMMENT 'จำนวนครั้งที่เข้าร่วม: 0-1 / 2-3 / 4+',
    line_engagement VARCHAR(20) DEFAULT NULL COMMENT 'การอ่านข้อความ LINE: regular/sometimes/rarely',
    line_interaction VARCHAR(20) DEFAULT NULL COMMENT 'การตอบโต้ใน LINE: regular/sometimes/never',
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
    status VARCHAR(20) DEFAULT NULL COMMENT 'complete/lost/withdrawn',
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
--    Baseline + 6 month
-- ============================================
CREATE TABLE IF NOT EXISTS health_literacy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    q1_baseline TINYINT COMMENT 'ข้อ 1 Baseline (1-5)',
    q1_6month TINYINT COMMENT 'ข้อ 1 6เดือน (1-5)',
    q2_baseline TINYINT,
    q2_6month TINYINT,
    q3_baseline TINYINT,
    q3_6month TINYINT,
    q4_baseline TINYINT,
    q4_6month TINYINT,
    q5_baseline TINYINT,
    q5_6month TINYINT,
    q6_baseline TINYINT,
    q6_6month TINYINT,
    q7_baseline TINYINT,
    q7_6month TINYINT,
    q8_baseline TINYINT,
    q8_6month TINYINT,
    q9_baseline TINYINT,
    q9_6month TINYINT,
    q10_baseline TINYINT,
    q10_6month TINYINT,
    total_baseline INT COMMENT 'คะแนนรวม Baseline (10-50)',
    total_6month INT COMMENT 'คะแนนรวม 6 เดือน (10-50)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 8. self_care - พฤติกรรมการดูแลตนเอง (12 ข้อ)
--    คะแนน 1-4 (ไม่เคย → ทุกวัน)
--    Baseline + 6 month
-- ============================================
CREATE TABLE IF NOT EXISTS self_care (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    q1_baseline TINYINT COMMENT 'ข้อ 1 Baseline (1-4)',
    q1_6month TINYINT COMMENT 'ข้อ 1 6เดือน (1-4)',
    q2_baseline TINYINT,
    q2_6month TINYINT,
    q3_baseline TINYINT,
    q3_6month TINYINT,
    q4_baseline TINYINT,
    q4_6month TINYINT,
    q5_baseline TINYINT,
    q5_6month TINYINT,
    q6_baseline TINYINT,
    q6_6month TINYINT,
    q7_baseline TINYINT,
    q7_6month TINYINT,
    q8_baseline TINYINT,
    q8_6month TINYINT,
    q9_baseline TINYINT,
    q9_6month TINYINT,
    q10_baseline TINYINT,
    q10_6month TINYINT,
    q11_baseline TINYINT,
    q11_6month TINYINT,
    q12_baseline TINYINT,
    q12_6month TINYINT,
    total_baseline INT COMMENT 'คะแนนรวม Baseline (12-48)',
    total_6month INT COMMENT 'คะแนนรวม 6 เดือน (12-48)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient (patient_id)
) ENGINE=InnoDB;

-- ============================================
-- 9. daily_tracking - บันทึกพฤติกรรมสุขภาพประจำวัน
-- ============================================
CREATE TABLE IF NOT EXISTS daily_tracking (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(20) NOT NULL,
    tracking_date DATE NOT NULL,
    bs_fasting DECIMAL(6,1) COMMENT 'น้ำตาลก่อนอาหาร (mg/dL)',
    bs_postmeal DECIMAL(6,1) COMMENT 'น้ำตาลหลังอาหาร (mg/dL)',
    bs_bedtime DECIMAL(6,1) COMMENT 'น้ำตาลก่อนนอน (mg/dL)',
    diet JSON COMMENT 'อาหาร: meals, sweet_drink, snack',
    exercise_types VARCHAR(200) COMMENT 'ประเภทออกกำลังกาย',
    exercise_minutes INT COMMENT 'เวลาออกกำลังกาย (นาที)',
    exercise_intensity VARCHAR(20) COMMENT 'ความหนัก: light/moderate/vigorous',
    medication VARCHAR(10) COMMENT 'กินยา: all/some/none',
    foot_inspected BOOLEAN DEFAULT FALSE,
    foot_cream BOOLEAN DEFAULT FALSE,
    foot_wound BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    UNIQUE KEY uk_patient_date (patient_id, tracking_date)
) ENGINE=InnoDB;
