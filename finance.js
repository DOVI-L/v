const Finance = {
    currentFilter: 'all',
    limit: 30,
    financeData: {},
    
    reset() { 
        this.financeData = {}; 
        Store.cursors.finance = null; 
        document.getElementById('finance-tbody').innerHTML = '';
        this.loadMore(); 
    },
    
    loadMore(reset = false) {
        if(reset) this.reset();
        let q = db.ref(`years/${Store.currentYear}/finance`).orderByChild('date').limitToLast(this.limit);
        if(Store.cursors.finance) q = q.endBefore(Store.cursors.finance);
        q.once('value', snap => {
            const data = snap.val();
            if(!data) {
                document.getElementById('finance-loader-more').style.display = 'none';
                return;
            }
            const arr = [];
            Object.keys(data).forEach(k => arr.push(data[k]));
            arr.sort((a,b) => b.date - a.date); 
            Store.cursors.finance = arr[arr.length-1].date;
            document.getElementById('finance-loader-more').style.display = 'block';
            Object.assign(this.financeData, data);
            this.render();
        });
    },
    
    render() {
        const tbody = document.getElementById('finance-tbody');
        tbody.innerHTML = ''; 
        let raw = Object.values(this.financeData);
        if(this.currentFilter !== 'all') {
            if(this.currentFilter === 'purim') raw = raw.filter(tx => tx.isPurim);
            else raw = raw.filter(tx => tx.type === this.currentFilter);
        }
        
        raw.sort((a,b) => b.date - a.date);
        tbody.innerHTML = raw.map(tx => {
            let entityName = '-';
            if (tx.studentId) {
                 const s = Store.data.students[tx.studentId];
                 entityName = s ? (s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name) : 'לא ידוע';
            } else if (tx.donorId) {
                 entityName = Store.data.donors[tx.donorId]?.name || 'לא ידוע';
            } else if (tx.isGroup) {
                entityName = `קבוצה: ${tx.groupName || tx.groupId}`;
            }

            const isNote = isNaN(parseFloat(tx.amount));
            const displayAmount = isNote ? `<span class="text-xs text-gray-500">${tx.amount}</span>` : `₪${parseInt(tx.amount).toLocaleString()}`;
            const rowClass = isNote ? 'bg-gray-50 italic' : 'hover:bg-slate-50';
            const displayDate = System.toHebrewDate(tx.date);

            return `
            <tr class="${rowClass} border-b border-slate-50 transition">
                <td class="p-3 text-gray-500 text-xs">${displayDate}</td>
                <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${tx.type==='income'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${tx.type==='income'?'הכנסה':'הוצאה'}</span></td>
                <td class="p-3 font-medium text-slate-700">${tx.category}</td>
                <td class="p-3">
                    <div class="text-sm">${tx.desc || ''}</div>
                    ${entityName !== '-' ? `<div class="text-xs text-gray-400"><i class="fas fa-user-tag"></i> ${entityName}</div>` : ''}
                    ${tx.addedBy ? `<div class="text-[10px] text-gray-400">נוסף ע״י: ${tx.addedBy}</div>` : ''}
                </td>
                <td class="p-3 font-bold ${tx.type==='income'?'text-emerald-600':'text-rose-600'}" dir="ltr">${displayAmount}</td>
                <td class="p-3 flex gap-2 justify-center">
                    <button onclick="Finance.editTx('${tx.id}')" class="text-gray-300 hover:text-indigo-500 transition"><i class="fas fa-pen"></i></button>
                    <button onclick="Finance.deleteTx('${tx.id}', '${tx.type}', '${tx.amount}')" class="text-gray-300 hover:text-red-500 transition"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>`;
        }).join('');
    },
    
    setFilter(f) {
        this.currentFilter = f;
        document.querySelectorAll('.finance-filter').forEach(b => {
            const active = b.dataset.f === f;
            b.classList.toggle('active', active);
            b.classList.toggle('bg-slate-800', active);
            b.classList.toggle('text-white', active);
            b.classList.toggle('shadow-md', active);
        });
        this.render();
    },
    
    openVouchersView() {
        document.getElementById('finance-main-view').classList.add('hidden');
        document.getElementById('finance-store-debts-view').classList.add('hidden');
        document.getElementById('finance-vouchers-view').classList.remove('hidden');
        this.renderPendingVouchers();
    },
    
    closeVouchersView() {
        document.getElementById('finance-main-view').classList.remove('hidden');
        document.getElementById('finance-vouchers-view').classList.add('hidden');
        this.loadMore(true);
    },
    
    openStoreDebtsView() {
        document.getElementById('finance-main-view').classList.add('hidden');
        document.getElementById('finance-vouchers-view').classList.add('hidden');
        document.getElementById('finance-store-debts-view').classList.remove('hidden');
        this.renderStoreDebts();
    },
    
    closeStoreDebtsView() {
        document.getElementById('finance-main-view').classList.remove('hidden');
        document.getElementById('finance-store-debts-view').classList.add('hidden');
        this.loadMore(true);
    },

    renderPendingVouchers() {
        const list = document.getElementById('pending-vouchers-list');
        list.innerHTML = '<div class="text-center text-gray-400">טוען תלושים...</div>';
        
        db.ref(`years/${Store.currentYear}/vouchersPending`).once('value', s => {
            const data = s.val();
            if(!data) {
                list.innerHTML = '<div class="text-center text-gray-400 p-4">אין תלושים הממתינים למימוש</div>';
                return;
            }
            list.innerHTML = '';
            Object.values(data).forEach(v => {
                const student = Store.data.students[v.studentId];
                const sName = student ? (student.firstName ? `${student.firstName} ${student.lastName}` : student.name) : 'לא ידוע';
                list.innerHTML += `
                    <div class="bg-white p-4 border rounded shadow-sm flex justify-between items-center">
                        <div>
                            <div class="font-bold text-gray-800">${v.voucherName} (שווי: ₪${v.faceValue})</div>
                            <div class="text-sm text-gray-500">עבור: <span class="font-bold text-indigo-600">${sName}</span> | חנות: ${v.storeName || 'לא צוין'}</div>
                            <div class="text-xs text-gray-400">עלות למערכת: ₪${v.realCost}</div>
                        </div>
                        <button onclick="Finance.realizeVoucher('${v.id}')" class="bg-purple-600 text-white px-4 py-2 rounded font-bold text-sm shadow hover:bg-purple-700">
                            העבר למומש (רשום הוצאה)
                        </button>
                    </div>
                `;
            });
        });
    },

    realizeVoucher(vid) {
        if(!confirm('האם לרשום תלוש זה כמומש? הפעולה תיצור הוצאה בקופה לפי העלות האמיתית.')) return;
        
        db.ref(`years/${Store.currentYear}/vouchersPending/${vid}`).once('value', s => {
            const v = s.val();
            if(!v) return;
            
            const expenseId = 'exp' + Date.now();
            const expenseTx = {
                id: expenseId,
                date: Date.now(),
                type: 'expense',
                amount: parseFloat(v.realCost),
                category: 'תלושים/מתנות',
                desc: `מימוש תלוש: ${v.voucherName} (שווי ${v.faceValue})`,
                studentId: v.studentId,
                isPurim: true,
                storeName: v.storeName || 'כללי',
                isPaidToStore: false
            };
            
            OfflineManager.write(`years/${Store.currentYear}/finance/${expenseId}`, expenseTx);
            if(OfflineManager.isOnline) {
                 db.ref(`years/${Store.currentYear}/stats/expense`).transaction(c => (c||0) + expenseTx.amount);
            }
            
            OfflineManager.write(`years/${Store.currentYear}/vouchersPending/${vid}`, null, 'remove');
            Notify.show('התלוש מומש ונרשמה הוצאה', 'success');
            setTimeout(() => this.renderPendingVouchers(), 500);
        });
    },
    
    renderStoreDebts() {
        const container = document.getElementById('store-debts-container');
        container.innerHTML = '<div class="text-center text-gray-400">מחשב נתונים...</div>';
        
        db.ref(`years/${Store.currentYear}/finance`).once('value', s => {
            const allTx = Object.values(s.val() || {});
            const storeMap = {};
            
            allTx.forEach(tx => {
                if (tx.type === 'expense' && tx.category === 'תלושים/מתנות' && tx.storeName) {
                    if (!storeMap[tx.storeName]) storeMap[tx.storeName] = { total: 0, paid: 0, debts: 0, items: [] };
                    
                    const amt = parseFloat(tx.amount) || 0;
                    storeMap[tx.storeName].total += amt;
                    if (tx.isPaidToStore) {
                        storeMap[tx.storeName].paid += amt;
                    } else {
                        storeMap[tx.storeName].debts += amt;
                    }
                    storeMap[tx.storeName].items.push(tx);
                }
            });
            
            if (Object.keys(storeMap).length === 0) {
                container.innerHTML = '<div class="text-center text-gray-400">אין נתוני חובות לחנויות. (ודא שתלושים מומשו עם שיוך לחנות)</div>';
                return;
            }
            
            container.innerHTML = '';
            Object.entries(storeMap).forEach(([store, data]) => {
                 const debtClass = data.debts > 0 ? 'text-red-600' : 'text-green-600';
                 let itemsHtml = '';
                 data.items.forEach(item => {
                     const btnLabel = item.isPaidToStore ? 'סמן כלא שולם' : 'סמן כשולם';
                     const btnClass = item.isPaidToStore ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700 font-bold';
                     const sName = Store.data.students[item.studentId] ? Store.data.students[item.studentId].name : '';
                     
                     itemsHtml += `
                        <div class="flex justify-between items-center border-b p-2 text-sm ${item.isPaidToStore ? 'bg-gray-50 opacity-75' : ''}">
                            <div>
                                <div class="font-medium">${item.desc}</div>
                                <div class="text-xs text-gray-500">${sName ? 'עבור: '+sName : ''} | ${System.toHebrewDate(item.date)}</div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="font-bold">₪${item.amount}</span>
                                <button onclick="Finance.toggleStorePayment('${item.id}', ${!item.isPaidToStore})" class="text-xs px-2 py-1 rounded border ${btnClass}">
                                    ${btnLabel}
                                </button>
                            </div>
                        </div>
                     `;
                 });

                 container.innerHTML += `
                    <div class="bg-white border rounded-xl overflow-hidden mb-4 shadow-sm">
                        <div class="p-4 bg-gray-50 border-b flex justify-between items-center cursor-pointer" onclick="this.nextElementSibling.classList.toggle('hidden')">
                            <h4 class="font-bold text-lg">${store}</h4>
                            <div class="text-right">
                                <div class="text-xs text-gray-500">סך הכל: ₪${data.total.toLocaleString()}</div>
                                <div class="font-bold ${debtClass}">חוב לתשלום: ₪${data.debts.toLocaleString()}</div>
                            </div>
                            <i class="fas fa-chevron-down text-gray-400 ml-2"></i>
                        </div>
                        <div class="hidden bg-white p-2 max-h-60 overflow-y-auto custom-scroll">
                            ${itemsHtml}
                        </div>
                    </div>
                 `;
            });
        });
    },

    toggleStorePayment(id, status) {
        OfflineManager.write(`years/${Store.currentYear}/finance/${id}/isPaidToStore`, status);
        setTimeout(() => this.renderStoreDebts(), 200);
    },

    renderBatchTransactionForm() {
        // ... (המשך קוד קיים ללא שינוי בפונקציה זו, המודל החדש ישתמש בפונקציה הרגילה) ...
        const today = new Date().toISOString().split('T')[0];
        const studentsList = Object.values(Store.data.students).map(s => {
            const n = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
            return `<option value="${n} (בחור)">${s.id}</option>`;
        }).join('');
        const donorsList = Object.values(Store.data.donors).map(d => `<option value="${d.name} (תורם)">${d.id}</option>`).join('');

        const html = `
            <div class="overflow-x-auto">
                <datalist id="entity-list">
                    ${studentsList}
                    ${donorsList}
                </datalist>
                <table class="w-full text-right batch-table" id="batch-tx-table">
                    <thead>
                        <tr>
                            <th width="80">סוג</th>
                            <th width="120">תאריך</th>
                            <th width="150">שם (חפש והקלד)</th>
                            <th width="100">סכום / תלוש</th>
                            <th width="120">קטגוריה</th>
                            <th>פרטים / הערות</th>
                            <th width="50" class="text-center">פורים</th>
                            <th width="40"></th>
                        </tr>
                    </thead>
                    <tbody id="batch-tbody"></tbody>
                </table>
                <button onclick="Finance.addBatchRow()" class="mt-4 text-indigo-600 font-bold text-sm hover:underline">+ הוסף שורה</button>
            </div>
        `;

        // שינוי כאן: שימוש ברוחב מקסימלי למודל
        Modal.renderRaw('הוספת תנועות מרוכזת', html, () => Finance.submitBatch(), 'max-w-7xl w-full');
        for(let i=0; i<5; i++) Finance.addBatchRow();
    },

    addBatchRow() {
        const tbody = document.getElementById('batch-tbody');
        const rowId = 'row-' + Date.now() + Math.random().toString(36).substr(2, 5);
        const tr = document.createElement('tr');
        tr.id = rowId;
        const today = new Date().toISOString().split('T')[0];
        
        const vouchers = Store.data.config.vouchers || [];
        let voucherOpts = '<option value="">-- בחר תלוש --</option>';
        vouchers.forEach(v => {
            voucherOpts += `<option value="${v.id}" data-cost="${v.realCost}" data-face="${v.faceValue}" data-name="${v.voucherName}">${v.voucherName} (${v.storeName})</option>`;
        });

        tr.innerHTML = `
            <td>
                <select class="batch-input" name="type" onchange="Finance.toggleRowType(this)">
                    <option value="income">הכנסה</option>
                    <option value="expense">הוצאה</option>
                    <option value="voucher">תלוש לבחור</option>
                </select>
            </td>
            <td><input type="date" class="batch-input" name="date" value="${today}"></td>
            <td>
                <input type="text" list="entity-list" class="batch-input" name="entityName" placeholder="הקלד שם..." onchange="Finance.resolveEntity(this)">
                <input type="hidden" name="entityId">
                <input type="hidden" name="entityType">
            </td>
            <td>
                <input type="number" class="batch-input field-amount" name="amount" placeholder="0">
                <select class="batch-input field-voucher hidden" name="voucherId" onchange="Finance.fillVoucherDetails(this)">${voucherOpts}</select>
            </td>
            <td>
                <select class="batch-input field-cat" name="category">
                    <option>תרומה כללית</option><option>מזומן</option><option>צק</option><option>אשראי</option>
                </select>
            </td>
            <td><input type="text" class="batch-input" name="desc"></td>
            <td class="text-center"><input type="checkbox" name="isPurim" checked class="h-4 w-4"></td>
            <td class="text-center"><button onclick="document.getElementById('${rowId}').remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button></td>
        `;
        tbody.appendChild(tr);
    },

    toggleRowType(select) {
        const tr = select.closest('tr');
        const type = select.value;
        const catSelect = tr.querySelector('.field-cat');
        const amtInput = tr.querySelector('.field-amount');
        const voucherSelect = tr.querySelector('.field-voucher');
        
        if (type === 'voucher') {
            amtInput.classList.add('hidden');
            voucherSelect.classList.remove('hidden');
            catSelect.innerHTML = `<option>תלושים/מתנות</option>`;
            catSelect.disabled = true;
        } else {
            amtInput.classList.remove('hidden');
            voucherSelect.classList.add('hidden');
            catSelect.disabled = false;
            if (type === 'income') {
                catSelect.innerHTML = `<option>תרומה כללית</option><option>מזומן</option><option>צק</option><option>אשראי</option>`;
            } else {
                catSelect.innerHTML = `<option>אוכל</option><option>ציוד</option><option>שיווק</option><option>אחר</option><option>תלושים/מתנות</option>`;
            }
        }
    },

    resolveEntity(input) {
        const val = input.value;
        const tr = input.closest('tr');
        const hiddenId = tr.querySelector('input[name="entityId"]');
        const hiddenType = tr.querySelector('input[name="entityType"]');
        
        const cleanName = val.replace(' (בחור)', '').replace(' (תורם)', '');
        let foundId = null; 
        let foundType = null;

        const s = Object.values(Store.data.students).find(s => {
            const n = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
            return n === cleanName;
        });
        if (s) { foundId = s.id; foundType = 'student'; }
        
        if (!foundId) {
            const d = Object.values(Store.data.donors).find(d => d.name === cleanName);
            if (d) { foundId = d.id; foundType = 'donor'; }
        }

        if (foundId) {
            hiddenId.value = foundId;
            hiddenType.value = foundType;
            input.classList.add('border-green-500', 'bg-green-50');
        } else {
            hiddenId.value = '';
            hiddenType.value = '';
            input.classList.remove('border-green-500', 'bg-green-50');
        }
    },

    fillVoucherDetails(select) {},

    submitBatch() {
        const rows = document.querySelectorAll('#batch-tbody tr');
        let count = 0;
        
        rows.forEach(tr => {
            const type = tr.querySelector('select[name="type"]').value;
            const dateVal = tr.querySelector('input[name="date"]').value;
            const entityId = tr.querySelector('input[name="entityId"]').value;
            const entityType = tr.querySelector('input[name="entityType"]').value;
            const entityNameRaw = tr.querySelector('input[name="entityName"]').value;
            const category = tr.querySelector('select[name="category"]').value;
            const desc = tr.querySelector('input[name="desc"]').value;
            const isPurim = tr.querySelector('input[name="isPurim"]').checked;
            
            const timestamp = dateVal ? new Date(dateVal + 'T12:00:00').getTime() : Date.now();
            const txId = 'tx' + Date.now() + Math.random().toString(36).substr(2,5);

            if (type === 'voucher') {
                const voucherSelect = tr.querySelector('select[name="voucherId"]');
                const vOption = voucherSelect.options[voucherSelect.selectedIndex];
                if (!vOption.value || !entityId || entityType !== 'student') return;
                
                const vData = {
                    id: 'vp' + Date.now() + Math.random().toString(36).substr(2,5),
                    studentId: entityId,
                    voucherId: vOption.value,
                    voucherName: vOption.dataset.name,
                    realCost: parseFloat(vOption.dataset.cost),
                    faceValue: parseFloat(vOption.dataset.face),
                    storeName: vOption.text.match(/\((.*?)\)/)?.[1] || 'כללי',
                    dateIssued: timestamp
                };
                OfflineManager.write(`years/${Store.currentYear}/vouchersPending/${vData.id}`, vData);
                count++;
                
            } else {
                const amount = parseFloat(tr.querySelector('input[name="amount"]').value);
                if (!amount) return;

                const txData = {
                    id: txId,
                    date: timestamp,
                    type: type,
                    amount: amount,
                    category: category,
                    desc: (entityId ? '' : `שם: ${entityNameRaw}. `) + desc,
                    isPurim: isPurim
                };
                
                if (entityId) {
                    if (entityType === 'student') txData.studentId = entityId;
                    if (entityType === 'donor') txData.donorId = entityId;
                }

                OfflineManager.write(`years/${Store.currentYear}/finance/${txId}`, txData);
                
                if(OfflineManager.isOnline) {
                     db.ref(`years/${Store.currentYear}/stats/${type}`).transaction(curr => (curr || 0) + amount);
                }
                
                if(type === 'income' && txData.studentId) {
                    System.checkStudentProgress(txData.studentId, amount);
                }
                count++;
            }
        });
        
        if (count > 0) {
            Notify.show(`${count} שורות נקלטו בהצלחה`, 'success');
            Modal.close();
        } else {
            alert('לא נקלטו נתונים (ודא שמילאת סכומים ושמות תקינים)');
        }
    },

    editTx(id) {
        const tx = this.financeData[id];
        if(!tx) return;
        this.openTransactionModal(tx.type, tx); 
    },
    
    // שינוי עיקרי כאן: עיצוב מחדש של המודל לרוחב מלא וגדול
    openTransactionModal(type, existingData = null) {
        const cats = type==='income' ? ['תרומה כללית','מזומן','צק','אשראי'] : ['אוכל','ציוד','שיווק','אחר','תלושים/מתנות'];
        const studentsOpts = Object.values(Store.data.students).filter(s => s).map(s => {
            const n = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
            return `<option value="${s.id}">${n}</option>`;
        }).join('');
        const donorsOpts = Object.values(Store.data.donors).filter(d => d).map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        
        let defaultDate = new Date().toISOString().split('T')[0];
        if (existingData && existingData.date) {
            defaultDate = new Date(existingData.date).toISOString().split('T')[0];
        }

        const html = `
            <div class="space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                         <label class="lbl">תאריך</label>
                         <input type="date" id="tx-date" value="${defaultDate}" class="input-field w-full" onchange="document.getElementById('hebrew-date-display').innerText = System.toHebrewDate(this.value)">
                         <div id="hebrew-date-display" class="text-xs text-indigo-600 mt-1 font-bold">${System.toHebrewDate(defaultDate)}</div>
                    </div>
                    <div>
                        <label class="lbl">קטגוריה</label>
                        <select id="tx-category" class="input-field w-full">
                            ${cats.map(c => `<option ${existingData?.category===c?'selected':''}>${c}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="amount-input-container" class="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label class="lbl text-lg text-slate-700">סכום (בש"ח)</label>
                    <input type="text" id="tx-amount" class="input-field w-full text-3xl font-bold text-center tracking-wider text-slate-800" value="${existingData?.amount || ''}" placeholder="0" required>
                </div>

                <div class="bg-slate-50 p-4 rounded-xl border">
                    <label class="lbl">שיוך ${type==='income'?'הכנסה':'הוצאה'}</label>
                    <div class="flex gap-4 mb-3">
                        <label class="cursor-pointer flex items-center gap-2 bg-white px-3 py-1 rounded border hover:bg-gray-50"><input type="radio" name="tx-src" value="none" ${(!existingData?.studentId && !existingData?.donorId)?'checked':''} onclick="document.getElementById('src-select-area').classList.add('hidden')"> כללי</label>
                        <label class="cursor-pointer flex items-center gap-2 bg-white px-3 py-1 rounded border hover:bg-gray-50"><input type="radio" name="tx-src" value="student" ${existingData?.studentId?'checked':''} onclick="document.getElementById('src-select-area').classList.remove('hidden'); document.getElementById('sel-student').classList.remove('hidden'); document.getElementById('sel-donor').classList.add('hidden')"> בחור</label>
                        <label class="cursor-pointer flex items-center gap-2 bg-white px-3 py-1 rounded border hover:bg-gray-50"><input type="radio" name="tx-src" value="donor" ${existingData?.donorId?'checked':''} onclick="document.getElementById('src-select-area').classList.remove('hidden'); document.getElementById('sel-student').classList.add('hidden'); document.getElementById('sel-donor').classList.remove('hidden')"> תורם</label>
                    </div>
                    <div id="src-select-area" class="${(existingData?.studentId || existingData?.donorId)?'':'hidden'}">
                        <select id="sel-student" class="input-field w-full ${existingData?.studentId?'':'hidden'}"><option value="">-- בחר בחור --</option>${studentsOpts}</select>
                        <select id="sel-donor" class="input-field w-full ${existingData?.donorId?'':'hidden'}"><option value="">-- בחר תורם --</option>${donorsOpts}</select>
                    </div>
                </div>

                <div>
                    <label class="lbl">תיאור / הערות</label>
                    <textarea id="tx-desc" class="input-field w-full h-24" placeholder="פירוט נוסף...">${existingData?.desc || ''}</textarea>
                </div>

                <div class="flex items-center gap-2 bg-purple-50 p-3 rounded border border-purple-100">
                    <input type="checkbox" id="tx-purim" class="h-5 w-5 rounded text-indigo-600" ${(!existingData || existingData.isPurim)?'checked':''}>
                    <span class="text-sm font-bold text-purple-900">שייך לתקציב פורים?</span>
                </div>
            </div>
        `;
        
        // שימוש במודל רחב יותר (max-w-2xl)
        Modal.renderRaw(existingData ? 'עריכת תנועה' : (type === 'income' ? 'הוספת הכנסה' : 'הוספת הוצאה'), html, () => {
            const srcType = document.querySelector('input[name="tx-src"]:checked').value;
            let studentId = null, donorId = null;
            if(srcType === 'student') studentId = document.getElementById('sel-student').value;
            if(srcType === 'donor') donorId = document.getElementById('sel-donor').value;
            
            let amount = document.getElementById('tx-amount').value;
            if(!amount) return alert('חובה להזין סכום או ערך');
            
            let isNote = false;
            if (!isNaN(parseFloat(amount))) amount = parseFloat(amount);
            else isNote = true;
            
            const dVal = document.getElementById('tx-date').value;
            const timestamp = dVal ? new Date(dVal + 'T12:00:00').getTime() : Date.now();

            const id = existingData ? existingData.id : ('tx' + Date.now());
            const newData = {
                id, date: timestamp, type,
                amount: amount,
                category: document.getElementById('tx-category').value,
                desc: document.getElementById('tx-desc').value,
                isPurim: document.getElementById('tx-purim').checked,
                studentId, donorId
            };
            
            OfflineManager.write(`years/${Store.currentYear}/finance/${id}`, newData, existingData ? 'update' : 'set');
            
            if(OfflineManager.isOnline && !isNote && !existingData) {
                db.ref(`years/${Store.currentYear}/stats/${type}`).transaction(curr => (curr || 0) + amount);
            }
            
            Notify.show('נשמר בהצלחה', 'success');
            Modal.close();
        }, 'max-w-3xl w-full'); // Passing explicit width
        
        if(existingData?.studentId) document.getElementById('sel-student').value = existingData.studentId;
        if(existingData?.donorId) document.getElementById('sel-donor').value = existingData.donorId;
    },

    deleteTx(id, type, amountVal) {
        if(confirm('למחוק תנועה זו?')) {
            OfflineManager.write(`years/${Store.currentYear}/finance/${id}`, null, 'remove');
            const amount = parseFloat(amountVal);
            if(OfflineManager.isOnline && !isNaN(amount)) {
                db.ref(`years/${Store.currentYear}/stats/${type}`).transaction(curr => (curr || 0) - amount);
            }
            Notify.show('תנועה נמחקה', 'info');
        }
    }
};
window.Finance = Finance;