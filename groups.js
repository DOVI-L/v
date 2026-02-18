const Groups = {
    currentDay: 'night14',
    activeGroupId: null,
    
    setDay(d) {
        this.currentDay = d;
        document.querySelectorAll('.group-tab').forEach(b => b.classList.toggle('active', b.dataset.day === d));
        this.activeGroupId = null;
        this.render();
    },
    
    render() {
        const listEl = document.getElementById('groups-list');
        listEl.innerHTML = '';
        const groups = (Store.data.yearData[Store.currentYear]?.groups || {})[this.currentDay] || {};
        
        Object.entries(groups).forEach(([gid, g]) => {
            const isActive = gid === this.activeGroupId;
            const el = document.createElement('div');
            el.className = `p-4 border-b cursor-pointer transition flex justify-between items-center group ${isActive ? 'bg-indigo-50 border-r-4 border-r-indigo-600' : 'hover:bg-slate-50'}`;
            el.onclick = () => this.selectGroup(gid, g);
            el.innerHTML = `
                <div>
                    <div class="font-bold text-slate-700 text-sm group-hover:text-indigo-700">${g.name}</div>
                    <div class="text-xs text-gray-400 mt-1">${(g.members||[]).length} בחורים | ${(g.route||[]).length} תורמים</div>
                </div>
                <i class="fas fa-chevron-left text-xs text-gray-300 ${isActive?'text-indigo-500':''}"></i>
            `;
            listEl.appendChild(el);
        });
        
        const ph = document.getElementById('group-placeholder');
        const editor = document.getElementById('group-editor');
        if(this.activeGroupId && groups[this.activeGroupId]) {
            ph.classList.add('hidden');
            editor.classList.remove('hidden');
            this.renderEditor(groups[this.activeGroupId]);
        } else {
            ph.classList.remove('hidden');
            editor.classList.add('hidden');
        }
    },
    
    selectGroup(gid, g) {
        this.activeGroupId = gid;
        document.getElementById('active-group-name').innerText = g.name;
        const dayText = document.querySelector(`.group-tab[data-day="${this.currentDay}"]`).innerText;
        document.getElementById('active-group-details').innerText = `${dayText} | ${(g.members||[]).length} בחורים`;
        this.render(); 
        this.renderEditor(g);
    },
    
    renderEditor(group) {
        const memList = document.getElementById('group-members-list');
        memList.innerHTML = '';
        
        (group.members || []).forEach((m, idx) => {
            const s = Store.data.students[m.id];
            if(!s) return;
            const name = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
            const roleSelect = `
                <select onchange="Groups.updateMemberRole(${idx}, this.value)" class="text-xs border rounded p-1 mr-2 bg-gray-50">
                    <option value="חבר" ${m.role === 'חבר' ? 'selected' : ''}>חבר</option>
                    <option value="ראש צוות" ${m.role === 'ראש צוות' ? 'selected' : ''}>ראש צוות</option>
                    <option value="סגן" ${m.role === 'סגן' ? 'selected' : ''}>סגן</option>
                </select>
            `;
            memList.innerHTML += `
                <div class="bg-white p-2 border rounded shadow-sm text-sm flex justify-between items-center mb-1">
                    <div class="flex items-center">
                        <span class="font-bold text-slate-700 ml-2">${name}</span>
                        ${roleSelect}
                    </div>
                    <button onclick="Groups.removeMember(${idx})" class="text-red-300 hover:text-red-500"><i class="fas fa-times"></i></button>
                </div>`;
        });
        
        const routeList = document.getElementById('group-route-list');
        routeList.innerHTML = '';
        
        // כפתור הוספת הערה
        routeList.innerHTML += `<div class="mb-2 text-center"><button onclick="Groups.addRouteNote()" class="text-xs text-indigo-600 font-bold border border-indigo-200 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100">+ הוסף הערת מסלול</button></div>`;
        
        (group.route || []).forEach((did, i) => {
            if (did.startsWith('NOTE:')) {
                const noteText = did.substring(5);
                const el = document.createElement('div');
                el.className = "bg-yellow-50 p-3 border border-yellow-200 rounded-lg shadow-sm text-sm mb-2 flex justify-between items-center cursor-grab active:cursor-grabbing hover:border-yellow-300 transition";
                el.dataset.id = did;
                el.innerHTML = `
                    <div class="flex items-center gap-3 w-full">
                        <span class="bg-yellow-200 text-yellow-800 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"><i class="fas fa-sticky-note"></i></span>
                        <div class="flex-1 font-bold text-yellow-900">${noteText}</div>
                        <button onclick="Groups.removeFromRoute('${this.currentDay}','${this.activeGroupId}','${did}')" class="text-red-300 hover:text-red-500"><i class="fas fa-times"></i></button>
                    </div>
                `;
                routeList.appendChild(el);
            } else {
                const d = Store.data.donors[did];
                if(!d) return;
                const el = document.createElement('div');
                el.className = "bg-white p-3 border rounded-lg shadow-sm text-sm mb-2 flex justify-between items-center cursor-grab active:cursor-grabbing hover:border-emerald-200 transition";
                el.dataset.id = did;
                el.innerHTML = `
                    <div class="flex items-center gap-3 w-full">
                        <span class="bg-emerald-100 text-emerald-700 w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold">${i+1}</span>
                        <div class="flex-1 overflow-hidden">
                            <div class="font-bold text-slate-800 truncate">${d.name}</div>
                            <div class="text-xs text-gray-500 truncate">${d.city || ''} ${d.street || d.address || ''}</div>
                        </div>
                        <i class="fas fa-grip-lines text-gray-300"></i>
                    </div>
                `;
                routeList.appendChild(el);
            }
        });
        
        if(this.sortableInstance) this.sortableInstance.destroy();
        this.sortableInstance = new Sortable(routeList, {
            animation: 150,
            ghostClass: 'bg-emerald-50',
            handle: '.cursor-grab', // Changed to ensure note handle works or whole element
            onEnd: () => {
                const newOrder = Array.from(routeList.children).filter(c => c.dataset.id).map(c => c.dataset.id);
                OfflineManager.write(`years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}/route`, newOrder);
            }
        });
        this.filterStudents('');
    },

    addRouteNote() {
        const text = prompt("הכנס טקסט להערה במסלול (לדוגמה: 'הפסקה', 'מעבר לרחוב הבא'):");
        if(text) {
             const path = `years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}/route`;
             db.ref(path).once('value', s => {
                const list = s.val() || [];
                list.push(`NOTE:${text}`);
                OfflineManager.write(path, list);
                setTimeout(() => Store.loadGroups(), 300);
             });
        }
    },
    
    addNewGroup() {
        const n = prompt("שם הקבוצה:");
        if(n) {
            const newRef = db.ref(`years/${Store.currentYear}/groups/${this.currentDay}`).push();
            OfflineManager.write(`years/${Store.currentYear}/groups/${this.currentDay}/${newRef.key}`, {name: n, members: [], route: []});
        }
    },
    
    renameGroup() {
        const old = document.getElementById('active-group-name').innerText;
        const n = prompt("שם חדש לקבוצה:", old);
        if(n && n !== old) OfflineManager.write(`years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}/name`, n);
    },
    
    deleteGroup() {
         if(confirm('האם אתה בטוח שברצונך למחוק קבוצה זו?')) {
             OfflineManager.write(`years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}`, null, 'remove');
             this.activeGroupId = null;
             this.render();
         }
    },
    
    filterStudents(term) {
        const pool = document.getElementById('pool-students');
        pool.innerHTML = '';
        
        let list = Object.values(Store.data.students).filter(s => s && !s.isArchived);
        list = list.map(s => ({
            ...s, 
            fullName: s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : (s.name || '')
        }));
        
        const dayGroups = Store.data.yearData[Store.currentYear].groups[this.currentDay] || {};
        const assignedInDay = new Set();
        Object.values(dayGroups).forEach(g => (g.members||[]).forEach(m => assignedInDay.add(m.id)));
        list = list.filter(s => !assignedInDay.has(s.id));

        if(term) {
            list = list.filter(s => s.fullName.includes(term));
        }
        
        list.slice(0, 50).forEach(s => {
            pool.innerHTML += `<div onclick="Groups.addMember('${s.id}')" class="p-2 border-b cursor-pointer hover:bg-indigo-50 flex justify-between text-sm"><span class="font-medium">${s.fullName}</span><i class="fas fa-plus text-indigo-500"></i></div>`;
        });
        if (list.length > 50) pool.innerHTML += `<div class="text-center text-xs text-gray-400 p-2">ישנן עוד תוצאות...</div>`;
    },
    
    addMember(sid) {
        const path = `years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}/members`;
        db.ref(path).once('value', snap => {
            const list = snap.val() || [];
            if(!list.some(x => x.id === sid)) {
                list.push({id: sid, role: 'חבר'});
                OfflineManager.write(path, list);
            }
        });
    },
    
    removeMember(idx) {
        const path = `years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}/members`;
        db.ref(path).once('value', s => {
            const l = s.val(); l.splice(idx,1); 
            OfflineManager.write(path, l);
        });
    },
    
    updateMemberRole(idx, newRole) {
        const path = `years/${Store.currentYear}/groups/${this.currentDay}/${this.activeGroupId}/members/${idx}/role`;
        OfflineManager.write(path, newRole);
    },
    
    removeFromRoute(day, gid, did) {
        const path = `years/${Store.currentYear}/groups/${day}/${gid}/route`;
        db.ref(path).once('value', s => {
            let l = s.val() || [];
            l = l.filter(x => x !== did);
            OfflineManager.write(path, l);
        });
        setTimeout(() => Store.loadGroups(), 500); 
    },
    
    openGroupDonationModal() {
        const g = (Store.data.yearData[Store.currentYear].groups[this.currentDay] || {})[this.activeGroupId];
        if (!g) return Notify.show('שגיאה בטעינת הקבוצה', 'error');

        const html = `
            <div class="mb-4">
                <label class="block text-sm font-bold text-slate-700 mb-1">סכום תרומה קבוצתי</label>
                <input type="number" id="group-total-amount" class="input-field w-full" placeholder="לדוגמה: 1000">
                <p class="text-xs text-gray-500 mt-1">הסכום יירשם לזכות הקבוצה ולא יחולק בין הבחורים.</p>
            </div>
        `;
        Modal.renderRaw('הוספת תרומה קבוצתית', html, () => {
            const total = parseInt(document.getElementById('group-total-amount').value);
            if (!total || total <= 0) return;
            const id = 'tx' + Date.now();
            OfflineManager.write(`years/${Store.currentYear}/finance/${id}`, {
                id, date: Date.now(), type: 'income',
                amount: total, category: 'תרומה קבוצתית',
                desc: `תרומה לקבוצה: ${g.name}`,
                isGroup: true, groupId: this.activeGroupId, groupName: g.name, isPurim: true 
            });
            if(OfflineManager.isOnline) db.ref(`years/${Store.currentYear}/stats/income`).transaction(curr => (curr || 0) + total);
            Notify.show(`תרומה של ${total} ש"ח נרשמה לקבוצה בהצלחה!`, 'success');
            Modal.close();
            setTimeout(() => Finance.loadMore(true), 1000);
        });
    },
    
    copyFromPreviousYear() {
        const mapRev = {'תשפ״ח':5788, 'תשפ״ז':5787, 'תשפ״ו':5786, 'תשפ״ה':5785, 'תשפ״ד':5784, 'תשפ״ג':5783, 'תשפ״ב':5782, 'תשפ״א':5781, 'תש״פ':5780};
        const map = {5788:'תשפ״ח', 5787:'תשפ״ז', 5786:'תשפ״ו', 5785:'תשפ״ה', 5784:'תשפ״ד', 5783:'תשפ״ג', 5782:'תשפ״ב', 5781:'תשפ״א', 5780:'תש״פ'};
        
        const currNum = mapRev[Store.currentYear];
        if(!currNum) return alert('לא ניתן לזהות את השנה הנוכחית');
        const prevYear = map[currNum - 1];
        if(!prevYear) return alert('לא ניתן לזהות את השנה הקודמת');

        if(!confirm(`האם לייבא קבוצות משנת ${prevYear}? הפעולה תייבא את מבנה הקבוצות ואת כל התורמים שהיו משובצים אליהן (ללא בחורים).`)) return;

        Notify.show('מייבא נתונים...', 'info');
        
        const prevYear2 = map[currNum - 2];
        const p1 = db.ref(`years/${prevYear}/groups`).once('value');
        const p2 = prevYear2 ? db.ref(`years/${prevYear2}/groups`).once('value') : Promise.resolve({val:()=>({})});

        Promise.all([p1, p2]).then(snaps => {
            const old1 = snaps[0].val() || {};
            const old2 = snaps[1].val() || {};
            
            const newGroups = {};
            
            const merge = (target, source) => {
                Object.keys(source).forEach(day => {
                    if(!target[day]) target[day] = {};
                    Object.keys(source[day]).forEach(gid => {
                        if(!target[day][gid]) target[day][gid] = { name: source[day][gid].name, route: [], members: [] };
                        const existingRoute = new Set(target[day][gid].route);
                        (source[day][gid].route || []).forEach(did => {
                            if(!existingRoute.has(did)) target[day][gid].route.push(did);
                        });
                    });
                });
            };

            merge(newGroups, old1);
            merge(newGroups, old2);

            db.ref(`years/${Store.currentYear}/groups`).update(newGroups, (err) => {
                if(err) Notify.show('שגיאה בהעתקה', 'error');
                else {
                    Notify.show('הקבוצות והמסלולים יובאו בהצלחה!', 'success');
                    setTimeout(() => location.reload(), 1500);
                }
            });
        });
    },
    
    async exportGroupData(format) {
        const g = (Store.data.yearData[Store.currentYear].groups[this.currentDay] || {})[this.activeGroupId];
        if(!g) return;

        await Store.ensureAllLoaded('donors');
        
        Reports.getAllHistory().then(historyData => {
            const donors = (g.route || []).filter(x => !x.startsWith('NOTE:')).map(did => Store.data.donors[did]).filter(x => x);
            const rows = donors.map(d => {
                const row = {
                    "שם": d.name,
                    "כתובת": `${d.city||''} ${d.street||''}`,
                    "טלפון": d.phone || '',
                    "הערות": d.notes || ''
                };
                 Object.keys(historyData).forEach(yNum => {
                     const hYear = Object.keys(HEBREW_YEARS_MAPPING).find(key => HEBREW_YEARS_MAPPING[key] == yNum);
                     if(hYear) row[hYear] = historyData[yNum][d.id] || 0;
                 });
                 return row;
            });

            if (format === 'excel') {
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "נתוני קבוצה");
                XLSX.writeFile(wb, `Group_${g.name}.xlsx`);
            } else {
                 // שימוש בעורך להדפסת נתונים
                 this.printSheet('data');
            }
        });
    },
    
    async printAllGroups() {
        Notify.show('מכין הדפסה מרוכזת...', 'info');
        await Store.ensureAllLoaded('students');

        const groups = Store.data.yearData[Store.currentYear]?.groups[this.currentDay] || {};
        const dayName = this.currentDay.replace('night','ליל ').replace('day','יום ');

        if (Object.keys(groups).length === 0) return Notify.show('אין קבוצות להדפסה ביום זה', 'info');

        let html = `<div class="boxes-container">`;
        
        Object.values(groups).forEach(g => {
            html += `
                <div class="group-box">
                    <div class="group-box-header">${g.name} - ${dayName}</div>
                    <div class="group-box-content">
            `;
            const members = g.members || [];
            const commanders = members.filter(m => m.role === 'ראש צוות');
            const deputies = members.filter(m => m.role === 'סגן');
            const regulars = members.filter(m => m.role !== 'ראש צוות' && m.role !== 'סגן');
            
            const renderRow = (m, roleText) => {
                const s = Store.data.students[m.id];
                if (!s) return '';
                const name = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
                return `
                    <div class="group-box-row">
                        <span class="box-name">${name} ${roleText ? `<span class="box-role">(${roleText})</span>` : ''}</span>
                        <span class="box-grade">${s.grade || ''}</span>
                    </div>
                `;
            };
            commanders.forEach(m => html += renderRow(m, 'ר"צ'));
            deputies.forEach(m => html += renderRow(m, 'סגן'));
            regulars.forEach(m => html += renderRow(m, ''));
            html += `</div></div>`;
        });
        html += '</div>';
        
        const pa = document.getElementById('print-area');
        pa.innerHTML = `<div class="print-header no-print-bg"><img src="1.JPG" alt="לוגו"><h1>רשימת קבוצות - ${dayName}</h1><h3>שנה: ${Store.currentYear}</h3></div>${html}`;
        window.print();
    },
    
    // שינוי עיקרי כאן: פתיחת העורך המתקדם ודוח מסלול מסודר
    async printSheet(type) {
        const g = (Store.data.yearData[Store.currentYear].groups[this.currentDay] || {})[this.activeGroupId];
        if(!g) return;
        
        const dayMap = {'night14': 'ליל י"ד', 'day14': 'יום י"ד', 'day15': 'יום ט"ו'};
        const dayName = dayMap[this.currentDay] || this.currentDay;
        
        // טען הכל לפני הדפסה
        if(type === 'members') await Store.ensureAllLoaded('students');
        if(type === 'route') await Store.ensureAllLoaded('donors');
        
        let customHtml = '';
        
        if(type === 'members') {
            const members = g.members || [];
            const commanders = members.filter(m => m.role === 'ראש צוות');
            const deputies = members.filter(m => m.role === 'סגן');
            const regulars = members.filter(m => m.role !== 'ראש צוות' && m.role !== 'סגן');

            const renderMemberRow = (m, idx) => {
                const s = Store.data.students[m.id];
                if (!s) return '';
                const name = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
                let roleBadge = '', rowClass = '';
                if (m.role === 'ראש צוות') { roleBadge = '<span class="role-badge role-commander">ראש צוות</span>'; rowClass = 'font-bold bg-blue-50'; }
                else if (m.role === 'סגן') { roleBadge = '<span class="role-badge role-deputy">סגן</span>'; rowClass = 'bg-yellow-50'; }
                
                return `<tr class="${rowClass}"><td width="5%" class="text-center">${idx+1}</td><td width="55%"><b>${name}</b> ${roleBadge}</td><td width="40%">${s.grade || ''}</td></tr>`;
            };
            
            // יצירת פורמט "דף קבוצה" בסגנון דף בחור
            customHtml = `
                <div class="student-slip" style="margin: 0 auto; width: 100%; border: none;">
                    <div class="student-slip-header">
                        <div>
                            <div class="student-slip-title">דף קבוצה: ${g.name}</div>
                            <div>${dayName} | שנה: ${Store.currentYear}</div>
                        </div>
                    </div>
                    <table class="print-table w-full"><thead><tr><th>#</th><th>שם הבחור</th><th>שיעור</th></tr></thead><tbody>`;
            
            let count = 0;
            commanders.forEach(m => customHtml += renderMemberRow(m, count++));
            deputies.forEach(m => customHtml += renderMemberRow(m, count++));
            regulars.forEach(m => customHtml += renderMemberRow(m, count++));
            customHtml += `</tbody></table></div>`;
            
        } else {
            // דף מסלול
            Notify.show('מכין נתונים להדפסה...', 'info');
            const yearMapRev = {'תשפ״ח':5788, 'תשפ״ז':5787, 'תשפ״ו':5786, 'תשפ״ה':5785, 'תשפ״ד':5784, 'תשפ״ג':5783, 'תשפ״ב':5782, 'תשפ״א':5781, 'תש״פ':5780};
            const yearMap = {5788:'תשפ״ח', 5787:'תשפ״ז', 5786:'תשפ״ו', 5785:'תשפ״ה', 5784:'תשפ״ד', 5783:'תשפ״ג', 5782:'תשפ״ב', 5781:'תשפ״א', 5780:'תש״פ'};
            
            let currNum = yearMapRev[Store.currentYear] || 5785;
            const prev1 = yearMap[currNum-1] || (currNum-1).toString();
            const prev2 = yearMap[currNum-2] || (currNum-2).toString();
            const prev3 = yearMap[currNum-3] || (currNum-3).toString();

            const getHistory = async (year) => {
                const snap = await db.ref(`years/${year}/finance`).once('value');
                const val = snap.val() || {};
                const totals = {};
                Object.values(val).forEach(tx => {
                    if (tx.type === 'income' && tx.donorId) {
                        if (!totals[tx.donorId]) totals[tx.donorId] = 0;
                        totals[tx.donorId] += (isNaN(parseFloat(tx.amount)) ? 0 : parseFloat(tx.amount));
                    }
                });
                return totals;
            };

            const [hist1, hist2, hist3] = await Promise.all([getHistory(prev1), getHistory(prev2), getHistory(prev3)]);

            customHtml = `
                <div class="student-slip" style="margin: 0 auto; width: 100%; border: none;">
                    <div class="student-slip-header">
                         <div>
                            <div class="student-slip-title">דף מסלול: ${g.name}</div>
                            <div>${dayName} | שנה: ${Store.currentYear}</div>
                        </div>
                    </div>
                    <table class="print-table w-full text-sm">
                        <thead><tr>
                            <th width="3%">#</th><th width="20%">שם</th><th width="20%">כתובת</th><th width="16%">הערות</th>
                            <th width="7%">${prev3}</th><th width="7%">${prev2}</th><th width="7%">${prev1}</th><th width="9%">סכום</th>
                        </tr></thead><tbody>`;
            
            let i = 1;
            (g.route||[]).forEach((did) => {
                if(did.startsWith('NOTE:')) {
                     const noteText = did.substring(5);
                     customHtml += `<tr style="background-color: #fef9c3;"><td colspan="8" style="font-weight:bold; text-align:center; padding: 8px;">-- ${noteText} --</td></tr>`;
                } else {
                    const d = Store.data.donors[did];
                    if(d) {
                        const val1 = hist1[did] ? '₪'+hist1[did] : '';
                        const val2 = hist2[did] ? '₪'+hist2[did] : '';
                        const val3 = hist3[did] ? '₪'+hist3[did] : '';
                        customHtml += `<tr><td>${i++}</td><td>${d.name}</td><td>${d.city||''} ${d.street||''}</td><td>${d.notes||''}</td><td>${val3}</td><td>${val2}</td><td>${val1}</td><td></td></tr>`;
                    }
                }
            });
            customHtml += `</tbody></table></div>`;
        }

        // פתיחת התוכן בעורך הדוחות במצב מותאם
        Reports.openEditor('custom', customHtml);
    }
};

window.Groups = Groups;
