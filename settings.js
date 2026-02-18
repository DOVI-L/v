const Settings = {
 init() {
        // וידוא שהאלמנטים קיימים לפני שמנסים לשנות אותם
        if(document.getElementById('settings-active-fields')) {
            this.renderFieldsEditor();
            this.renderGoals();
            this.renderStudentRewards();
            this.renderBonusTiers();
            this.renderVouchers();
        }

        if(Store.data.config) {
            const elGoal = document.getElementById('conf-global-goal');
            if(elGoal) elGoal.value = Store.data.config.globalGoal || '';
            
            const elBase = document.getElementById('conf-base-student-goal');
            if(elBase) elBase.value = Store.data.config.baseStudentGoal || '';
            
            const elAI = document.getElementById('conf-enable-ai');
            if(elAI) elAI.checked = Store.data.config.enableAI || false;
            
            const gd = Store.data.config.groupDiscounts || {};
            const elD1 = document.getElementById('conf-disc-night14');
            if(elD1) elD1.value = gd.night14 || 0;
            const elD2 = document.getElementById('conf-disc-day14');
            if(elD2) elD2.value = gd.day14 || 0;
            const elD3 = document.getElementById('conf-disc-day15');
            if(elD3) elD3.value = gd.day15 || 0;
        }
    },
    save(key, val) { OfflineManager.write(`settings/${key}`, parseInt(val)); Notify.show('הגדרה נשמרה', 'success'); },
    saveGroupDiscount(key, val) {
        OfflineManager.write(`settings/groupDiscounts/${key}`, parseInt(val));
    },
    createUser() {
        const email = document.getElementById('new-user-email').value;
        const pass = document.getElementById('new-user-pass').value;
        const role = document.getElementById('new-user-role').value;
        if(!email || !pass) return alert('נא למלא אימייל וסיסמה');
        try {
            const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary");
            secondaryApp.auth().createUserWithEmailAndPassword(email, pass).then(cred => {
                db.ref(`users/${cred.user.uid}`).set({ email: email, role: role });
                secondaryApp.auth().signOut();
                secondaryApp.delete(); 
                Notify.show('משתמש נוצר בהצלחה!', 'success');
                document.getElementById('new-user-email').value = '';
                document.getElementById('new-user-pass').value = '';
            }).catch(err => {
                alert("שגיאה ביצירת משתמש: " + err.message);
                if(secondaryApp) secondaryApp.delete();
            });
        } catch(e) { console.error(e); }
    },
    loadUsersList() {
        db.ref('users').once('value', snap => {
            const users = snap.val() || {};
            const container = document.getElementById('users-list-container');
            container.innerHTML = '';
            Object.entries(users).forEach(([uid, u]) => {
                container.innerHTML += `
                    <div class="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                        <div><span class="font-bold">${u.email}</span> (${u.role})</div>
                        <div class="flex gap-2">
                            <button onclick="Settings.sendPasswordReset('${u.email}')" class="text-orange-500 hover:text-orange-700 text-xs font-bold" title="שלח למשתמש מייל לאיפוס/שינוי סיסמה">שנה סיסמה (מייל)</button>
                            <button onclick="Settings.updateUserRole('${uid}', '${u.role === 'admin' ? 'user' : 'admin'}')" class="text-blue-500 hover:underline text-xs">שנה תפקיד</button>
                            <button onclick="Settings.deleteUserDB('${uid}')" class="text-red-500 hover:text-red-700 text-xs font-bold">מחק גישה</button>
                        </div>
                    </div>`;
            });
        });
    },
    sendPasswordReset(email) {
        if(confirm(`האם לשלוח ל-${email} מייל לשינוי סיסמה?`)) {
            auth.sendPasswordResetEmail(email).then(() => {
                Notify.show('מייל לשינוי סיסמה נשלח בהצלחה', 'success');
            }).catch(error => {
                Notify.show('שגיאה בשליחת מייל: ' + error.message, 'error');
            });
        }
    },
    updateUserRole(uid, newRole) {
        if(confirm('לשנות את תפקיד המשתמש?')) {
            db.ref(`users/${uid}/role`).set(newRole).then(() => {
                this.loadUsersList();
                Notify.show('תפקיד עודכן', 'success');
            });
        }
    },
    deleteUserDB(uid) {
        if(confirm('פעולה זו תסיר את גישת המשתמש מהמערכת. האם להמשיך?')) {
            db.ref(`users/${uid}`).remove().then(() => {
                this.loadUsersList();
                Notify.show('גישה הוסרה', 'info');
            });
        }
    },
    exportDataAsJSON() {
        Notify.show('מכין גיבוי מלא...', 'info');
        db.ref('/').once('value', snap => {
            const fullData = snap.val();
            const dataStr = JSON.stringify(fullData, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_ezer_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            Notify.show('הגיבוי ירד למחשב', 'success');
        });
    },
    importDataFromJSON(input) {
        const file = input.files[0];
        if (!file) return;
        if(!confirm('אזהרה: המערכת תוסיף רק נתונים חסרים ולא תדרוס נתונים קיימים. להמשיך?')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                Notify.show('מנתח נתונים...', 'info');
                db.ref('/').once('value', snap => {
                    const currentData = snap.val() || {};
                    const updates = {};
                    let addedCount = 0;
                    function processMerge(path, incoming, existing) {
                        if (typeof incoming === 'object' && incoming !== null) {
                            Object.keys(incoming).forEach(key => {
                                const newPath = path ? `${path}/${key}` : key;
                                if (!existing || !existing.hasOwnProperty(key)) {
                                    updates[newPath] = incoming[key];
                                    addedCount++;
                                } else if (typeof incoming[key] === 'object' && incoming[key] !== null) {
                                    processMerge(newPath, incoming[key], existing[key]);
                                }
                            });
                        }
                    }
                    processMerge('', importedData, currentData);
                    if (Object.keys(updates).length > 0) {
                        db.ref().update(updates).then(() => {
                            Notify.show(`השחזור הצליח! נוספו ${addedCount} רשומות חדשות.`, 'success');
                            setTimeout(() => location.reload(), 2000);
                        });
                    } else {
                        Notify.show('לא נמצאו נתונים חדשים לייבוא.', 'info');
                    }
                });
            } catch(err) { alert('קובץ לא תקין'); }
        };
        reader.readAsText(file);
    },
    syncYears() {
        if(!confirm('פעולה זו תקדם את כל הבחורים בשיעור אחד. בוגרי קיבוץ ח\' יועברו לתורמים. להמשיך?')) return;
        Notify.show('מבצע סנכרון...', 'info');
        db.ref('global/students').once('value', s => {
            const allStudents = s.val() || {};
            const updates = {};
            const newDonors = {};
            let movedCount = 0;
            Object.values(allStudents).forEach(st => {
                const currentGrade = st.grade;
                if(!currentGrade) return;
                const idx = SHIURIM_ORDER.indexOf(currentGrade);
                if(idx === -1) return; 
                if(idx < SHIURIM_ORDER.length - 1) {
                    updates[`global/students/${st.id}/grade`] = SHIURIM_ORDER[idx + 1];
                } else {
                    movedCount++;
                    updates[`global/students/${st.id}`] = null; 
                    const n = st.firstName && st.lastName ? `${st.firstName} ${st.lastName}` : (st.name || '');
                    newDonors[`global/donors/${st.id}`] = {
                        id: st.id, name: n, phone: st.phone, address: st.city || '',
                        joinYear: Store.currentYear, notes: 'בוגר (הועבר אוטומטית)', isAlumni: true
                    };
                }
            });
            db.ref().update(updates).then(() => {
                 if(movedCount > 0) db.ref().update(newDonors);
                 Notify.show(`סנכרון הושלם. ${movedCount} בוגרים הועברו לתורמים.`, 'success');
                 setTimeout(() => location.reload(), 2000);
            });
        });
    },
    renderFieldsEditor() {
        const type = document.getElementById('settings-field-type').value;
        const list = document.getElementById('settings-active-fields');
        const customList = document.getElementById('settings-custom-list');
        const select = document.getElementById('settings-predefined-field');
        const defs = PREDEFINED_FIELDS[type] || [];
        select.innerHTML = '';
        defs.forEach(d => select.innerHTML += `<option value="${d.k}">${d.l}</option>`);
        const customDefs = Store.data.config.customFieldsDefs || {};
        customList.innerHTML = '';
        Object.entries(customDefs).forEach(([k, def]) => {
             select.innerHTML += `<option value="${k}" class="text-indigo-600">${def.l} (מותאם)</option>`;
             customList.innerHTML += `
                <div class="flex justify-between items-center text-xs bg-gray-50 p-1 border rounded">
                    <span>${def.l} (${k})</span>
                    <button onclick="Settings.deleteCustomFieldDef('${k}')" class="text-red-500 hover:text-red-700 px-2" title="מחק שדה מהמערכת"><i class="fas fa-trash"></i></button>
                </div>`;
        });
        if(Object.keys(customDefs).length === 0) customList.innerHTML = '<span class="text-gray-400 text-xs">אין שדות מותאמים</span>';
        const active = (Store.data.config.fields || {})[type] || DEFAULT_ACTIVE_FIELDS[type];
        list.innerHTML = '';
        active.forEach(k => {
            let def = defs.find(d => d.k === k);
            if (!def && customDefs[k]) def = {l: customDefs[k].l};
            const label = def ? def.l : k;
            list.innerHTML += `
                <div class="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm">
                    <span>${label}</span>
                    <button onclick="Settings.removeField('${type}','${k}')" class="text-red-500 hover:text-red-700"><i class="fas fa-trash"></i></button>
                </div>`;
        });
    },
    addField() {
        const type = document.getElementById('settings-field-type').value;
        const key = document.getElementById('settings-predefined-field').value;
        const active = (Store.data.config.fields || {})[type] || [];
        if(!active.includes(key)) {
            active.push(key);
            OfflineManager.write(`settings/fields/${type}`, active);
            if(!Store.data.config.fields) Store.data.config.fields = {};
            Store.data.config.fields[type] = active;
            this.renderFieldsEditor();
        }
    },
    addCustomField() {
        const key = document.getElementById('custom-field-key').value.trim();
        const label = document.getElementById('custom-field-label').value.trim();
        if(!key || !label) return alert('חובה למלא מזהה (באנגלית) ותווית (בעברית)');
        const defs = Store.data.config.customFieldsDefs || {};
        defs[key] = { l: label };
        OfflineManager.write(`settings/customFieldsDefs`, defs);
        Store.data.config.customFieldsDefs = defs;
        const type = document.getElementById('settings-field-type').value;
        const active = (Store.data.config.fields || {})[type] || [];
        if(!active.includes(key)) {
            active.push(key);
            OfflineManager.write(`settings/fields/${type}`, active);
            if(!Store.data.config.fields) Store.data.config.fields = {};
            Store.data.config.fields[type] = active;
        }
        document.getElementById('custom-field-key').value = '';
        document.getElementById('custom-field-label').value = '';
        Notify.show('שדה מותאם נוסף בהצלחה', 'success');
        this.renderFieldsEditor();
    },
    deleteCustomFieldDef(key) {
        if(!confirm('האם אתה בטוח שברצונך למחוק שדה זה מהמערכת?')) return;
        const defs = Store.data.config.customFieldsDefs || {};
        delete defs[key];
        OfflineManager.write('settings/customFieldsDefs', defs);
        Store.data.config.customFieldsDefs = defs;
        ['students', 'donors'].forEach(type => {
            let active = (Store.data.config.fields || {})[type] || [];
            if(active.includes(key)) {
                active = active.filter(k => k !== key);
                OfflineManager.write(`settings/fields/${type}`, active);
                Store.data.config.fields[type] = active;
            }
        });
        this.renderFieldsEditor();
        Notify.show('השדה נמחק מהמערכת', 'info');
    },
    removeField(type, key) {
        if(!confirm('האם להסיר את השדה מהרשימה הפעילה?')) return;
        let active = (Store.data.config.fields || {})[type] || [];
        active = active.filter(k => k !== key);
        OfflineManager.write(`settings/fields/${type}`, active);
        Store.data.config.fields[type] = active;
        this.renderFieldsEditor();
    },
    renderGoals() {
        const div = document.getElementById('settings-goals-tiers');
        const tiers = Store.data.config.tiers || [];
        div.innerHTML = tiers.map((t, i) => `
            <div class="flex gap-2 items-center mb-2">
                <span class="text-sm font-bold w-6">#${i+1}</span>
                <input type="number" placeholder="סכום תרומה" value="${t.amount}" onchange="Settings.updateTier(${i}, 'amount', this.value)" class="input-field w-24 p-1 text-sm">
                <input type="text" placeholder="סכום זיכוי (מספר) או מתנה" value="${t.gift}" onchange="Settings.updateTier(${i}, 'gift', this.value)" class="input-field flex-1 p-1 text-sm">
                <button onclick="Settings.removeTier(${i})" class="text-red-500"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    },
    addGoalTier() {
        const tiers = Store.data.config.tiers || [];
        tiers.push({amount: 0, gift: ''});
        OfflineManager.write('settings/tiers', tiers);
        Store.data.config.tiers = tiers;
        this.renderGoals();
    },
    updateTier(i, k, v) {
        const tiers = [...Store.data.config.tiers];
        tiers[i][k] = v;
        OfflineManager.write('settings/tiers', tiers);
    },
    removeTier(i) {
        const tiers = Store.data.config.tiers || [];
        tiers.splice(i, 1);
        OfflineManager.write('settings/tiers', tiers);
        Store.data.config.tiers = tiers;
        this.renderGoals();
    },
    renderStudentRewards() {
        const div = document.getElementById('settings-student-rewards');
        const tiers = Store.data.config.studentTiers || [];
        div.innerHTML = tiers.map((t, i) => `
            <div class="flex gap-2 items-center bg-white p-2 rounded border border-amber-100">
                <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold">${i+1}</div>
                <div class="flex-1 grid grid-cols-2 gap-2">
                    <input type="number" placeholder="סכום יעד" value="${t.amount}" onchange="Settings.updateStudentReward(${i}, 'amount', this.value)" class="input-field text-sm">
                    <input type="text" placeholder="תיאור מתנה/תגמול" value="${t.reward}" onchange="Settings.updateStudentReward(${i}, 'reward', this.value)" class="input-field text-sm">
                </div>
                <button onclick="Settings.removeStudentReward(${i})" class="text-red-400 hover:bg-red-50 p-2 rounded"><i class="fas fa-trash-alt"></i></button>
            </div>
        `).join('');
    },
    addStudentReward() {
        const tiers = Store.data.config.studentTiers || [];
        tiers.push({amount: 5000, reward: 'מתנה חדשה'});
        OfflineManager.write('settings/studentTiers', tiers);
        Store.data.config.studentTiers = tiers;
        this.renderStudentRewards();
    },
    updateStudentReward(i, k, v) {
        const tiers = [...Store.data.config.studentTiers];
        tiers[i][k] = k === 'amount' ? parseInt(v) : v;
        OfflineManager.write('settings/studentTiers', tiers);
    },
    removeStudentReward(i) {
        const tiers = Store.data.config.studentTiers || [];
        tiers.splice(i, 1);
        OfflineManager.write('settings/studentTiers', tiers);
        Store.data.config.studentTiers = tiers;
        this.renderStudentRewards();
    },
    renderBonusTiers() {
        const div = document.getElementById('settings-bonus-tiers');
        const tiers = Store.data.config.bonusTiers || [];
        div.innerHTML = tiers.map((t, i) => `
            <div class="flex gap-2 items-center mb-2">
                <span class="text-xs">מ:</span>
                <input type="number" value="${t.rangeMin}" onchange="Settings.updateBonusTier(${i}, 'rangeMin', this.value)" class="input-field w-20 p-1 text-sm">
                <span class="text-xs">עד:</span>
                <input type="number" value="${t.rangeMax}" onchange="Settings.updateBonusTier(${i}, 'rangeMax', this.value)" class="input-field w-20 p-1 text-sm">
                <span class="text-xs">ש"ח =</span>
                <input type="number" value="${t.percent}" onchange="Settings.updateBonusTier(${i}, 'percent', this.value)" class="input-field w-16 p-1 text-sm">
                <span class="text-xs">%</span>
                <button onclick="Settings.removeBonusTier(${i})" class="text-red-500"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    },
    addBonusTier() {
        const tiers = Store.data.config.bonusTiers || [];
        tiers.push({rangeMin: 0, rangeMax: 1000, percent: 10});
        OfflineManager.write('settings/bonusTiers', tiers);
        Store.data.config.bonusTiers = tiers;
        this.renderBonusTiers();
    },
    updateBonusTier(i, k, v) {
        const tiers = [...Store.data.config.bonusTiers];
        tiers[i][k] = parseFloat(v);
        OfflineManager.write('settings/bonusTiers', tiers);
    },
    removeBonusTier(i) {
        const tiers = Store.data.config.bonusTiers || [];
        tiers.splice(i, 1);
        OfflineManager.write('settings/bonusTiers', tiers);
        Store.data.config.bonusTiers = tiers;
        this.renderBonusTiers();
    },
    renderVouchers() {
        const div = document.getElementById('settings-vouchers-list');
        if(!div) return;
        const vouchers = Store.data.config.vouchers || [];
        if (vouchers.length === 0) {
            div.innerHTML = '<div class="text-gray-400 text-sm">לא הוגדרו תלושים</div>';
            return;
        }
        div.innerHTML = vouchers.map((v, i) => `
            <div class="flex gap-2 items-center bg-white p-2 rounded border border-purple-100 shadow-sm">
                <div class="flex-1 grid grid-cols-3 gap-2">
                    <div><label class="text-[10px] text-gray-500 block">שם החנות</label><input type="text" value="${v.storeName}" onchange="Settings.updateVoucher(${i}, 'storeName', this.value)" class="input-field text-sm w-full py-1"></div>
                    <div><label class="text-[10px] text-gray-500 block">שווי</label><input type="number" value="${v.faceValue}" onchange="Settings.updateVoucher(${i}, 'faceValue', this.value)" class="input-field text-sm w-full py-1"></div>
                    <div><label class="text-[10px] text-gray-500 block">עלות אמיתית</label><input type="number" value="${v.realCost}" onchange="Settings.updateVoucher(${i}, 'realCost', this.value)" class="input-field text-sm w-full py-1"></div>
                </div>
                <button onclick="Settings.removeVoucherType(${i})" class="text-red-400 hover:bg-red-50 p-2 rounded"><i class="fas fa-trash-alt"></i></button>
            </div>
        `).join('');
    },
    addVoucherType() {
        const vouchers = Store.data.config.vouchers || [];
        vouchers.push({ id: 'v' + Date.now(), storeName: '', faceValue: 0, realCost: 0 });
        OfflineManager.write('settings/vouchers', vouchers);
        Store.data.config.vouchers = vouchers;
        this.renderVouchers();
    },
    updateVoucher(i, k, v) {
        const vouchers = [...Store.data.config.vouchers];
        vouchers[i][k] = (k === 'faceValue' || k === 'realCost') ? parseFloat(v) : v;
        OfflineManager.write('settings/vouchers', vouchers);
    },
    removeVoucherType(i) {
        if(!confirm('למחוק סוג תלוש זה?')) return;
        const vouchers = Store.data.config.vouchers || [];
        vouchers.splice(i, 1);
        OfflineManager.write('settings/vouchers', vouchers);
        Store.data.config.vouchers = vouchers;
        this.renderVouchers();
    }
};
window.Settings = Settings;