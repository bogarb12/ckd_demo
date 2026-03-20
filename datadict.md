# Data Dictionary — ระบบติดตามผลโปรแกรมโรงเรียนเบาหวาน + LINE

**Repository:** `github.com/bogarb12/ckd_demo`
**Branch:** `claude/diabetes-tracking-webapp-muRJg`
**Database:** `diabetes_tracking` (MySQL / utf8mb4)
**Schema file:** `server/schema.sql`

---

## 1. patients — ข้อมูลพื้นฐานผู้เข้าร่วมวิจัย

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `patient_id` | VARCHAR(20) PK | รหัสผู้ป่วย | e.g. `EXP-001`, `CTRL-001` |
| `enrollment_date` | DATE | วันที่ลงทะเบียนเข้าร่วมวิจัย | |
| `study_group` | VARCHAR(20) | กลุ่มวิจัย | `experimental` / `control` |
| `gender` | VARCHAR(10) | เพศ | `male` / `female` / `other` |
| `first_name` | VARCHAR(100) | ชื่อจริง *(แสดงเฉพาะ admin)* | |
| `last_name` | VARCHAR(100) | นามสกุล *(แสดงเฉพาะ admin)* | |
| `weight` | DECIMAL(5,1) | น้ำหนัก (kg) | |
| `height` | DECIMAL(5,1) | ส่วนสูง (cm) | |
| `bmi` | DECIMAL(4,1) | ดัชนีมวลกาย (kg/m²) | เกณฑ์เอเชีย: <18.5 ผอม, 18.5–22.9 ปกติ, 23–24.9 เกิน, 25–29.9 อ้วน 1, ≥30 อ้วน 2 |
| `waist` | DECIMAL(5,1) | รอบเอว (cm) | |
| `age` | INT | อายุ (ปี) | |
| `education_level` | INT | ระดับการศึกษา | `1` = ประถม, `2` = มัธยม, `3` = อนุปริญญา, `4` = ปริญญาตรี+ |
| `occupation` | INT | อาชีพ | `1` = เกษตร, `2` = รับจ้าง, `3` = ราชการ, `4` = ค้าขาย, `5` = อื่นๆ |
| `occupation_note` | VARCHAR(100) | หมายเหตุอาชีพ (กรณีเลือก อื่นๆ) | |
| `diabetes_duration_years` | DECIMAL(4,1) | ระยะเวลาที่เป็นเบาหวาน (ปี) | |
| `d1` | TINYINT | โรคร่วม: ความดันโลหิตสูง (Hypertension) | `0` = ไม่มี, `1` = มี |
| `d2` | TINYINT | โรคร่วม: ไขมันในเลือดสูง (Dyslipidemia) | `0` / `1` |
| `d3` | TINYINT | โรคร่วม: โรคหัวใจ (CVD) | `0` / `1` |
| `d4` | TINYINT | โรคร่วม: โรคไต (CKD) | `0` / `1` |
| `d5` | TINYINT | โรคร่วม: เกาต์ (Gout) | `0` / `1` |
| `d6` | TINYINT | โรคร่วม: ไม่มีโรคร่วม | `0` / `1` |
| `d7` | TINYINT | โรคร่วม: อื่นๆ | `0` / `1` |
| `comorbidity_note` | VARCHAR(200) | หมายเหตุโรคร่วม (กรณี d7=1) | |
| `medication` | INT | ประเภทยาที่ใช้ | `1` = ยากิน, `2` = อินซูลิน, `3` = ยากิน+อินซูลิน |
| `line_usage` | INT | พฤติกรรมการใช้ LINE | `1` = ใช้เป็นประจำ, `2` = ใช้บ้าง, `3` = ไม่ค่อยใช้, `4` = ใช้ไม่เป็น |
| `created_at` | TIMESTAMP | วันที่สร้างข้อมูล | auto |
| `updated_at` | TIMESTAMP | วันที่แก้ไขล่าสุด | auto |

---

## 2. clinical_outcomes — ผลลัพธ์ทางคลินิก

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `hba1c_baseline` | DECIMAL(4,1) | HbA1c Baseline (%) | ค่าปกติ <7% |
| `hba1c_6month` | DECIMAL(4,1) | HbA1c ที่ 6 เดือน (%) | สีเขียว = ลดลง, สีแดง = เพิ่มขึ้น |
| `fbs` | DECIMAL(6,1) | Fasting Blood Sugar (mg/dL) | ปกติ <100, เสี่ยง 100–125, สูง ≥126 |
| `gfr` | DECIMAL(6,1) | อัตราการกรองของไต GFR (mL/min) | ≥90 ปกติ, 60–89 ลดเล็กน้อย, 30–59 ลดปานกลาง, <30 วิกฤต |
| `dtx1` | DECIMAL(6,1) | DTX ครั้งที่ 1 | ค่าน้ำตาลปลายนิ้ว (mg/dL) |
| `dtx2` | DECIMAL(6,1) | DTX ครั้งที่ 2 | ค่าน้ำตาลปลายนิ้ว (mg/dL) |
| `dtx3` | DECIMAL(6,1) | DTX ครั้งที่ 3 | ค่าน้ำตาลปลายนิ้ว (mg/dL) |
| `dtx4` | DECIMAL(6,1) | DTX ครั้งที่ 4 | ค่าน้ำตาลปลายนิ้ว (mg/dL) |
| `dtx5` | DECIMAL(6,1) | DTX ครั้งที่ 5 | ค่าน้ำตาลปลายนิ้ว (mg/dL) |
| `dtx6` | DECIMAL(6,1) | DTX ครั้งที่ 6 | ค่าน้ำตาลปลายนิ้ว (mg/dL) |
| `dtx_avg` | DECIMAL(6,1) | DTX เฉลี่ย (คำนวณอัตโนมัติ) | ค่าเฉลี่ยจาก dtx1-dtx6 ที่มีข้อมูล |
| `created_at` | TIMESTAMP | | auto |
| `updated_at` | TIMESTAMP | | auto |

> **Unique constraint:** 1 record ต่อ 1 patient
>
> **DTX เกณฑ์อ้างอิง:** ปกติ 70-100 | ก่อนอาหาร 80-130 | หลังอาหาร <180 | ต่ำ <70 (Hypoglycemia) | สูง >250 (Hyperglycemia)

---

## 3. paid5_scores — PAID-5 Thai Version (ความเครียดจากเบาหวาน)

**เครื่องมือ:** Problem Areas in Diabetes Scale – 5 items (Thai)
**การคำนวณ:** คะแนน 0–4 ต่อข้อ (ไม่เป็นปัญหา → เป็นปัญหามาก), รวม 0–20, แปลง ×5 = 0–100
**เกณฑ์ Distress:** ต่ำ (<40) / สูง (≥40)

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `q1_baseline` – `q5_baseline` | TINYINT | คะแนนข้อ 1–5 Baseline | `0` – `4` |
| `q1_6month` – `q5_6month` | TINYINT | คะแนนข้อ 1–5 ที่ 6 เดือน | `0` – `4` |
| `total_baseline` | INT | คะแนนรวม Baseline (raw) | 0–20 |
| `total_6month` | INT | คะแนนรวม 6 เดือน (raw) | 0–20 |
| `converted_baseline` | INT | คะแนนแปลง Baseline (×5) | 0–100 |
| `converted_6month` | INT | คะแนนแปลง 6 เดือน (×5) | 0–100 |
| `distress_baseline` | VARCHAR(10) | ระดับ Distress Baseline | `low` (<40) / `high` (≥40) |
| `distress_6month` | VARCHAR(10) | ระดับ Distress 6 เดือน | `low` / `high` |

---

## 4. program_participation — การเข้าร่วมโปรแกรม

> เฉพาะกลุ่มทดลอง (experimental) เท่านั้น

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `sessions_attended` | VARCHAR(10) | จำนวนครั้งที่เข้าร่วม | `0-1` / `2-3` / `4+` |
| `line_engagement` | VARCHAR(20) | พฤติกรรมการอ่านข้อความ LINE | `regular` / `sometimes` / `rarely` |
| `line_interaction` | VARCHAR(20) | พฤติกรรมการตอบโต้ใน LINE | `regular` / `sometimes` / `never` |

---

## 5. adverse_events — เหตุการณ์ไม่พึงประสงค์

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `has_event` | BOOLEAN | มีเหตุการณ์ไม่พึงประสงค์หรือไม่ | `0` / `1` |
| `description` | TEXT | รายละเอียดเหตุการณ์ | |
| `event_date` | DATE | วันที่เกิดเหตุการณ์ | |

> หนึ่งผู้ป่วยอาจมีหลาย record (ไม่มี unique constraint)

---

## 6. follow_up_status — สถานะการติดตาม

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `status` | VARCHAR(20) | สถานะการติดตาม | `complete` = ติดตามครบ, `lost` = ขาดการติดต่อ, `withdrawn` = ถอนตัว |
| `withdrawal_reason` | TEXT | เหตุผลที่ถอนตัว (กรณี withdrawn) | |
| `end_date` | DATE | วันที่สิ้นสุดการติดตาม | |

---

## 7. health_literacy — ความรอบรู้ด้านสุขภาพ

**เครื่องมือ:** แบบสอบถามความรอบรู้ด้านสุขภาพ 10 ข้อ
**การให้คะแนน:** 1–5 ต่อข้อ (ง่ายมาก → ยากมาก)
**คะแนนรวม:** 10–50 (คะแนนสูง = ความรอบรู้สูง)

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `q1_baseline` – `q10_baseline` | TINYINT | คะแนนข้อ 1–10 Baseline | `1` – `5` |
| `q1_6month` – `q10_6month` | TINYINT | คะแนนข้อ 1–10 ที่ 6 เดือน | `1` – `5` |
| `total_baseline` | INT | คะแนนรวม Baseline | 10–50 |
| `total_6month` | INT | คะแนนรวม 6 เดือน | 10–50 |

---

## 8. self_care — พฤติกรรมการดูแลตนเอง

**เครื่องมือ:** แบบสอบถามพฤติกรรมการดูแลตนเอง 12 ข้อ
**การให้คะแนน:** 1–4 ต่อข้อ (ไม่เคย → ทุกวัน)
**คะแนนรวม:** 12–48 (คะแนนสูง = พฤติกรรมดี)

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `q1_baseline` – `q12_baseline` | TINYINT | คะแนนข้อ 1–12 Baseline | `1` – `4` |
| `q1_6month` – `q12_6month` | TINYINT | คะแนนข้อ 1–12 ที่ 6 เดือน | `1` – `4` |
| `total_baseline` | INT | คะแนนรวม Baseline | 12–48 |
| `total_6month` | INT | คะแนนรวม 6 เดือน | 12–48 |

---

## 9. daily_tracking — บันทึกพฤติกรรมสุขภาพประจำวัน

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ค่าที่เป็นไปได้ |
|---------|-----------|---------|---------------|
| `id` | INT PK AI | ลำดับ | auto |
| `patient_id` | VARCHAR(20) FK | รหัสผู้ป่วย → patients | |
| `tracking_date` | DATE | วันที่บันทึก | |
| `bs_fasting` | DECIMAL(6,1) | น้ำตาลก่อนอาหาร (mg/dL) | เป้าหมาย: 80–130 |
| `bs_postmeal` | DECIMAL(6,1) | น้ำตาลหลังอาหาร 2 ชม. (mg/dL) | เป้าหมาย: <180 |
| `bs_bedtime` | DECIMAL(6,1) | น้ำตาลก่อนนอน (mg/dL) | เป้าหมาย: 100–140 |
| `diet` | JSON | ข้อมูลอาหาร | `{ meals, sweet_drink, snack }` |
| `exercise_types` | VARCHAR(200) | ประเภทการออกกำลังกาย | e.g. `เดิน, ว่ายน้ำ` |
| `exercise_minutes` | INT | ระยะเวลาออกกำลังกาย (นาที) | เป้าหมาย: ≥30 นาที/วัน |
| `exercise_intensity` | VARCHAR(20) | ความหนักของการออกกำลังกาย | `light` / `moderate` / `vigorous` |
| `medication` | VARCHAR(10) | ความสม่ำเสมอในการกินยา | `all` = ครบ, `some` = บางส่วน, `none` = ไม่กิน |
| `foot_inspected` | BOOLEAN | ตรวจเท้าประจำวัน | `0` / `1` |
| `foot_cream` | BOOLEAN | ทาครีมบำรุงเท้า | `0` / `1` |
| `foot_wound` | BOOLEAN | มีแผลที่เท้า | `0` / `1` |
| `notes` | TEXT | หมายเหตุเพิ่มเติม | |

> **Unique constraint:** (patient_id, tracking_date) — 1 record ต่อวันต่อผู้ป่วย

---

## Dashboard Visualizations — การแสดงผลบนแดชบอร์ด

### Summary Cards (แถว 1)
| การ์ด | แหล่งข้อมูล | การคำนวณ |
|-------|-----------|---------|
| ผู้ป่วยทั้งหมด | `patients` | COUNT(*) |
| กลุ่มทดลอง | `patients` | COUNT WHERE study_group = 'experimental' |
| กลุ่มควบคุม | `patients` | COUNT WHERE study_group = 'control' |
| HbA1c เฉลี่ย | `clinical_outcomes` | AVG(hba1c_baseline) |

### Summary Cards (แถว 2)
| การ์ด | แหล่งข้อมูล | การคำนวณ |
|-------|-----------|---------|
| BMI เฉลี่ย | `patients.bmi` | AVG(bmi) |
| FBS เฉลี่ย | `clinical_outcomes.fbs` | AVG(fbs) mg/dL |
| GFR เฉลี่ย | `clinical_outcomes.gfr` | AVG(gfr) mL/min |
| อัตราติดตาม | `follow_up_status` | (ทั้งหมด − lost − withdrawn) / ทั้งหมด × 100 |

### Summary Cards (แถว 3)
| การ์ด | แหล่งข้อมูล | การคำนวณ |
|-------|-----------|---------|
| DTX เฉลี่ย | `clinical_outcomes.dtx_avg` | AVG(dtx_avg) mg/dL |

### Charts
| กราฟ | ชนิด | แหล่งข้อมูล |
|------|------|-----------|
| HbA1c Baseline vs 6 เดือน | Grouped Bar | `clinical_outcomes` แยกกลุ่ม exp/ctrl |
| PAID-5 ความเครียด | Grouped Bar | `paid5_scores.converted_*` แยกกลุ่ม |
| Distress ระดับ | Doughnut | `paid5_scores.distress_*` low/high |
| Health Literacy | Grouped Bar | `health_literacy.total_*` แยกกลุ่ม |
| Self-care | Grouped Bar | `self_care.total_*` แยกกลุ่ม |
| BMI Distribution | Doughnut | `patients.bmi` จัดกลุ่มตามเกณฑ์เอเชีย |
| Comorbidities | Horizontal Bar | `patients.d1`–`d5` |
| DTX เฉลี่ย ตามกลุ่ม | Bar | `clinical_outcomes.dtx_avg` แยกกลุ่ม exp/ctrl |
| Age Distribution | Bar | `patients.age` จัดกลุ่มอายุ |

### DTX Analysis — การวิเคราะห์เปรียบเทียบ DTX (เมนูย่อย DTX)
| กราฟ | ชนิด | แหล่งข้อมูล |
|------|------|-----------|
| DTX 6 ครั้ง Trend | Line | `clinical_outcomes.dtx1`–`dtx6` |
| DTX vs HbA1c | Bar | `dtx_avg` vs `hba1c_baseline`, `hba1c_6month` |
| DTX vs PAID-5 | Bar | `dtx_avg` vs `paid5_scores.converted_*` |
| DTX vs Health Literacy | Bar | `dtx_avg` vs `health_literacy.total_*` |
| DTX vs BMI & BW | Bar | `dtx_avg` vs `patients.bmi`, `patients.weight` |

### Patient Table — คอลัมน์ตารางผู้ป่วย
| คอลัมน์ | สิทธิ์ | Color Coding |
|---------|-------|-------------|
| รหัส | ทุกคน | — |
| ชื่อ-สกุล | **Admin only** | — |
| เพศ | ทุกคน | — |
| อายุ | ทุกคน | — |
| กลุ่ม | ทุกคน | — |
| BMI | ทุกคน | แดง ≥30, ส้ม ≥25, เหลืองส้ม ≥23 |
| HbA1c BL | ทุกคน | — |
| HbA1c 6m | ทุกคน | เขียว = ลดลง, แดง = เพิ่มขึ้น |
| FBS | ทุกคน | แดง >130, เหลือง ≥100 |
| GFR | ทุกคน | แดง <30, เหลือง <60 |
| DTX AVG | ทุกคน | เขียว 70-130, ส้ม >180, แดง >250, เหลือง <70 |
| PAID-5 BL | ทุกคน | — |
| PAID-5 6m | ทุกคน | — |
| Distress | ทุกคน | เขียว = ต่ำ, แดง = สูง |
| สถานะ | ทุกคน | เขียว = active/completed, แดง = withdrawn/lost |
