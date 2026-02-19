const HybridAI = {
    mode: 'offline',

    init() {
        console.log("🚀 AI: מאתחל מערכת...");

        // 1. תיקון כוחני לתצוגת הכפתור (CSS Fix)
        const btnContainer = document.getElementById('ai-bubble-container');
        if (btnContainer) {
            btnContainer.classList.remove('hidden-screen', 'hidden');
            btnContainer.style.display = 'block';
            btnContainer.style.zIndex = '99999';
        }

        // 2. בדיקת המפתח שהוזרק ע"י GitHub Actions
        this.checkApiKey();
        
        // 3. הגדרת מצב רשת
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));

        // 4. חשיפת הפונקציה לחלון (בשביל הכפתור ב-HTML)
        window.toggleChatWindow = () => this.toggleChat();
    },

    checkApiKey() {
        const key = window.GEMINI_API_KEY;
        console.log("🔍 AI Debug: בודק מפתח API...");

        if (!key) {
            console.error("❌ מפתח חסר לחלוטין (undefined).");
            this.setOffline("מפתח לא נמצא");
            return false;
        }

        // בדיקה האם ה-Workflow הצליח להחליף את המפתח
        if (key.includes('PLACEHOLDER') || key.includes('__GEMINI')) {
            console.warn("⚠️ המפתח הוא עדיין Placeholder. ההזרקה ב-GitHub נכשלה.");
            this.setOffline("הגדרת המפתח נכשלה (Placeholder)");
            
            // הודעה למשתמש בצ'אט
            setTimeout(() => {
                this.addMsg("<b>שגיאת מערכת:</b><br>המפתח לא הוזרק בהצלחה.<br>וודא שהסוד GEMINI_API_KEY מוגדר ב-GitHub Settings.", 'system');
            }, 2000);
            return false;
        }

        // אם הגענו לפה - יש מפתח אמיתי!
        console.log("✅ מפתח API תקין זוהה.");
        this.setOnline();
        return true;
    },

    setOnline() {
        this.mode = 'online';
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-lg";
        if (text) text.innerText = "מחובר (Gemini AI)";
    },

    setOffline(reason) {
        this.mode = 'offline';
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');
        if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
        if (text) text.innerText = `אופליין (${reason})`;
    },

    handleNetworkChange(isOnline) {
        if (isOnline) this.checkApiKey();
        else this.setOffline("אין אינטרנט");
    },

    // פונקציית פתיחת הצ'אט (הגרסה החזקה)
    toggleChat() {
        const w = document.getElementById('ai-chat-window');
        if (!w) return;

        const isHidden = w.classList.contains('hidden') || getComputedStyle(w).display === 'none';

        if (isHidden) {
            w.classList.remove('hidden');
            w.style.display = 'flex';
            w.style.zIndex = '999999'; // מעל הכל
            setTimeout(() => document.getElementById('ai-input')?.focus(), 100);
        } else {
            w.classList.add('hidden');
            w.style.display = 'none';
        }
    },

    addMsg(html, role) {
        const container = document.getElementById('ai-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = role === 'user' 
            ? "bg-indigo-600 text-white self-end p-2 rounded-lg mb-2 text-sm max-w-[85%]" 
            : role === 'system'
            ? "text-center text-xs text-red-500 my-2 font-bold"
            : "bg-white border text-gray-800 self-start p-2 rounded-lg mb-2 text-sm max-w-[90%]";
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    async send() {
        const inp = document.getElementById('ai-input');
        const text = inp.value.trim();
        if (!text) return;

        this.addMsg(text, 'user');
        inp.value = '';

        if (this.mode === 'offline') {
            setTimeout(() => this.addMsg("המערכת במצב אופליין. בדוק את הגדרות המפתח ב-GitHub.", 'ai'), 500);
            return;
        }

        // שליחה לגוגל
        this.addMsg('<i class="fas fa-spinner fa-spin"></i> מעבד...', 'ai');
        
        try {
            const context = {
                view: Router?.current || 'home',
                stats: Store?.data?.stats || {},
                year: Store?.currentYear
            };
            
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `System Context: ${JSON.stringify(context)}. User Question: ${text}` }] }]
                })
            });

            const data = await response.json();
            
            // הסרת הודעת טעינה
            const msgs = document.getElementById('ai-messages');
            if (msgs.lastElementChild.innerHTML.includes('fa-spinner')) msgs.lastElementChild.remove();

            if (data.error) throw new Error(data.error.message);
            
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "שגיאה בקבלת תשובה.";
            this.addMsg(reply.replace(/\n/g, '<br>').replace(/\*\*/g, '<b>'), 'ai');

        } catch (e) {
            console.error(e);
            this.addMsg("שגיאה בתקשורת עם ה-AI.", 'ai');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => HybridAI.init(), 1000);
});
