const HybridAI = {
    mode: 'offline', // 'online' | 'offline'
    isQuotaExceeded: false,
    currentFileContent: null,
    
    init() {
        console.log("HybridAI: Initializing...");
        this.checkConnectivity();
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
        
        // בדיקת הרשאות והצגת הכפתור
        setTimeout(() => {
            const fab = document.getElementById('ai-bubble-container');
            if (fab) {
                // הצגה כברירת מחדל כדי לוודא שרואים אותו
                fab.classList.remove('hidden-screen');
                fab.style.display = 'block'; 
                console.log("HybridAI: Bubble button should be visible now.");
            } else {
                console.error("HybridAI: Button container 'ai-bubble-container' not found!");
            }
        }, 1000);
    },

    checkConnectivity() {
        const isOnline = navigator.onLine;
        const hasKey = window.GEMINI_API_KEY && !window.GEMINI_API_KEY.includes('PLACEHOLDER');
        
        if (isOnline && hasKey && !this.isQuotaExceeded) {
            this.setMode('online');
        } else {
            this.setMode('offline');
        }
    },

    setMode(newMode) {
        if (this.mode === newMode) return;
        this.mode = newMode;
        
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');
        
        if (dot && text) {
            if (newMode === 'online') {
                dot.className = "w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]";
                text.innerText = "מחובר (Gemini AI)";
            } else {
                dot.className = "w-2.5 h-2.5 rounded-full bg-orange-500";
                text.innerText = "מצב אופליין";
            }
        }
    },

    handleNetworkChange(isOnline) {
        if (isOnline) {
            this.retryOnline();
        } else {
            this.setMode('offline');
            this.addMsg("האינטרנט התנתק. עברתי למצב אופליין.", 'system');
        }
    },

    retryOnline() {
        this.isQuotaExceeded = false;
        this.checkConnectivity();
        if (this.mode === 'online') {
            this.addMsg("החיבור חודש.", 'system');
        }
    },

    // --- קריאת קבצים ---
    async handleFileSelect(input) {
        const file = input.files[0];
        if(!file) return;
        
        const preview = document.getElementById('ai-file-preview');
        const nameEl = document.getElementById('ai-file-name');
        if(preview) preview.classList.remove('hidden');
        if(nameEl) nameEl.innerText = "מעבד קובץ...";

        try {
            let content = "";
            if(file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                content = await this.readExcel(file);
            } else if (file.name.endsWith('.pdf')) {
                content = "PDF detected (Text extraction limited in browser).";
            } else {
                content = await this.readText(file);
            }

            this.currentFileContent = content;
            if(nameEl) nameEl.innerText = file.name;
            this.addMsg(`הקובץ ${file.name} נטען בהצלחה.`, 'system');

        } catch (err) {
            console.error(err);
            this.addMsg("שגיאה בקריאת הקובץ.", 'system');
            if(preview) preview.classList.add('hidden');
        }
    },

    readExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const json = XLSX.utils.sheet_to_json(sheet, {header: 1});
                    let text = "Excel Data:\n";
                    json.slice(0, 100).forEach(row => text += row.join(" | ") + "\n");
                    resolve(text);
                } catch (err) { reject(err); }
            };
            reader.readAsArrayBuffer(file);
        });
    },

    readText(file) {
        return new Promise(resolve => {
            const r = new FileReader();
            r.onload = e => resolve(e.target.result);
            r.readAsText(file);
        });
    },

    clearFile() {
        this.currentFileContent = null;
        document.getElementById('ai-file-input').value = '';
        document.getElementById('ai-file-preview').classList.add('hidden');
    },

    addMsg(html, role) {
        const container = document.getElementById('ai-messages');
        if (!container) return;
        const div = document.createElement('div');
        div.className = `p-3 rounded-xl mb-2 text-sm max-w-[90%] ${role === 'user' ? 'bg-indigo-600 text-white self-end' : 'bg-white border text-gray-800 self-start'}`;
        if (role === 'system') div.className = "text-center text-xs text-gray-500 my-2";
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    async send() {
        const inp = document.getElementById('ai-input');
        const text = inp.value.trim();
        if (!text && !this.currentFileContent) return;

        this.addMsg(text, 'user');
        inp.value = '';

        if (this.mode === 'online') await this.processOnline(text);
        else this.processOffline(text);
    },

    async processOnline(text) {
        this.addMsg(`<i class="fas fa-spinner fa-spin"></i> מעבד...`, 'ai');
        try {
            const context = {
                view: Router.current,
                stats: Store.data.stats
            };
            const prompt = `You are a helper for Yeshiva Management System.
            System State: ${JSON.stringify(context)}
            ${this.currentFileContent ? 'Attached File: ' + this.currentFileContent : ''}
            User: ${text}`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "שגיאה.";
            
            // מחיקת הודעת הטעינה (האחרונה)
            const msgs = document.getElementById('ai-messages');
            if(msgs.lastChild.innerHTML.includes('fa-spinner')) msgs.lastChild.remove();

            this.handleAIResponse(reply);
        } catch (e) {
            this.addMsg("שגיאת תקשורת.", 'system');
        }
    },

    handleAIResponse(reply) {
        const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            if (clean.startsWith('{')) {
                const cmd = JSON.parse(clean);
                if (cmd.tool === 'navigate') Router.go(cmd.view);
                this.addMsg("בוצע.", 'ai');
            } else {
                this.addMsg(clean.replace(/\n/g, '<br>'), 'ai');
            }
        } catch (e) {
            this.addMsg(reply, 'ai');
        }
    },

    processOffline(text) {
        this.addMsg("אני באופליין. נסה 'דוח כספי' או 'עבור ללוח המחוונים'.", 'ai');
    }
};

// --- פונקציה גלובלית לפתיחת החלון (חשוב!) ---
// זה נמצא מחוץ לאובייקט כדי שיהיה זמין מיד בלחיצה
window.toggleChatWindow = function() {
    console.log("Toggle Chat Clicked!"); // לוג לבדיקה
    const w = document.getElementById('ai-chat-window');
    
    if (!w) {
        alert("שגיאה: חלון הצ'אט לא נמצא ב-HTML");
        console.error("Element #ai-chat-window is missing from DOM");
        return;
    }

    // החלפת מחלקות CSS להצגה/הסתרה
    if (w.classList.contains('hidden')) {
        w.classList.remove('hidden');
        w.classList.add('flex');
        setTimeout(() => {
            const input = document.getElementById('ai-input');
            if(input) input.focus();
        }, 100);
    } else {
        w.classList.add('hidden');
        w.classList.remove('flex');
    }
};

window.HybridAI = HybridAI;
// טעינת ה-AI
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => HybridAI.init(), 1000);
});
