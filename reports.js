const Reports = {
    // מנוע חיפוש לישויות (בחורים/תורמים) עבור הדוחות
    searchEntity(v) {
        const res = document.getElementById('rep-entity-results');
        res.innerHTML = '';
        if(v.length < 2) { res.classList.add('hidden'); return; }
        res.classList.remove('hidden');
        
        const students = Object.values(Store.data.students).filter(s => s).filter(s => {
            const n = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
            return n && n.includes(v);
        }).slice(0,5);
        
        const donors = Object.values(Store.data.donors).filter(d => d && d.name && d.name.includes(v)).slice(0,5);
        
        students.forEach(s => {
            const n = s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name;
            res.innerHTML += `<div class="p-2 hover:bg-gray-100 cursor-pointer text-sm" onclick="Reports.selectEntity('${s.id}','${n}','student')"><i class="fas fa-user-graduate text-blue-500"></i> ${n} <span class="text-xs text-gray-500">(בחור)</span></div>`;
        });
        
        donors.forEach(d => {
            res.innerHTML += `<div class="p-2 hover:bg-gray-100 cursor-pointer text-sm" onclick="Reports.selectEntity('${d.id}','${d.name}','donor')"><i class="fas fa-hand-holding-heart text-emerald-500"></i> ${d.name} <span class="text-xs text-gray-500">(תורם)</span></div>`;
        });
    },

    selectEntity(id, name, type) {
        document.getElementById('rep-entity-search').value = name;
        document.getElementById('rep-entity-id').value = id + '|' + type;
        document.getElementById('rep-entity-results').classList.add('hidden');
    },
    
    async getAllHistory(studentId = null) {
        let years = Object.keys(HEBREW_YEARS_MAPPING);
        if (Store.currentYear && !years.includes(Store.currentYear)) {
            years.push(Store.currentYear);
        }

        const promises = years.map(y => db.ref(`years/${y}/finance`).once('value'));
        const snapshots = await Promise.all(promises);
        
        const allTx = [];
        snapshots.forEach((snap, idx) => {
            const yearName = years[idx];
            const val = snap.val();
            if(val) Object.values(val).forEach(t => {
                t._year = yearName;
                allTx.push(t);
            });
        });
        
        if (studentId) {
            return allTx.filter(t => t.studentId == studentId && t.type === 'income');
        }
        return allTx; 
    },

    async generateIndividual(id, name) {
        Notify.show('מלקט נתונים מכל השנים...', 'info');
        const data = await this.getAllHistory(id);
        
        data.sort((a, b) => b.date - a.date);

        const rows = data.length > 0 ? data.map(t => ({
            "שנה": t._year || '',
            "תאריך": System.toHebrewDate(t.date),
            "קטגוריה": t.category,
            "תיאור": t.desc,
            "סכום": parseFloat(t.amount) || 0
        })) : [{ "שנה": Store.currentYear, "תאריך": "", "קטגוריה": "", "תיאור": "אין נתונים לבחור זה", "סכום": 0 }];

        const ws = XLSX.utils.json_to_sheet(rows);
        if(!ws['!views']) ws['!views'] = [];
        ws['!views'].push({ rightToLeft: true });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "דוח הכנסות אישי");
        wb.Workbook = { Views: [{ RTL: true }] };
        const safeName = name ? name.replace(/ /g,'_') : 'Student';
        XLSX.writeFile(wb, `Income_Report_${safeName}.xlsx`);
        Notify.show('הדוח הורד בהצלחה', 'success');
    },

    async printStudentSlip(id, name) {
        Notify.show('מכין דף בחור להדפסה...', 'info');
        const data = await this.getAllHistory(id);
        const s = Store.data.students[id] || { grade: '', idNum: '' };
        
        let total = 0;
        let rowsHtml = '';
        data.sort((a,b) => b.date - a.date);
        
        data.forEach(t => {
            const amt = isNaN(parseFloat(t.amount)) ? 0 : parseFloat(t.amount);
            total += amt;
            rowsHtml += `<tr>
                <td>₪${amt.toLocaleString()}</td>
                <td>${t.desc || '-'}</td>
                <td>${t.category}</td>
                <td>${System.toHebrewDate(t.date)}</td>
                <td>${t._year || ''}</td>
            </tr>`;
        });

        if (data.length === 0) {
            rowsHtml = `<tr><td colspan="5" style="text-align:center; padding:10px;">אין נתונים כספיים לבחור זה</td></tr>`;
        }

        const html = `
            <div class="student-slip">
                <div class="student-slip-header">
                    <div>
                        <div class="student-slip-title">${name}</div>
                        <div>${s.grade || ''} ${s.idNum ? '| ת.ז: ' + s.idNum : ''}</div>
                    </div>
                    <img src="1.JPG" alt="לוגו" class="student-slip-logo">
                </div>
                <h3 style="text-align:center; margin-bottom:10px;">פירוט תרומות והכנסות</h3>
                <table class="print-table" style="width:100%;">
                    <thead>
                        <tr><th>סכום</th><th>תיאור</th><th>קטגוריה</th><th>תאריך</th><th>שנה</th></tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                    <tfoot>
                        <tr style="background:#e0f2fe; font-weight:bold;">
                            <td>₪${total.toLocaleString()}</td>
                            <td colspan="4">סה״כ לתשלום / זיכוי</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="margin-top: 30px; text-align: center; font-size: 12px;">הופק על ידי מערכת עזר חתנים בתאריך ${new Date().toLocaleDateString('he-IL')}</div>
            </div>`;

        const pa = document.getElementById('print-area');
        pa.innerHTML = html;
        window.print();
    },

    async generateStandard() {
        if(Store.role === 'user') return Notify.show('אין הרשאה להפקת דוח כספי מלא', 'error');
        
        await Store.ensureAllLoaded(['students', 'donors']);

        Notify.show('מייצא נתונים...', 'info');
        db.ref(`years/${Store.currentYear}/finance`).once('value', snap => {
            const type = document.getElementById('rep-type').value;
            const entVal = document.getElementById('rep-entity-id').value;
            let data = Object.values(snap.val() || {});
            
            if(type !== 'all') data = data.filter(t => t.type === type);
            if(entVal) {
                const [eid, etype] = entVal.split('|');
                data = data.filter(t => (etype === 'student' ? t.studentId : t.donorId) === eid);
            }
            data.sort((a, b) => b.date - a.date);

            const rows = data.map(t => {
                let entityName = '';
                if (t.studentId) {
                    const s = Store.data.students[t.studentId];
                    entityName = s ? (s.firstName && s.lastName ? `${s.firstName} ${s.lastName}` : s.name) : 'בחור לא ידוע';
                } else if (t.donorId) {
                    const d = Store.data.donors[t.donorId];
                    entityName = d ? d.name : 'תורם לא ידוע';
                } else if (t.isGroup) {
                    entityName = `קבוצה: ${t.groupName || ''}`;
                }

                return {
                    "תאריך": System.toHebrewDate(t.date),
                    "שם משוייך": entityName,
                    "סוג תנועה": t.type === 'income' ? 'הכנסה' : 'הוצאה',
                    "קטגוריה": t.category,
                    "תיאור / הערות": t.desc,
                    "סכום בש״ח": parseFloat(t.amount) || 0
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            ws['!cols'] = [{wch: 15}, {wch: 25}, {wch: 10}, {wch: 15}, {wch: 40}, {wch: 12}];
            if(!ws['!views']) ws['!views'] = [];
            ws['!views'].push({ rightToLeft: true });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "דוח כספי");
            wb.Workbook = { Views: [{ RTL: true }] };
            XLSX.writeFile(wb, `Report_${Store.currentYear}.xlsx`);
            Notify.show('הקובץ מוכן!', 'success');
        });
    },
    
    // --- עורך דוחות ויזואלי (דוח תצוגה + הדפסות מותאמות) ---
    editorState: {
        bgImg: null, bgOpacity: 0.2, title: 'דוח תצוגה משוקלל',
        images: [], zoom: 0.6,
        headers: ['שם הבחור', 'יעד אישי', 'סה״כ לתצוגה', 'אחוז מיעד', 'מתנה'],
        colsVisible: [true, true, true, true, true],
        headersOrder: [0, 1, 2, 3, 4],
        orientation: 'landscape', rowsPerPage: 22,
        mode: 'visual', // 'visual' | 'custom'
        customHtml: '', // For group sheets etc.
        marginPadding: 20,
        sortBy: 'amount_desc' // amount_desc, name_asc, grade, goal_desc
    },
    
    setRowsPerPage(val) {
        this.editorState.rowsPerPage = parseInt(val) || 20;
        this.renderEditorCanvas();
    },
    
    // פונקציה פותחת עורך
    openEditor(mode = 'visual', customHtml = '') {
        this.editorState.mode = mode;
        this.editorState.customHtml = customHtml;
        this.editorState.title = mode === 'custom' ? 'תצוגה מקדימה להדפסה' : 'דוח תצוגה משוקלל';
        
        document.getElementById('editor-title-input').value = this.editorState.title;
        document.getElementById('report-editor-screen').classList.remove('hidden-screen');
        
        // הצג/הסתר הגדרות רלוונטיות
        const headersEditor = document.getElementById('editor-headers-container');
        if (mode === 'custom') {
            headersEditor.parentElement.style.display = 'none';
        } else {
            headersEditor.parentElement.style.display = 'block';
            this.renderHeadersEditor();
        }
        
        this.renderEditorCanvas();
    },

    closeEditor() {
        document.getElementById('report-editor-screen').classList.add('hidden-screen');
    },

    renderHeadersEditor() {
        const container = document.getElementById('editor-headers-container');
        container.innerHTML = '';
        
        // הוספת בורר מיון
        const sortDiv = document.createElement('div');
        sortDiv.className = "mb-2 border-b pb-2";
        sortDiv.innerHTML = `
            <label class="text-xs font-bold block mb-1">מיון לפי:</label>
            <select onchange="Reports.setSort(this.value)" class="text-xs border rounded p-1 w-full">
                <option value="amount_desc" ${this.editorState.sortBy === 'amount_desc' ? 'selected' : ''}>סכום לתצוגה (מהגבוה)</option>
                <option value="goal_desc" ${this.editorState.sortBy === 'goal_desc' ? 'selected' : ''}>גובה יעד (מהגבוה)</option>
                <option value="name_asc" ${this.editorState.sortBy === 'name_asc' ? 'selected' : ''}>שם משפחה (א-ת)</option>
                <option value="grade" ${this.editorState.sortBy === 'grade' ? 'selected' : ''}>שיעור</option>
            </select>
        `;
        container.appendChild(sortDiv);

        this.editorState.headersOrder.forEach((originalIndex, displayOrder) => {
            const val = this.editorState.headers[originalIndex];
            const isVis = this.editorState.colsVisible[originalIndex];
            const el = document.createElement('div');
            el.className = "flex items-center gap-2 bg-slate-50 p-1 border rounded text-xs";
            el.innerHTML = `
                 <button onclick="Reports.moveHeader(${displayOrder}, -1)" class="text-gray-400 hover:text-blue-500"><i class="fas fa-arrow-up"></i></button>
                 <button onclick="Reports.moveHeader(${displayOrder}, 1)" class="text-gray-400 hover:text-blue-500"><i class="fas fa-arrow-down"></i></button>
                 <input type="checkbox" ${isVis ? 'checked' : ''} onchange="Reports.toggleCol(${originalIndex}, this.checked)">
                 <input type="text" value="${val}" oninput="Reports.updateHeader(${originalIndex}, this.value)" class="flex-1 bg-transparent outline-none">
            `;
            container.appendChild(el);
        });
    },
    setSort(val) {
        this.editorState.sortBy = val;
        this.renderEditorCanvas();
    },
    moveHeader(currIdx, direction) {
        const newIdx = currIdx + direction;
        const arr = this.editorState.headersOrder;
        if (newIdx < 0 || newIdx >= arr.length) return;
        const temp = arr[currIdx];
        arr[currIdx] = arr[newIdx];
        arr[newIdx] = temp;
        this.renderHeadersEditor();
        this.renderEditorCanvas();
    },
    
    // רנדור הקנבס - תומך גם בדוח תצוגה וגם ב-HTML מותאם (קבוצות)
    async renderEditorCanvas() {
        const container = document.getElementById('report-canvas-container');
        
        // הוספנו סליידר לשוליים בתפריט הצדדי אם לא קיים
        if (!document.getElementById('margin-control')) {
            const sidebarDiv = document.querySelector('#report-sidebar .space-y-4');
            const div = document.createElement('div');
            div.id = 'margin-control';
            div.className = "border-t pt-2";
            div.innerHTML = `
                <label class="text-sm font-bold block mb-1">שוליים (Padding)</label>
                <input type="range" min="0" max="100" value="${this.editorState.marginPadding}" oninput="Reports.updateMargin(this.value)" class="w-full">
            `;
            // הוספה אחרי הזום
            sidebarDiv.insertBefore(div, sidebarDiv.children[4]);
        }

        if (this.editorState.mode === 'custom') {
            container.innerHTML = '';
            const bgStyle = this.editorState.bgImg ? `background-image: url('${this.editorState.bgImg}');` : '';
            const pageClass = this.editorState.orientation === 'landscape' ? 'page-landscape' : 'page-portrait';
            
            const pageHtml = `
            <div class="report-page ${pageClass} editor-print-mode" style="transform: scale(${this.editorState.zoom}); padding: ${this.editorState.marginPadding}px;">
                <div class="print-layer-bg bg-contain bg-center bg-no-repeat" style="${bgStyle} opacity: ${this.editorState.bgOpacity};"></div>
                <div class="print-layer-content h-full flex flex-col relative">
                     ${this.editorState.customHtml}
                     
                     <div class="draggable-item" id="default-logo" style="top: 10px; left: 10px; width: 80px;">
                        <img src="1.JPG" class="w-full h-full object-contain pointer-events-none">
                        <div class="resize-handle"></div>
                     </div>
                </div>
                <div class="print-layer-decor absolute inset-0 overflow-hidden pointer-events-auto" id="decor-layer-0"></div>
            </div>`;
            const pageEl = document.createElement('div');
            pageEl.innerHTML = pageHtml;
            container.appendChild(pageEl.firstElementChild);
            
            setTimeout(() => {
                const logo = document.getElementById('default-logo');
                if(logo) this.makeDraggable(logo);
            }, 100);
            return;
        }

        // --- דוח תצוגה (Visual Report) ---
        container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-gray-400">טוען נתונים...</div>';
        
        // וודא שכל הנתונים נטענו לפני דוח תצוגה
        await Store.ensureAllLoaded(['students', 'donors']);

        const [finSnap, grpSnap] = await Promise.all([
            db.ref(`years/${Store.currentYear}/finance`).once('value'),
            db.ref(`years/${Store.currentYear}/groups`).once('value')
        ]);

        const finances = Object.values(finSnap.val() || {});
        const groupsData = grpSnap.val() || {};
        const config = Store.data.config;
        const discounts = config.groupDiscounts || {};
        const bonusTiers = config.bonusTiers || [];

        let list = [];

        Object.values(Store.data.students).filter(s => s && !s.isArchived).forEach(student => {
            let actual = 0;
            let extra = 0;
            
            finances.filter(f => f.studentId == student.id && f.type === 'income').forEach(f => {
                 if (!isNaN(parseFloat(f.amount))) actual += parseFloat(f.amount);
            });

            Object.keys(groupsData).forEach(day => {
                Object.values(groupsData[day]).forEach(g => {
                    if((g.members||[]).some(m => m.id == student.id)) {
                        const disc = parseInt(discounts[day] || 0);
                        if (disc > 0) extra += disc;
                    }
                });
            });

            const donorsBrought = Object.values(Store.data.donors).filter(d => d && d.referrerId == student.id);
            donorsBrought.forEach(d => {
                let donorTotal = 0;
                finances.filter(f => f.donorId == d.id && f.type === 'income').forEach(f => {
                    if (!isNaN(parseFloat(f.amount))) donorTotal += parseFloat(f.amount);
                });
                const tier = bonusTiers.find(t => donorTotal >= t.rangeMin && donorTotal <= t.rangeMax);
                if (tier) extra += (donorTotal * (tier.percent / 100));
                const tiers = config.tiers || [];
                const goalTier = tiers.sort((a,b) => b.amount - a.amount).find(t => donorTotal >= t.amount);
                if (goalTier && !isNaN(parseInt(goalTier.gift))) extra += parseInt(goalTier.gift);
            });

            const yData = (Store.data.yearData[Store.currentYear]?.students || {})[student.id] || {};
            const goal = yData.personalGoal || config.baseStudentGoal || 0;
            const name = student.firstName && student.lastName ? `${student.firstName} ${student.lastName}` : student.name;
            const lastName = student.lastName || '';
            const grade = student.grade || '';
            const totalDisplay = Math.round(actual + extra);

            const studentTiers = config.studentTiers || [];
            const rewardTier = studentTiers.sort((a,b) => b.amount - a.amount).find(t => totalDisplay >= t.amount);
            const reward = rewardTier ? rewardTier.reward : '-';

            if(totalDisplay > 0 || goal > 0) {
                list.push({name, lastName, grade, goal, totalDisplay, pct: goal>0 ? Math.round((totalDisplay/goal)*100) : 0, reward});
            }
        });

        // מיון
        const sortType = this.editorState.sortBy;
        list.sort((a,b) => {
             if (sortType === 'amount_desc') return b.totalDisplay - a.totalDisplay;
             if (sortType === 'goal_desc') return b.goal - a.goal;
             if (sortType === 'name_asc') return a.lastName.localeCompare(b.lastName);
             if (sortType === 'grade') return (a.grade||'').localeCompare(b.grade||'');
             return 0;
        });

        const ROWS_PER_PAGE = this.editorState.rowsPerPage || (this.editorState.orientation === 'landscape' ? 22 : 35);
        const chunks = [];
        for (let i = 0; i < list.length; i += ROWS_PER_PAGE) {
            chunks.push(list.slice(i, i + ROWS_PER_PAGE));
        }
        if (chunks.length === 0) chunks.push([]); 

        container.innerHTML = ''; 

        const bgStyle = this.editorState.bgImg ? `background-image: url('${this.editorState.bgImg}');` : '';
        const h = this.editorState.headers;
        const pageClass = this.editorState.orientation === 'landscape' ? 'page-landscape' : 'page-portrait';
        
        let tableHeaderHTML = '<tr class="bg-slate-200">';
        this.editorState.headersOrder.forEach(idx => {
            if (this.editorState.colsVisible[idx]) {
                 tableHeaderHTML += `<th class="border border-black p-1 text-center">${h[idx]}</th>`;
            }
        });
        tableHeaderHTML += '</tr>';

        chunks.forEach((chunk, pageIdx) => {
            let pageHtml = `
            <div class="report-page ${pageClass} editor-print-mode" style="transform: scale(${this.editorState.zoom}); padding: ${this.editorState.marginPadding}px;">
                <div class="print-layer-bg bg-contain bg-center bg-no-repeat" style="${bgStyle} opacity: ${this.editorState.bgOpacity};"></div>
                <div class="print-layer-content h-full flex flex-col relative">
                    <div class="print-header mb-4">
                        <div class="draggable-item" style="position: absolute; right: 0; top: 0; width: 60px;">
                             <img src="1.JPG" alt="לוגו" class="w-full h-full object-contain pointer-events-none">
                             <div class="resize-handle"></div>
                        </div>
                        <h1 class="text-2xl font-black text-center" id="canvas-title">${this.editorState.title}</h1>
                        <h3 class="text-center">שנה: ${Store.currentYear} | עמוד ${pageIdx+1} מתוך ${chunks.length}</h3>
                    </div>
                    <div class="flex-1">
                         <table class="w-full text-right border-collapse text-sm">
                            <thead>${tableHeaderHTML}</thead>
                            <tbody>
                                ${chunk.map(item => {
                                    let rowHtml = '<tr class="bg-white/80">';
                                    this.editorState.headersOrder.forEach(idx => {
                                        if (this.editorState.colsVisible[idx]) {
                                            let val = '';
                                            if (idx === 0) val = `<span class="font-bold">${item.name}</span>`;
                                            if (idx === 1) val = item.goal;
                                            if (idx === 2) val = `<span class="font-bold">${item.totalDisplay}</span>`;
                                            if (idx === 3) val = `${item.pct}%`;
                                            if (idx === 4) val = `<span class="text-xs">${item.reward}</span>`;
                                            rowHtml += `<td class="border border-black p-1 text-center">${val}</td>`;
                                        }
                                    });
                                    rowHtml += '</tr>';
                                    return rowHtml;
                                }).join('')}
                            </tbody>
                         </table>
                    </div>
                </div>
                <div class="print-layer-decor absolute inset-0 overflow-hidden pointer-events-auto" id="decor-layer-${pageIdx}"></div>
            </div>`;
            const pageEl = document.createElement('div');
            pageEl.innerHTML = pageHtml;
            container.appendChild(pageEl.firstElementChild);
        });

        setTimeout(() => {
            document.querySelectorAll('.draggable-item').forEach(el => this.makeDraggable(el));
        }, 100);
    },
    
    updateTitle(val) {
        this.editorState.title = val;
        const els = document.querySelectorAll('#canvas-title');
        els.forEach(el => el.innerText = val);
    },
    updateHeader(originalIdx, val) {
        this.editorState.headers[originalIdx] = val;
        this.renderEditorCanvas();
    },
    toggleCol(originalIdx, isChecked) {
        this.editorState.colsVisible[originalIdx] = isChecked;
        this.renderEditorCanvas();
    },
    updateBackground(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.editorState.bgImg = e.target.result;
                document.querySelectorAll('.print-layer-bg').forEach(el => el.style.backgroundImage = `url('${e.target.result}')`);
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    updateBgOpacity(val) {
        this.editorState.bgOpacity = val;
        document.querySelectorAll('.print-layer-bg').forEach(el => el.style.opacity = val);
    },
    updateMargin(val) {
        this.editorState.marginPadding = val;
        document.querySelectorAll('.report-page').forEach(el => el.style.padding = `${val}px`);
    },
    setZoom(val) {
        this.editorState.zoom = val;
        document.querySelectorAll('.report-page').forEach(el => el.style.transform = `scale(${val})`);
    },
    setOrientation(val) {
        this.editorState.orientation = val;
        const styleEl = document.getElementById('dynamic-print-style') || document.createElement('style');
        styleEl.id = 'dynamic-print-style';
        styleEl.innerHTML = `@media print { @page { size: A4 ${val}; margin: 0; } body { padding-bottom: 50px; } }`;
        document.head.appendChild(styleEl);
        this.renderEditorCanvas();
    },
    addDecorImage(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgId = 'decor-' + Date.now();
                const imgContainer = document.createElement('div');
                imgContainer.className = 'draggable-item';
                imgContainer.id = imgId;
                imgContainer.style.top = '100px';
                imgContainer.style.left = '100px';
                imgContainer.style.width = '150px';
                imgContainer.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-contain pointer-events-none"><div class="resize-handle"></div>`;
                const firstPageLayer = document.querySelector('[id^="decor-layer-"]');
                if (firstPageLayer) {
                    firstPageLayer.appendChild(imgContainer);
                    this.makeDraggable(imgContainer);
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    makeDraggable(elmnt) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        elmnt.onmousedown = function(e) {
            if (e.target.classList.contains('resize-handle')) return; 
            document.querySelectorAll('.draggable-item').forEach(el => el.classList.remove('selected'));
            elmnt.classList.add('selected');
            dragMouseDown(e);
        };
        const resizeHandle = elmnt.querySelector('.resize-handle');
        if (resizeHandle) {
            resizeHandle.onmousedown = function(e) {
                e.stopPropagation();
                e.preventDefault();
                let startX = e.clientX;
                let startWidth = parseInt(document.defaultView.getComputedStyle(elmnt).width, 10);
                document.onmouseup = function() {
                    document.onmouseup = null; document.onmousemove = null;
                };
                document.onmousemove = function(e) {
                    let newW = startWidth + (e.clientX - startX) / Reports.editorState.zoom; 
                    elmnt.style.width = newW + 'px';
                };
            };
        }
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = closeDragElement; document.onmousemove = elementDrag;
        }
        function elementDrag(e) {
            e.preventDefault();
            const zoom = Reports.editorState.zoom || 1;
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            elmnt.style.top = (elmnt.offsetTop - pos2 / zoom) + "px";
            elmnt.style.left = (elmnt.offsetLeft - pos1 / zoom) + "px";
        }
        function closeDragElement() {
            document.onmouseup = null; document.onmousemove = null;
        }
    },
    printEditor() {
        const container = document.getElementById('report-canvas-container');
        const printArea = document.getElementById('print-area');
        const clones = [];
        container.querySelectorAll('.report-page').forEach(page => {
             const c = page.cloneNode(true);
             c.style.transform = 'none'; 
             c.style.marginBottom = '0';
             c.querySelectorAll('.draggable-item').forEach(el => {
                el.classList.remove('selected');
                el.style.border = 'none';
                const handle = el.querySelector('.resize-handle');
                if(handle) handle.style.display = 'none';
             });
             clones.push(c);
        });
        printArea.innerHTML = '';
        clones.forEach(c => printArea.appendChild(c));
        window.print();
    }
};
window.Reports = Reports;