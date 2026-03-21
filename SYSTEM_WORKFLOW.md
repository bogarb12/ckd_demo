# Diabetes Tracking System - กระบวนการทำงาน (System Workflow)

## 1. กระบวนการ Authentication (การยืนยันตัวตน)

```
┌─────────────┐     POST /api/auth/login      ┌──────────────┐
│   ผู้ใช้งาน   │ ──── username + password ────> │   Server     │
│  (Browser)   │                                │  (Express)   │
└──────┬──────┘                                └──────┬───────┘
       │                                              │
       │                                    ┌─────────v─────────┐
       │                                    │ ตรวจสอบ users.json │
       │                                    │ bcrypt.compare()   │
       │                                    └─────────┬─────────┘
       │                                              │
       │              ถ้าผ่าน                          │
       │    <──── JWT Token (7 วัน) ──────────────────┘
       │
┌──────v──────┐
│ เก็บ Token   │
│ sessionStorage│
│ dt_auth_token │
│ dt_auth_user  │
└──────┬──────┘
       │
       │  ทุก API Request ต่อไป
       │  Header: Authorization: Bearer {token}
       v
```

### สิทธิ์การเข้าถึง (Role-Based Access)

```
┌─────────────────────────────────────────────────────────┐
│                    Role Permissions                       │
├─────────┬──────┬───────┬────────────┬───────────────────┤
│ Feature │admin │ staff │ researcher │ guest (no login)  │
├─────────┼──────┼───────┼────────────┼───────────────────┤
│ ดูข้อมูล  │  ✓   │   ✓   │     ✓      │        ✓         │
│ เพิ่มผู้ป่วย│  ✓   │   ✓   │     ✓      │        ✓         │
│ แก้ไขข้อมูล│  ✓   │   ✓   │     ✓      │        ✗         │
│ ลบผู้ป่วย  │  ✓   │   ✗   │     ✗      │        ✗         │
│ Dashboard│  ✓   │   ✗   │     ✓      │        ✗         │
│ Export CSV│ ✓   │   ✗   │     ✗      │        ✗         │
│ Import CSV│ ✓   │   ✓   │     ✗      │        ✗         │
│ จัดการ User│ ✓   │   ✗   │     ✗      │        ✗         │
└─────────┴──────┴───────┴────────────┴───────────────────┘
```

---

## 2. กระบวนการลงทะเบียนผู้ป่วย (Patient Registration - CRF 6 Steps)

```
┌────────────────────────────────────────────────────────────────┐
│                    CRF 6-Step Wizard Form                       │
│                                                                  │
│  Step 1          Step 2           Step 3          Step 4        │
│  ข้อมูลพื้นฐาน     ผลตรวจทางคลินิก    PAID-5          การเข้าร่วม     │
│  ┌──────────┐   ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ รหัสผู้ป่วย  │   │ HbA1c    │    │ Q1-Q5    │    │ จำนวนครั้ง  │   │
│  │ ชื่อ-สกุล   │   │ FBS      │    │ Baseline │    │ LINE     │   │
│  │ เพศ/อายุ   │   │ GFR      │    │ 6-month  │    │ engagement│   │
│  │ น้ำหนัก/สูง │   │ DTX 1-6  │    │ auto-calc│    │ (กลุ่มทดลอง)│   │
│  │ BMI/รอบเอว │   │          │    │ distress │    │          │   │
│  │ การศึกษา   │   │          │    │ category │    │          │   │
│  │ อาชีพ      │   │          │    │          │    │          │   │
│  │ โรคร่วม    │   │          │    │          │    │          │   │
│  │ ยาที่ใช้    │   │          │    │          │    │          │   │
│  │ LINE usage│   │          │    │          │    │          │   │
│  └──────────┘   └──────────┘    └──────────┘    └──────────┘   │
│                                                                  │
│  Step 5              Step 6                                      │
│  เหตุการณ์ไม่พึงประสงค์   สถานะติดตาม                                │
│  ┌──────────┐        ┌──────────┐                               │
│  │ มี/ไม่มี    │        │ complete │                               │
│  │ รายละเอียด  │        │ lost     │                               │
│  │ วันที่เกิดเหตุ│        │ withdrawn│                               │
│  │           │        │ เหตุผล    │                               │
│  └──────────┘        └──────────┘                               │
│                                                                  │
│                    [ บันทึก / Save ]                              │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                    POST /api/patients
                          │
                          v
┌──────────────────────────────────────────────────────────────┐
│                    Server Processing                          │
│                                                                │
│  1. INSERT → patients (ข้อมูลพื้นฐาน)                           │
│  2. INSERT → clinical_outcomes (HbA1c, FBS, GFR, DTX)         │
│  3. INSERT → paid5_scores (PAID-5 + auto-calculate total)     │
│  4. INSERT → program_participation (ถ้ากลุ่มทดลอง)               │
│  5. INSERT → adverse_events (ถ้ามีเหตุการณ์)                     │
│  6. INSERT → follow_up_status (สถานะติดตาม)                     │
│                                                                │
│  ทั้งหมดทำใน Transaction เดียว                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. กระบวนการบันทึก DTX (DTX Tracking Flow)

```
┌──────────────┐                    ┌──────────────┐
│  เลือกผู้ป่วย   │                    │  กรอกค่า DTX  │
│  จากรายชื่อ    │ ──────────────>   │  DTX 1-6     │
└──────────────┘                    │  (mg/dL)     │
                                    └──────┬───────┘
                                           │
                                    POST /api/dtx/:id
                                           │
                                           v
                              ┌────────────────────────┐
                              │  คำนวณค่าเฉลี่ย DTX     │
                              │  avg = sum / count      │
                              │  (เฉพาะค่าที่กรอก)       │
                              └────────────┬───────────┘
                                           │
                                           v
                              ┌────────────────────────┐
                              │  บันทึกลง                │
                              │  clinical_outcomes      │
                              │  (dtx1-6 + dtx_avg)    │
                              └────────────┬───────────┘
                                           │
                                    GET /api/dtx/:id
                                           │
                                           v
                              ┌────────────────────────┐
                              │  แสดงผลวิเคราะห์          │
                              │                        │
                              │  📊 กราฟ DTX แต่ละครั้ง    │
                              │  📊 เปรียบเทียบ HbA1c    │
                              │  📊 เปรียบเทียบ PAID-5   │
                              │  📊 เปรียบเทียบ HL Score │
                              │                        │
                              │  สี: 🟢 <100 ปกติ        │
                              │       🟡 100-125 เฝ้าระวัง │
                              │       🟠 126-180 สูง     │
                              │       🔴 >180 สูงมาก     │
                              └────────────────────────┘
```

---

## 4. กระบวนการบันทึกสุขภาพรายวัน (Daily Tracking Flow)

```
┌──────────────────────────────────────────────────────┐
│              Daily Tracking Form                      │
│                                                        │
│  🩸 น้ำตาลในเลือด        🍽️ อาหาร                      │
│  ┌───────────────┐      ┌───────────────┐            │
│  │ Fasting (เช้า)  │      │ รายการอาหาร    │            │
│  │ Post-meal (หลังอาหาร)│  │ (JSON format) │            │
│  │ Bedtime (ก่อนนอน)│    │               │            │
│  └───────────────┘      └───────────────┘            │
│                                                        │
│  🏃 การออกกำลังกาย        💊 ยา                         │
│  ┌───────────────┐      ┌───────────────┐            │
│  │ ประเภท (เดิน/วิ่ง)│     │ รายการยา      │            │
│  │ ระยะเวลา (นาที) │      │ ความสม่ำเสมอ   │            │
│  │ ความหนัก        │      │               │            │
│  └───────────────┘      └───────────────┘            │
│                                                        │
│  🦶 การดูแลเท้า                                        │
│  ┌───────────────┐                                    │
│  │ ตรวจเท้า ✓/✗   │                                    │
│  │ ทาครีม ✓/✗     │                                    │
│  │ มีแผล ✓/✗      │                                    │
│  └───────────────┘                                    │
│                                                        │
│              [ บันทึกประจำวัน ]                           │
└─────────────────────┬────────────────────────────────┘
                      │
               POST /api/tracking/:id
                      │
                      v
              ┌───────────────┐
              │ daily_tracking │
              │ table          │
              │ (UPSERT by    │
              │  patient+date) │
              └───────────────┘
```

---

## 5. กระบวนการแบบประเมิน (Questionnaire Flow)

```
┌──────────────────────────────────────────────────────────┐
│                 Questionnaire System                      │
│                                                            │
│  ┌─────────────────────┐   ┌─────────────────────┐       │
│  │  Health Literacy     │   │  Self-Care           │       │
│  │  ความรอบรู้ด้านสุขภาพ  │   │  พฤติกรรมดูแลตนเอง     │       │
│  │                     │   │                     │       │
│  │  10 ข้อ              │   │  12 ข้อ              │       │
│  │  Q1: หาข้อมูลอาหาร   │   │  Q1: ควบคุมปริมาณอาหาร│       │
│  │  Q2: เลือกอาหาร     │   │  Q2: เลือกอาหาร     │       │
│  │  Q3: ออกกำลังกาย    │   │  Q3: ออกกำลังกาย    │       │
│  │  Q4: รับประทานยา    │   │  Q4: กินยาตามสั่ง    │       │
│  │  Q5: ดูแลเท้า       │   │  Q5: ตรวจเท้า       │       │
│  │  Q6-Q10: อื่นๆ      │   │  Q6-Q12: อื่นๆ      │       │
│  │                     │   │                     │       │
│  │  ⏱ Baseline        │   │  ⏱ Baseline        │       │
│  │  ⏱ 6 เดือน          │   │  ⏱ 6 เดือน          │       │
│  └─────────┬───────────┘   └─────────┬───────────┘       │
│            │                         │                    │
│            └────────┬────────────────┘                    │
│                     │                                     │
│              POST /api/questionnaire/:id                  │
│                     │                                     │
│                     v                                     │
│            ┌────────────────┐                             │
│            │  คำนวณคะแนนรวม  │                             │
│            │  total = Σ(Q)  │                             │
│            └────────┬───────┘                             │
│                     │                                     │
│            ┌────────v────────┐                            │
│            │ INSERT/UPDATE   │                            │
│            │ health_literacy │                            │
│            │ self_care       │                            │
│            └─────────────────┘                            │
└──────────────────────────────────────────────────────────┘
```

---

## 6. กระบวนการ CSV Import/Export

### Export Flow

```
Admin กดปุ่ม "Export CSV"
        │
  GET /api/export/csv (Admin Only)
        │
        v
┌──────────────────────────────┐
│  Query: SELECT patients      │
│  LEFT JOIN clinical_outcomes │
│  LEFT JOIN paid5_scores      │
│  LEFT JOIN health_literacy   │
│  LEFT JOIN self_care         │
│  LEFT JOIN follow_up_status  │
│  LEFT JOIN program_part.     │
└──────────┬───────────────────┘
           │
           v
┌──────────────────────────────┐
│  แปลงเป็น CSV                 │
│  - UTF-8 BOM (รองรับภาษาไทย)  │
│  - 80+ columns               │
│  - Quoted fields             │
│  - Content-Disposition       │
│  - filename: patients_export │
└──────────┬───────────────────┘
           │
           v
    📄 ดาวน์โหลดไฟล์ .csv
```

### Import Flow

```
┌──────────────┐
│  เลือกไฟล์ CSV │
│  (max 5MB)   │
└──────┬───────┘
       │
  POST /api/import/csv
  (multipart/form-data)
       │
       v
┌──────────────────────────────┐
│  Multer: parse CSV file      │
│  (memory storage)            │
└──────────┬───────────────────┘
           │
           v
┌──────────────────────────────┐
│  วนลูปแต่ละแถว:                │
│                              │
│  1. ตรวจสอบ patient_id       │
│  2. INSERT/UPDATE patients   │
│  3. INSERT/UPDATE clinical   │
│  4. INSERT/UPDATE paid5      │
│  5. INSERT/UPDATE HL & SC    │
│  6. INSERT/UPDATE follow_up  │
│                              │
│  Return: จำนวนที่ import สำเร็จ │
└──────────────────────────────┘
```

---

## 7. กระบวนการ Visitor Health Lookup (สำหรับผู้เยี่ยมชม)

```
ผู้เยี่ยมชม (ไม่ต้อง login)
        │
  พิมพ์ชื่อจริง ในช่องค้นหา
        │
  GET /api/visitor/health?name=ชื่อ
        │
        v
┌──────────────────────────────┐
│  ค้นหาใน patients table      │
│  WHERE first_name LIKE %ชื่อ% │
│  JOIN clinical_outcomes      │
└──────────┬───────────────────┘
           │
           v
┌──────────────────────────────┐
│  แสดงผลสุขภาพ:                │
│                              │
│  🔹 DTX Average              │
│  🔹 BMI                      │
│  🔹 HbA1c (Baseline/6m)     │
│  🔹 eGFR                    │
│  🔹 FBS                     │
│  🔹 รอบเอว                   │
│                              │
│  (ไม่แสดงข้อมูลส่วนบุคคลอื่น)    │
└──────────────────────────────┘
```

---

## 8. กระบวนการ LINE Bot Integration

```
┌──────────────────────────────────────────────────────┐
│              LINE Bot Script Generator                 │
│                                                        │
│  1. เลือก Mode:                                        │
│     ├── Messaging API (Channel-based)                 │
│     └── LINE Notify (Personal notifications)          │
│                                                        │
│  2. กรอก Credentials:                                  │
│     ├── Channel Access Token                          │
│     └── Channel Secret                                │
│                                                        │
│  3. Generate Script:                                   │
│     ├── Google Apps Script code                       │
│     ├── Webhook URL setup                             │
│     └── Auto-reply message templates                  │
│                                                        │
│  4. Deploy:                                            │
│     ├── Copy code → Google Apps Script               │
│     ├── Deploy as Web App                            │
│     └── Set Webhook URL in LINE Developers           │
└──────────────────────────────────────────────────────┘

                    Flow เมื่อ Deploy แล้ว:

ผู้ป่วย (LINE App)                    Google Apps Script
      │                                      │
      │── ส่งข้อความ ─────────────────────────>│
      │                                      │── เรียก API Server
      │                                      │   /api/visitor/health
      │                                      │<─ ได้ข้อมูลสุขภาพ
      │<─ ตอบกลับข้อมูลสุขภาพ + คำแนะนำ ────────│
      │                                      │
```

---

## 9. กระบวนการ Dashboard (Admin)

```
Admin Login
    │
    v
GET /api/dashboard/summary
    │
    v
┌──────────────────────────────────────────────────┐
│              Dashboard Summary                    │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ จำนวนผู้ป่วย │  │ กลุ่มทดลอง │  │ กลุ่มควบคุม│       │
│  │  Total    │  │  Exp.    │  │ Control  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                    │
│  📊 กราฟ HbA1c Progress                           │
│  ┌─────────────────────────────────┐             │
│  │  Baseline vs 6-month            │             │
│  │  Experimental vs Control        │             │
│  │  (Bar Chart - Chart.js)         │             │
│  └─────────────────────────────────┘             │
│                                                    │
│  📊 กราฟ PAID-5 Distress Trends                   │
│  ┌─────────────────────────────────┐             │
│  │  Baseline vs 6-month            │             │
│  │  Distribution by distress level │             │
│  └─────────────────────────────────┘             │
│                                                    │
│  📊 Health Literacy & Self-Care                   │
│  ┌─────────────────────────────────┐             │
│  │  Score comparison               │             │
│  │  Baseline vs 6-month            │             │
│  └─────────────────────────────────┘             │
│                                                    │
│  📋 ตารางข้อมูลผู้ป่วย (Scrollable Table)            │
│  📄 Export to CSV / Print Report                  │
└──────────────────────────────────────────────────┘
```

---

## 9.1 กระบวนการ DAX Analytics Dashboard (Power BI-style)

```
┌──────────────────────────────────────────────────────────┐
│          DAX Analytics Engine (diabetes-dax.js)            │
│          Client-side analytics — ไม่ต้องเรียก API เพิ่ม       │
└────────────────────────┬─────────────────────────────────┘
                         │
              ใช้ข้อมูลจาก patient list
              ที่โหลดมาแล้วใน memory
                         │
                         v
┌──────────────────────────────────────────────────────────┐
│                  Slicer Panel (Filter Context)            │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ กลุ่มการศึกษา  │  │ เพศ           │  │ ช่วงอายุ       │   │
│  │ ☑ Experimental│  │ ☑ ชาย         │  │ ├──●────┤     │   │
│  │ ☑ Control     │  │ ☑ หญิง        │  │ 20 — 90 ปี   │   │
│  │ ☑ Other       │  │ ☑ อื่นๆ        │  │ (Range Slider)│   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                            │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ ระดับ Distress │  │ โรคร่วม        │                      │
│  │ ☑ Low         │  │ ☐ DM          │                      │
│  │ ☑ Moderate    │  │ ☐ HT          │                      │
│  │ ☑ High        │  │ ☐ DLP         │                      │
│  └──────────────┘  └──────────────┘                      │
│                                                            │
│                   [ รีเซ็ตตัวกรอง ]                          │
└────────────────────────┬─────────────────────────────────┘
                         │
              DAXEngine.applyContext()
              CALCULATE + FILTER (DAX-style)
                         │
                         v
┌──────────────────────────────────────────────────────────┐
│                    KPI Cards (8 ตัว)                        │
│                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  │Total   │ │HbA1c   │ │Distress│ │Improved│            │
│  │Patients│ │Average │ │High/Low│ │HbA1c % │            │
│  └────────┘ └────────┘ └────────┘ └────────┘            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│  │BMI Avg │ │FBS Avg │ │DTX Avg │ │Age Avg │            │
│  └────────┘ └────────┘ └────────┘ └────────┘            │
└────────────────────────┬─────────────────────────────────┘
                         │
                         v
┌──────────────────────────────────────────────────────────┐
│                    Charts (4 กราฟ)                         │
│                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ HbA1c Comparison    │  │ PAID-5 Distribution  │        │
│  │ (Bar: BL vs 6m)     │  │ (Doughnut: Low/Med/  │        │
│  │ Exp vs Control      │  │  High)               │        │
│  └─────────────────────┘  └─────────────────────┘        │
│                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐        │
│  │ HL & SC Radar       │  │ Patient Ranking      │        │
│  │ (Radar: 6 metrics)  │  │ (Table: Top 20)      │        │
│  │ Normalized 0-100%   │  │ RANKX by HbA1c Δ    │        │
│  └─────────────────────┘  └─────────────────────┘        │
└──────────────────────────────────────────────────────────┘

        DAX Functions ที่ใช้ (client-side simulation):
        ─────────────────────────────────────────────
        CALCULATE()     — คำนวณ metric ภายใต้ filter context
        FILTER()        — กรองข้อมูลตาม slicer
        AVERAGEX()      — ค่าเฉลี่ยจาก iterator
        COUNTROWS()     — นับจำนวนแถว
        DIVIDE()        — หารปลอดภัย (handle zero)
        RANKX()         — จัดอันดับผู้ป่วย
        ALL()           — ยกเลิก filter (สำหรับ %)
```

---

## 10. กระบวนการ Server Startup

```
npm start / pm2 start
        │
        v
┌──────────────────────────────┐
│  1. Load .env config         │
│  2. Create MariaDB pool      │
│  3. Test DB connection       │
└──────────┬───────────────────┘
           │
           v
┌──────────────────────────────┐
│  4. Auto-create tables       │
│     (IF NOT EXISTS)          │
│  5. Run migrations           │
│     (ALTER TABLE ADD COLUMN) │
│  6. Create default admin     │
│     (if users.json empty)    │
└──────────┬───────────────────┘
           │
           v
┌──────────────────────────────┐
│  7. Setup middleware         │
│     - CORS                   │
│     - JSON parser            │
│     - Static files           │
│  8. Register all routes      │
│  9. Listen on PORT           │
└──────────┬───────────────────┘
           │
           v
    ✅ Server ready on port 4000
    📡 Database connected
```

---

## 11. กระบวนการ Research Study (ภาพรวมการวิจัย)

```
┌──────────────────────────────────────────────────────────┐
│         Randomized Controlled Trial (RCT)                 │
│         Diabetes School Program + LINE Bot                │
└──────────────────────────┬───────────────────────────────┘
                           │
              สุ่มแบ่งกลุ่ม (Randomization)
                           │
            ┌──────────────┴──────────────┐
            v                             v
   ┌─────────────────┐          ┌─────────────────┐
   │  กลุ่มทดลอง       │          │  กลุ่มควบคุม      │
   │  (Experimental)  │          │  (Control)       │
   │                  │          │                  │
   │  Diabetes School │          │  Diabetes School │
   │  + LINE Bot      │          │  เท่านั้น          │
   │  + Daily Track   │          │                  │
   └────────┬─────────┘          └────────┬─────────┘
            │                             │
            v                             v
   ┌──────────────────────────────────────────────┐
   │              Baseline Assessment              │
   │  • HbA1c, FBS, GFR, DTX                     │
   │  • PAID-5 (Diabetes Distress)                │
   │  • Health Literacy (10 ข้อ)                   │
   │  • Self-Care (12 ข้อ)                         │
   └──────────────────────┬───────────────────────┘
                          │
                     6 เดือน
                    (Follow-up)
                          │
                          v
   ┌──────────────────────────────────────────────┐
   │            6-Month Assessment                 │
   │  • HbA1c (6-month)                           │
   │  • PAID-5 (6-month)                          │
   │  • Health Literacy (6-month)                 │
   │  • Self-Care (6-month)                       │
   │  • Follow-up Status                          │
   │  • Adverse Events                            │
   └──────────────────────┬───────────────────────┘
                          │
                          v
   ┌──────────────────────────────────────────────┐
   │            Data Analysis (Dashboard)          │
   │                                              │
   │  เปรียบเทียบ Experimental vs Control:          │
   │  • HbA1c ลดลงมากกว่าหรือไม่?                    │
   │  • PAID-5 ลดลงมากกว่าหรือไม่?                   │
   │  • Health Literacy เพิ่มขึ้นหรือไม่?              │
   │  • Self-Care เพิ่มขึ้นหรือไม่?                    │
   └──────────────────────────────────────────────┘
```

---

## 12. สรุป Data Flow ของระบบทั้งหมด

```
                    ┌─────────────────┐
                    │   LINE Bot       │
                    │   (Google Apps)  │
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │  Visitor Lookup  │
                    │  (Public API)   │
                    └────────┬────────┘
                             │
┌──────────┐    ┌────────────v────────────┐    ┌──────────┐
│  CSV     │───>│                          │<───│  CSV     │
│  Import  │    │     Express Server       │    │  Export  │
└──────────┘    │     /api/*               │    └──────────┘
                │                          │
                │  Auth │ CRUD │ Analytics │
                └───┬──────┬──────┬───────┘
                    │      │      │
         ┌──────────┘      │      └──────────┐
         v                 v                  v
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   patients   │  │  clinical_   │  │  daily_      │
│   (ข้อมูลหลัก) │  │  outcomes   │  │  tracking    │
└──────────────┘  │  paid5_scores│  │  (รายวัน)     │
                  │  health_lit  │  └──────────────┘
                  │  self_care   │
                  └──────────────┘
                         │
                         v
                ┌──────────────────┐
                │   Dashboard      │
                │   (Chart.js)     │
                │   📊 สรุปผลวิจัย   │
                └────────┬─────────┘
                         │
                         v
                ┌──────────────────┐
                │  DAX Analytics   │
                │  (Power BI-style)│
                │  📊 KPI + Charts │
                │  🎛️ Slicer Filter│
                │  🏆 Patient Rank │
                └──────────────────┘
```
