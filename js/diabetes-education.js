const DiabetesEducation = {
    currentCategory: 'nutrition',

    // Video link data - each item links to YouTube search for that topic
    videos: {
        nutrition: [
            {
                title: 'อาหารสำหรับผู้ป่วยเบาหวาน',
                icon: '🍚',
                desc: 'เรียนรู้วิธีเลือกอาหาร สัดส่วนที่เหมาะสม และเมนูที่ควรกิน-ควรเลี่ยง',
                search: 'อาหารสำหรับผู้ป่วยเบาหวาน กินอะไรได้บ้าง'
            },
            {
                title: 'กฎ 6-6-1 ลดหวาน มัน เค็ม',
                icon: '🥄',
                desc: 'น้ำตาลไม่เกิน 6 ช้อนชา น้ำมันไม่เกิน 6 ช้อนชา เกลือไม่เกิน 1 ช้อนชาต่อวัน',
                search: 'กฎ 6-6-1 ลดหวาน มัน เค็ม เบาหวาน'
            },
            {
                title: 'สัดส่วนจาน 2-1-1',
                icon: '🍽️',
                desc: 'แบ่งจานอาหาร: ผัก 2 ส่วน ข้าว 1 ส่วน โปรตีน 1 ส่วน',
                search: 'สัดส่วนจานอาหาร เบาหวาน จาน 2-1-1'
            },
            {
                title: 'นับคาร์บ (Carb Counting)',
                icon: '🔢',
                desc: 'เทคนิคการนับปริมาณคาร์โบไฮเดรตเพื่อควบคุมน้ำตาลในเลือด',
                search: 'นับคาร์บ เบาหวาน carb counting ภาษาไทย'
            },
            {
                title: 'การลดน้ำหนักสำหรับผู้ป่วยเบาหวาน',
                icon: '📉',
                desc: 'วิธีลดน้ำหนักอย่างปลอดภัย IF, Calorie Deficit สำหรับผู้ป่วยเบาหวาน',
                search: 'ลดน้ำหนัก เบาหวาน ปลอดภัย IF'
            }
        ],
        exercise: [
            {
                title: 'ออกกำลังกายสำหรับผู้ป่วยเบาหวาน',
                icon: '🏃',
                desc: 'คำแนะนำการออกกำลังกายที่เหมาะสม ความถี่ ความหนัก ระยะเวลา',
                search: 'ออกกำลังกาย ผู้ป่วยเบาหวาน วิธีที่เหมาะสม'
            },
            {
                title: 'ท่าออกกำลังกายง่ายๆ ที่บ้าน',
                icon: '💪',
                desc: 'ท่าออกกำลังกายที่ทำได้ง่ายๆ ที่บ้าน เหมาะกับผู้ป่วยเบาหวาน',
                search: 'ท่าออกกำลังกาย เบาหวาน ที่บ้าน ง่ายๆ'
            },
            {
                title: 'การเดินเร็วลดน้ำตาล',
                icon: '🚶',
                desc: 'เทคนิคการเดินเร็วช่วยลดน้ำตาลในเลือด 150 นาทีต่อสัปดาห์',
                search: 'เดินเร็ว ลดน้ำตาล เบาหวาน ออกกำลังกาย'
            },
            {
                title: 'ข้อควรระวังเมื่อออกกำลังกาย',
                icon: '⚠️',
                desc: 'ตรวจน้ำตาลก่อน-หลัง สังเกตอาการน้ำตาลต่ำ พกของหวานติดตัว',
                search: 'ข้อควรระวัง ออกกำลังกาย เบาหวาน น้ำตาลต่ำ'
            }
        ],
        medication: [
            {
                title: 'ยารักษาเบาหวาน ชนิดต่างๆ',
                icon: '💊',
                desc: 'ยากิน ยาฉีดอินซูลิน วิธีการใช้ยา และข้อควรระวัง',
                search: 'ยาเบาหวาน ชนิด วิธีใช้ อินซูลิน Metformin'
            },
            {
                title: 'ภาวะน้ำตาลต่ำในเลือด',
                icon: '🚨',
                desc: 'อาการ สาเหตุ วิธีแก้ไขเฉียบพลัน (กฎ 15-15) และการป้องกัน',
                search: 'น้ำตาลต่ำในเลือด เบาหวาน อาการ วิธีแก้ กฎ 15-15'
            },
            {
                title: 'การฉีดอินซูลินอย่างถูกวิธี',
                icon: '💉',
                desc: 'ตำแหน่งฉีด วิธีเก็บรักษา การปรับขนาดยา',
                search: 'วิธีฉีดอินซูลิน เบาหวาน ถูกวิธี ตำแหน่งฉีด'
            }
        ],
        foot: [
            {
                title: 'การตรวจเท้าด้วยตนเอง',
                icon: '🦶',
                desc: 'วิธีตรวจเท้าทุกวัน ดูผิวหนัง เล็บ ซอกนิ้ว สัมผัสอุณหภูมิ',
                search: 'ตรวจเท้า เบาหวาน ด้วยตนเอง วิธีดูแลเท้า'
            },
            {
                title: 'การดูแลแผลที่เท้า',
                icon: '🩹',
                desc: 'วิธีดูแลแผล สัญญาณอันตราย เมื่อไรต้องพบแพทย์',
                search: 'แผลเท้าเบาหวาน ดูแล รักษา สัญญาณอันตราย'
            },
            {
                title: 'รองเท้าที่เหมาะสม',
                icon: '👟',
                desc: 'วิธีเลือกรองเท้าสำหรับผู้ป่วยเบาหวาน ป้องกันแผลที่เท้า',
                search: 'รองเท้า เบาหวาน เหมาะสม ป้องกันแผลเท้า'
            }
        ]
    },

    init() {
        this.bindCategoryButtons();
        this.bindBMICalculator();
        this.selectCategory('nutrition');
    },

    bindCategoryButtons() {
        const buttons = document.querySelectorAll('.category-pill');
        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const category = btn.getAttribute('data-category');
                if (category) {
                    this.selectCategory(category);
                }
            });
        });
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
        if (!this.videos[category]) return;

        this.currentCategory = category;

        // Update active pill styling
        const buttons = document.querySelectorAll('.category-pill');
        buttons.forEach(btn => {
            const btnCategory = btn.getAttribute('data-category');
            if (btnCategory === category) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderVideoList();
    },

    renderVideoList() {
        const container = document.getElementById('flash-card-container');
        if (!container) return;

        const categoryVideos = this.videos[this.currentCategory];
        if (!categoryVideos || categoryVideos.length === 0) return;

        var html = '';
        categoryVideos.forEach(function(video) {
            var ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(video.search);
            html += '<a class="video-link-card" href="' + ytUrl + '" target="_blank" rel="noopener noreferrer">';
            html += '  <div class="video-link-icon">' + video.icon + '</div>';
            html += '  <div class="video-link-info">';
            html += '    <div class="video-link-title">' + video.title + '</div>';
            html += '    <div class="video-link-desc">' + video.desc + '</div>';
            html += '  </div>';
            html += '  <div class="video-link-play">';
            html += '    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582 6.186a2.506 2.506 0 00-1.768-1.768C18.254 4 12 4 12 4s-6.254 0-7.814.418A2.506 2.506 0 002.418 6.186C2 7.746 2 12 2 12s0 4.254.418 5.814a2.506 2.506 0 001.768 1.768C5.746 20 12 20 12 20s6.254 0 7.814-.418a2.506 2.506 0 001.768-1.768C22 16.254 22 12 22 12s0-4.254-.418-5.814zM10 15.5V8.5l6 3.5-6 3.5z"/></svg>';
            html += '  </div>';
            html += '</a>';
        });

        container.innerHTML = html;

        // Update counter
        var counterEl = document.getElementById('card-counter');
        if (counterEl) {
            counterEl.textContent = categoryVideos.length + ' videos';
        }
    },

    calculateBMI() {
        const weightInput = document.getElementById('bmi-weight');
        const heightInput = document.getElementById('bmi-height');
        const resultContainer = document.getElementById('bmi-result');
        const valueEl = document.getElementById('bmi-value');
        const categoryEl = document.getElementById('bmi-category');
        const adviceEl = document.getElementById('bmi-advice');

        if (!weightInput || !heightInput) return;

        const weight = parseFloat(weightInput.value);
        const height = parseFloat(heightInput.value);

        // Validate inputs
        if (isNaN(weight) || isNaN(height) || weight <= 0 || height <= 0) {
            if (valueEl) {
                valueEl.textContent = '--';
                valueEl.style.color = '';
            }
            if (categoryEl) {
                categoryEl.textContent = 'กรุณากรอกน้ำหนักและส่วนสูงให้ถูกต้อง';
                categoryEl.style.color = '#e74c3c';
            }
            if (adviceEl) {
                adviceEl.textContent = '';
            }
            if (resultContainer) resultContainer.classList.remove('hidden');
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
            advice = 'ควรเพิ่มน้ำหนักโดยกินอาหารให้ครบ 5 หมู่ เพิ่มมื้อย่อย และปรึกษานักโภชนาการ';
        } else if (bmi <= 22.9) {
            category = 'น้ำหนักปกติ (Normal)';
            color = '#27ae60';
            advice = 'น้ำหนักอยู่ในเกณฑ์ปกติ รักษาระดับนี้ไว้ด้วยการกินอาหารสมดุลและออกกำลังกายสม่ำเสมอ';
        } else if (bmi <= 24.9) {
            category = 'น้ำหนักเกิน (Overweight)';
            color = '#f39c12';
            advice = 'ควรควบคุมอาหารและเพิ่มการออกกำลังกาย ลดน้ำหนัก 5-10% จะช่วยควบคุมน้ำตาลได้ดีขึ้น';
        } else if (bmi <= 29.9) {
            category = 'อ้วนระดับ 1 (Obese I)';
            color = '#e67e22';
            advice = 'ควรลดน้ำหนักอย่างจริงจัง ปรึกษาแพทย์เพื่อวางแผนลดน้ำหนัก ลด 500 แคลอรี่/วัน';
        } else {
            category = 'อ้วนระดับ 2 (Obese II)';
            color = '#e74c3c';
            advice = 'ควรพบแพทย์โดยเร็วเพื่อวางแผนลดน้ำหนักเฉพาะบุคคล อาจต้องปรับยาเบาหวานร่วมด้วย';
        }

        // Show result container
        if (resultContainer) resultContainer.classList.remove('hidden');

        // Display results
        if (valueEl) {
            valueEl.textContent = bmiRounded.toFixed(1);
            valueEl.style.color = color;
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
