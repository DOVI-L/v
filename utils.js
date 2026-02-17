const Notify = {
    show(msg, type = 'info') {
        const con = document.getElementById('toast-container');
        if (!con) return alert(msg);
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
        el.innerHTML = `<i class="fas ${icon} toast-icon"></i><span class="font-medium text-slate-800 text-sm">${msg}</span>`;
        con.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
    }
};

const Modal = {
    // הוספתי פרמטר אופציונלי widthClass לשליטה ברוחב המודל
    render(title, fields, onSave, extraHtml='', widthClass = '') {
        let html = '';
        fields.forEach(f => {
            html += `<div class="mb-4">
                <label class="block text-sm font-bold text-slate-700 mb-1">${f.l} ${f.r?'<span class="text-red-500">*</span>':''}</label>`;
            
            if(f.t === 'select') {
                html += `<select id="field-${f.id}" class="w-full border border-slate-300 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition">`;
                f.opts.forEach(o => html += `<option value="${o}" ${f.v===o?'selected':''}>${o}</option>`);
                html += `</select>`;
            } else if(f.t === 'checkbox') {
                 html += `<div class="flex items-center gap-2"><input type="checkbox" id="field-${f.id}" ${f.v?'checked':''} class="h-5 w-5 rounded text-indigo-600"> <span class="text-sm">פעיל</span></div>`;
            } else if(f.t === 'textarea') {
                html += `<textarea id="field-${f.id}" class="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition h-24">${f.v||''}</textarea>`;
            } else if(f.t === 'referrer_select') {
                const opts = Object.values(Store.data.students).map(s => {
                    const n = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
                    return `<option value="${s.id}" ${f.v===s.id?'selected':''}>${n}</option>`;
                }).join('');
                html += `<select id="field-${f.id}" class="w-full border border-slate-300 p-2.5 rounded-lg bg-white"><option value="">-- בחר --</option>${opts}</select>`;
            } else {
                html += `<input id="field-${f.id}" type="${f.t||'text'}" value="${f.v||''}" class="w-full border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition" ${f.r?'required':''}>`;
            }
            html += `</div>`;
        });
        html += extraHtml;
        this.renderRaw(title, html, () => {
            const data = {};
            fields.forEach(f => {
                const el = document.getElementById(`field-${f.id}`);
                data[f.id] = f.t === 'checkbox' ? el.checked : el.value;
            });
            onSave(data);
            this.close();
        }, widthClass);
    },
    renderRaw(title, bodyHtml, onSaveAction, widthClass = '') {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = bodyHtml;
        
        const modalContainer = document.querySelector('#modal-form > div');
        // איפוס מחלקות רוחב קודמות
        modalContainer.classList.remove('w-[550px]', 'max-w-4xl', 'w-full');
        
        // הוספת מחלקת רוחב אם סופקה, אחרת ברירת מחדל
        if (widthClass) {
            widthClass.split(' ').forEach(c => modalContainer.classList.add(c));
        } else {
            modalContainer.classList.add('w-[550px]');
        }

        document.getElementById('modal-form').classList.remove('hidden-screen');
        const btnContainer = document.querySelector('#modal-form .btn-primary').parentElement;
        if(btnContainer) btnContainer.style.display = 'flex';
        
        setTimeout(() => {
            if(modalContainer) modalContainer.classList.remove('scale-95', 'opacity-0');
        }, 10);
        
        const btn = document.getElementById('modal-save-btn');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = onSaveAction;
    },
    close() { 
        const el = document.querySelector('#modal-form > div');
        if(el) el.classList.add('scale-95'); 
        setTimeout(() => document.getElementById('modal-form').classList.add('hidden-screen'), 150); 
    }
};

const ListenerManager = {
    activeListeners: [],
    add(ref, eventType, callback) {
        ref.on(eventType, callback);
        this.activeListeners.push({ ref, eventType, callback });
    },
    remove(ref, eventType, callback) {
        ref.off(eventType, callback);
        this.activeListeners = this.activeListeners.filter(l => l.callback !== callback);
    },
    clearAll() {
        this.activeListeners.forEach(l => l.ref.off(l.eventType, l.callback));
        this.activeListeners = [];
    }
};

const getHebrewYear = () => {
    const d = new Date();
    const y = d.getFullYear();
    const hYear = d.getMonth() > 8 ? y + 3761 : y + 3760; 
    const map = {5780:'תש״פ', 5781:'תשפ״א', 5782:'תשפ״ב', 5783:'תשפ״ג', 5784:'תשפ״ד', 5785:'תשפ״ה', 5786:'תשפ״ו', 5787:'תשפ״ז', 5788:'תשפ״ח'};
    return map[hYear] || hYear.toString();
};

const System = {
    searchTimeout: null,
    initUI() {
        const sel = document.getElementById('year-selector');
        if(!sel) return;
        sel.innerHTML = '';
        
        const d = new Date();
        const currG = d.getFullYear();
        const currH = d.getMonth() > 8 ? currG + 3761 : currG + 3760; 
        const yearsList = [];
        for(let i = -7; i <= 2; i++) {
            const hYear = currH + i;
            const map = {5780:'תש״פ', 5781:'תשפ״א', 5782:'תשפ״ב', 5783:'תשפ״ג', 5784:'תשפ״ד', 5785:'תשפ״ה', 5786:'תשפ״ו', 5787:'תשפ״ז', 5788:'תשפ״ח'};
            yearsList.push(map[hYear] || hYear.toString());
        }

        yearsList.forEach(y => {
            const op = document.createElement('option');
            op.value = y; op.innerText = y;
            if(y === Store.currentYear) op.selected = true;
            sel.appendChild(op);
        });
        document.querySelectorAll('.curr-year').forEach(s => s.innerText = Store.currentYear);
    },
    changeYear(y) {
        const currentView = Router.current;
        ListenerManager.clearAll();
        Store.currentYear = y;
        Store.data.yearData = {};
        Store.data.stats = { income: 0, expense: 0 };
        Store.loadConfig();
        Store.loadStats();
        Store.loadGroups();
        Finance.reset();
        document.querySelectorAll('.curr-year').forEach(s => s.innerText = y);
        Router.go(currentView || 'dashboard'); 
    },
    addCustomYear() {
        const y = prompt("הכנס שנה חדשה (לדוגמה: תשצ״ט או 5800):");
        if (y) {
            const sel = document.getElementById('year-selector');
            const op = document.createElement('option');
            op.value = y; op.innerText = y;
            op.selected = true;
            sel.appendChild(op);
            this.changeYear(y);
        }
    },
    checkStudentProgress(studentId, addedAmount) {
        if(!studentId) return;
        db.ref(`years/${Store.currentYear}/finance`).orderByChild('studentId').equalTo(studentId).once('value', snap => {
            let total = 0;
            if(snap.val()) {
                Object.values(snap.val()).forEach(tx => {
                    if(tx.type === 'income') total += parseFloat(tx.amount || 0);
                });
            }
            const tiers = (Store.data.config.studentTiers || []).sort((a,b) => b.amount - a.amount);
            const reachedTier = tiers.find(t => total >= t.amount);
            if(reachedTier) {
                const previousTotal = total - addedAmount;
                if(previousTotal < reachedTier.amount) {
                    this.showCelebration(Store.data.students[studentId]?.name || 'הבחור', total, reachedTier.reward);
                }
            }
        });
    },
    showCelebration(name, amount, reward) {
        const modal = document.getElementById('celebration-modal');
        document.getElementById('celebration-name').innerText = name;
        document.getElementById('celebration-amount').innerText = amount.toLocaleString();
        document.getElementById('celebration-reward').innerText = reward;
        modal.classList.remove('hidden-screen');
        const container = document.getElementById('confetti-container');
        container.innerHTML = '';
        const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6'];
        for(let i=0; i<100; i++) {
            const c = document.createElement('div');
            c.style.cssText = `
                position: absolute;
                width: ${Math.random()*10+5}px;
                height: ${Math.random()*10+5}px;
                background: ${colors[Math.floor(Math.random()*colors.length)]};
                left: ${Math.random()*100}%;
                top: -20px;
                animation: confetti-fall ${Math.random()*2+2}s linear forwards;
            `;
            container.appendChild(c);
        }
    },
    searchFirebase(term, type) {
        clearTimeout(this.searchTimeout);
        if(!term && !type) { location.reload(); return; }
        if(!term || term.length < 2) {
             if(type === 'students') Students.render();
             if(type === 'donors') Donors.render();
             return;
        }
        this.searchTimeout = setTimeout(() => {
            const path = type === 'students' ? 'global/students' : 'global/donors';
            const ref = db.ref(path);
            ref.orderByChild('name').startAt(term).endAt(term + "\uf8ff").once('value').then(snapshot => {
                const results = snapshot.val();
                if(results) {
                    const targetStore = type === 'students' ? Store.data.students : Store.data.donors;
                    Object.assign(targetStore, results);
                    OfflineManager.saveState(type, targetStore);
                    if(type === 'students') Students.render(term);
                    else Donors.render(term);
                } else {
                    Notify.show('לא נמצאו תוצאות', 'info');
                    if(type === 'students') Students.render(term);
                    else Donors.render(term);
                }
            });
        }, 800); 
    },
    refreshModule() {
        const current = Router.current;
        if (current === 'students' || current === 'donors') {
            Notify.show('מרענן ' + (current==='students'?'בחורים':'תורמים') + '...', 'info');
            Store.data[current] = {};
            Store.cursors[current] = null;
            Store.loadedAll[current] = false;
            OfflineManager.saveState(current, {});
            if (current === 'students') Students.loadMore(true);
            else Donors.loadMore(true);
        } else {
            location.reload();
        }
    },
    clearLocalCache() {
        if(confirm('פעולה זו תמחק את כל הנתונים השמורים בדפדפן ותבצע רענון מלא. להמשיך?')) {
            localStorage.clear();
            location.reload();
        }
    },
    toggleAI(enabled) {
        const aiContainer = document.getElementById('ai-bubble-container');
        const aiCheck = document.getElementById('conf-enable-ai');
        if (Store.role === 'admin' && enabled) {
            if(aiContainer) aiContainer.classList.remove('hidden-screen');
            if(aiCheck) aiCheck.checked = true;
        } else {
            if(aiContainer) aiContainer.classList.add('hidden-screen');
            if(aiCheck) aiCheck.checked = false;
        }
    },
    // פונקציה משופרת להמרת תאריך עברי אמיתי (גימטריה)
    toHebrewDate(dateInput) {
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return dateInput;

            // שימוש ב-Intl כדי לקבל את החלקים
            const options = { calendar: 'hebrew', day: 'numeric', month: 'long', year: 'numeric' };
            const parts = new Intl.DateTimeFormat('he-IL', options).formatToParts(date);
            
            let day = '', month = '', year = '';
            
            parts.forEach(p => {
                if (p.type === 'day') day = p.value;
                if (p.type === 'month') month = p.value;
                if (p.type === 'year') year = p.value;
            });

            // פונקציית עזר לגימטריה (פשוטה למספרים עד 31)
            const toGematria = (num) => {
                const map = {1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י',20:'כ',30:'ל'};
                const n = parseInt(num);
                if (map[n]) return map[n];
                if (n > 10 && n < 20) return 'י' + map[n-10];
                if (n > 20 && n < 30) return 'כ' + map[n-20];
                if (n > 30) return 'ל' + map[n-30];
                return num; // Fallback
            };

            // מיפוי שנים נפוצות (כי Intl מחזיר "ה'תשפ״ו")
            const yearMap = {
                '5784': 'תשפ״ד', '5785': 'תשפ״ה', '5786': 'תשפ״ו', '5787': 'תשפ״ז', '5788': 'תשפ״ח'
            };
            
            // ניקוי "ה'" מהשנה אם קיים
            let cleanYear = year.replace("ה'", "").replace(/,/g, "");
            if (yearMap[cleanYear]) cleanYear = yearMap[cleanYear];

            // המרת יום לגימטריה
            const dayGematria = toGematria(day) + "'";

            return `${dayGematria} ${month} ${cleanYear}`;
        } catch (e) { return dateInput; }
    }
};

const UI = {
    updateIfVisible(module) {
        if(Router.current === module) {
            if(module === 'students') Students.render();
            if(module === 'donors') Donors.render();
            if(module === 'groups') Groups.render();
            if(module === 'finance') Finance.render();
        }
        if(module === 'finance' && Router.current === 'dashboard') Dashboard.render();
    }
};

window.Notify = Notify;
window.Modal = Modal;
window.ListenerManager = ListenerManager;
window.System = System;
window.UI = UI;