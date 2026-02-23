-- ============================================
-- Diabetes Tracking System - Database Schema
-- ============================================

CREATE DATABASE IF NOT EXISTS diabetes_tracking
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE diabetes_tracking;

-- ============================================
-- Table: patients (ข้อมูลพื้นฐานผู้ป่วย)
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
    patient_id VARCHAR(50) PRIMARY KEY,
    enrollment_date DATE,
    study_group ENUM('experimental', 'control'),
    gender ENUM('male', 'female', 'other'),
    age INT,
    education_level VARCHAR(50),
    occupation VARCHAR(100),
    diabetes_duration_years DECIMAL(4,1),
    comorbidities JSON,
    comorbidity_other VARCHAR(255),
    diabetes_treatment VARCHAR(50),
    line_usage VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- Table: clinical_outcomes (HbA1c)
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_outcomes (
    patient_id VARCHAR(50) PRIMARY KEY,
    hba1c_baseline DECIMAL(4,1),
    hba1c_6month DECIMAL(4,1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Table: paid5_scores (PAID-5 ความเครียดจากเบาหวาน)
-- ============================================
CREATE TABLE IF NOT EXISTS paid5_scores (
    patient_id VARCHAR(50) PRIMARY KEY,
    q1_baseline TINYINT, q1_6month TINYINT,
    q2_baseline TINYINT, q2_6month TINYINT,
    q3_baseline TINYINT, q3_6month TINYINT,
    q4_baseline TINYINT, q4_6month TINYINT,
    q5_baseline TINYINT, q5_6month TINYINT,
    total_baseline TINYINT,
    total_6month TINYINT,
    converted_baseline DECIMAL(5,2),
    converted_6month DECIMAL(5,2),
    distress_baseline VARCHAR(20),
    distress_6month VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Table: program_participation (กลุ่มทดลองเท่านั้น)
-- ============================================
CREATE TABLE IF NOT EXISTS program_participation (
    patient_id VARCHAR(50) PRIMARY KEY,
    sessions_attended VARCHAR(20),
    line_engagement VARCHAR(20),
    line_interaction VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Table: adverse_events (เหตุการณ์ไม่พึงประสงค์)
-- ============================================
CREATE TABLE IF NOT EXISTS adverse_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(50),
    has_event BOOLEAN DEFAULT FALSE,
    description TEXT,
    event_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Table: follow_up_status (สถานะการติดตาม)
-- ============================================
CREATE TABLE IF NOT EXISTS follow_up_status (
    patient_id VARCHAR(50) PRIMARY KEY,
    status ENUM('complete', 'lost', 'withdrawn'),
    withdrawal_reason TEXT,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Table: health_literacy (ความรอบรู้ด้านสุขภาพ)
-- ============================================
CREATE TABLE IF NOT EXISTS health_literacy (
    patient_id VARCHAR(50) PRIMARY KEY,
    q1_find_food_info TINYINT,
    q2_ask_medication TINYINT,
    q3_read_med_label TINYINT,
    q4_foot_care_inst TINYINT,
    q5_hypo_symptoms TINYINT,
    q6_reliable_info TINYINT,
    q7_choose_food TINYINT,
    q8_adjust_eating TINYINT,
    q9_med_on_time TINYINT,
    q10_exercise TINYINT,
    total_score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Table: self_care (พฤติกรรมการดูแลตนเอง)
-- ============================================
CREATE TABLE IF NOT EXISTS self_care (
    patient_id VARCHAR(50) PRIMARY KEY,
    q1_rice_portion TINYINT,
    q2_avoid_sweets TINYINT,
    q3_vegetables TINYINT,
    q4_exercise_30min TINYINT,
    q5_move_body TINYINT,
    q6_stop_abnormal TINYINT,
    q7_med_daily TINYINT,
    q8_no_stop_med TINYINT,
    q9_carry_sweets TINYINT,
    q10_foot_inspect TINYINT,
    q11_closed_shoes TINYINT,
    q12_see_provider TINYINT,
    total_score INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ============================================
-- Grant permissions
-- ============================================
GRANT ALL PRIVILEGES ON diabetes_tracking.* TO 'ubuntu'@'localhost';
FLUSH PRIVILEGES;
