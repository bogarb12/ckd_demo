const DiabetesEducation = {
    currentCategory: 'nutrition',
    currentCardIndex: 0,

    // FULL CONTENT DATA - all in Thai
    cards: {
        nutrition: [
            {
                title: 'แคลอรี่ที่ควรได้รับต่อวัน',
                icon: '🍚',
                front: 'ผู้ป่วยเบาหวานควรได้รับพลังงานวันละเท่าไร?',
                back: `ปริมาณแคลอรี่ที่แนะนำ:
• ผู้หญิง: 1,200-1,500 กิโลแคลอรี่/วัน
• ผู้ชาย: 1,500-1,800 กิโลแคลอรี่/วัน
• ขึ้นอยู่กับกิจกรรม น้ำหนัก และเป้าหมาย
• ปรึกษานักโภชนาการเพื่อแผนเฉพาะบุคคล

หลักการ: กินให้พอเหมาะ ไม่มากไม่น้อยเกินไป`
            },
            {
                title: 'กฎ 6-6-1 ลดหวาน มัน เค็ม',
                icon: '🥄',
                front: 'กฎ 6-6-1 คืออะไร? ช่วยควบคุมเบาหวานอย่างไร?',
                back: `กฎ 6-6-1 สำหรับผู้ป่วยเบาหวาน:
• น้ำตาล: ไม่เกิน 6 ช้อนชา/วัน (24 กรัม)
• น้ำมัน: ไม่เกิน 6 ช้อนชา/วัน
• เกลือ/โซเดียม: ไม่เกิน 1 ช้อนชา/วัน (2,000 มก.)

เคล็ดลับ:
✓ อ่านฉลากโภชนาการก่อนซื้อ
✓ หลีกเลี่ยงอาหารแปรรูป
✓ ปรุงอาหารเองเมื่อทำได้
✓ ใช้สมุนไพรแทนเครื่องปรุง`
            },
            {
                title: 'สัดส่วนจาน 2-1-1',
                icon: '🍽️',
                front: 'สัดส่วนจาน 2-1-1 แบ่งอาหารอย่างไร?',
                back: `แบ่งจานอาหารเป็น 4 ส่วน:
🥬 2 ส่วน = ผัก (ครึ่งจาน)
   ผักใบเขียว ผักต่างสี
🍚 1 ส่วน = ข้าว/แป้ง (1/4 จาน)
   ข้าวกล้อง ข้าวไรซ์เบอร์รี่
🍗 1 ส่วน = โปรตีน (1/4 จาน)
   ปลา ไก่ไม่ติดหนัง เต้าหู้ ถั่ว

ผลไม้: 1 ส่วนต่อมื้อ เลือกผลไม้น้ำตาลต่ำ
เช่น ฝรั่ง ชมพู่ แก้วมังกร`
            },
            {
                title: 'ดัชนีมวลกาย (BMI) และน้ำหนัก',
                icon: '⚖️',
                front: 'ทำไม BMI สำคัญสำหรับผู้ป่วยเบาหวาน?',
                back: `BMI ที่เหมาะสม ช่วยควบคุมน้ำตาลได้ดีขึ้น

เกณฑ์ BMI สำหรับคนเอเชีย:
• < 18.5: น้ำหนักต่ำกว่าเกณฑ์
• 18.5-22.9: น้ำหนักปกติ ✓
• 23.0-24.9: น้ำหนักเกิน ⚠️
• 25.0-29.9: อ้วนระดับ 1 ⚠️
• ≥ 30: อ้วนระดับ 2 🔴

ลดน้ำหนัก 5-10% ช่วย:
✓ ลด HbA1c ได้ 0.5-1.0%
✓ ลดความดันโลหิต
✓ ลดไขมันในเลือด`
            },
            {
                title: 'การลดน้ำหนัก: IF และ Calorie Deficit',
                icon: '📉',
                front: 'วิธีลดน้ำหนักที่ปลอดภัยสำหรับผู้ป่วยเบาหวาน?',
                back: `Calorie Deficit (กินน้อยกว่าที่ใช้):
• ลด 500 แคล/วัน = ลด ~0.5 กก./สัปดาห์
• อย่าลดต่ำกว่า 1,200 แคล/วัน

Intermittent Fasting (IF):
⚠️ ต้องปรึกษาแพทย์ก่อนเสมอ
• แบบ 16:8 (อดอาหาร 16 ชม.)
• เสี่ยงน้ำตาลต่ำ - ต้องปรับยา
• ดื่มน้ำเปล่าให้เพียงพอ

คำแนะนำสำคัญ:
🔴 ห้ามอดอาหารโดยไม่ปรึกษาแพทย์
✓ ลดทีละน้อย ค่อยเป็นค่อยไป
✓ ออกกำลังกายร่วมด้วย`
            }
        ],
        exercise: [
            {
                title: 'คำแนะนำการออกกำลังกาย',
                icon: '🏃',
                front: 'ผู้ป่วยเบาหวานควรออกกำลังกายอย่างไร?',
                back: `หลัก FITT สำหรับผู้ป่วยเบาหวาน:

📅 Frequency (ความถี่): 3-5 วัน/สัปดาห์
⏱️ Intensity (ความหนัก): ปานกลาง
   (พูดได้แต่ร้องเพลงไม่ได้)
⏰ Time (ระยะเวลา): 30-60 นาที/ครั้ง
   (เริ่มจาก 10-15 นาที แล้วค่อยเพิ่ม)
🏊 Type (ประเภท):
   แอโรบิก: เดินเร็ว ว่ายน้ำ ปั่นจักรยาน
   ยืดเหยียด: โยคะ ไทเก็ก

⚠️ หลีกเลี่ยง: วิ่งเท้าเปล่า กีฬาที่กระแทก`
            },
            {
                title: 'การดูแลก่อน-หลังออกกำลังกาย',
                icon: '💪',
                front: 'ต้องเตรียมตัวอย่างไรก่อนและหลังออกกำลังกาย?',
                back: `ก่อนออกกำลังกาย:
✓ ตรวจน้ำตาลในเลือด
  • < 100 mg/dL: กินอาหารว่างก่อน
  • 100-250: ออกกำลังกายได้
  • > 250: งดออกกำลังกาย
✓ พกน้ำตาลทรายหรือน้ำผลไม้
✓ สวมรองเท้าที่เหมาะสม
✓ อบอุ่นร่างกาย 5-10 นาที

หลังออกกำลังกาย:
✓ คูลดาวน์ 5-10 นาที
✓ ตรวจน้ำตาลอีกครั้ง
✓ ตรวจเท้าว่ามีแผลหรือไม่
✓ ดื่มน้ำให้เพียงพอ`
            },
            {
                title: 'รองเท้าที่เหมาะสม',
                icon: '👟',
                front: 'ผู้ป่วยเบาหวานควรเลือกรองเท้าอย่างไร?',
                back: `รองเท้าที่เหมาะสม:
✓ หุ้มส้น ปิดหัว ปิดท้าย
✓ พื้นนิ่ม รองรับแรงกระแทก
✓ ขนาดพอดี ไม่คับไม่หลวม
✓ ระบายอากาศได้ดี
✓ ไม่มีตะเข็บด้านในกดเท้า

❌ หลีกเลี่ยง:
• รองเท้าแตะ รองเท้าเปิดหัว
• รองเท้าส้นสูง
• เดินเท้าเปล่า

💡 เคล็ดลับ:
• ซื้อรองเท้าตอนบ่าย (เท้าขยาย)
• สวมถุงเท้าเสมอ
• ตรวจด้านในรองเท้าก่อนสวม`
            },
            {
                title: 'ความถี่ ความหนัก และระยะเวลา',
                icon: '⏱️',
                front: 'ออกกำลังกายแค่ไหนจึงจะพอเหมาะ?',
                back: `เป้าหมายต่อสัปดาห์:
🎯 อย่างน้อย 150 นาที/สัปดาห์

ตัวอย่างตารางออกกำลังกาย:
📅 จ/พ/ศ: เดินเร็ว 30 นาที
📅 อ/พฤ: ว่ายน้ำ 30 นาที
📅 ส: ปั่นจักรยาน 30 นาที

วัดความหนักด้วย Talk Test:
😊 เบา: พูดคุยสบาย ร้องเพลงได้
💪 ปานกลาง: พูดได้ ร้องไม่ได้ ✓
😤 หนัก: พูดไม่สะดวก

⚠️ หยุดทันทีเมื่อ:
• เจ็บหน้าอก ใจสั่น
• เวียนศีรษะ หน้ามืด
• หายใจลำบาก
• มีอาการน้ำตาลต่ำ`
            }
        ],
        medication: [
            {
                title: 'ยารักษาเบาหวาน',
                icon: '💊',
                front: 'ยาเบาหวานมีกี่ชนิด? แต่ละชนิดทำงานอย่างไร?',
                back: `ยากิน:
💊 Metformin: ลดการสร้างน้ำตาลจากตับ
   (ยาหลัก มักใช้ตัวแรก)
💊 Sulfonylurea (Glipizide, Glimepiride):
   กระตุ้นตับอ่อนสร้างอินซูลิน
💊 DPP-4 inhibitor: ช่วยร่างกายใช้อินซูลินดีขึ้น
💊 SGLT2 inhibitor: ขับน้ำตาลออกทางปัสสาวะ

ยาฉีด:
💉 อินซูลิน: ทดแทนอินซูลินที่ร่างกายผลิตไม่พอ
   - ออกฤทธิ์เร็ว (ฉีดก่อนอาหาร)
   - ออกฤทธิ์ยาว (ฉีดวันละครั้ง)
💉 GLP-1 agonist: กระตุ้นอินซูลิน + ลดน้ำหนัก

⚠️ ห้ามหยุดยาเอง แม้น้ำตาลปกติ`
            },
            {
                title: 'ภาวะน้ำตาลต่ำในเลือด',
                icon: '🚨',
                front: 'อาการน้ำตาลต่ำเป็นอย่างไร? แก้ไขอย่างไร?',
                back: `อาการน้ำตาลต่ำ (< 70 mg/dL):
🔴 ใจสั่น มือสั่น
🔴 เหงื่อออก ตัวเย็น
🔴 หิวมาก อ่อนเพลีย
🔴 เวียนศีรษะ ตาพร่ามัว
🔴 สับสน พูดไม่ชัด

การแก้ไข (กฎ 15-15):
1️⃣ กิน/ดื่มน้ำตาล 15 กรัม:
   • น้ำผลไม้ 120 มล.
   • น้ำตาลทราย 1 ช้อนโต๊ะ
   • ลูกอม 3-4 เม็ด
   • เม็ดกลูโคส 3-4 เม็ด
2️⃣ รอ 15 นาที
3️⃣ วัดน้ำตาลซ้ำ
4️⃣ ถ้ายังต่ำ ทำซ้ำขั้นตอน 1-3

⚠️ พกของหวานติดตัวเสมอ!`
            }
        ],
        foot: [
            {
                title: 'การตรวจเท้าด้วยตนเอง',
                icon: '🦶',
                front: 'ผู้ป่วยเบาหวานควรตรวจเท้าอย่างไร?',
                back: `ตรวจเท้าทุกวัน ทุกครั้งก่อนนอน:

👀 ดู:
✓ ผิวหนัง: แดง บวม แห้ง แตก
✓ เล็บ: สีเปลี่ยน หนาผิดปกติ เล็บขบ
✓ ซอกนิ้ว: ชื้น เชื้อรา
✓ ฝ่าเท้า: ตาปลา หนังด้าน แผล
(ใช้กระจกส่องใต้เท้า)

🤚 สัมผัส:
✓ อุณหภูมิ: ร้อนหรือเย็นผิดปกติ
✓ ชา: ใช้ปลายปากกาแตะ
✓ เต้นชีพจร: ข้อเท้า หลังเท้า

🧴 ดูแล:
✓ ล้างเท้าด้วยน้ำอุ่น ซับให้แห้ง
✓ ทาครีมบำรุง (ไม่ทาซอกนิ้ว)
✓ ตัดเล็บตรง ไม่ตัดโค้ง`
            },
            {
                title: 'สัญญาณอันตรายที่ต้องพบแพทย์',
                icon: '🏥',
                front: 'อาการใดที่เท้าที่ต้องไปพบแพทย์ทันที?',
                back: `🚨 ไปพบแพทย์ทันที เมื่อ:

🔴 แผลที่เท้าไม่หายใน 2 สัปดาห์
🔴 แผลมีหนอง กลิ่นเหม็น
🔴 เท้าบวม แดง ร้อน
🔴 เท้าเปลี่ยนสี (คล้ำ ดำ)
🔴 เจ็บเท้ามากขึ้นเรื่อยๆ
🔴 ชาเท้าเพิ่มขึ้น
🔴 เล็บเท้าเปลี่ยนสี หนา ผิดรูป
🔴 มีไข้ร่วมกับแผลที่เท้า

⚠️ ป้องกัน:
✓ สวมรองเท้าหุ้มส้นเสมอ
✓ ไม่แช่เท้าน้ำร้อน
✓ ไม่ตัดหนังหนา/ตาปลาเอง
✓ ไม่ใช้ยาทาแผลเอง
✓ ตรวจเท้ากับแพทย์ทุก 6-12 เดือน`
            }
        ]
    },

    init() {
        this.bindCategoryButtons();
        this.bindCardNavigation();
        this.bindBMICalculator();
        this.selectCategory('nutrition');
    },

    bindCategoryButtons() {
        const buttons = document.querySelectorAll('.edu-category-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                if (category) {
                    this.selectCategory(category);
                }
            });
        });
    },

    bindCardNavigation() {
        const prevBtn = document.getElementById('card-prev');
        const nextBtn = document.getElementById('card-next');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.prevCard());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextCard());
        }
    },

    bindBMICalculator() {
        const calcBtn = document.getElementById('btn-calc-bmi');
        if (calcBtn) {
            calcBtn.addEventListener('click', () => this.calculateBMI());
        }

        // Allow Enter key to trigger calculation
        const weightInput = document.getElementById('bmi-weight');
        const heightInput = document.getElementById('bmi-height');

        [weightInput, heightInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.calculateBMI();
                    }
                });
            }
        });
    },

    selectCategory(category) {
        if (!this.cards[category]) return;

        this.currentCategory = category;
        this.currentCardIndex = 0;

        // Update active pill styling
        const buttons = document.querySelectorAll('.edu-category-btn');
        buttons.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderCard(this.currentCardIndex);
    },

    renderCard(index) {
        const container = document.getElementById('flash-card-container');
        if (!container) return;

        const categoryCards = this.cards[this.currentCategory];
        if (!categoryCards || !categoryCards[index]) return;

        const card = categoryCards[index];
        this.currentCardIndex = index;

        // Format the back text: convert newlines to <br> and preserve whitespace
        const formatText = (text) => {
            return text
                .split('\n')
                .map(line => `<span>${line || '&nbsp;'}</span>`)
                .join('<br>');
        };

        container.innerHTML = `
            <div class="flash-card" id="active-flash-card" role="button" tabindex="0" aria-label="แตะเพื่อพลิกการ์ด">
                <div class="flash-card-inner">
                    <div class="flash-card-front">
                        <div class="flash-card-icon">${card.icon}</div>
                        <h3 class="flash-card-title">${card.title}</h3>
                        <p class="flash-card-question">${card.front}</p>
                        <div class="flash-card-hint">
                            <span>👆 แตะเพื่อดูคำตอบ</span>
                        </div>
                    </div>
                    <div class="flash-card-back">
                        <h3 class="flash-card-title">${card.icon} ${card.title}</h3>
                        <div class="flash-card-answer">${formatText(card.back)}</div>
                        <div class="flash-card-hint">
                            <span>👆 แตะเพื่อกลับด้านหน้า</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Bind flip on click/tap and keyboard
        const flashCard = document.getElementById('active-flash-card');
        if (flashCard) {
            flashCard.addEventListener('click', () => this.flipCard());
            flashCard.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.flipCard();
                }
            });
        }

        // Update counter
        this.updateCounter();

        // Update navigation button states
        this.updateNavButtons();
    },

    flipCard() {
        const flashCard = document.getElementById('active-flash-card');
        if (flashCard) {
            flashCard.classList.toggle('flipped');
        }
    },

    nextCard() {
        const categoryCards = this.cards[this.currentCategory];
        if (!categoryCards) return;

        if (this.currentCardIndex < categoryCards.length - 1) {
            this.renderCard(this.currentCardIndex + 1);
        }
    },

    prevCard() {
        if (this.currentCardIndex > 0) {
            this.renderCard(this.currentCardIndex - 1);
        }
    },

    updateCounter() {
        const counter = document.getElementById('card-counter');
        if (!counter) return;

        const categoryCards = this.cards[this.currentCategory];
        const total = categoryCards ? categoryCards.length : 0;
        counter.textContent = `${this.currentCardIndex + 1}/${total}`;
    },

    updateNavButtons() {
        const prevBtn = document.getElementById('card-prev');
        const nextBtn = document.getElementById('card-next');
        const categoryCards = this.cards[this.currentCategory];

        if (prevBtn) {
            prevBtn.disabled = this.currentCardIndex <= 0;
        }
        if (nextBtn) {
            nextBtn.disabled = !categoryCards || this.currentCardIndex >= categoryCards.length - 1;
        }
    },

    calculateBMI() {
        const weightInput = document.getElementById('bmi-weight');
        const heightInput = document.getElementById('bmi-height');
        const resultEl = document.getElementById('bmi-result');
        const categoryEl = document.getElementById('bmi-category');
        const adviceEl = document.getElementById('bmi-advice');

        if (!weightInput || !heightInput) return;

        const weight = parseFloat(weightInput.value);
        const height = parseFloat(heightInput.value);

        // Validate inputs
        if (isNaN(weight) || isNaN(height) || weight <= 0 || height <= 0) {
            if (resultEl) {
                resultEl.textContent = '--';
                resultEl.style.color = '';
            }
            if (categoryEl) {
                categoryEl.textContent = 'กรุณากรอกน้ำหนักและส่วนสูงให้ถูกต้อง';
                categoryEl.style.color = '#e74c3c';
            }
            if (adviceEl) {
                adviceEl.textContent = '';
            }
            return;
        }

        // BMI = weight(kg) / (height(m))^2
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        const bmiRounded = Math.round(bmi * 10) / 10;

        // Categorize using Asian criteria
        let category = '';
        let color = '';
        let advice = '';

        if (bmi < 18.5) {
            category = 'น้ำหนักต่ำกว่าเกณฑ์ (Underweight)';
            color = '#3498db';
            advice = 'ควรเพิ่มน้ำหนักโดยกินอาหารให้ครบ 5 หมู่ เพิ่มมื้อย่อย และปรึกษานักโภชนาการเพื่อวางแผนเพิ่มน้ำหนักอย่างเหมาะสม';
        } else if (bmi <= 22.9) {
            category = 'น้ำหนักปกติ (Normal) ✓';
            color = '#27ae60';
            advice = 'น้ำหนักอยู่ในเกณฑ์ปกติ รักษาระดับนี้ไว้ด้วยการกินอาหารสมดุลและออกกำลังกายสม่ำเสมอ';
        } else if (bmi <= 24.9) {
            category = 'น้ำหนักเกิน (Overweight) ⚠️';
            color = '#f39c12';
            advice = 'ควรควบคุมอาหารและเพิ่มการออกกำลังกาย ลดน้ำหนัก 5-10% จะช่วยควบคุมน้ำตาลได้ดีขึ้น ลด HbA1c ได้ 0.5-1.0%';
        } else if (bmi <= 29.9) {
            category = 'อ้วนระดับ 1 (Obese I) ⚠️';
            color = '#e67e22';
            advice = 'ควรลดน้ำหนักอย่างจริงจัง ปรึกษาแพทย์เพื่อวางแผนลดน้ำหนักที่เหมาะสม ลด 500 แคลอรี่/วัน และออกกำลังกาย 150 นาที/สัปดาห์';
        } else {
            category = 'อ้วนระดับ 2 (Obese II) 🔴';
            color = '#e74c3c';
            advice = 'ควรพบแพทย์โดยเร็วเพื่อวางแผนลดน้ำหนักเฉพาะบุคคล อาจต้องปรับยาเบาหวานร่วมด้วย น้ำหนักเกินเพิ่มความเสี่ยงภาวะแทรกซ้อน';
        }

        // Display results
        if (resultEl) {
            resultEl.textContent = bmiRounded.toFixed(1);
            resultEl.style.color = color;
        }
        if (categoryEl) {
            categoryEl.textContent = category;
            categoryEl.style.color = color;
        }
        if (adviceEl) {
            adviceEl.textContent = advice;
        }
    }
};

window.DiabetesEducation = DiabetesEducation;
