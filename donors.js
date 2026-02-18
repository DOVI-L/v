const Donors = {
    limit: 40,
    viewMode: 'list', 
    viewTab: 'all',
    kanbanDay: 'night14', 
    // שינוי: loadMore מחזיר Promise
    loadMore(reset = false) {
        return new Promise((resolve) => {
            if(reset) { Store.cursors.donors = null; Store.loadedAll.donors = false; }
            const loader = document.getElementById('donors-loader-more');
            if(loader) {
                 loader.style.display = 'block';
                 const btn = loader.querySelector('button');
                 if(btn) btn.innerText = 'טוען...';
            }
            let query = db.ref('global/donors').orderByKey().limitToLast(this.limit);
            if(Store.cursors.donors) query = query.endBefore(Store.cursors.donors);
            query.once('value', snap => {
                const data = snap.val();
                if(!data) {
                    Store.loadedAll.donors = true;
                    if(loader) loader.style.display = 'none';
                    resolve();
                    return;
                }
                const keys = Object.keys(data).sort();
                Store.cursors.donors = keys[0];
                Object.assign(Store.data.donors, data);
                OfflineManager.saveState('donors', Store.data.donors);
                this.render();
                if (keys.length < this.limit) {
                    Store.loadedAll.donors = true;
                    if(loader) loader.style.display = 'none';
                } else {
                    if(loader) loader.innerHTML = `
                        <button onclick="Donors.loadMore()" class="bg-slate-200 text-slate-600 px-6 py-2 rounded-full font-bold text-sm">טען עוד...</button>
                    `;
                }
                resolve();
            });
        });
    },
    syncNewest() {
        db.ref('global/donors').orderByKey().limitToLast(10).once('value', snap => {
            const data = snap.val();
            if(data) {
                Object.assign(Store.data.donors, data);
                OfflineManager.saveState('donors', Store.data.donors);
                if(Router.current === 'donors') this.render();
            }
        });
    },
    render(searchTerm = null) {
        if(this.viewMode === 'list') {
            document.getElementById('donors-list-view').style.display = 'block';
            document.getElementById('donors-quick-manager').style.display = 'none';
            document.getElementById('donors-quick-manager').classList.add('hidden');
            this.renderList(searchTerm);
        } else {
            document.getElementById('donors-list-view').style.display = 'none';
            document.getElementById('donors-quick-manager').style.display = 'flex';
            document.getElementById('donors-quick-manager').classList.remove('hidden');
            this.renderManager();
        }
    },
    toggleQuickManager() {
        this.viewMode = this.viewMode === 'list' ? 'manager' : 'list';
        this.render();
    },
    setViewTab(tab) {
        this.viewTab = tab;
        document.querySelectorAll('.donor-view-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        
        const subFilter = document.getElementById('donors-groups-filter');
        const subSelect = document.getElementById('donor-group-select');
        subSelect.innerHTML = '<option value="">הכל</option>';
        
        if (tab !== 'all' && tab !== 'unassigned') {
            subFilter.classList.remove('hidden');
            subFilter.classList.add('flex');
            const groupsInDay = Store.data.yearData[Store.currentYear]?.groups[tab] || {};
            Object.entries(groupsInDay).forEach(([gid, g]) => {
                subSelect.innerHTML += `<option value="${gid}">${g.name}</option>`;
            });
        } else {
            subFilter.classList.add('hidden');
            subFilter.classList.remove('flex');
        }
        
        this.renderList();
    },
    renderList(searchTerm) {
        const term = searchTerm || (document.getElementById('donor-search-input') ? document.getElementById('donor-search-input').value.trim() : '');
        const tbody = document.getElementById('donors-tbody');
        if(!tbody) return;
        const selectedGroupId = document.getElementById('donor-group-select').value;
        
        tbody.innerHTML = '';
        let list = Object.values(Store.data.donors).filter(d => d).sort((a,b) => (a.name||'').localeCompare(b.name||''));
        
        if(this.viewTab === 'unassigned') {
            const assignedDonors = new Set(Object.keys(Store.data.donorGroupMap));
            list = list.filter(d => !assignedDonors.has(d.id));
        } else if (this.viewTab !== 'all') {
            const groupsInDay = Store.data.yearData[Store.currentYear]?.groups[this.viewTab] || {};
            if (selectedGroupId) {
                const g = groupsInDay[selectedGroupId];
                const donorsInGroup = new Set(g.route || []);
                list = list.filter(d => donorsInGroup.has(d.id));
            } else {
                const donorsInDay = new Set();
                Object.values(groupsInDay).forEach(g => (g.route || []).forEach(id => {
                     if(!id.startsWith('NOTE:')) donorsInDay.add(id);
                }));
                list = list.filter(d => donorsInDay.has(d.id));
            }
        }

        if(term) {
            list = list.filter(d => (d.name || '').includes(term) || (d.address||'').includes(term) || (d.city||'').includes(term));
        }
        
        const displayList = list.slice(0, 50);
        
        if(displayList.length === 0) {
             tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-400">לא נמצאו תורמים</td></tr>';
        }

        displayList.forEach(d => {
            const groupName = Store.data.donorGroupMap[d.id];
            const tr = document.createElement('tr');
            tr.className = "hover:bg-slate-50 border-b border-slate-50 transition cursor-pointer group";
            tr.innerHTML = `
                <td class="p-3 text-right font-medium text-slate-800">
                     ${d.name} ${d.vip ? '<span class="mr-2 text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">VIP</span>' : ''}
                </td>
                <td class="p-3 text-right text-gray-500 text-sm">
                     ${d.city || ''} ${d.street || d.address || ''} ${d.floor ? '(קומה '+d.floor+')' : ''}
                </td>
                <td class="p-3 text-right text-gray-500 text-sm">${d.phone || ''}</td>
                <td class="p-3 text-right text-sm">
                    ${groupName ? `<span class="bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-100">${groupName}</span>` : '-'}
                </td>
                <td class="p-3 text-center flex items-center justify-center gap-2">
                    <button onclick="Donors.openBatchDonation('${d.id}', '${d.name}')" class="bg-green-100 text-green-600 hover:bg-green-200 hover:text-green-800 transition p-2 rounded-full font-bold" title="הוסף תרומות ברצף"><i class="fas fa-plus"></i></button>
                    <button onclick="Donors.openEdit('${d.id}')" class="text-indigo-400 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-full transition"><i class="fas fa-pen"></i></button>
                    <button onclick="Donors.delete('${d.id}')" class="text-red-300 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition" title="מחק תורם"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },
    openBatchDonation(id, name) {
        const html = `
            <div class="space-y-4">
                <div class="bg-green-50 p-3 rounded-lg border border-green-200 flex justify-between items-center">
                    <div>
                        <div class="font-bold text-green-900">הוספת תרומות עבור: ${name}</div>
                        <div class="text-xs text-green-700">כל שורה מייצגת תרומה נפרדת</div>
                    </div>
                </div>
                
                <table class="w-full text-right" id="batch-add-table">
                    <thead>
                        <tr class="text-xs text-gray-500 border-b">
                            <th class="p-2">סכום</th>
                            <th class="p-2">אמצעי תשלום / מקור</th>
                            <th class="p-2">הערות</th>
                            <th class="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody id="batch-add-tbody">
                        ${this.getBatchRowHtml()}
                        ${this.getBatchRowHtml()}
                    </tbody>
                </table>
                
                <button onclick="Donors.addBatchRow()" class="text-indigo-600 text-sm font-bold hover:underline">+ הוסף שורה</button>
            </div>
        `;

        Modal.renderRaw(`הוספת תרומות - ${name}`, html, () => {
            const rows = document.querySelectorAll('#batch-add-tbody tr');
            let count = 0;
            const now = Date.now();
            
            rows.forEach(tr => {
                const amount = parseFloat(tr.querySelector('.input-amount').value);
                if (!amount) return;
                
                const method = tr.querySelector('.input-method').value;
                const notes = tr.querySelector('.input-notes').value;
                
                const txId = 'tx' + Date.now() + Math.random().toString(36).substr(2,5);
                
                const txData = {
                    id: txId,
                    date: now,
                    type: 'income',
                    amount: amount,
                    category: method,
                    desc: notes,
                    donorId: id,
                    isPurim: true
                };
                
                OfflineManager.write(`years/${Store.currentYear}/finance/${txId}`, txData);
                if(OfflineManager.isOnline) {
                     db.ref(`years/${Store.currentYear}/stats/income`).transaction(curr => (curr || 0) + amount);
                }
                count++;
            });
            
            if (count > 0) {
                Notify.show(`${count} תרומות נוספו בהצלחה`, 'success');
                Modal.close();
            } else {
                alert('לא הוזנו סכומים');
            }
        }, 'max-w-3xl w-full');
    },
    getBatchRowHtml() {
        return `
            <tr class="border-b last:border-0">
                <td class="p-2"><input type="number" class="input-amount border rounded p-1 w-full" placeholder="₪"></td>
                <td class="p-2">
                    <select class="input-method border rounded p-1 w-full text-sm">
                        <option>תרומה כללית</option>
                        <option>מזומן</option>
                        <option>צק</option>
                        <option>אשראי</option>
                    </select>
                </td>
                <td class="p-2"><input type="text" class="input-notes border rounded p-1 w-full" placeholder="הערה..."></td>
                <td class="p-2 text-center"><button onclick="this.closest('tr').remove()" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button></td>
            </tr>
        `;
    },
    addBatchRow() {
        const tbody = document.getElementById('batch-add-tbody');
        tbody.insertAdjacentHTML('beforeend', this.getBatchRowHtml());
    },
    setKanbanDay(day) {
        this.kanbanDay = day;
        document.querySelectorAll('.kanban-tab').forEach(b => b.classList.toggle('active', b.dataset.day === day));
        this.renderManager();
    },
    renderManager() {
        const poolEl = document.getElementById('donor-pool-list');
        poolEl.innerHTML = '';
        const currentDayGroups = [];
        const groupsData = Store.data.yearData[Store.currentYear]?.groups || {};
        if (groupsData[this.kanbanDay]) {
             Object.entries(groupsData[this.kanbanDay]).forEach(([gid, g]) => {
                currentDayGroups.push({id: gid, day: this.kanbanDay, ...g});
            });
        }
        const assignedDonors = new Set(Object.keys(Store.data.donorGroupMap));
        const unassigned = Object.values(Store.data.donors).filter(d => d && !assignedDonors.has(d.id));
        
        document.getElementById('pool-count').innerText = unassigned.length;
        unassigned.sort((a,b) => a.name.localeCompare(b.name)).forEach(d => {
            const el = document.createElement('div');
            el.className = "bg-white p-2 border rounded shadow-sm text-sm cursor-grab hover:bg-gray-50 flex justify-between flex-col";
            el.dataset.id = d.id;
            el.innerHTML = `
                <div class="font-medium flex justify-between"><span>${d.name}</span> <i class="fas fa-grip-lines text-gray-300"></i></div>
                <div class="text-xs text-gray-400 mt-1"><i class="fas fa-map-marker-alt"></i> ${d.city || ''} ${d.street || d.address || ''}</div>
            `;
            poolEl.appendChild(el);
        });
        new Sortable(poolEl, { group: { name: 'donors', pull: true, put: true }, sort: false, animation: 150 });
        
        const container = document.getElementById('groups-kanban-container');
        container.innerHTML = '';
        if (currentDayGroups.length === 0) container.innerHTML = `<div class="text-gray-400 text-sm">אין קבוצות מוגדרות</div>`;

        currentDayGroups.forEach(g => {
            const col = document.createElement('div');
            col.className = "shrink-0 w-72 h-full bg-white rounded-lg shadow-sm border flex flex-col";
            col.innerHTML = `
                <div class="p-2 border-b bg-indigo-50 font-bold text-sm text-indigo-900 flex justify-between shrink-0 cursor-pointer" onclick="Donors.showGroupDetails('${g.id}', '${g.day}')">
                    <span>${g.name}</span>
                </div>
                <div class="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50 kanban-group-list custom-scroll" data-gid="${g.id}"></div>
            `;
            const listEl = col.querySelector('.kanban-group-list');
            (g.route || []).forEach(did => {
                if(did.startsWith('NOTE:')) {
                    const noteText = did.substring(5);
                     const item = document.createElement('div');
                    item.className = "bg-yellow-50 p-2 border border-yellow-200 rounded shadow-sm text-sm cursor-grab flex flex-col justify-between group";
                    item.dataset.id = did;
                    item.innerHTML = `
                        <div class="flex justify-between items-start font-bold text-yellow-800">
                            <span class="truncate w-40"><i class="fas fa-sticky-note ml-1"></i> ${noteText}</span>
                            <button onclick="Groups.removeFromRoute('${g.day}','${g.id}','${did}')" class="text-red-300 hover:text-red-500 hidden group-hover:block"><i class="fas fa-times"></i></button>
                        </div>
                    `;
                    listEl.appendChild(item);
                } else {
                    const d = Store.data.donors[did];
                    if(d) {
                        const item = document.createElement('div');
                        item.className = "bg-white p-2 border rounded shadow-sm text-sm cursor-grab flex flex-col justify-between group";
                        item.dataset.id = did;
                        item.innerHTML = `
                            <div class="flex justify-between items-start">
                                <span class="truncate w-40 font-bold">${d.name}</span>
                                <button onclick="Groups.removeFromRoute('${g.day}','${g.id}','${did}')" class="text-red-300 hover:text-red-500 hidden group-hover:block"><i class="fas fa-times"></i></button>
                            </div>
                            <div class="text-xs text-gray-500 mt-1 truncate">${d.city||''} ${d.street||d.address||''}</div>
                        `;
                        listEl.appendChild(item);
                    }
                }
            });
            container.appendChild(col);
            new Sortable(listEl, {
                group: 'donors',
                animation: 150,
                onAdd: () => {
                    const newOrder = Array.from(listEl.children).map(c => c.dataset.id);
                    OfflineManager.write(`years/${Store.currentYear}/groups/${g.day}/${g.id}/route`, newOrder);
                    setTimeout(() => { Store.loadGroups(); }, 500);
                },
                onUpdate: () => {
                     const newOrder = Array.from(listEl.children).map(c => c.dataset.id);
                     OfflineManager.write(`years/${Store.currentYear}/groups/${g.day}/${g.id}/route`, newOrder);
                }
            });
        });
    },
    showGroupDetails(gid, day) {
        const g = Store.data.yearData[Store.currentYear].groups[day][gid];
        if (!g) return;
        
        Reports.getAllHistory().then(historyData => {
            const donors = (g.route || []).filter(x => !x.startsWith('NOTE:')).map(did => Store.data.donors[did]).filter(x => x);
            const years = Object.keys(HEBREW_YEARS_MAPPING).sort().slice(-3);
            let html = `<div class="overflow-x-auto"><table class="w-full text-sm border-collapse"><thead class="bg-gray-100"><tr><th class="p-2 border">שם</th><th class="p-2 border">כתובת</th>${years.map(y => `<th class="p-2 border text-center">${y}</th>`).join('')}<th class="p-2 border"></th></tr></thead><tbody>`;
            donors.forEach(d => {
                html += `<tr><td class="p-2 border">${d.name}</td><td class="p-2 border">${d.city||''}</td>${years.map(()=>'<td class="p-2 border">...</td>').join('')}<td class="p-2 border"><button onclick="Groups.removeFromRoute('${day}','${gid}','${d.id}');Modal.close();" class="text-red-500">הסר</button></td></tr>`;
            });
            html += `</tbody></table></div>`;
            Modal.renderRaw(`פרטי קבוצה: ${g.name}`, html, () => Modal.close());
            document.querySelector('#modal-form .btn-primary').parentElement.style.display = 'none';
        });
    },
    filterPool(v) {
        const list = document.getElementById('donor-pool-list');
        Array.from(list.children).forEach(el => {
            el.style.display = el.innerText.includes(v) ? 'flex' : 'none';
        });
    },
    getFormFields() {
        const activeKeys = (Store.data.config.fields || {}).donors || DEFAULT_ACTIVE_FIELDS.donors;
        const fields = [];
        activeKeys.forEach(k => {
            let def = PREDEFINED_FIELDS.donors.find(p => p.k === k);
            if (!def && Store.data.config.customFieldsDefs && Store.data.config.customFieldsDefs[k]) {
                def = { k: k, l: Store.data.config.customFieldsDefs[k].l, t: 'text' };
            }
            if(def) fields.push({id:k, l:def.l, t:def.t, opts:def.opts, r:def.r});
        });
        return fields;
    },
    openAddModal() {
        const allGroups = [];
        const gData = Store.data.yearData[Store.currentYear]?.groups || {};
        Object.entries(gData).forEach(([d, dayG]) => Object.entries(dayG).forEach(([gid, g]) => allGroups.push({id: gid, day:d, name: g.name})));
        const groupSelectHtml = `
            <div class="mb-3 p-3 bg-amber-50 rounded border border-amber-100">
                <label class="block text-sm font-bold text-amber-800 mb-1">שיוך לקבוצה (אופציונלי)</label>
                <select id="new-donor-group" class="w-full border p-2 rounded bg-white text-sm">
                    <option value="">-- ללא שיוך --</option>
                    ${allGroups.map(g => `<option value="${g.day}|${g.id}">${g.name} (${g.day})</option>`).join('')}
                </select>
            </div>
        `;
        Modal.render('הוספת תורם חדש', this.getFormFields(), (data) => {
            if (!data.firstName || !data.lastName) return Notify.show('שגיאה: חובה שם פרטי ומשפחה', 'error');
            const id = db.ref('global/donors').push().key || ('don' + Date.now());
            if(data.firstName || data.lastName) data.name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            if(!data.name) data.name = 'ללא שם';
            OfflineManager.write(`global/donors/${id}`, { id, joinYear: Store.currentYear, ...data });
            const groupVal = document.getElementById('new-donor-group').value;
            if(groupVal) {
                const [day, gid] = groupVal.split('|');
                const ref = db.ref(`years/${Store.currentYear}/groups/${day}/${gid}/route`);
                ref.once('value', s => {
                    const list = s.val() || [];
                    list.push(id);
                    OfflineManager.write(`years/${Store.currentYear}/groups/${day}/${gid}/route`, list);
                });
            }
            Notify.show('תורם נוסף בהצלחה', 'success');
        }, groupSelectHtml);
    },
    openEdit(id) {
        const d = Store.data.donors[id];
        if (!d) return Notify.show('תורם לא נמצא', 'error');
        const fields = this.getFormFields().map(f => ({ ...f, v: d[f.id] }));
        Modal.render('עריכת תורם', fields, (data) => {
            if(data.firstName || data.lastName) data.name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            OfflineManager.write(`global/donors/${id}`, data, 'update');
            Notify.show('פרטי תורם עודכנו', 'success');
        });
    },
    delete(id) {
        if(confirm('אזהרה: למחוק תורם זה?')) {
            OfflineManager.write(`global/donors/${id}`, null, 'remove');
            delete Store.data.donors[id];
            this.render();
            Notify.show('התורם נמחק', 'info');
        }
    }
};

window.Donors = Donors;