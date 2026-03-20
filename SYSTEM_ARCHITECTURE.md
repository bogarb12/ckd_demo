# SYSTEM_ARCHITECTURE.md - สถาปัตยกรรมระบบ CKD Progression Dashboard

## 1. ภาพรวมของระบบ (System Overview)

**CKD Progression Dashboard** คือระบบแสดงผลข้อมูลผู้ป่วยโรคไตเรื้อรัง (Chronic Kidney Disease) แบบ Frontend-only ที่ทำงานบน Web Browser โดยไม่ต้องมี Backend Server

ระบบสร้างข้อมูลผู้ป่วยสังเคราะห์ (Synthetic Data) จำนวน 1,530 ราย พร้อมความสัมพันธ์ทางคลินิกที่สมจริง และนำเสนอผ่าน Interactive Dashboard 3 แท็บหลัก

---

## 2. โครงสร้างไฟล์โปรเจกต์ (Project Structure)

```
ckd_demo/
├── index.html              # หน้าเว็บหลัก (15.5 KB)
├── css/
│   └── style.css           # สไตล์และเลย์เอาต์ (21.6 KB, 1,086 บรรทัด)
├── js/
│   ├── dashboard.js        # ตัวควบคุมหลัก & แท็บคุณภาพข้อมูล (10.2 KB)
│   ├── overview.js         # แท็บภาพรวม พร้อมกราฟ 6 ชนิด (13.7 KB)
│   ├── individual.js       # แท็บรายบุคคล (35.6 KB - โมดูลใหญ่สุด)
│   └── data-generator.js   # ตัวสร้างข้อมูลสังเคราะห์ (10.7 KB)
└── data/
    └── patients.json       # ข้อมูลตัวอย่างอ้างอิง (25.4 KB, 10 ราย)
```

---

## 3. สถาปัตยกรรมภาพรวม (Architecture Diagram)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Browser (Client)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    index.html (Entry Point)                  │    │
│  │  - Header พร้อมสถิติ                                         │    │
│  │  - Tab Navigation (3 แท็บ)                                   │    │
│  │  - Content Panels                                            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                              │                                      │
│  ┌───────────────────────────┼──────────────────────────────────┐   │
│  │              JavaScript Application Layer                    │   │
│  │                                                              │   │
│  │  ┌──────────────────┐   ┌──────────────────┐                │   │
│  │  │ data-generator.js│──▶│  patients[] Array │                │   │
│  │  │ (CKDDataGenerator)│  │  (1,530 records)  │                │   │
│  │  └──────────────────┘   └────────┬─────────┘                │   │
│  │                                   │                          │   │
│  │          ┌────────────────────────┼────────────────┐         │   │
│  │          ▼                        ▼                ▼         │   │
│  │  ┌──────────────┐   ┌──────────────────┐  ┌────────────┐   │   │
│  │  │ overview.js  │   │ individual.js    │  │dashboard.js│   │   │
│  │  │ (OverviewTab)│   │ (IndividualTab)  │  │(DataQuality│   │   │
│  │  │              │   │                  │  │ + Main Ctrl)│  │   │
│  │  │ - สถิติรวม    │   │ - ค้นหา/กรอง     │  │ - Tab Nav  │   │   │
│  │  │ - กราฟ 6 แบบ  │   │ - ตารางผู้ป่วย   │  │ - กราฟคุณภาพ│  │   │
│  │  │              │   │ - รายละเอียด     │  │            │   │   │
│  │  │              │   │ - Radar Chart   │  │            │   │   │
│  │  └──────┬───────┘   └────────┬────────┘  └─────┬──────┘   │   │
│  │         │                     │                  │          │   │
│  └─────────┼─────────────────────┼──────────────────┼──────────┘   │
│            ▼                     ▼                  ▼               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Chart.js v4.4.7 (CDN)                     │    │
│  │  - Doughnut, Bar, Scatter, Radar Charts                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   css/style.css                              │    │
│  │  - CSS Variables (Design System)                             │    │
│  │  - Responsive Grid Layout                                   │    │
│  │  - Component Styling                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              External Resources (CDN)                        │    │
│  │  - Google Fonts: Sarabun (รองรับภาษาไทย)                     │    │
│  │  - Chart.js 4.4.7                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. รายละเอียดส่วนประกอบ (Component Details)

### 4.1 Data Generator (`js/data-generator.js`)

**Class:** `CKDDataGenerator`

**หน้าที่:** สร้างข้อมูลผู้ป่วยสังเคราะห์ที่มีความสมจริงทางคลินิก

**คุณสมบัติหลัก:**
- **Seeded PRNG:** ใช้ Linear Congruential Generator (seed=42) เพื่อให้ข้อมูลเหมือนกันทุกครั้งที่โหลด
- **จำนวนผู้ป่วย:** 1,530 ราย (ค่าเริ่มต้น)
- **ความสัมพันธ์ทางคลินิก:** โรคร่วมส่งผลต่อค่า lab อย่างสมจริง

**โครงสร้างข้อมูลผู้ป่วย:**

| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|--------|-----------|----------|
| `patient_id` | String | รหัสผู้ป่วย (P00001 - P01530) |
| `age` | Number | อายุ 30-90 ปี (Normal Distribution) |
| `gender` | String | เพศ (M/F, สัดส่วน 52%/48%) |
| `egfr` | Number/null | อัตราการกรองของไต (mL/min/1.73m²) |
| `base_egfr` | Number | ค่า eGFR พื้นฐาน (ใช้เมื่อ egfr เป็น null) |
| `creatinine` | Number | ค่าครีเอตินิน |
| `creatinine_unit` | String | หน่วย (mg/dL หรือ mmol/L) |
| `fbs` | Number/null | น้ำตาลในเลือดขณะอดอาหาร |
| `hba1c` | Number/null | ค่าน้ำตาลสะสม (%) |
| `sbp` | Number | ความดันโลหิตตัวบน (mmHg) |
| `dbp` | Number | ความดันโลหิตตัวล่าง (mmHg) |
| `bmi` | Number/null | ดัชนีมวลกาย (kg/m²) |
| `urine_protein` | String/null | ระดับโปรตีนในปัสสาวะ |
| `has_diabetes` | Number | เบาหวาน (0/1) |
| `has_hypertension` | Number | ความดันโลหิตสูง (0/1) |
| `has_cvd` | Number | โรคหัวใจและหลอดเลือด (0/1) |
| `ace_inhibitor` | Number | ยา ACE Inhibitor (0/1) |
| `arb` | Number | ยา ARBs (0/1) |
| `visit_count` | Number | จำนวนครั้งที่มาพบแพทย์/ปี |
| `ckd_progression_1yr` | Number | ผลลัพธ์การดำเนินโรค 1 ปี (0/1) |

**การคำนวณ CKD Stage จาก eGFR:**

| Stage | eGFR (mL/min/1.73m²) |
|-------|----------------------|
| Stage 1 | ≥ 90 |
| Stage 2 | 60 - 89 |
| Stage 3a | 45 - 59 |
| Stage 3b | 30 - 44 |
| Stage 4 | 15 - 29 |
| Stage 5 | < 15 |

**การจำลองคุณภาพข้อมูล:**
- ข้อมูลสูญหาย (Missing Data): eGFR ~22%, HbA1c ~28%, BMI ~32%, Urine Protein ~35%
- ข้อมูลซ้ำ (Duplicates): ~2%
- ค่าผิดปกติ (Outliers): ~1% (FBS 350-500, อายุ >120)
- หน่วยหลากหลาย: Creatinine มีทั้ง mg/dL (85%) และ mmol/L (15%)

---

### 4.2 Dashboard Controller (`js/dashboard.js`)

**หน้าที่:** ควบคุมการทำงานหลักของแอปพลิเคชัน และแสดงผลแท็บคุณภาพข้อมูล

**การทำงาน:**
1. **Initialization:** เริ่มต้นระบบเมื่อ DOM โหลดเสร็จ
2. **Tab Navigation:** จัดการการสลับแท็บ (Overview / Individual / Data Quality)
3. **Data Quality Tab:** แสดงกราฟและสถิติคุณภาพข้อมูล (Lazy Loading)

**กราฟคุณภาพข้อมูล:**
- กราฟแท่งแนวนอน: แสดง % ข้อมูลสูญหายแต่ละฟิลด์ (สีแดง >25%, เหลือง 10-25%, เขียว <10%)
- สถิติคุณภาพ: จำนวนซ้ำ, Outliers, สัดส่วนหน่วย, Class Balance
- กราฟ Feature Distribution: Min/Q25/Mean/Q75/Max ของ 6 ตัวแปร

---

### 4.3 Overview Tab (`js/overview.js`)

**Class:** `OverviewTab`

**หน้าที่:** แสดงสถิติรวมและกราฟระดับประชากร

**Summary Cards (6 การ์ด):**
| การ์ด | คำอธิบาย |
|--------|----------|
| จำนวนผู้ป่วยทั้งหมด | 1,530 ราย |
| อัตรา Progression | % ที่มี ckd_progression_1yr = 1 |
| ค่าเฉลี่ย eGFR | ค่าเฉลี่ยของ effective eGFR |
| อายุเฉลี่ย | ค่าเฉลี่ย (ไม่รวม outlier >120 ปี) |
| อัตราเบาหวาน | % ที่มี has_diabetes = 1 |
| อัตราความดันสูง | % ที่มี has_hypertension = 1 |

**กราฟ 6 ชนิด:**
1. **CKD Stage Distribution** (Doughnut) - การกระจายผู้ป่วยตาม Stage
2. **Risk Factor Progression** (Grouped Bar) - อัตรา Progression ตามปัจจัยเสี่ยง
3. **eGFR Distribution** (Stacked Bar) - การกระจาย eGFR แบ่ง Progression/Stable
4. **Age vs eGFR** (Scatter) - ความสัมพันธ์อายุกับ eGFR
5. **Blood Pressure** (Scatter) - การกระจาย SBP vs DBP
6. **Urine Protein** (Stacked Bar) - ระดับโปรตีนในปัสสาวะ

---

### 4.4 Individual Tab (`js/individual.js`)

**Class:** `IndividualTab`

**หน้าที่:** ค้นหา กรอง และแสดงรายละเอียดผู้ป่วยรายบุคคล

**ส่วนประกอบ:**

**แผงซ้าย (420px):**
- ช่องค้นหา Patient ID
- ตัวกรอง 4 ชนิด: Stage, Progression, Gender, Comorbidity
- ตารางผู้ป่วย (แสดง 50 รายต่อหน้า)
- Pagination

**แผงขวา (ขนาดยืดหยุ่น):**
- ข้อมูลส่วนตัว (อายุ, เพศ, วันที่)
- ตัวบ่งชี้ CKD Stage (วงกลมสี)
- **Radar/Spider Chart:** แสดงระดับความผิดปกติ 6 ด้าน
- การประเมินความเสี่ยง (คะแนน 0-13)
- สัญญาณชีพ (SBP, DBP, BMI)
- ผลตรวจ Lab (Creatinine, eGFR, FBS, HbA1c)
- โปรตีนในปัสสาวะ
- โรคร่วมและยาที่ใช้
- ข้อมูลการติดตาม

**ระบบ Radar Chart:**
- แปลงค่า 6 ตัวแปรเป็นมาตราส่วน "ระดับความกังวล" 0-100
- สีกราฟเปลี่ยนตามระดับสุขภาพ: แดง (>50%), เหลือง (25-50%), น้ำเงิน (<25%)

**ระบบประเมินความเสี่ยง:**

| ปัจจัย | คะแนน |
|--------|--------|
| เบาหวาน | +2 |
| ความดันสูง | +1 |
| โรคหัวใจ | +2 |
| eGFR < 30 | +3 |
| eGFR < 60 (แต่ ≥30) | +2 |
| โปรตีนในปัสสาวะ 2+/3+ | +2 |
| อายุ > 70 ปี | +1 |

| ระดับความเสี่ยง | คะแนน |
|-----------------|--------|
| สูง (High) | ≥ 6 |
| ปานกลาง (Medium) | 3-5 |
| ต่ำ (Low) | < 3 |

---

### 4.5 Styling System (`css/style.css`)

**ระบบออกแบบ (Design System):**

**CSS Variables:**
- สีหลัก: `#1e3a5f` (น้ำเงินเข้ม), `#2563eb` (น้ำเงินสด)
- สี Semantic: เขียว (Success), เหลือง (Warning), แดง (Danger)
- สี CKD Stage: เขียว→เหลือง→ส้ม→แดง ตามความรุนแรง

**เลย์เอาต์:**
- CSS Grid สำหรับ Summary Cards (auto-fit, minmax 200px)
- CSS Grid สำหรับ Charts (2 คอลัมน์)
- CSS Grid สำหรับ Individual Tab (420px + flexible)
- Flexbox สำหรับ Header และ Navigation

**Responsive Breakpoints:**
| Breakpoint | การปรับตัว |
|-----------|-----------|
| ≤ 1024px | กราฟเป็น 1 คอลัมน์ |
| ≤ 768px | ปรับ Flexbox |
| ≤ 480px | Summary Cards เป็น 1 คอลัมน์ |

---

## 5. Dependencies ภายนอก

| Library | Version | แหล่งที่มา | การใช้งาน |
|---------|---------|----------|----------|
| Chart.js | 4.4.7 | CDN (jsDelivr) | กราฟทั้ง 9 ชนิด |
| Google Fonts: Sarabun | - | CDN (Google) | ฟอนต์ภาษาไทย |

**ไม่มี Backend / Database / API calls** — ทั้งหมดทำงานฝั่ง Client

---

## 6. การจัดการข้อมูลในหน่วยความจำ (Data Management)

```
┌───────────────────────────────┐
│  CKDDataGenerator (seed=42)   │
│  generatePatients(1530)       │
└──────────────┬────────────────┘
               ▼
    ┌─────────────────────┐
    │  patients[] Array    │ ← เก็บในหน่วยความจำ (In-Memory)
    │  1,530 records       │ ← คงอยู่ตลอด Session
    └──────────┬──────────┘
               │
    ┌──────────┼──────────────────────┐
    ▼          ▼                      ▼
 Overview   Individual             DataQuality
 (อ่านอย่างเดียว) (กรอง/เรียง/เลือก)  (วิเคราะห์คุณภาพ)
               │
               ▼
    ┌─────────────────────┐
    │ filteredPatients[]   │ ← สำเนาที่กรองแล้ว
    │ (dynamic subset)     │
    └──────────────────────┘
```

- **ไม่มีการบันทึกข้อมูล** ถาวร — รีโหลดหน้า = สร้างข้อมูลใหม่ (แต่เหมือนเดิมเพราะ seed คงที่)
- **Chart.js instances** ถูกทำลายและสร้างใหม่เมื่อจำเป็น

---

## 7. ข้อกำหนดทางเทคนิค (Technical Requirements)

- **Browser:** รองรับ ES6+ (Chrome, Firefox, Safari, Edge เวอร์ชันใหม่)
- **Internet:** จำเป็นสำหรับโหลด CDN (Chart.js, Google Fonts) ครั้งแรก
- **Server:** ไม่จำเป็น — เปิดไฟล์ HTML ตรงได้ หรือใช้ Static File Server
- **ขนาด:** ~70 KB ซอร์สโค้ด + CDN resources
