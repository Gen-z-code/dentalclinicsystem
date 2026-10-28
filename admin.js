(function() {
    // 1. Inject Dashboard Styles (Claymorphism for Admin)
    const styles = `
        :root {
            --primary: #A78BFA; --bg: #FFFDF8; --text: #243047; --surface: #E0F2FE;
            --danger: #FDA4AF; --success: #A7F3D0;
            --shadow: 4px 4px 10px rgba(167,139,250,0.15), -4px -4px 10px #ffffff;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); display: flex; min-height: 100vh; overflow-x: hidden; }
        
        .login-container { display: flex; justify-content: center; align-items: center; height: 100vh; width: 100%; background: var(--bg); }
        .clay-panel { background: var(--bg); border-radius: 24px; box-shadow: var(--shadow); padding: 2rem; border: 2px solid rgba(255,255,255,0.6); }
        .clay-input { width: 100%; padding: 1rem; border-radius: 12px; border: none; background: var(--bg); box-shadow: inset 4px 4px 8px rgba(0,0,0,0.05), inset -4px -4px 8px rgba(255,255,255,0.9); margin-bottom: 1rem; }
        .clay-input:focus { outline: 2px solid var(--primary); }
        .clay-btn { background: var(--primary); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 99px; cursor: pointer; font-weight: 600; box-shadow: 2px 2px 6px rgba(167,139,250,0.4); width: 100%; transition: 0.2s; }
        .clay-btn:hover { filter: brightness(1.05); }
        
        .sidebar { width: 250px; background: var(--surface); padding: 2rem; box-shadow: 2px 0 10px rgba(0,0,0,0.05); }
        .sidebar h2 { color: var(--primary); margin-bottom: 2rem; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; }
        .sidebar a { display: block; padding: 1rem; color: var(--text); text-decoration: none; border-radius: 12px; margin-bottom: 0.5rem; transition: 0.2s; font-weight: 500; }
        .sidebar a:hover, .sidebar a.active { background: var(--bg); box-shadow: var(--shadow); color: var(--primary); }
        
        .main-content { flex: 1; padding: 2rem; overflow-y: auto; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { background: var(--bg); padding: 1.5rem; border-radius: 16px; box-shadow: var(--shadow); border: 1px solid rgba(255,255,255,0.5); text-align: center; }
        .stat-card h3 { font-size: 2rem; color: var(--primary); margin-bottom: 0.5rem; }
        .stat-card p { font-size: 0.875rem; color: #6B7280; font-weight: 600; text-transform: uppercase; }
        
        table { width: 100%; border-collapse: collapse; background: var(--bg); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); }
        th, td { padding: 1rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.05); }
        th { background: var(--surface); font-weight: 600; }
        .badge { padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; }
        .badge.pending { background: #FEF3C7; color: #D97706; }
        .badge.confirmed { background: var(--success); color: #065F46; }
        .badge.cancelled { background: var(--danger); color: #9F1239; }
        
        .action-btn { background: none; border: none; cursor: pointer; color: var(--text); padding: 0.25rem; }
        .action-btn:hover { color: var(--primary); }
    `;
    document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

    const root = document.getElementById('admin-root');

    // Utility: Fetch wrapper for CSRF logic
    const apiFetch = async (url, options = {}) => {
        options.credentials = 'same-origin';
        if (!options.headers) options.headers = {};
        options.headers['X-Admin-Request'] = 'true';
        if (options.body && !(options.body instanceof FormData)) {
            options.headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(url, options);
        if (res.status === 401) return renderLogin();
        return res;
    };

    // --- VIEWS ---

    const renderLogin = () => {
        root.innerHTML = `
            <div class="login-container">
                <div class="clay-panel" style="width: 100%; max-width: 400px; text-align: center;">
                    <i data-lucide="lock" style="width:48px;height:48px;color:var(--primary);margin-bottom:1rem;"></i>
                    <h2 style="margin-bottom:1.5rem;">Admin Login</h2>
                    <form id="login-form">
                        <input type="email" id="email" class="clay-input" placeholder="Admin Email" required value="admin@lumasmile.example">
                        <input type="password" id="password" class="clay-input" placeholder="Password" required value="Admin@123">
                        <button type="submit" class="clay-btn">Login</button>
                    </form>
                    <p style="margin-top:1rem; font-size:0.75rem; color:#6b7280;">Use Bootstrap credentials for demo</p>
                </div>
            </div>
        `;
        lucide.createIcons();
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button'); btn.textContent = 'Verifying...';
            const res = await fetch('/api/admin/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value })
            });
            if (res.ok) initApp();
            else { alert('Invalid credentials'); btn.textContent = 'Login'; }
        };
    };

    const renderDashboardLayout = (contentHTML) => {
        root.innerHTML = `
            <div class="sidebar">
                <h2><i data-lucide="smile"></i> LumaSmile Admin</h2>
                <a href="#dashboard" class="nav-link" data-target="dashboard"><i data-lucide="layout-dashboard"></i> Dashboard</a>
                <a href="#appointments" class="nav-link" data-target="appointments"><i data-lucide="calendar"></i> Appointments</a>
                <a href="#" id="logout-btn" style="margin-top:auto; color:var(--danger);"><i data-lucide="log-out"></i> Logout</a>
            </div>
            <div class="main-content">
                ${contentHTML}
            </div>
        `;
        lucide.createIcons();
        document.getElementById('logout-btn').onclick = async () => {
            await fetch('/api/admin/logout', { method: 'POST' });
            renderLogin();
        };
    };

    const loadDashboard = async () => {
        renderDashboardLayout(`<div class="header"><h1>Dashboard Overview</h1></div><div id="stats-container">Loading...</div>`);
        const res = await apiFetch('/api/admin/stats');
        const stats = await res.json();
        document.getElementById('stats-container').innerHTML = `
            <div class="grid-cards">
                <div class="stat-card"><h3>${stats.todayAppts}</h3><p>Today's Appointments</p></div>
                <div class="stat-card"><h3>${stats.pending}</h3><p>Pending Review</p></div>
                <div class="stat-card"><h3>${stats.total}</h3><p>Total Bookings</p></div>
            </div>
            <div class="clay-panel">
                <h3>Welcome to LumaSmile Admin</h3>
                <p style="margin-top:1rem; color:#6b7280;">Select 'Appointments' from the sidebar to manage bookings, confirm pending requests, and manage patient flows. All sensitive operations are protected by CSRF verification.</p>
            </div>
        `;
    };

    const loadAppointments = async () => {
        renderDashboardLayout(`<div class="header"><h1>Appointments</h1></div><div id="table-container">Loading...</div>`);
        const res = await apiFetch('/api/admin/appointments');
        const appointments = await res.json();
        
        if (appointments.length === 0) {
            document.getElementById('table-container').innerHTML = `<div class="clay-panel" style="text-align:center; padding: 4rem;">No appointments found.</div>`;
            return;
        }

        const rows = appointments.map(appt => `
            <tr>
                <td><strong>${appt.reference}</strong></td>
                <td>${appt.patientName}<br><small>${appt.phone}</small></td>
                <td>${appt.serviceId?.name || 'Unknown'}<br><small>${appt.dentistId?.name || 'Unknown'}</small></td>
                <td>${appt.date} <br> ${appt.startTime}</td>
                <td><span class="badge ${appt.status}">${appt.status.toUpperCase()}</span></td>
                <td>
                    ${appt.status === 'pending' ? `<button class="action-btn" title="Confirm" onclick="updateStatus('${appt._id}', 'confirmed')"><i data-lucide="check-circle"></i></button>` : ''}
                    ${(appt.status === 'pending' || appt.status === 'confirmed') ? `<button class="action-btn" title="Cancel" onclick="updateStatus('${appt._id}', 'cancelled')"><i data-lucide="x-circle"></i></button>` : ''}
                </td>
            </tr>
        `).join('');

        document.getElementById('table-container').innerHTML = `
            <table>
                <thead><tr><th>Reference</th><th>Patient</th><th>Service & Dentist</th><th>Date & Time</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        lucide.createIcons();
    };

    // Global action for button clicks in rendered HTML
    window.updateStatus = async (id, status) => {
        if (!confirm(`Are you sure you want to mark this as ${status}?`)) return;
        const res = await apiFetch(`/api/admin/appointments/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
        if (res.ok) loadAppointments();
        else alert('Failed to update status.');
    };

    // --- ROUTER ---
    const route = () => {
        const hash = window.location.hash.substring(1) || 'dashboard';
        if (hash === 'appointments') loadAppointments();
        else loadDashboard();
    };
    window.addEventListener('hashchange', route);

    // --- INIT ---
    const initApp = async () => {
        const res = await apiFetch('/api/admin/me');
        if (res.ok) { route(); } 
        else { renderLogin(); }
    };
    initApp();
})();
