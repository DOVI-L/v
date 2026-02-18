const HybridAI = {
    mode: 'offline', // 'online' | 'offline'
    isQuotaExceeded: false,
    currentFileContent: null,
    
    init() {
        this.checkConnectivity();
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
        
        // בדוק אם יש מפתח אונליין תקין
        const hasKey = window.GEMINI_API_KEY && !window.GEMINI_API_KEY.includes('PLACEHOLDER');
        if (!hasKey) {
            this.addMsg("הערה: לא הוזרק מפתח API מהשרת. ה-AI יעבוד במצב אופליין בלבד.", 'system');
        } else {
            console.log("HybridAI: API Key detected.");
        }
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
                const reason = !navigator.onLine ? "אין אינטרנט" : (this.isQuotaExceeded ? "חריגת מכסה" : "מצב מכני");
                text.innerText = `אופליין (${reason})`;
            }
        }
    },

    handleNetworkChange(isOnline) {
        if (isOnline) {
            this.addMsg(`
                <div class="flex justify-between items-center bg-green-50 p-2 rounded border border-green-200">
                    <span><i class="fas fa-wifi text-green-600"></i> האינטרנט חזר!</span>
                    <button onclick="HybridAI.retryOnline()" class="text-xs bg-green-600 text-white px-3 py-1 rounded font-bold hover:bg-green-700 transition">התחבר מחדש</button>
                </div>
            `, 'system');
        } else {
            this.setMode('offline');
            this.addMsg("החיבור נותק. עברתי למצב אופליין.", 'system');
        }
    },

    retryOnline() {
        this.isQuotaExceeded = false;
        this.checkConnectivity();
        if (this.mode === 'online') {
            this.addMsg("התחברתי בהצלחה ל-Gemini.", 'system');
        } else {
            this.addMsg("עדיין לא ניתן להתחבר (בדוק מפתח API).", 'system');
        }
    },

    handleFileSelect(input) {
        const file = input.files[0];
        if(!file) return;
        
        document.getElementById('ai-file-preview').classList.remove('hidden');
        document.getElementById('ai-file-name').innerText = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            if(file.name.endsWith('xlsx') || file.name.endsWith('xls')) {
                try {
                    const workbook = XLSX.read(e.target.result, {type: 'binary'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    this.currentFileContent = XLSX.utils.sheet_to_csv(firstSheet);
                    this.addMsg(`קובץ נטען. ניתן לשאול שאלות על תוכנו.`, 'system');
                } catch(err) {
                    this.addMsg("שגיאה בקריאת קובץ אקסל.", 'system');
                }
            } else {
                this.currentFileContent = e.target.result;
            }
        };
        
        if(file.name.endsWith('xlsx') || file.name.endsWith('xls')) {
            reader.readAsBinaryString(file);
        } else {
            reader.readAsText(file);
        }
    },

    clearFile() {
        this.currentFileContent = null;
        document.getElementById('ai-file-input').value = '';
        document.getElementById('ai-file-preview').classList.add('hidden');
    },

    addMsg(html, role) {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        
        let styleClass = "p-3 rounded-xl mb-2 text-sm max-w-[90%] shadow-sm animate-fade-in ";
        if (role === 'user') styleClass += "bg-indigo-600 text-white self-end rounded-br-none";
        else if (role === 'ai') styleClass += "bg-white text-slate-800 self-start border border-gray-200 rounded-bl-none";
        else styleClass += "bg-gray-100 text-gray-600 self-center text-xs w-full text-center border border-gray-200";

        div.className = styleClass;
        div.innerHTML = html;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    async send() {
        const inp = document.getElementById('ai-input');
        const text = inp.value.trim();
        
        if (!text && !this.currentFileContent) return;

        let userDisplay = text;
        if (this.currentFileContent) userDisplay += ' <span class="text-xs bg-white/20 px-1 rounded inline-flex items-center gap-1"><i class="fas fa-paperclip"></i> קובץ</span>';
        this.addMsg(userDisplay, 'user');
        
        inp.value = '';

        if (this.mode === 'online') {
            await this.processOnline(text);
        } else {
            this.processOffline(text);
        }
    },

    async processOnline(text) {
        const loadingId = 'loading-' + Date.now();
        this.addMsg(`<div id="${loadingId}" class="flex items-center gap-2"><i class="fas fa-circle-notch fa-spin text-indigo-500"></i> חושב...</div>`, 'ai');

        try {
            const stats = JSON.stringify(Store.data.stats);
            let context = `Current View: ${Router.current}. User Role: ${Store.role}. Stats: ${stats}.`;
            
            if (this.currentFileContent) {
                context += `\n\nATTACHED FILE CONTENT (Truncated):\n${this.currentFileContent.substring(0, 10000)}\n[End of File]`;
                this.clearFile();
            }

            const systemPrompt = `
            You are "EzerBot", a smart assistant for a Yeshiva management system.
            Context: ${context}
            
            Capabilities:
            1. Analyze attached file data (CSV/Text) and answer questions.
            2. Control the app via JSON commands.
            3. Answer general questions in Hebrew.

            JSON COMMANDS (Output ONLY JSON if action is needed):
            - {"tool": "navigate", "view": "dashboard|students|donors|finance|reports"}
            - {"tool": "search", "term": "search term"}
            - {"tool": "report", "type": "visual|finance"}

            If no command needed, just answer in Hebrew.
            User says: "${text}"
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
            });

            if (!response.ok) {
                if (response.status === 429) throw new Error("QUOTA");
                throw new Error("NETWORK");
            }

            const data = await response.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "שגיאה בקבלת תשובה.";

            document.getElementById(loadingId).parentElement.remove(); // הסרת הודעת טעינה
            this.handleAIResponse(reply);

        } catch (error) {
            const loader = document.getElementById(loadingId);
            if(loader) loader.parentElement.remove();

            if (error.message === "QUOTA") {
                this.isQuotaExceeded = true;
                this.addMsg(`
                    <div class="border-r-4 border-red-500 pr-2 bg-red-50 p-2">
                        <strong>הגענו למגבלת השימוש.</strong><br>
                        עובר למצב אופליין.
                    </div>
                `, 'system');
            } else {
                this.addMsg("שגיאת תקשורת עם Gemini. מנסה לענות באופליין...", 'system');
            }
            
            this.setMode('offline');
            this.processOffline(text);
        }
    },

    handleAIResponse(reply) {
        const cleanReply = reply.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            if (cleanReply.startsWith('{') && cleanReply.endsWith('}')) {
                const cmd = JSON.parse(cleanReply);
                
                if (cmd.tool === 'navigate') {
                    Router.go(cmd.view);
                    this.addMsg(`ניווטתי למסך ${cmd.view}.`, 'ai');
                } else if (cmd.tool === 'search') {
                    if (Router.current !== 'students') Router.go('students');
                    Students.render(cmd.term);
                    this.addMsg(`חיפשתי את "${cmd.term}".`, 'ai');
                } else if (cmd.tool === 'report') {
                    if (cmd.type === 'visual') Reports.openEditor();
                    else Reports.generateStandard();
                    this.addMsg("הפעלתי את הדוח המבוקש.", 'ai');
                }
            } else {
                this.addMsg(reply.replace(/\n/g, '<br>'), 'ai');
            }
        } catch (e) {
            this.addMsg(reply, 'ai');
        }
    },

    processOffline(text) {
        let response = "אני במצב אופליין. יכולות מוגבלות.";
        
        if (this.currentFileContent) {
            response = "באופליין אני יכול רק להציג את תחילת הקובץ:<br><pre class='text-xs bg-gray-200 p-2 mt-1 overflow-auto max-h-32'>" + this.currentFileContent.substring(0, 300) + "...</pre>";
            this.clearFile();
        }
        else if (text.includes('דוח')) {
            if (text.includes('כספ')) { Reports.generateStandard(); response = "מפיק דוח כספי..."; }
            else { Reports.openEditor(); response = "פותח עורך דוחות..."; }
        }
        else if (text.includes('עבור') || text.includes('לך')) {
            if(text.includes('קופה')) { Router.go('finance'); response = "עובר לקופה..."; }
            else if(text.includes('בית')) { Router.go('dashboard'); response = "עובר לבית..."; }
            else response = "לא הבנתי לאן לעבור.";
        }
        else if (text.includes('חפש')) {
            const term = text.replace('חפש','').trim();
            if (Router.current !== 'students') Router.go('students');
            Students.render(term);
            response = `מחפש "${term}"...`;
        }

        this.addMsg(response, 'ai');
    }
};

window.HybridAI = HybridAI;
// טעינה מאוחרת לוודא שכל התלויות קיימות
document.addEventListener('DOMContentLoaded', () => setTimeout(() => HybridAI.init(), 1000));