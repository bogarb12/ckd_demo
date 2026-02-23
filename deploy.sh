#!/bin/bash
# =============================================================================
# Diabetes Tracking App - Safe Deployment Script
# สำหรับเซิร์ฟเวอร์ CED NRRU (ced.nrru.ac.th)
# =============================================================================
#
# สิ่งที่สคริปต์นี้ทำ:
#   1. ตรวจสอบระบบเดิม (Huathale, TPMAP) ก่อน deploy
#   2. Clone/update repo ไปที่ /var/www/html/diabetes-tracking
#   3. ติดตั้ง dependencies, สร้าง .env, สร้าง database
#   4. เริ่ม PM2 process
#   5. เพิ่ม Apache ProxyPass config (ถ้ายังไม่มี)
#   6. ทดสอบทั้ง 3 ระบบหลัง deploy
#
# วิธีใช้:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# =============================================================================

set -e  # หยุดทันทีถ้ามี error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

APP_DIR="/var/www/html/diabetes-tracking"
APACHE_CONF="/etc/apache2/sites-available/ced.nrru.ac.th.conf"
REPO_URL="https://github.com/bogarb12/ckd_demo.git"
BRANCH="claude/diabetes-tracking-webapp-muRJg"

echo "============================================"
echo "  Diabetes Tracking App - Deployment"
echo "============================================"
echo ""

# -----------------------------------------------
# Step 0: ตรวจสอบสิทธิ์ root
# -----------------------------------------------
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: กรุณารันด้วย sudo${NC}"
    echo "  sudo ./deploy.sh"
    exit 1
fi

# -----------------------------------------------
# Step 1: ตรวจสอบระบบเดิมก่อน deploy
# -----------------------------------------------
echo -e "${YELLOW}[1/7] ตรวจสอบระบบเดิม...${NC}"

# ตรวจ Apache
if ! systemctl is-active --quiet apache2; then
    echo -e "${RED}ERROR: Apache ไม่ทำงาน! กรุณาแก้ไข Apache ก่อน deploy${NC}"
    exit 1
fi
echo "  ✓ Apache ทำงานปกติ"

# ตรวจ MariaDB
if ! systemctl is-active --quiet mariadb; then
    echo -e "${RED}ERROR: MariaDB ไม่ทำงาน! กรุณาแก้ไข MariaDB ก่อน deploy${NC}"
    exit 1
fi
echo "  ✓ MariaDB ทำงานปกติ"

# ตรวจ Huathale
if command -v pm2 &> /dev/null; then
    if pm2 describe huathale-backend &> /dev/null; then
        echo "  ✓ Huathale backend ทำงานปกติ"
    else
        echo -e "${YELLOW}  ⚠ Huathale backend ไม่พบใน PM2 (อาจชื่ออื่น)${NC}"
    fi
fi

# ตรวจเว็บเดิม
echo "  กำลังตรวจสอบเว็บเดิม..."
if curl -ksf -o /dev/null "https://ced.nrru.ac.th/huathale/" 2>/dev/null; then
    echo "  ✓ Huathale เข้าถึงได้"
else
    echo -e "${YELLOW}  ⚠ Huathale ไม่ตอบ (อาจเป็นปกติถ้ายังไม่ setup SSL)${NC}"
fi

if curl -ksf -o /dev/null "https://ced.nrru.ac.th/OpenGISData-Thailand/tpmap_help/" 2>/dev/null; then
    echo "  ✓ TPMAP Help เข้าถึงได้"
else
    echo -e "${YELLOW}  ⚠ TPMAP Help ไม่ตอบ (อาจเป็นปกติถ้ายังไม่ setup SSL)${NC}"
fi
echo ""

# -----------------------------------------------
# Step 2: Clone หรือ Update repo
# -----------------------------------------------
echo -e "${YELLOW}[2/7] เตรียมไฟล์ application...${NC}"

if [ -d "$APP_DIR" ]; then
    echo "  พบ directory เดิม กำลัง update..."
    cd "$APP_DIR"
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    echo "  กำลัง clone repository..."
    git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# Set ownership
chown -R ubuntu:ubuntu "$APP_DIR"
echo "  ✓ ไฟล์พร้อมแล้ว"
echo ""

# -----------------------------------------------
# Step 3: ติดตั้ง dependencies
# -----------------------------------------------
echo -e "${YELLOW}[3/7] ติดตั้ง dependencies...${NC}"
cd "$APP_DIR"
sudo -u ubuntu npm install --production
echo "  ✓ Dependencies ติดตั้งแล้ว"
echo ""

# -----------------------------------------------
# Step 4: สร้าง .env (ถ้ายังไม่มี)
# -----------------------------------------------
echo -e "${YELLOW}[4/7] ตรวจสอบ .env...${NC}"
if [ ! -f "$APP_DIR/.env" ]; then
    echo "  สร้าง .env จาก .env.example..."
    if [ -f "$APP_DIR/.env.example" ]; then
        cp "$APP_DIR/.env.example" "$APP_DIR/.env"
        chown ubuntu:ubuntu "$APP_DIR/.env"
        echo -e "${YELLOW}  ⚠ กรุณาแก้ไข .env ให้ตรงกับเซิร์ฟเวอร์:${NC}"
        echo "    nano $APP_DIR/.env"
    else
        cat > "$APP_DIR/.env" << 'ENVEOF'
DB_HOST=localhost
DB_PORT=3306
DB_USER=ubuntu
DB_PASSWORD=YOUR_PASSWORD_HERE
DB_NAME=diabetes_tracking
PORT=3000
ENVEOF
        chown ubuntu:ubuntu "$APP_DIR/.env"
        echo -e "${RED}  ⚠ กรุณาตั้งค่า DB_PASSWORD ใน .env:${NC}"
        echo "    nano $APP_DIR/.env"
    fi
else
    echo "  ✓ .env มีอยู่แล้ว"
fi
echo ""

# -----------------------------------------------
# Step 5: สร้าง Database (ถ้ายังไม่มี)
# -----------------------------------------------
echo -e "${YELLOW}[5/7] ตรวจสอบ database...${NC}"
DB_EXISTS=$(mysql -u ubuntu -p"$(grep DB_PASSWORD "$APP_DIR/.env" | cut -d= -f2)" -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'diabetes_tracking'" 2>/dev/null | grep diabetes_tracking || true)

if [ -z "$DB_EXISTS" ]; then
    echo "  กำลังสร้าง database..."
    mysql -u ubuntu -p"$(grep DB_PASSWORD "$APP_DIR/.env" | cut -d= -f2)" < "$APP_DIR/server/schema.sql" 2>/dev/null
    echo "  ✓ Database สร้างแล้ว"
else
    echo "  ✓ Database มีอยู่แล้ว"
fi
echo ""

# -----------------------------------------------
# Step 6: เริ่ม PM2 process
# -----------------------------------------------
echo -e "${YELLOW}[6/7] เริ่ม PM2 process...${NC}"

# สร้าง logs directory
mkdir -p "$APP_DIR/logs"
chown ubuntu:ubuntu "$APP_DIR/logs"

# หยุด process เดิม (ถ้ามี)
sudo -u ubuntu pm2 delete diabetes-tracking 2>/dev/null || true

# เริ่ม process ใหม่
cd "$APP_DIR"
sudo -u ubuntu pm2 start ecosystem.config.js
sudo -u ubuntu pm2 save

echo "  ✓ PM2 process เริ่มแล้ว"
echo ""

# -----------------------------------------------
# Step 7: ตั้งค่า Apache Reverse Proxy
# -----------------------------------------------
echo -e "${YELLOW}[7/7] ตรวจสอบ Apache config...${NC}"

# ตรวจว่ามี config สำหรับ diabetes แล้วหรือยัง
if grep -q "diabetes" "$APACHE_CONF" 2>/dev/null; then
    echo "  ✓ Apache config สำหรับ diabetes มีอยู่แล้ว"
else
    echo -e "${YELLOW}  ⚠ ยังไม่มี Apache config สำหรับ diabetes${NC}"
    echo ""
    echo "  กรุณาเพิ่ม config ด้วยตนเอง (เพื่อความปลอดภัย):"
    echo ""
    echo "  ขั้นตอน:"
    echo "  1. Backup config:"
    echo "     sudo cp $APACHE_CONF ${APACHE_CONF}.bak.\$(date +%Y%m%d%H%M)"
    echo ""
    echo "  2. เปิดแก้ไข:"
    echo "     sudo nano $APACHE_CONF"
    echo ""
    echo "  3. เพิ่มในทั้ง VirtualHost *:80 และ *:443:"
    echo "     ──────────────────────────────────────"
    echo "     # Diabetes Tracking App (Node.js port 3000)"
    echo "     ProxyPass /diabetes/ http://127.0.0.1:3000/"
    echo "     ProxyPassReverse /diabetes/ http://127.0.0.1:3000/"
    echo "     ──────────────────────────────────────"
    echo ""
    echo "  4. เปิด mod_proxy (ถ้ายังไม่ได้เปิด):"
    echo "     sudo a2enmod proxy proxy_http"
    echo ""
    echo "  5. ตรวจสอบและ reload:"
    echo "     sudo apache2ctl configtest"
    echo "     sudo systemctl reload apache2"
fi
echo ""

# -----------------------------------------------
# ตรวจสอบผลลัพธ์
# -----------------------------------------------
echo "============================================"
echo "  ตรวจสอบผลลัพธ์"
echo "============================================"
echo ""

# ตรวจ Node.js app
sleep 2
if curl -sf "http://127.0.0.1:3000/api/status" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Diabetes Tracking App ทำงานที่ port 3000${NC}"
else
    echo -e "  ${RED}✗ Diabetes Tracking App ไม่ตอบที่ port 3000${NC}"
    echo "    ตรวจสอบ: pm2 logs diabetes-tracking --lines 20"
fi

# ตรวจ Huathale (ไม่กระทบระบบเดิม)
if curl -ksf -o /dev/null "https://ced.nrru.ac.th/huathale/" 2>/dev/null; then
    echo -e "  ${GREEN}✓ Huathale ยังเข้าถึงได้ปกติ${NC}"
else
    echo -e "  ${YELLOW}⚠ Huathale ไม่ตอบ (ตรวจสอบเพิ่มเติม)${NC}"
fi

# ตรวจ TPMAP
if curl -ksf -o /dev/null "https://ced.nrru.ac.th/OpenGISData-Thailand/tpmap_help/" 2>/dev/null; then
    echo -e "  ${GREEN}✓ TPMAP Help ยังเข้าถึงได้ปกติ${NC}"
else
    echo -e "  ${YELLOW}⚠ TPMAP Help ไม่ตอบ (ตรวจสอบเพิ่มเติม)${NC}"
fi

# ตรวจ Diabetes ผ่าน Apache (ถ้ามี config แล้ว)
if grep -q "diabetes" "$APACHE_CONF" 2>/dev/null; then
    if curl -ksf -o /dev/null "https://ced.nrru.ac.th/diabetes/diabetes.html" 2>/dev/null; then
        echo -e "  ${GREEN}✓ Diabetes ผ่าน Apache (/diabetes/) เข้าถึงได้${NC}"
    else
        echo -e "  ${YELLOW}⚠ Diabetes ยังเข้าผ่าน Apache ไม่ได้ (ตรวจ apache config)${NC}"
    fi
fi

echo ""
echo "============================================"
echo "  URL ที่ใช้งาน"
echo "============================================"
echo "  ทดสอบตรง:  http://49.231.27.66:3000/diabetes.html"
echo "  ผ่าน HTTPS: https://ced.nrru.ac.th/diabetes/diabetes.html"
echo ""
echo "  คำสั่งตรวจสอบ:"
echo "    pm2 status"
echo "    pm2 logs diabetes-tracking --lines 20"
echo "    curl http://127.0.0.1:3000/api/status"
echo "============================================"
