const Importer = {
    currentType: null,
    fileData: null,
    init(type) {
        if (type === 'students') {
            const html = `
                <div class="space-y-4">
                    <button onclick="Importer.startImport('students_new')" class="w-full bg-blue-50 p-4 rounded-xl border border-blue-200 hover:bg-blue-100 flex items-center gap-4 text-right">
                        <div class="bg-blue-500 text-white w-10 h-10 rounded-full flex items-center justify-center shrink-0"><i class="fas fa-user-plus"></i></div>
                        <div><div class="font-bold text-blue-900">יבוא בחורים חדשים</div><div class="text-xs text-blue-700">הוספת בחורים למאגר המערכת מקובץ אקסל</div></div>
                    </button>
                    <button onclick="Importer.startImport('students_donations')" class="w-full bg-emerald-50 p-4 rounded-xl border border-emerald-200 hover:bg-emerald-100 flex items-center gap-4 text-right">
                        <div class="bg-emerald-500 text-white w-10 h-10 rounded-full flex items-center justify-center shrink-0"><i class="fas fa-hand-holding-usd"></i></div>
                        <div><div class="font-bold text-emerald-900">יבוא תרומות לבחורים</div><div class="text-xs text-emerald-700">קליטת סכומי תרומה שהביאו בחורים (לפי שנים)</div></div>
                    </button>
                </div>
            `;
            Modal.renderRaw('בחר סוג יבוא', html, () => {});
            document.querySelector('#modal-form .btn-primary').parentElement.style.display = 'none';
        } else {
            this.startImport(type);
        }
    },
    startImport(type) {
        this.currentType = type; 
        Modal.close();
        setTimeout(() => {
            const input = document.getElementById('excel-upload-input');
            input.value = '';
            input.click();
        }, 300);
    },
    handleFileSelect(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            this.fileData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
            if (this.fileData.length === 0) { Notify.show('הקובץ ריק', 'error'); return; }
            this.openMappingModal();
        };
        reader.readAsArrayBuffer(file);
    },
    openMappingModal() {
        const excelHeaders = Object.keys(this.fileData[0]);
        let systemFields = [];
        let isDonationImport = false;

        if (this.currentType === 'students_new') {
            systemFields = PREDEFINED_FIELDS.students;
        } else if (this.currentType === 'donors') {
            systemFields = PREDEFINED_FIELDS.donors;
            isDonationImport = true; 
        } else if (this.currentType === 'students_donations') {
            // הוספת שדה מספר מזהה למיפוי
            systemFields = [{k:'firstName', l:'שם פרטי', t:'text'}, {k:'lastName', l:'שם משפחה', t:'text'},{k:'fullName', l:'שם מלא', t:'text'}, {k:'studentNum', l:'מספר מזהה', t:'text'}];
            isDonationImport = true;
        }
        
        const customDefs = Store.data.config.customFieldsDefs || {};
        const allFields = [...systemFields];
        if (this.currentType !== 'students_donations') {
            Object.entries(customDefs).forEach(([k, def]) => {
                 if(!allFields.find(f => f.k === k)) allFields.push({k:k, l:def.l});
            });
        }

        let html = `<div dir="rtl" class="text-right">`;
        html += `<div class="bg-blue-50 p-4 rounded mb-4 text-sm text-blue-800">נמצאו ${this.fileData.length} רשומות. אנא התאם את עמודות האקסל לשדות המערכת:</div>`;
        html += `<div class="grid grid-cols-2 gap-4 font-bold border-b pb-2 mb-2"><div>שדה במערכת</div><div>עמודה באקסל</div></div>`;
        
        allFields.forEach(field => {
            let options = `<option value="">-- אל תייבא --</option>`;
            excelHeaders.forEach(header => {
                const isMatch = header.includes(field.l) || field.l.includes(header);
                options += `<option value="${header}" ${isMatch ? 'selected' : ''}>${header}</option>`;
            });
            html += `<div class="grid grid-cols-2 gap-4 items-center mb-2"><div class="text-sm">${field.l} ${field.r ? '*' : ''}</div><select id="map-${field.k}" class="border rounded p-1 w-full text-sm bg-white">${options}</select></div>`;
        });

        if (isDonationImport) {
            html += `<div class="mt-4 pt-4 border-t border-dashed"><h4 class="font-bold mb-2 text-indigo-700">יבוא תרומות / היסטוריה</h4><p class="text-xs text-gray-500 mb-2">בחר עמודות המכילות סכומים עבור כל שנה.</p><div id="history-map-container">`;
            const years = Object.keys(HEBREW_YEARS_MAPPING);
            years.forEach(hYear => {
                const numYear = HEBREW_YEARS_MAPPING[hYear];
                let options = `<option value="">-- ללא יבוא --</option>`;
                excelHeaders.forEach(header => {
                    const isMatch = header.includes(hYear) || header.includes(hYear.replace(/['"]/g, ''));
                    options += `<option value="${header}" ${isMatch ? 'selected' : ''}>${header}</option>`;
                });
                html += `<div class="grid grid-cols-2 gap-4 items-center mb-1"><div class="text-sm">תרומות ${hYear} (${numYear})</div><select id="map-finance-${numYear}" class="border rounded p-1 w-full text-sm bg-gray-50 history-selector" data-year="${numYear}">${options}</select></div>`;
            });
            html += `</div></div>`;
        }
        html += `</div>`; 

        const customBtn = `<button onclick="Importer.executeImport()" class="w-full bg-green-600 text-white py-3 rounded-xl font-bold mt-4 shadow-lg hover:bg-green-700">בצע יבוא</button>`;
        Modal.renderRaw(`יבוא נתונים מאקסל`, html + customBtn, () => {});
        document.querySelector('#modal-form .btn-primary').parentElement.style.display = 'none';
    },
    executeImport() {
        const mapping = {};
        const historyMapping = {};
        let fieldsToCheck = [];
        if (this.currentType === 'students_new') fieldsToCheck = PREDEFINED_FIELDS.students;
        else if (this.currentType === 'donors') fieldsToCheck = PREDEFINED_FIELDS.donors;
        else fieldsToCheck = [{k:'firstName'},{k:'lastName'},{k:'fullName'}, {k:'studentNum'}];

        if (this.currentType !== 'students_donations') {
             const customDefs = Store.data.config.customFieldsDefs || {};
             Object.keys(customDefs).forEach(k => fieldsToCheck.push({k}));
        }

        fieldsToCheck.forEach(f => {
            const el = document.getElementById(`map-${f.k}`);
            if(el && el.value) mapping[f.k] = el.value;
        });

        document.querySelectorAll('.history-selector').forEach(el => {
            if (el.value) historyMapping[el.dataset.year] = el.value;
        });

        if (this.currentType === 'students_donations' && !mapping.fullName && (!mapping.firstName || !mapping.lastName) && !mapping.studentNum) {
            Notify.show('חובה למפות מספר מזהה, שם מלא, או שם פרטי+משפחה לזיהוי הבחור', 'error');
            return;
        }

        Notify.show('מעבד נתונים...', 'info');
        const dbPath = (this.currentType === 'donors') ? 'global/donors' : 'global/students';
        const revYearMap = {};
        Object.keys(HEBREW_YEARS_MAPPING).forEach(k => revYearMap[HEBREW_YEARS_MAPPING[k]] = k);

        db.ref(dbPath).once('value', snapshot => {
            const existingData = snapshot.val() || {};
            const nameMap = {};
            const numMap = {}; // מפה לזיהוי לפי מספר מזהה

            Object.values(existingData).forEach(item => {
                if (item.name) nameMap[item.name.trim()] = item.id;
                if (item.name) {
                    const reversedName = item.name.split(' ').reverse().join(' ');
                    nameMap[reversedName] = item.id;
                }
                if (item.studentNum) numMap[item.studentNum.toString().trim()] = item.id;
            });

            let countNew = 0;
            let countFinance = 0;
            const updates = {};
            const financeUpdates = {};

            this.fileData.forEach(row => {
                const tempObj = {};
                Object.keys(mapping).forEach(sysKey => {
                    tempObj[sysKey] = row[mapping[sysKey]];
                });
                
                let fullName = tempObj.fullName;
                if (!fullName && (tempObj.firstName || tempObj.lastName)) {
                    fullName = `${tempObj.firstName || ''} ${tempObj.lastName || ''}`.trim();
                }
                
                let entityId = null;

                // ניסיון זיהוי לפי מספר מזהה תחילה
                if (tempObj.studentNum && numMap[tempObj.studentNum.toString().trim()]) {
                    entityId = numMap[tempObj.studentNum.toString().trim()];
                }
                // ניסיון זיהוי לפי שם
                if (!entityId && fullName && nameMap[fullName]) {
                    entityId = nameMap[fullName];
                }

                if (this.currentType !== 'students_donations') {
                    if (!entityId) {
                        entityId = db.ref(dbPath).push().key;
                        const newObj = { id: entityId, ...tempObj, name: fullName || 'לא ידוע' };
                        if (this.currentType === 'students_new') newObj.lastUpdatedYear = Store.currentYear;
                        else newObj.joinYear = Store.currentYear; 
                        updates[`${dbPath}/${entityId}`] = newObj;
                        
                        if(fullName) nameMap[fullName] = entityId; 
                        if(tempObj.studentNum) numMap[tempObj.studentNum.toString().trim()] = entityId;
                        
                        countNew++;
                    }
                } else {
                    if (!entityId) return; // דלג אם לא נמצא בחור קיים
                }

                if (entityId) {
                    Object.entries(historyMapping).forEach(([year, colHeader]) => {
                        let val = row[colHeader];
                        if (!val) return;
                        const txId = 'imp' + Date.now() + Math.random().toString(36).substr(2, 5);
                        const hebrewYear = revYearMap[year] || year;
                        const tx = {
                            id: txId,
                            date: new Date(parseInt(year) - 3760, 2, 14).getTime(),
                            type: 'income',
                            category: 'יבוא אקסל',
                            desc: 'היסטוריה/יבוא',
                            amount: val,
                            isPurim: true
                        };
                        if (this.currentType === 'donors') tx.donorId = entityId;
                        else tx.studentId = entityId;
                        financeUpdates[`years/${hebrewYear}/finance/${txId}`] = tx;
                        countFinance++;
                    });
                }
            });

            const promises = [];
            if (Object.keys(updates).length > 0) promises.push(db.ref().update(updates));
            if (Object.keys(financeUpdates).length > 0) promises.push(db.ref().update(financeUpdates));

            Promise.all(promises).then(() => {
                Modal.close();
                document.querySelector('#modal-form .btn-primary').parentElement.style.display = 'flex';
                let msg = 'הפעולה הסתיימה. ';
                if (countNew > 0) msg += `נוספו ${countNew} רשומות חדשות. `;
                if (countFinance > 0) msg += `נקלטו ${countFinance} תרומות.`;
                if (countNew === 0 && countFinance === 0) msg = 'לא בוצעו שינויים.';
                Notify.show(msg, countFinance > 0 ? 'success' : 'info');
                if (this.currentType.includes('students')) Students.loadMore(true);
                else Donors.loadMore(true);
                if (countFinance > 0) Finance.loadMore(true);
            }).catch(err => {
                console.error(err);
                Notify.show('שגיאה בשמירת הנתונים', 'error');
            });
        });
    }
};
window.Importer = Importer;
