// ============================================================================
// LINE Bot Script Generator Module
// สร้างสคริปต์ Google Apps Script สำหรับใช้กับ LINE Bot ในกลุ่มผู้ป่วย
// ============================================================================

const LineBotGenerator = {

    init() {
        this.setupTypeSelector();
        this.setupApiTypeToggle();
        this.setupGenerateButton();
        this.setupCopyButton();
    },

    // =====================
    // UI Setup
    // =====================

    setupTypeSelector() {
        const cards = document.querySelectorAll('.bot-type-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                cards.forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                card.querySelector('input[type="radio"]').checked = true;
                this.showSettingsPanel(card.getAttribute('data-type'));
            });
        });
        // Select first by default
        if (cards.length > 0) {
            cards[0].classList.add('selected');
        }
    },

    setupApiTypeToggle() {
        const radios = document.querySelectorAll('input[name="bot_api_type"]');
        radios.forEach(r => {
            r.addEventListener('change', () => {
                const isMessaging = r.value === 'messaging' && r.checked;
                const secretGroup = document.getElementById('bot-channel-secret-group');
                const tokenLabel = document.getElementById('bot-token-label');
                if (secretGroup) secretGroup.style.display = isMessaging ? '' : 'none';
                if (tokenLabel) tokenLabel.textContent = isMessaging ? 'Channel Access Token' : 'LINE Notify Token';
            });
        });
    },

    showSettingsPanel(type) {
        document.querySelectorAll('.bot-settings-panel').forEach(p => p.style.display = 'none');
        const panel = document.getElementById('bot-settings-' + type);
        if (panel) panel.style.display = '';
    },

    setupGenerateButton() {
        const btn = document.getElementById('btn-generate-script');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const script = this.generateScript();
            const output = document.getElementById('bot-script-output');
            const code = document.getElementById('bot-script-code');
            if (output && code) {
                code.textContent = script;
                output.style.display = '';
                output.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    },

    setupCopyButton() {
        const btn = document.getElementById('btn-copy-script');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const code = document.getElementById('bot-script-code');
            if (code) {
                navigator.clipboard.writeText(code.textContent).then(() => {
                    if (typeof DiabetesApp !== 'undefined') {
                        DiabetesApp.showToast('คัดลอกสคริปต์แล้ว', 'success');
                    }
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> คัดลอกแล้ว!';
                    setTimeout(() => {
                        btn.innerHTML = '<i class="fa-solid fa-copy"></i> คัดลอก';
                    }, 2000);
                });
            }
        });
    },

    // =====================
    // Script Generation
    // =====================

    getConfig() {
        const apiType = document.querySelector('input[name="bot_api_type"]:checked')?.value || 'notify';
        const token = document.getElementById('bot-line-token')?.value || 'YOUR_LINE_TOKEN_HERE';
        const secret = document.getElementById('bot-channel-secret')?.value || 'YOUR_CHANNEL_SECRET';
        const scriptType = document.querySelector('input[name="bot_script_type"]:checked')?.value || 'reminder';
        return { apiType, token, secret, scriptType };
    },

    generateScript() {
        const config = this.getConfig();
        switch (config.scriptType) {
            case 'reminder': return this.genReminder(config);
            case 'health-tips': return this.genHealthTips(config);
            case 'survey': return this.genSurvey(config);
            case 'blood-sugar': return this.genBloodSugar(config);
            case 'exercise': return this.genExercise(config);
            case 'appointment': return this.genAppointment(config);
            default: return '// ไม่พบประเภทสคริปต์';
        }
    },

    // =====================
    // LINE Send Function (shared)
    // =====================

    _notifyFn(token) {
        return `// ============================================
// LINE Notify - ส่งข้อความ
// ============================================
var LINE_TOKEN = '${token}';

function sendLineNotify(message) {
  var options = {
    method: 'post',
    headers: { 'Authorization': 'Bearer ' + LINE_TOKEN },
    payload: { message: message }
  };
  try {
    UrlFetchApp.fetch('https://notify-api.line.me/api/notify', options);
    Logger.log('ส่งสำเร็จ: ' + message.substring(0, 50));
  } catch (e) {
    Logger.log('ส่งล้มเหลว: ' + e.message);
  }
}`;
    },

    _messagingFn(token, secret) {
        return `// ============================================
// LINE Messaging API - ส่ง+รับข้อความ
// ============================================
var CHANNEL_ACCESS_TOKEN = '${token}';
var CHANNEL_SECRET = '${secret}';

function sendPushMessage(groupId, message) {
  var url = 'https://api.line.me/v2/bot/message/push';
  var payload = {
    to: groupId,
    messages: [{ type: 'text', text: message }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload)
  };
  try {
    UrlFetchApp.fetch(url, options);
    Logger.log('ส่งสำเร็จ: ' + message.substring(0, 50));
  } catch (e) {
    Logger.log('ส่งล้มเหลว: ' + e.message);
  }
}

function sendBroadcast(message) {
  var url = 'https://api.line.me/v2/bot/message/broadcast';
  var payload = {
    messages: [{ type: 'text', text: message }]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload)
  };
  try {
    UrlFetchApp.fetch(url, options);
    Logger.log('Broadcast สำเร็จ');
  } catch (e) {
    Logger.log('Broadcast ล้มเหลว: ' + e.message);
  }
}

// รับข้อความจากผู้ใช้ (Webhook)
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var events = data.events;
  for (var i = 0; i < events.length; i++) {
    var event = events[i];
    if (event.type === 'message' && event.message.type === 'text') {
      handleMessage(event);
    }
  }
  return ContentService.createTextOutput('OK');
}`;
    },

    _sendFn(config) {
        return config.apiType === 'messaging'
            ? this._messagingFn(config.token, config.secret)
            : this._notifyFn(config.token);
    },

    _sendCall(config) {
        return config.apiType === 'messaging' ? 'sendBroadcast' : 'sendLineNotify';
    },

    // =====================
    // Script: เตือนกินยา/นัดหมาย
    // =====================

    genReminder(config) {
        const msg = document.getElementById('bot-reminder-msg')?.value || 'อย่าลืมกินยาเบาหวานนะคะ 💊';
        const morning = document.getElementById('bot-remind-morning')?.checked;
        const noon = document.getElementById('bot-remind-noon')?.checked;
        const evening = document.getElementById('bot-remind-evening')?.checked;

        const times = [];
        if (morning) times.push('08:00');
        if (noon) times.push('12:00');
        if (evening) times.push('18:00');

        const escapedMsg = msg.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

        return `${this._sendFn(config)}

// ============================================
// สคริปต์เตือนกินยา / แจ้งเตือนอัตโนมัติ
// ============================================
// ⏰ Trigger: Time-driven → ทุกวัน
// เวลาที่ส่ง: ${times.join(', ') || 'กรุณาเลือกเวลา'}
// ============================================

var REMINDER_TIMES = ${JSON.stringify(times)};
var REMINDER_MESSAGE = '${escapedMsg}';

function main() {
  var now = new Date();
  var hour = ('0' + now.getHours()).slice(-2);
  var minute = ('0' + now.getMinutes()).slice(-2);
  var currentTime = hour + ':' + minute;

  for (var i = 0; i < REMINDER_TIMES.length; i++) {
    // ตรวจสอบชั่วโมงตรง (อนุโลมนาทีภายใน 5 นาที)
    var targetHour = REMINDER_TIMES[i].split(':')[0];
    if (hour === targetHour) {
      var dayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
      var today = dayNames[now.getDay()];
      var dateStr = now.getDate() + '/' + (now.getMonth() + 1) + '/' + (now.getFullYear() + 543);

      var message = '\\n📅 วัน' + today + ' ' + dateStr + '\\n';
      message += '⏰ เวลา ' + REMINDER_TIMES[i] + ' น.\\n';
      message += '─────────────\\n';
      message += REMINDER_MESSAGE;

      ${this._sendCall(config)}(message);
      Logger.log('ส่งเตือนเวลา ' + REMINDER_TIMES[i]);
      break;
    }
  }
}

// ============================================
// วิธีตั้ง Trigger:
// 1. เปิด Apps Script → Triggers (ไอคอนนาฬิกา)
// 2. Add Trigger → เลือกฟังก์ชัน: main
// 3. Event source: Time-driven
// 4. Type: Hour timer → Every hour
// 5. สคริปต์จะตรวจสอบเวลาและส่งเฉพาะตรงชั่วโมง
// ============================================
`;
    },

    // =====================
    // Script: ส่งความรู้สุขภาพ
    // =====================

    genHealthTips(config) {
        const cats = [];
        document.querySelectorAll('.bot-tip-cat:checked').forEach(c => cats.push(c.value));
        const time = document.getElementById('bot-tips-time')?.value || '09:00';

        return `${this._sendFn(config)}

// ============================================
// สคริปต์ส่งความรู้สุขภาพรายวัน
// ============================================
// ⏰ Trigger: Time-driven → ทุกวัน เวลา ${time} น.
// หมวด: ${cats.join(', ') || 'ทั้งหมด'}
// ============================================

var TIPS = {
  food: [
    '🍚 ควบคุมปริมาณข้าว/แป้ง ใช้กฎจาน 2-1-1: ผัก 2 ส่วน, ข้าว 1 ส่วน, เนื้อสัตว์ 1 ส่วน',
    '🥤 งดเครื่องดื่มหวาน เช่น น้ำอัดลม ชานม น้ำผลไม้กล่อง เลือกดื่มน้ำเปล่าแทน',
    '🥗 กินผักอย่างน้อยครึ่งจานทุกมื้อ เลือกผักหลากสี เพิ่มใยอาหาร',
    '🍬 กฎ 6-6-1: น้ำตาลไม่เกิน 6 ช้อนชา, น้ำมันไม่เกิน 6 ช้อนชา, เกลือไม่เกิน 1 ช้อนชา/วัน',
    '🍎 ผลไม้ที่เหมาะสม: ฝรั่ง ชมพู่ แอปเปิ้ล ส้ม — หลีกเลี่ยง: ทุเรียน ลำไย องุ่น มะม่วงสุก',
    '🥚 โปรตีนที่ดี: อกไก่ ปลา ไข่ เต้าหู้ ถั่ว — หลีกเลี่ยง: หมูกรอบ ไส้กรอก เนื้อติดมัน',
    '📏 นับคาร์บอย่างง่าย: ข้าว 1 ทัพพี = คาร์บ 15 กรัม, ผู้ป่วยเบาหวานควรกินข้าว 1-2 ทัพพี/มื้อ'
  ],
  exercise: [
    '🏃 ออกกำลังกายอย่างน้อย 30 นาที/วัน, 5 วัน/สัปดาห์ — เดินเร็ว ว่ายน้ำ ปั่นจักรยาน',
    '🧘 ท่าออกกำลังง่ายๆ ที่บ้าน: ยืนหมุนข้อเท้า, ยืดน่อง, ยกแขนค้าง — ทำได้ทุกเวลา',
    '⚠️ ข้อควรระวัง: หยุดทันทีเมื่อเวียนศีรษะ ใจสั่น แน่นหน้าอก หรือเหงื่อออกผิดปกติ',
    '👟 สวมรองเท้าที่เหมาะสม ตรวจเท้าก่อน/หลังออกกำลังกาย หลีกเลี่ยงการเดินเท้าเปล่า',
    '💧 ดื่มน้ำก่อน ระหว่าง และหลังออกกำลังกาย ป้องกันขาดน้ำ'
  ],
  medication: [
    '💊 กินยาตรงเวลาทุกวัน ตั้งนาฬิกาเตือนเพื่อไม่ให้ลืม',
    '🚫 ห้ามหยุดยาเอง แม้น้ำตาลจะดีขึ้น — ปรึกษาแพทย์ก่อนปรับยาเสมอ',
    '🍬 พกลูกอมหรือน้ำหวาน 1 กล่อง ไว้ป้องกันน้ำตาลต่ำ',
    '⚡ อาการน้ำตาลต่ำ: ใจสั่น มือสั่น เหงื่อออก หน้ามืด — รีบกินของหวาน 15 กรัมทันที',
    '📋 จดบันทึกยาที่กินและขนาดยา พกไปพบแพทย์ทุกครั้ง'
  ],
  foot: [
    '👀 ตรวจเท้าทุกวัน: ดูรอยแดง แผล ผิวแห้งแตก เล็บผิดปกติ ใช้กระจกส่องใต้เท้า',
    '🧴 ทาครีมบำรุงเท้าทุกวัน หลีกเลี่ยงระหว่างนิ้วเท้า ป้องกันเชื้อรา',
    '👞 สวมรองเท้าหุ้มส้น พื้นนุ่ม ไม่คับไม่หลวม ตรวจข้างในรองเท้าก่อนสวมทุกครั้ง',
    '🩹 มีแผลที่เท้า — ล้างด้วยน้ำสะอาด ปิดแผลสะอาด ไปพบแพทย์ทันที',
    '✂️ ตัดเล็บเท้าตรงๆ อย่าตัดสั้นเกินไป ห้ามตัดมุมเล็บจนลึก'
  ]
};

var SELECTED_CATS = ${JSON.stringify(cats)};

function main() {
  // รวมเคล็ดลับจากหมวดที่เลือก
  var allTips = [];
  for (var i = 0; i < SELECTED_CATS.length; i++) {
    var cat = SELECTED_CATS[i];
    if (TIPS[cat]) {
      allTips = allTips.concat(TIPS[cat]);
    }
  }

  if (allTips.length === 0) {
    Logger.log('ไม่มีเคล็ดลับ');
    return;
  }

  // ใช้วันที่เป็น seed เพื่อไม่ซ้ำในแต่ละวัน
  var today = new Date();
  var dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  var index = dayOfYear % allTips.length;

  var tip = allTips[index];

  var message = '\\n🌟 ความรู้สุขภาพประจำวัน 🌟\\n';
  message += '─────────────\\n';
  message += tip + '\\n';
  message += '─────────────\\n';
  message += '💚 ดูแลสุขภาพ ห่างไกลโรคเบาหวาน';

  ${this._sendCall(config)}(message);
}

// ============================================
// วิธีตั้ง Trigger:
// 1. Triggers → Add Trigger → ฟังก์ชัน: main
// 2. Time-driven → Day timer → ${time.split(':')[0]}:00 - ${(parseInt(time.split(':')[0]) + 1)}:00
// ============================================
`;
    },

    // =====================
    // Script: แบบสอบถามรายสัปดาห์
    // =====================

    genSurvey(config) {
        const dayMap = { '0': 'อาทิตย์', '1': 'จันทร์', '2': 'อังคาร', '3': 'พุธ', '4': 'พฤหัสบดี', '5': 'ศุกร์', '6': 'เสาร์' };
        const day = document.getElementById('bot-survey-day')?.value || '5';
        const dayName = dayMap[day];
        const url = document.getElementById('bot-survey-url')?.value || '';

        const urlLine = url
            ? `message += '\\n🔗 ตอบแบบประเมิน: ${url.replace(/'/g, "\\'")}';`
            : `// ถ้ามี URL แบบประเมิน ให้เพิ่มบรรทัดนี้:
    // message += '\\n🔗 ตอบแบบประเมิน: https://your-url.com';`;

        return `${this._sendFn(config)}

// ============================================
// สคริปต์ส่งแบบสอบถามประจำสัปดาห์
// ============================================
// ⏰ Trigger: Time-driven → ทุกวัน${dayName} เวลา 09:00 น.
// ============================================

var SURVEY_DAY = ${day}; // 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์

function main() {
  var today = new Date();
  if (today.getDay() !== SURVEY_DAY) {
    Logger.log('วันนี้ไม่ใช่วันส่งแบบสอบถาม');
    return;
  }

  var weekNum = Math.ceil(today.getDate() / 7);

  var questions = [
    { week: 1, topic: 'อาหาร', items: [
      '1. สัปดาห์นี้ท่านควบคุมปริมาณข้าว/แป้งได้ดีแค่ไหน? (1-4)',
      '2. งดเครื่องดื่มหวานได้หรือไม่? (1-4)',
      '3. กินผักอย่างน้อยครึ่งจานทุกมื้อไหม? (1-4)'
    ]},
    { week: 2, topic: 'ออกกำลังกาย', items: [
      '1. สัปดาห์นี้ออกกำลังกาย 30 นาที กี่วัน? (1-4)',
      '2. มีการขยับร่างกายนอกเวลาออกกำลังไหม? (1-4)',
      '3. หยุดออกกำลังเมื่อมีอาการผิดปกติไหม? (1-4)'
    ]},
    { week: 3, topic: 'ยา', items: [
      '1. สัปดาห์นี้กินยาตรงเวลาทุกวันไหม? (1-4)',
      '2. มีหยุดยาเองเมื่อน้ำตาลดีขึ้นไหม? (1-4)',
      '3. พกของหวานป้องกันน้ำตาลต่ำไหม? (1-4)'
    ]},
    { week: 4, topic: 'เท้า', items: [
      '1. สัปดาห์นี้ตรวจดูเท้าทุกวันไหม? (1-4)',
      '2. สวมรองเท้าหุ้มส้นเมื่อออกนอกบ้านไหม? (1-4)',
      '3. มีแผลที่เท้าหรือไม่? ถ้ามี ไปพบแพทย์หรือยัง?'
    ]}
  ];

  var qIndex = (weekNum - 1) % questions.length;
  var q = questions[qIndex];

  var message = '\\n📋 แบบประเมินประจำสัปดาห์ 📋\\n';
  message += '─────────────\\n';
  message += '📌 หัวข้อ: ' + q.topic + '\\n';
  message += '(คะแนน: 1=ไม่เคย, 2=บางครั้ง, 3=บ่อยครั้ง, 4=ทุกครั้ง)\\n\\n';

  for (var i = 0; i < q.items.length; i++) {
    message += q.items[i] + '\\n';
  }

  message += '\\n─────────────\\n';
  message += '💬 ตอบเป็นตัวเลข เช่น: 3, 2, 4';
  ${urlLine}

  ${this._sendCall(config)}(message);
}

${config.apiType === 'messaging' ? `
// รับคำตอบจากสมาชิก (Messaging API)
function handleMessage(event) {
  var text = event.message.text.trim();
  var userId = event.source.userId;

  // ตรวจสอบว่าเป็นคำตอบแบบสอบถาม (เช่น "3, 2, 4")
  var scores = text.split(/[,\\s]+/).map(Number).filter(function(n) { return n >= 1 && n <= 4; });

  if (scores.length >= 2) {
    // บันทึกลง Google Sheets
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('survey_responses') || ss.insertSheet('survey_responses');
    sheet.appendRow([new Date(), userId, scores.join(', '), scores.reduce(function(a, b) { return a + b; }, 0)]);

    // ตอบกลับ
    replyMessage(event.replyToken, '✅ บันทึกคำตอบแล้ว! คะแนนรวม: ' + scores.reduce(function(a, b) { return a + b; }, 0));
  }
}

function replyMessage(replyToken, text) {
  var url = 'https://api.line.me/v2/bot/message/reply';
  var payload = {
    replyToken: replyToken,
    messages: [{ type: 'text', text: text }]
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify(payload)
  });
}` : ''}

// ============================================
// วิธีตั้ง Trigger:
// 1. Triggers → Add Trigger → ฟังก์ชัน: main
// 2. Time-driven → Day timer → 9am - 10am
// (สคริปต์จะตรวจสอบวันเอง ส่งเฉพาะวัน${dayName})
// ============================================
`;
    },

    // =====================
    // Script: บันทึกน้ำตาลในเลือด
    // =====================

    genBloodSugar(config) {
        const sheetId = document.getElementById('bot-sheet-id')?.value || 'YOUR_GOOGLE_SHEETS_ID';
        const beforeMeal = document.getElementById('bot-bs-before-meal')?.checked;
        const afterMeal = document.getElementById('bot-bs-after-meal')?.checked;

        const times = [];
        if (beforeMeal) times.push('07:00');
        if (afterMeal) times.push('09:00');

        if (config.apiType !== 'messaging') {
            return `// ⚠️ สคริปต์บันทึกน้ำตาลในเลือดต้องใช้ Messaging API
// เพราะต้องรับข้อความตอบกลับจากผู้ใช้
// กรุณาเปลี่ยนประเภท API เป็น "Messaging API" แล้วสร้างใหม่`;
        }

        return `${this._sendFn(config)}

// ============================================
// สคริปต์บันทึกน้ำตาลในเลือด
// ============================================
// ⏰ Trigger: Time-driven → ทุกวัน
// เวลาเตือน: ${times.join(', ')}
// 📊 ข้อมูลบันทึกใน Google Sheets
// ============================================

var SPREADSHEET_ID = '${sheetId}';
var REMIND_TIMES = ${JSON.stringify(times)};

function main() {
  var now = new Date();
  var hour = ('0' + now.getHours()).slice(-2);

  for (var i = 0; i < REMIND_TIMES.length; i++) {
    var targetHour = REMIND_TIMES[i].split(':')[0];
    if (hour === targetHour) {
      var period = (parseInt(hour) < 9) ? 'ก่อนอาหารเช้า' : 'หลังอาหาร 2 ชม.';

      var message = '\\n🩸 แจ้งเตือนวัดน้ำตาล 🩸\\n';
      message += '─────────────\\n';
      message += '⏰ ช่วง: ' + period + '\\n';
      message += '📝 กรุณาพิมพ์ค่าน้ำตาลของท่าน\\n';
      message += '(ตัวอย่าง: พิมพ์ "120" หรือ "น้ำตาล 120")\\n';
      message += '─────────────\\n';
      message += '🎯 เป้าหมาย:\\n';
      message += '• ก่อนอาหาร: 80-130 mg/dL\\n';
      message += '• หลังอาหาร 2 ชม.: < 180 mg/dL';

      sendBroadcast(message);
      break;
    }
  }
}

// รับค่าน้ำตาลจากผู้ใช้
function handleMessage(event) {
  var text = event.message.text.trim();
  var userId = event.source.userId;
  var displayName = getDisplayName(userId);

  // ดึงตัวเลขจากข้อความ (เช่น "120" หรือ "น้ำตาล 120")
  var match = text.match(/(\\d{2,3})/);
  if (!match) return;

  var bgValue = parseInt(match[1]);
  if (bgValue < 30 || bgValue > 600) return; // ค่าไม่สมเหตุสมผล

  // บันทึกลง Google Sheets
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('blood_sugar') || ss.insertSheet('blood_sugar');

  // สร้างหัวตารางถ้ายังไม่มี
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['วันที่', 'เวลา', 'User ID', 'ชื่อ', 'ค่าน้ำตาล (mg/dL)', 'ระดับ']);
  }

  var now = new Date();
  var level = '';
  if (bgValue < 70) level = '⚠️ ต่ำ';
  else if (bgValue <= 130) level = '✅ ปกติ';
  else if (bgValue <= 180) level = '⚡ สูงเล็กน้อย';
  else level = '🔴 สูง';

  sheet.appendRow([
    Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy'),
    Utilities.formatDate(now, 'Asia/Bangkok', 'HH:mm'),
    userId,
    displayName,
    bgValue,
    level
  ]);

  // ตอบกลับ
  var reply = '✅ บันทึกค่าน้ำตาล: ' + bgValue + ' mg/dL\\n';
  reply += '📊 ระดับ: ' + level + '\\n';

  if (bgValue < 70) {
    reply += '\\n⚠️ น้ำตาลต่ำ! กรุณากินของหวาน 15 กรัม (ลูกอม, น้ำผลไม้) แล้ววัดซ้ำใน 15 นาที';
  } else if (bgValue > 250) {
    reply += '\\n🔴 น้ำตาลสูงมาก! กรุณาปรึกษาแพทย์หรือพยาบาล';
  }

  replyMessage(event.replyToken, reply);
}

function getDisplayName(userId) {
  try {
    var url = 'https://api.line.me/v2/bot/profile/' + userId;
    var res = UrlFetchApp.fetch(url, {
      headers: { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN }
    });
    return JSON.parse(res.getContentText()).displayName;
  } catch (e) {
    return userId;
  }
}

function replyMessage(replyToken, text) {
  var url = 'https://api.line.me/v2/bot/message/reply';
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: 'text', text: text }]
    })
  });
}

// ============================================
// วิธีตั้งค่า:
// 1. สร้าง Google Sheets ใหม่ → คัดลอก ID จาก URL
// 2. ใส่ ID ในตัวแปร SPREADSHEET_ID
// 3. Triggers → Add Trigger → main → Hour timer → Every hour
// 4. Deploy → New deployment → Web app → Execute as: Me
// 5. คัดลอก URL ไปใส่ใน LINE Webhook URL
// ============================================
`;
    },

    // =====================
    // Script: เตือนออกกำลังกาย
    // =====================

    genExercise(config) {
        const time = document.getElementById('bot-exercise-time')?.value || '17:00';
        const goal = document.getElementById('bot-exercise-goal')?.value || '30';

        return `${this._sendFn(config)}

// ============================================
// สคริปต์เตือนออกกำลังกายประจำวัน
// ============================================
// ⏰ Trigger: Time-driven → ทุกวัน เวลา ${time} น.
// 🎯 เป้าหมาย: ${goal} นาที/วัน
// ============================================

var EXERCISE_GOAL = ${goal}; // นาที

var EXERCISES = [
  {
    name: '🚶 เดินเร็ว',
    desc: 'เดินเร็วรอบหมู่บ้าน หรือในสวน\\n• เริ่มช้าๆ 5 นาที → เร็วขึ้น ' + EXERCISE_GOAL + ' นาที → ค่อยๆ ลดความเร็ว 5 นาที',
    benefit: 'ลดน้ำตาลในเลือด เพิ่มการไหลเวียนเลือด'
  },
  {
    name: '🧘 ยืดเหยียดเบาๆ',
    desc: '• หมุนข้อเท้าซ้าย-ขวา 10 รอบ\\n• ยืดน่อง ค้าง 15 วินาที ข้างละ 3 ครั้ง\\n• ยกแขนเหนือศีรษะ ค้าง 10 วินาที 5 ครั้ง\\n• หมุนไหล่ 10 รอบ',
    benefit: 'เพิ่มความยืดหยุ่น ลดปวดเมื่อย'
  },
  {
    name: '💪 บริหารกล้ามเนื้อ',
    desc: '• นั่งยกขา ค้าง 5 วินาที ข้างละ 10 ครั้ง\\n• ยืนเขย่งปลายเท้า 15 ครั้ง\\n• นั่งบีบลูกบอล 10 ครั้ง\\n• ยืนพิงผนัง ย่อเข่า ค้าง 10 วินาที 5 ครั้ง',
    benefit: 'เพิ่มกล้ามเนื้อ ช่วยให้อินซูลินทำงานดีขึ้น'
  },
  {
    name: '🚴 ปั่นจักรยานอยู่กับที่',
    desc: 'ปั่นจักรยานอยู่กับที่หรือจักรยานจริง\\n• อุ่นเครื่อง 5 นาที → ปั่นสม่ำเสมอ ' + EXERCISE_GOAL + ' นาที → คูลดาวน์ 5 นาที',
    benefit: 'บริหารหัวใจ ลดน้ำหนัก ไม่กระแทกข้อ'
  },
  {
    name: '🏠 ออกกำลังกายในบ้าน',
    desc: '• เดินย่ำอยู่กับที่ 5 นาที\\n• ยกเข่าสลับซ้าย-ขวา 20 ครั้ง\\n• ยืนแกว่งแขน 30 วินาที\\n• นั่งยืนสลับ 10 ครั้ง',
    benefit: 'ทำได้ทุกสภาพอากาศ สะดวก ปลอดภัย'
  }
];

function main() {
  var today = new Date();
  var index = today.getDay() % EXERCISES.length;
  var ex = EXERCISES[index];

  var message = '\\n🏃 เวลาออกกำลังกายแล้ว! 🏃\\n';
  message += '─────────────\\n';
  message += ex.name + '\\n\\n';
  message += '📋 วิธีทำ:\\n' + ex.desc + '\\n\\n';
  message += '✨ ประโยชน์: ' + ex.benefit + '\\n';
  message += '─────────────\\n';
  message += '🎯 เป้าหมาย: ' + EXERCISE_GOAL + ' นาที/วัน\\n';
  message += '⚠️ หยุดทันทีเมื่อ: เวียนศีรษะ ใจสั่น แน่นหน้าอก';

  ${this._sendCall(config)}(message);
}

// ============================================
// วิธีตั้ง Trigger:
// 1. Triggers → Add Trigger → ฟังก์ชัน: main
// 2. Time-driven → Day timer → ${time.split(':')[0]}:00 - ${(parseInt(time.split(':')[0]) + 1)}:00
// ============================================
`;
    },

    // =====================
    // Script: แจ้งเตือนนัดพบแพทย์
    // =====================

    genAppointment(config) {
        const sheetId = document.getElementById('bot-appt-sheet-id')?.value || 'YOUR_GOOGLE_SHEETS_ID';
        const advance = document.getElementById('bot-appt-advance')?.value || '3';

        return `${this._sendFn(config)}

// ============================================
// สคริปต์แจ้งเตือนนัดพบแพทย์
// ============================================
// ⏰ Trigger: Time-driven → ทุกวัน เวลา 08:00 น.
// 📅 เตือนล่วงหน้า ${advance} วัน
// 📊 อ่านข้อมูลนัดจาก Google Sheets
// ============================================

var SPREADSHEET_ID = '${sheetId}';
var ADVANCE_DAYS = ${advance};

// Google Sheets ต้องมีคอลัมน์: รหัสผู้ป่วย | ชื่อ | วันนัด | เวลา | แผนก | หมายเหตุ
// วันนัดในรูปแบบ: dd/MM/yyyy

function main() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('appointments') || ss.getSheets()[0];
  var data = sheet.getDataRange().getValues();

  if (data.length < 2) {
    Logger.log('ไม่มีข้อมูลนัดหมาย');
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var upcoming = [];

  // เริ่มจากแถว 2 (ข้ามหัวตาราง)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var apptDate = row[2]; // คอลัมน์ C = วันนัด

    if (apptDate instanceof Date) {
      apptDate.setHours(0, 0, 0, 0);
      var diffDays = Math.floor((apptDate - today) / 86400000);

      if (diffDays >= 0 && diffDays <= ADVANCE_DAYS) {
        upcoming.push({
          patientId: row[0],
          name: row[1],
          date: Utilities.formatDate(apptDate, 'Asia/Bangkok', 'dd/MM/yyyy'),
          time: row[3] || 'ไม่ระบุ',
          department: row[4] || 'ไม่ระบุ',
          note: row[5] || '',
          daysLeft: diffDays
        });
      }
    }
  }

  if (upcoming.length === 0) {
    Logger.log('ไม่มีนัดหมายใน ${advance} วันข้างหน้า');
    return;
  }

  var message = '\\n📅 แจ้งเตือนนัดพบแพทย์ 📅\\n';
  message += '─────────────\\n';

  for (var j = 0; j < upcoming.length; j++) {
    var appt = upcoming[j];
    var urgency = appt.daysLeft === 0 ? '🔴 วันนี้!' :
                  appt.daysLeft === 1 ? '🟠 พรุ่งนี้' :
                  '🟡 อีก ' + appt.daysLeft + ' วัน';

    message += '\\n' + urgency + '\\n';
    message += '👤 ' + appt.name + ' (' + appt.patientId + ')\\n';
    message += '📅 ' + appt.date + ' เวลา ' + appt.time + '\\n';
    message += '🏥 แผนก: ' + appt.department + '\\n';
    if (appt.note) message += '📝 ' + appt.note + '\\n';
    message += '─────────────';
  }

  message += '\\n💚 กรุณามาตามนัดเพื่อสุขภาพที่ดี';

  ${this._sendCall(config)}(message);
}

// ============================================
// วิธีตั้งค่า:
// 1. สร้าง Google Sheets ใหม่ มีคอลัมน์:
//    A: รหัสผู้ป่วย | B: ชื่อ | C: วันนัด | D: เวลา | E: แผนก | F: หมายเหตุ
// 2. ใส่ Sheets ID ในตัวแปร SPREADSHEET_ID
// 3. Triggers → Add Trigger → main → Day timer → 8am - 9am
// ============================================
`;
    }
};

window.LineBotGenerator = LineBotGenerator;
