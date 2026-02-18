const Store = {
    currentYear: getHebrewYear(),
    user: null,
    role: 'user',
    data: {
        students: {}, 
        donors: {},   
        yearData: {}, 
        config: { fields: {}, goals: [], studentTiers: [], customFieldsDefs: {}, groupDiscounts: {}, bonusTiers: [], vouchers: [] },
        donorGroupMap: {},
        stats: { income: 0, expense: 0 } 
    },
    cursors: { students: null, donors: null, finance: null },
    loadedAll: { students: false, donors: false },

    init() {
        const cachedStudents = OfflineManager.loadState('students');
        const cachedDonors = OfflineManager.loadState('donors');
        
        if(cachedStudents) this.data.students = cachedStudents;
        if(cachedDonors) this.data.donors = cachedDonors;
        
        this.loadConfig();
        this.loadStats();
        
        if (!cachedStudents || Object.keys(cachedStudents).length === 0) {
            Students.loadMore(true); 
        } else {
            Students.syncNewest();
        }

        if (!cachedDonors || Object.keys(cachedDonors).length === 0) {
            Donors.loadMore(true);
        } else {
            Donors.syncNewest();
        }

        this.loadGroups();
    },

    loadStats() {
        if (Store.role === 'user') return; // Note: Role check might need adjustment if users need stats
        const ref = db.ref(`years/${this.currentYear}/stats`);
        ListenerManager.add(ref, 'value', s => {
            this.data.stats = s.val() || { income: 0, expense: 0 };
            if(Router.current === 'dashboard') Dashboard.render();
        });
    },
    
    loadGroups() {
        const ref = db.ref(`years/${this.currentYear}/groups`);
        ListenerManager.add(ref, 'value', snap => {
            if(!this.data.yearData[this.currentYear]) this.data.yearData[this.currentYear] = {};
            const groupsData = snap.val() || {};
            this.data.yearData[this.currentYear].groups = groupsData;
            
            this.data.donorGroupMap = {};
            Object.values(groupsData).forEach(dayGroups => {
                Object.values(dayGroups).forEach(g => {
                    if(g.route) g.route.forEach(did => {
                        if (!did.startsWith('NOTE:')) {
                            this.data.donorGroupMap[did] = g.name;
                        }
                    });
                });
            });
            
            UI.updateIfVisible('groups');
            if(Router.current === 'donors') Donors.render(); 
        });
    },

    loadConfig() {
        const ref = db.ref('settings');
        ListenerManager.add(ref, 'value', s => {
            this.data.config = s.val() || {};
            if(!this.data.config.fields) this.data.config.fields = {};
            if(Router.current === 'settings') {
                 Settings.renderFieldsEditor();
                 Settings.renderVouchers();
            }
            System.toggleAI(this.data.config.enableAI);
        });
    },

    // פונקציה חדשה לוידוא טעינת כל הנתונים
    async ensureAllLoaded(types = ['students', 'donors']) {
        if (!Array.isArray(types)) types = [types];
        
        for (const type of types) {
            if (this.loadedAll[type]) continue;

            Notify.show(`טוען את כל ה-${type === 'students' ? 'בחורים' : 'תורמים'} להדפסה/ייצוא...`, 'info');
            
            // Loop until loadedAll is true
            while (!this.loadedAll[type]) {
                if (type === 'students') await Students.loadMore();
                else if (type === 'donors') await Donors.loadMore();
            }
        }
        Notify.show('כל הנתונים נטענו בהצלחה', 'success');
    }
};

window.Store = Store;