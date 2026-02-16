const Dashboard = {
    render() {
        const stats = Store.data.stats || { income: 0, expense: 0 };
        const inc = stats.income || 0;
        const exp = stats.expense || 0;
        document.getElementById('dash-income').innerText = `₪${inc.toLocaleString()}`;
        document.getElementById('dash-expense').innerText = `₪${exp.toLocaleString()}`;
        document.getElementById('dash-total-balance').innerText = `₪${(inc - exp).toLocaleString()}`;
        
        const goal = Store.data.config.globalGoal || 100000;
        const elGoalText = document.getElementById('dash-goal-text-amount');
        if (elGoalText) elGoalText.innerText = `₪${parseInt(goal).toLocaleString()}`;

        const pct = Math.min(100, Math.round((inc / goal) * 100));
        setTimeout(() => { 
            const bar = document.getElementById('dash-bar');
            if(bar) bar.style.width = pct + '%'; 
        }, 100);
        document.getElementById('dash-goal-progress').innerText = pct + '%';
        
        db.ref('global/students').once('value', s => {
            const count = s.numChildren();
            const el = document.getElementById('dash-stat-students');
            if(el) el.innerText = count;
        });
        db.ref('global/donors').once('value', s => {
            const count = s.numChildren();
            const el = document.getElementById('dash-stat-donors');
            if(el) el.innerText = count;
        });

        if (Store.role !== 'user') {
            db.ref(`years/${Store.currentYear}/finance`).orderByChild('date').limitToLast(5).once('value', s => {
                const logs = document.getElementById('dash-logs');
                if(!logs) return;
                const val = s.val();
                if(!val) { logs.innerHTML = '<div class="text-center text-gray-400 mt-4">אין תנועות אחרונות</div>'; return; }
                const arr = Object.values(val).sort((a,b)=>b.date-a.date);
                logs.innerHTML = arr.map(t => {
                    const icon = t.type==='income' ? 'fa-arrow-down text-emerald-500' : 'fa-arrow-up text-rose-500';
                    const displayAmt = isNaN(parseFloat(t.amount)) ? t.amount : `₪${t.amount}`;
                    return `
                    <div class="p-3 border-b flex justify-between items-center text-sm hover:bg-slate-50">
                        <div class="flex items-center gap-2">
                            <i class="fas ${icon}"></i>
                            <span class="font-medium">${t.category}</span>
                            <span class="text-xs text-gray-400">${t.desc||''}</span>
                        </div>
                        <span class="font-bold">${displayAmt}</span>
                    </div>`;
                }).join('');
            });
        } else {
             const logs = document.getElementById('dash-logs');
             if(logs) logs.innerHTML = '<div class="text-center text-gray-400 mt-4">אין גישה לנתונים כספיים</div>';
        }
    }
};
window.Dashboard = Dashboard;