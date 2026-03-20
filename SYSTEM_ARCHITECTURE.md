# Diabetes Tracking System - โครงสร้างระบบ

## สถาปัตยกรรมระบบ (System Architecture)

```
+--------------------------------------------------+
|                   Client (Browser)                |
|                                                    |
|  diabetes.html          index.html                 |
|  (Diabetes Tracking)    (CKD Dashboard)            |
|                                                    |
|  +----------------------------------------------+  |
|  | JavaScript Modules                            | |
|  | diabetes-app.js      diabetes-auth.js         | |
|  | diabetes-form.js     diabetes-dtx.js          | |
|  | diabetes-dashboard.js diabetes-questionnaire.js| |
|  | diabetes-tracking.js  diabetes-linebot.js     | |
|  | diabetes-education.js                         | |
|  +----------------------------------------------+  |
|  | CSS: diabetes.css | style.css                 | |
|  | Libs: Chart.js | FontAwesome | Google Fonts   | |
|  +----------------------------------------------+  |
+-------------------------+------------------------+
                          |
                    HTTP / REST API
                    (Port 4000)
                          |
+-------------------------v------------------------+
|              Express.js Server                    |
|              server/server.js                     |
|                                                    |
|  +----------------------------------------------+  |
|  | Middleware                                    | |
|  | CORS | JSON Parser | Static Files | Multer   | |
|  | JWT Auth | Role-based Access Control          | |
|  +----------------------------------------------+  |
|  | API Endpoints                                 | |
|  | /api/auth/*        Authentication             | |
|  | /api/patients/*    Patient CRUD               | |
|  | /api/dtx/*         DTX Tracking               | |
|  | /api/questionnaire/* Health Literacy/Self-care| |
|  | /api/tracking/*    Daily Tracking             | |
|  | /api/visitor/*     Visitor Health Lookup       | |
|  | /api/export/*      CSV Export                 | |
|  | /api/import/*      CSV Import                 | |
|  | /api/users/*       User Management            | |
|  | /api/stats/*       Statistics                 | |
|  | /api/dashboard/*   Dashboard Summary          | |
|  +----------------------------------------------+  |
+-------------------------+------------------------+
                          |
+-------------------------v------------------------+
|              MariaDB Database                     |
|              diabetes_tracking                    |
|                                                    |
|  patients | clinical_outcomes | paid5_scores      |
|  health_literacy | self_care | daily_tracking     |
|  program_participation | adverse_events           |
|  follow_up_status                                 |
+--------------------------------------------------+
|              File Storage                         |
|  data/users.json (User credentials, bcrypt)       |
+--------------------------------------------------+
```

---

## โครงสร้างไฟล์ (File Structure)

```
diabetes-tracking/
├── server/
│   ├── server.js              # Express server + API endpoints (80KB)
│   ├── db.js                  # MariaDB connection pool
│   └── schema.sql             # Database schema + migrations
│
├── js/
│   ├── diabetes-app.js        # Main app controller, API client, navigation
│   ├── diabetes-auth.js       # JWT auth, login/logout, role access
│   ├── diabetes-form.js       # CRF 6-step wizard form
│   ├── diabetes-dtx.js        # DTX recording & analysis charts
│   ├── diabetes-dashboard.js  # Admin dashboard, charts, print report
│   ├── diabetes-questionnaire.js # Health literacy & self-care surveys
│   ├── diabetes-tracking.js   # Daily behavior tracking
│   ├── diabetes-education.js  # Educational video content
│   └── diabetes-linebot.js    # LINE Bot script generator
│
├── css/
│   ├── diabetes.css           # Main application styles (1,957 lines)
│   └── style.css              # CKD dashboard styles
│
├── data/
│   └── users.json             # User credentials (bcrypt hashed)
│
├── diabetes.html              # Main diabetes tracking SPA
├── index.html                 # CKD progression dashboard
├── schema.sql                 # Root database schema
├── package.json               # Dependencies & scripts
├── .env                       # Database & server config
├── ecosystem.config.js        # PM2 deployment config
└── deploy.sh                  # Deployment script
```

---

## ฐานข้อมูล (Database Schema)

### Entity Relationship Diagram

```
+------------------+       +----------------------+
|    patients      |       |  clinical_outcomes   |
+------------------+       +----------------------+
| patient_id (PK)  |<──────| patient_id (FK, UQ)  |
| first_name       |       | hba1c_baseline       |
| last_name        |       | hba1c_6month         |
| gender           |       | fbs, gfr             |
| age              |       | dtx1-dtx6, dtx_avg   |
| weight, height   |       +----------------------+
| bmi, waist       |
| study_group      |       +----------------------+
| education_level  |       |   paid5_scores       |
| occupation       |       +----------------------+
| diabetes_duration|<──────| patient_id (PK, FK)  |
| d1-d7 (comorbid) |       | q1-q5_baseline       |
| medication       |       | q1-q5_6month         |
| line_usage       |       | total_baseline/6month|
+------------------+       | distress_baseline/6m |
        |                   +----------------------+
        |
        |                   +----------------------+
        |                   |  health_literacy     |
        |                   +----------------------+
        +──────────────────>| patient_id (PK, FK)  |
        |                   | q1-q10_baseline      |
        |                   | q1-q10_6month        |
        |                   | total_baseline/6month|
        |                   +----------------------+
        |
        |                   +----------------------+
        |                   |     self_care        |
        |                   +----------------------+
        +──────────────────>| patient_id (PK, FK)  |
        |                   | q1-q12_baseline      |
        |                   | q1-q12_6month        |
        |                   | total_baseline/6month|
        |                   +----------------------+
        |
        |                   +----------------------+
        |                   |   daily_tracking     |
        |                   +----------------------+
        +──────────────────>| patient_id (FK)      |
        |                   | tracking_date        |
        |                   | bs_fasting/post/bed  |
        |                   | diet, exercise       |
        |                   | medication, foot_care|
        |                   +----------------------+
        |
        |                   +----------------------+
        |                   | follow_up_status     |
        +──────────────────>| patient_id (PK, FK)  |
        |                   | status               |
        |                   | withdrawal_reason    |
        |                   +----------------------+
        |
        |                   +----------------------+
        |                   |program_participation |
        +──────────────────>| patient_id (PK, FK)  |
        |                   | sessions_attended    |
        |                   | line_engagement      |
        |                   +----------------------+
        |
        |                   +----------------------+
        |                   |  adverse_events      |
        +──────────────────>| patient_id (FK)      |
                            | has_event, desc      |
                            | event_date           |
                            +----------------------+
```

### รายละเอียดตาราง

| ตาราง | คำอธิบาย | จำนวนคอลัมน์ |
|-------|----------|-------------|
| `patients` | ข้อมูลพื้นฐานผู้ป่วย (ชื่อ, อายุ, น้ำหนัก, โรคร่วม) | 22 |
| `clinical_outcomes` | ผลตรวจทางคลินิก (HbA1c, FBS, GFR, DTX 1-6) | 15 |
| `paid5_scores` | แบบประเมินความเครียด PAID-5 (5 ข้อ x 2 ช่วง) | 15 |
| `health_literacy` | ความรอบรู้ด้านสุขภาพ (10 ข้อ x 2 ช่วง) | 23 |
| `self_care` | พฤติกรรมดูแลตนเอง (12 ข้อ x 2 ช่วง) | 27 |
| `daily_tracking` | บันทึกสุขภาพรายวัน (น้ำตาล, อาหาร, ออกกำลังกาย) | 14 |
| `program_participation` | การเข้าร่วมโปรแกรม (กลุ่มทดลอง) | 5 |
| `adverse_events` | เหตุการณ์ไม่พึงประสงค์ | 6 |
| `follow_up_status` | สถานะการติดตาม | 5 |

---

## API Endpoints

### Authentication

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| POST | `/api/auth/login` | - | Login ด้วย username/password, return JWT |
| GET | `/api/auth/me` | JWT | ตรวจสอบ token, return ข้อมูล user |

### Patient Management

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/patients` | - | ดึงรายชื่อผู้ป่วยทั้งหมด (JOIN clinical, PAID-5, HL, SC) |
| GET | `/api/patients/:id` | - | ดึงข้อมูลผู้ป่วยรายบุคคลพร้อมข้อมูลที่เกี่ยวข้อง |
| POST | `/api/patients` | - | สร้างผู้ป่วยใหม่ + ผลตรวจ + PAID-5 + participation |
| PUT | `/api/patients/:id` | JWT | แก้ไขข้อมูลผู้ป่วย |
| DELETE | `/api/patients/:id` | Admin | ลบผู้ป่วย |

### DTX Tracking

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/dtx/:id` | - | ดึงค่า DTX + ข้อมูลเปรียบเทียบ (HbA1c, PAID-5, HL, BMI) |
| POST | `/api/dtx/:id` | - | บันทึกค่า DTX 6 ครั้ง (คำนวณค่าเฉลี่ยอัตโนมัติ) |

### Questionnaires

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| POST | `/api/questionnaire/:id` | - | บันทึกแบบประเมิน HL (10 ข้อ) + Self-care (12 ข้อ) |

### Daily Tracking

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/tracking/:id` | - | ดึงบันทึกสุขภาพรายวัน |
| POST | `/api/tracking/:id` | - | บันทึก/อัปเดตข้อมูลสุขภาพรายวัน |

### Visitor (Public)

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/visitor/health?name=` | - | ค้นหาผลสุขภาพด้วยชื่อจริง (DTX, BMI, HbA1c) |
| GET | `/api/status` | - | ตรวจสอบสถานะ database |
| GET | `/api/stats/counts` | - | สถิติจำนวนผู้ป่วย |

### Admin Dashboard

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/dashboard/summary` | Admin | สรุปข้อมูล Dashboard (HbA1c, PAID-5, HL, SC) |
| GET | `/api/export/csv` | Admin | ส่งออกข้อมูลทั้งหมดเป็น CSV |
| GET | `/api/import/template` | - | ดาวน์โหลด template CSV |
| POST | `/api/import/csv` | - | นำเข้าข้อมูลจาก CSV |

### User Management

| Method | Endpoint | Auth | คำอธิบาย |
|--------|----------|------|----------|
| GET | `/api/users` | Admin | รายชื่อ users ทั้งหมด |
| POST | `/api/users` | Admin | สร้าง user ใหม่ |
| PUT | `/api/users/:username` | Admin | แก้ไข user |
| DELETE | `/api/users/:username` | Admin | ลบ user |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6) |
| **UI Library** | Chart.js 4.4.7, FontAwesome 6.5 |
| **Fonts** | Google Fonts: Athiti, Sarabun (Thai) |
| **Backend** | Node.js + Express.js 4.x |
| **Database** | MariaDB (MySQL compatible) |
| **Auth** | JWT (jsonwebtoken) + bcryptjs |
| **File Upload** | Multer (memory storage, 5MB limit) |
| **Process Manager** | PM2 |
| **Web Server** | Apache (ProxyPass to Node.js) |

---

## การ Deploy

```
Apache (Port 80/443)
  │
  ├── ProxyPass /diabetes.html → localhost:4000
  │
  └── PM2
       └── server/server.js (Node.js, Port 4000)
            └── MariaDB (Port 3306, localhost)
```

### คำสั่ง Deploy

```bash
# Install dependencies
npm install

# Start server with PM2
pm2 start server/server.js --name diabetes-server

# Restart after code update
pm2 restart diabetes-server

# View logs
pm2 logs diabetes-server
```
