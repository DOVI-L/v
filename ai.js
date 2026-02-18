/**
 * ai.js - גרסה סופית ומתוקנת
 */

const HybridAI = {
    mode: 'offline', // ברירת מחדל
    
    // פונקציית האתחול הראשית
    init() {
        console.log("🚀 AI System: מתחיל אתחול...");

        // 1. וידוא שהאלמנטים קיימים
        const btnContainer = document.getElementById('ai-bubble-container');
        const chatWindow = document.getElementById('ai-chat-window');

        if (!chatWindow) {
            console.error("❌ שגיאה: חלון הצ'אט לא נמצא ב-HTML.");
            return;
        }

        // 2. הצגת כפתור הבועה
        if (btnContainer) {
            btnContainer.classList.remove('hidden-screen', 'hidden');
            btnContainer.style.display = 'block';
            btnContainer.style.pointerEvents = 'auto'; // וידוא שאפשר ללחוץ
        }

        // 3. איפוס סטטוס ראשוני (כדי למנוע תקיעה על "טוען...")
        this.setMode('offline'); // מתחילים באופליין כברירת מחדל

        // 4. בדיקת מפתח וחיבור לרשת
        this.checkConnectivity();

        // 5. האזנה לשינויי רשת
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));

        // 6. חשיפת פונקציית הטוגל לחלון הגלובלי (למקרה שה-HTML קורא לה)
        window.toggleChatWindow = () => this.toggleChat();

        console.log("✅ AI System: אתחול הסתיים.");
    },

    // בדיקה האם יש מפתח API תקין
    checkApiKey() {
        const key = window.GEMINI_API_KEY;
        
        // בדיקות תקינות למפתח
        if (!key) {
            console.warn("⚠️ AI: לא מוגדר משתנה GEMINI_API_KEY בקובץ config.js");
            return false;
        }
        if (key.includes('PLACEHOLDER') || key.includes('__GEMINI')) {
            console.warn("⚠️ AI: המפתח הוא עדיין Placeholder. נא להחליף למפתח אמיתי.");
            // הוספת הודעה למשתמש בצ'אט
            setTimeout(() => {
                const msgContainer = document.getElementById('ai-messages');
                if (msgContainer && msgContainer.children.length === 0) {
                    this.addMsg("<b>שים לב:</b> לא הגדרת מפתח API של Gemini בקובץ config.js.<br>המערכת עובדת במצב אופליין בלבד.", 'system');
                }
            }, 1000);
            return false;
        }
        return true;
    },

    // בדיקת חיבוריות וקביעת מצב
    checkConnectivity() {
        const isOnline = navigator.onLine;
        const hasKey = this.checkApiKey();

        if (isOnline && hasKey) {
            this.setMode('online');
            console.log("🟢 AI Status: אונליין (מחובר ל-Gemini)");
        } else {
            this.setMode('offline');
            console.log("🔴 AI Status: אופליין (חסר מפתח או אין אינטרנט)");
        }
    },

    handleNetworkChange(isOnline) {
        this.checkConnectivity();
        this.addMsg(isOnline ? "החיבור חזר." : "אין אינטרנט. עברתי למצב אופליין.", 'system');
    },

    // עדכון המחוון הגרפי (הנקודה הירוקה/אפורה)
    setMode(newMode) {
        this.mode = newMode;
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');

        if (dot && text) {
            if (newMode === 'online') {
                dot.className = "w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg";
                text.innerText = "מחובר (Gemini)";
                text.className = "text-xs font-bold text-green-400";
            } else {
                dot.className = "w-2.5 h-2.5 rounded-full bg-gray-400";
                text.innerText = "אופליין (ללא מפתח/רשת)";
                text.className = "text-xs font-bold text-gray-400";
            }
        }
    },

    // פונקציית פתיחה/סגירה אגרסיבית
    toggleChat() {
        const w = document.getElementById('ai-chat-window');
        if (!w) return;

        // בדיקה האם מוסתר
        const isHidden = w.classList.contains('hidden') || 
                         window.getComputedStyle(w).display === 'none';

        if (isHidden) {
            // פתיחה
            w.classList.remove('hidden');
            w.style.display = 'flex';
            w.style.zIndex = '999999';
            
            // פוקוס
            setTimeout(() => {
                const input = document.getElementById('ai-input');
                if (input) input.focus();
            }, 100);
        } else {
            // סגירה
            w.classList.add('hidden');
            w.style.display = 'none';
        }
    },

    // הוספת הודעה לחלון
    addMsg(html, role) {
        const container = document.getElementById('ai-messages');
        if (!container) return;

        const div = document.createElement('div');
        if (role === 'user') {
            div.className = "bg-indigo-600 text-white self-end p-2 px-3 rounded-lg mb-2 text-sm max-w-[85%]";
        } else if (role === 'ai') {
            div.className = "bg-white border text-gray-800 self-start p-2 px-3 rounded-lg mb-2 text-sm max-w-[90%] shadow-sm";
        } else {
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

    // עיבוד מול גוגל (Gemini)
    async processOnline(text) {
        // מחיקת הודעת טעינה קודמת אם נתקעה
        const container = document.getElementById('ai-messages');
        const last = container.lastElementChild;
        if(last && last.innerHTML.includes('חושב...')) last.remove();

        this.addMsg(`<i class="fas fa-spinner fa-spin"></i> חושב...`, 'ai');

        try {
            const apiKey = window.GEMINI_API_KEY;
            
            // בניית הקונטקסט של המערכת
            const context = {
                view: Router?.current || 'unknown',
                stats: Store?.data?.stats || { income: 0 },
                year: Store?.currentYear
            };

            const prompt = `You are a helper for a Yeshiva system. Context: ${JSON.stringify(context)}. User: ${text}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            
            // מחיקת ה"חושב..."
            container.lastElementChild.remove();

            if (data.error) {
                throw new Error(data.error.message);
            }

            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "לא התקבלה תשובה.";
            
            // בדיקה אם יש פקודת JSON (למשל ניווט)
            if (reply.includes('{') && reply.includes('}')) {
                 try {
                     const jsonMatch = reply.match(/\{.*\}/s);
                     if (jsonMatch) {
                         const cmd = JSON.parse(jsonMatch[0]);
                         if (cmd.tool === 'navigate') {
                             Router.go(cmd.view);
                             this.addMsg(`עברתי למסך ${cmd.view}`, 'ai');
                             return;
                         }
                     }
                 } catch(e) {}
            }
            
            this.addMsg(reply.replace(/\n/g, '<br>').replace(/\*\*/g, '<b>').replace(/\*/g, ''), 'ai');

        } catch (e) {
            const container = document.getElementById('ai-messages');
            if(container.lastElementChild.innerHTML.includes('חושב')) container.lastElementChild.remove();
            
            console.error("AI Error:", e);
            this.addMsg(`שגיאה: ${e.message}`, 'system');
        }
    },

    // עיבוד אופליין (תשובות מוכנות מראש)
    processOffline(text) {
        let res = "אני במצב אופליין (חסר מפתח API).";
        
        if (text.includes('דוח')) res = "לדוחות, נא לגשת לתפריט 'דוחות' בתפריט הצד.";
        else if (text.includes('שלום')) res = "שלום! המערכת עובדת, אך הבינה המלאכותית מנותקת כרגע.";
        else if (text.includes('כסף') || text.includes('קופה')) {
            const income = Store?.data?.stats?.income || 0;
            res = `ההכנסות כרגע: ₪${income.toLocaleString()}`;
        }

        setTimeout(() => this.addMsg(res, 'ai'), 600);
    },

    // טיפול בקבצים
    handleFileSelect(input) {
        if (input.files && input.files[0]) {
            document.getElementById('ai-file-preview').classList.remove('hidden');
            document.getElementById('ai-file-name').innerText = input.files[0].name;
        }
    },
    
    clearFile() {
        document.getElementById('ai-file-input').value = '';
        document.getElementById('ai-file-preview').classList.add('hidden');
    }
};

// הפעלה אוטומטית בטעינת הדף
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => HybridAI.init(), 1000);
});
