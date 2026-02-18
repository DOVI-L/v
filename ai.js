const HybridAI = {
    mode: 'offline',
    isQuotaExceeded: false,
    currentFileContent: null,
    
    init() {
        this.checkConnectivity();
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
        
        // הופך את פונקציית הפתיחה לזמינה גלובלית עבור הכפתור ב-HTML
        window.toggleChatWindow = () => {
            const w = document.getElementById('ai-chat-window');
            if (w) {
                w.classList.toggle('hidden');
                w.classList.toggle('flex');
                if (!w.classList.contains('hidden')) {
                    setTimeout(() => document.getElementById('ai-input').focus(), 100);
                }
            }
        };

        // בדיקת הרשאות להצגת הבועה
        setTimeout(() => {
            const fab = document.getElementById('ai-fab-container') || document.getElementById('ai-bubble-container');
            // מציג רק אם המשתמש מחובר והוא אדמין (או אם רוצים שיהיה פתוח תמיד, מחק את התנאי)
            if (fab) {
                if (window.Store && Store.user && Store.role === 'admin') {
                    fab.classList.remove('hidden-screen');
                    fab.style.display = 'block';
                } else {
                    fab.classList.add('hidden-screen');
                    fab.style.display = 'none';
                }
            }
        }, 2000); // המתנה לטעינת Store
    },

    checkConnectivity() {
        const isOnline = navigator.onLine;
        const hasKey = window.GEMINI_API_KEY && !window.GEMINI_API_KEY.includes('PLACEHOLDER');
        this.setMode((isOnline && hasKey && !this.isQuotaExceeded) ? 'online' : 'offline');
    },

    setMode(newMode) {
        if (this.mode === newMode) return;
        this.mode = newMode;
        const dot = document.getElementById('ai-status-dot');
        const text = document.getElementById('ai-status-text');
        if (dot && text) {
            if (newMode === 'online') {
                dot.className = "w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-green-500/50 shadow-lg";
                text.innerText = "מחובר (Gemini)";
            } else {
                dot.className = "w-2.5 h-2.5 rounded-full bg-gray-400";
                text.innerText = "אופליין";
            }
        }
    },

    handleNetworkChange(isOnline) {
        this.checkConnectivity();
        if(isOnline) this.addMsg("החיבור חזר.", 'system');
        else this.addMsg("אין אינטרנט. עברתי למצב אופליין.", 'system');
    },

    // --- טיפול בקבצים (Excel/CSV/Text) ---
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
                content = "זיהיתי PDF. שים לב: המערכת כרגע לא קוראת תוכן מתוך PDF סרוק, אלא רק טקסט חי.";
            } else {
                content = await this.readText(file);
            }

            // בדיקת כפילויות מול ה-Store
            const duplicates = this.checkDuplicates(content);
            
            this.currentFileContent = content;
            if(nameEl) nameEl.innerText = file.name;
            
            let msg = `הקובץ נטען.`;
            if (duplicates.length > 0) {
                msg += `<br><strong style="color:red">אזהרה:</strong> זיהיתי ${duplicates.length} שמות בקובץ שכבר קיימים במערכת (כגון: ${duplicates[0]}).<br>אני אזהר לא לדרוס נתונים אלא אם תבקש במפורש.`;
            } else {
                msg += `<br>לא נמצאו כפילויות מול המאגר הקיים.`;
            }
            
            this.addMsg(msg, 'system');

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
                    
                    // המרה לטקסט שה-AI יכול לקרוא
                    let text = "Excel Data:\n";
                    json.slice(0, 400).forEach(row => text += row.join(" | ") + "\n");
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

    checkDuplicates(text) {
        const dups = [];
        if (!window.Store || !Store.data) return [];
        
        const allNames = [
            ...Object.values(Store.data.students || {}).map(s => s.name),
            ...Object.values(Store.data.donors || {}).map(d => d.name)
        ];

        allNames.forEach(name => {
            if (name && name.length > 3 && text.includes(name)) {
                if(!dups.includes(name)) dups.push(name);
            }
        });
        return dups;
    },

    clearFile() {
        this.currentFileContent = null;
        document.getElementById('ai-file-input').value = '';
        document.getElementById('ai-file-preview').classList.add('hidden');
    },

    addMsg(html, role) {
        const container = document.getElementById('ai-messages');
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
        const loadingId = 'loading-' + Date.now();
        this.addMsg(`<i class="fas fa-spinner fa-spin"></i> חושב...`, 'ai');

        try {
            // Context על המערכת
            const context = {
                currentView: Router.current,
                stats: Store.data.stats,
                userRole: Store.role,
                currentYear: Store.currentYear
            };

            const systemPrompt = `
            You are the AI assistant for "Ezer Hatani" Yeshiva System.
            
            **STRICT RULES:**
            1. **SCOPE:** Only answer questions about this system (Students, Donors, Finance, Reports). If asked about anything else (weather, history, code, general knowledge), politely refuse: "אני יכול לעזור רק בנושאים הקשורים למערכת עזר חתנים."
            2. **ACTIONS:** You can guide the user. Available tools:
               - Navigate: {"tool": "navigate", "view": "view_name"}
               - Search: {"tool": "search", "term": "text"}
            3. **DATA PROTECTION:** If the user uploads a file with names that exist in the DB (I will provide duplicates list), WARN them. Do not hallucinate data.
            
            **System State:** ${JSON.stringify(context)}
            ${this.currentFileContent ? `**Attached File:** ${this.currentFileContent}` : ''}
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + "\nUser: " + text }] }] })
            });

            if (!response.ok) throw new Error("API Error");
            
            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "שגיאה בקבלת תשובה";

            // מחיקת הודעת טעינה והצגת תשובה (פשוטה, ללא מחיקת ה-DOM האחרון כרגע למניעת באגים)
            this.handleAIResponse(reply);

        } catch (e) {
            console.error(e);
            this.addMsg("שגיאה בתקשורת. נסה שוב.", 'system');
        }
    },

    handleAIResponse(reply) {
        const clean = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
            if (clean.startsWith('{')) {
                const cmd = JSON.parse(clean);
                if (cmd.tool === 'navigate') {
                    Router.go(cmd.view);
                    this.addMsg(`עברתי למסך ${cmd.view}`, 'ai');
                } else if (cmd.tool === 'search') {
                    if(Router.current !== 'students') Router.go('students');
                    Students.render(cmd.term);
                    this.addMsg(`חיפשתי: ${cmd.term}`, 'ai');
                }
            } else {
                this.addMsg(clean.replace(/\n/g, '<br>'), 'ai');
            }
        } catch (e) {
            this.addMsg(reply, 'ai');
        }
    },

    processOffline(text) {
        let res = "אני במצב אופליין. יכולות מוגבלות.";
        if (text.includes('דוח')) { Reports.generateStandard(); res = "מפיק דוח..."; }
        else if (text.includes('עבור')) { Router.go('dashboard'); res = "עובר..."; }
        this.addMsg(res, 'ai');
    }
};

window.HybridAI = HybridAI;
document.addEventListener('DOMContentLoaded', () => setTimeout(() => HybridAI.init(), 1000));