/**
 * ai.js - גרסה משוריינת לדיבוג מלא
 */

const HybridAI = {
    // הגדרות ברירת מחדל
    mode: 'offline', // online / offline
    isWindowOpen: false,
    
    // אתחול המערכת
    init() {
        console.log("🚀 AI System: מתחיל אתחול...");

        // 1. בדיקת מפתח API
        this.checkApiKey();

        // 2. בדיקת רכיבי DOM (כפתור וחלון)
        const btnContainer = document.getElementById('ai-bubble-container');
        const chatWindow = document.getElementById('ai-chat-window');
        const fabBtn = document.querySelector('#ai-bubble-container button');

        if (!btnContainer) console.error("❌ שגיאה קריטית: לא נמצא אלמנט #ai-bubble-container ב-HTML");
        if (!chatWindow) console.error("❌ שגיאה קריטית: לא נמצא אלמנט #ai-chat-window ב-HTML");
        
        // 3. הצגת הכפתור (במידה והוא מוסתר)
        if (btnContainer) {
            btnContainer.classList.remove('hidden-screen', 'hidden');
            btnContainer.style.display = 'block';
            console.log("✅ AI System: כפתור הבועה הוצג.");
            
            // הצמדת אירוע לחיצה מחדש (למקרה שה-onclick ב-HTML לא עובד)
            if (fabBtn) {
                // מסיר מאזינים ישנים כדי למנוע כפילויות
                const newBtn = fabBtn.cloneNode(true);
                fabBtn.parentNode.replaceChild(newBtn, fabBtn);
                
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("🖱️ AI System: זוהתה לחיצה על הכפתור!");
                    this.toggleChat();
                });
            }
        }

        // 4. בדיקת חיבור רשת
        this.checkConnectivity();
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));

        // 5. הגדרה גלובלית (לגיבוי)
        window.toggleChatWindow = () => this.toggleChat();

        console.log("✅ AI System: אתחול הושלם.");
    },

    // בדיקת מפתח Gemini
    checkApiKey() {
        const key = window.GEMINI_API_KEY;
        if (!key) {
            console.error("❌ AI Error: משתנה GEMINI_API_KEY לא מוגדר בקובץ config.js");
            alert("שגיאת מערכת: מפתח AI חסר.");
            return false;
        }
        if (key.includes('PLACEHOLDER') || key.includes('__GEMINI')) {
            console.warn("⚠️ AI Warning: מפתח ה-API הוא עדיין Placeholder (לא הוגדר מפתח אמיתי).");
            // אנחנו לא עוצרים את הריצה, אבל המצב יהיה אופליין
            return false;
        }
        console.log("✅ AI System: מפתח API זוהה ותקין (מבחינת פורמט).");
        return true;
    },

    // ניהול מצב רשת
    checkConnectivity() {
        const isOnline = navigator.onLine;
        const hasKey = this.checkApiKey();
        
        if (isOnline && hasKey) {
            this.setMode('online');
        } else {
            this.setMode('offline');
            if (!isOnline) console.log("🌐 AI Info: דפדפן במצב אופליין.");
        }
    },

    handleNetworkChange(isOnline) {
        console.log(`🌐 AI Network Change: ${isOnline ? 'מחובר' : 'מנותק'}`);
        this.checkConnectivity();
        this.addMsg(isOnline ? "החיבור חזר." : "אין אינטרנט. עברתי למצב אופליין.", 'system');
    },

    setMode(newMode) {
        this.mode = newMode;
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');
        
        if (dot && text) {
            if (newMode === 'online') {
                dot.className = "w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg";
                text.innerText = "מחובר (Gemini)";
            } else {
                dot.className = "w-2.5 h-2.5 rounded-full bg-gray-400";
                text.innerText = "אופליין (מקומי)";
            }
        }
    },

    // פונקציית הפתיחה/סגירה המשופרת
    toggleChat() {
        console.log("🔄 AI System: מבצע Toggle לחלון הצ'אט...");
        const w = document.getElementById('ai-chat-window');
        
        if (!w) {
            alert("שגיאה: חלון הצ'אט לא נמצא ב-DOM!");
            return;
        }

        // בדיקה אגרסיבית האם החלון מוסתר
        const style = window.getComputedStyle(w);
        const isHidden = w.classList.contains('hidden') || style.display === 'none' || style.visibility === 'hidden';

        console.log(`🔍 מצב נוכחי: ${isHidden ? 'מוסתר' : 'גלוי'}`);

        if (isHidden) {
            // פתיחה
            w.classList.remove('hidden');
            w.style.display = 'flex'; // דריסת CSS חיצוני
            w.style.visibility = 'visible';
            w.style.opacity = '1';
            w.style.zIndex = '99999'; // וידוא שהוא מעל הכל
            
            // פוקוס
            setTimeout(() => {
                const input = document.getElementById('ai-input');
                if (input) input.focus();
            }, 100);
            
            this.isWindowOpen = true;
            console.log("🔓 חלון נפתח.");
        } else {
            // סגירה
            w.classList.add('hidden');
            w.style.display = 'none';
            
            this.isWindowOpen = false;
            console.log("🔒 חלון נסגר.");
        }
    },

    // הוספת הודעה לצ'אט
    addMsg(html, role) {
        const container = document.getElementById('ai-messages');
        if (!container) return;

        const div = document.createElement('div');
        // עיצוב לפי תפקיד
        if (role === 'user') {
            div.className = "bg-indigo-600 text-white self-end p-3 rounded-xl mb-2 text-sm max-w-[85%]";
        } else if (role === 'ai') {
            div.className = "bg-white border text-gray-800 self-start p-3 rounded-xl mb-2 text-sm max-w-[90%] shadow-sm";
        } else { // system
            div.className = "text-center text-xs text-gray-400 my-2 italic";
        }
        
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    // שליחת הודעה
    async send() {
        const inp = document.getElementById('ai-input');
        const text = inp.value.trim();
        if (!text) return;

        this.addMsg(text, 'user');
        inp.value = '';

        if (this.mode === 'online') {
            await this.processOnline(text);
        } else {
            this.processOffline(text);
        }
    },

    // עיבוד אונליין (Gemini)
    async processOnline(text) {
        this.addMsg(`<i class="fas fa-spinner fa-spin"></i> חושב...`, 'ai');
        
        // כאן אתה יכול להוסיף את הלוגיקה המלאה של Gemini כמו בקוד הקודם
        // לצורך בדיקה, נחזיר תשובה מדמה אם אין API
        const apiKey = window.GEMINI_API_KEY;
        
        if (!apiKey || apiKey.includes('PLACEHOLDER')) {
            setTimeout(() => {
                this.handleAIResponse("אין מפתח API מוגדר, אך המערכת מחוברת לאינטרנט. נא להגדיר מפתח ב-Github Secrets.");
            }, 1000);
            return;
        }

        try {
            // בניית הקונטקסט
            const context = {
                currentView: Router?.current || 'unknown',
                stats: Store?.data?.stats || {},
                userRole: Store?.role || 'user',
                year: Store?.currentYear
            };

            const systemPrompt = `You are an assistant for a Yeshiva management system. Context: ${JSON.stringify(context)}. User says: ${text}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "לא התקבלה תשובה תקינה.";
            this.handleAIResponse(reply);

        } catch (e) {
            console.error("AI Request Failed:", e);
            this.handleAIResponse(`שגיאה בתקשורת: ${e.message}`);
        }
    },

    // טיפול בתשובה (ניקוי הודעת הטעינה)
    handleAIResponse(reply) {
        // מחיקת הודעת הטעינה האחרונה (דרך פשוטה: הסרת האלמנט האחרון אם הוא מכיל ספינר)
        const container = document.getElementById('ai-messages');
        const lastMsg = container.lastElementChild;
        if (lastMsg && lastMsg.innerHTML.includes('fa-spinner')) {
            lastMsg.remove();
        }
        
        // עיבוד JSON אם יש (לניווט)
        const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        if (clean.startsWith('{') && clean.endsWith('}')) {
            try {
                const cmd = JSON.parse(clean);
                if (cmd.tool === 'navigate') {
                    Router.go(cmd.view);
                    this.addMsg(`עברתי למסך ${cmd.view}`, 'ai');
                    return;
                }
            } catch(e) {}
        }
        
        this.addMsg(clean.replace(/\n/g, '<br>'), 'ai');
    },

    // עיבוד אופליין
    processOffline(text) {
        let res = "אני במצב אופליין (ללא AI).";
        if (text.includes('דוח')) res = "במצב אופליין ניתן להפיק דוחות דרך תפריט הדוחות.";
        else if (text.includes('שלום')) res = "שלום! איך אפשר לעזור במערכת?";
        
        setTimeout(() => this.addMsg(res, 'ai'), 500);
    },
    
    // ניקוי קובץ מצורף
    clearFile() {
        document.getElementById('ai-file-input').value = '';
        document.getElementById('ai-file-preview').classList.add('hidden');
    },
    
    // טיפול בקובץ
    handleFileSelect(input) {
        const file = input.files[0];
        if (!file) return;
        document.getElementById('ai-file-preview').classList.remove('hidden');
        document.getElementById('ai-file-name').innerText = file.name;
        this.addMsg(`קובץ נטען: ${file.name} (מוכן לשליחה)`, 'system');
    }
};

// הפעלת המערכת לאחר טעינת הדף
document.addEventListener('DOMContentLoaded', () => {
    // השהייה קצרה כדי לוודא ש-HTML נטען
    setTimeout(() => {
        HybridAI.init();
    }, 1500);
});

// ייצוא לחלון
window.HybridAI = HybridAI;
