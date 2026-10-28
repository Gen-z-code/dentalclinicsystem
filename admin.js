(function() {
    const styles = `
        :root { --primary: #A78BFA; --bg: #FFFDF8; --text: #243047; --surface: #E0F2FE; --danger: #FDA4AF; --success: #A7F3D0; --shadow: 4px 4px 10px rgba(167,139,250,0.15), -4px -4px 10px #ffffff; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); display: flex; min-height: 100vh; overflow-x: hidden; }
        
        .login-container { display: flex; justify-content: center; align-items: center; height: 100vh; width: 100%; }
        .clay-panel { background: var(--bg); border-radius: 24px; box-shadow: var(--shadow); padding: 2rem; border: 2px solid rgba(255,255,255,0.8); }
        .clay-input, .clay-select { width: 100%; padding: 1rem; border-radius: 12px; border: none; background: var(--bg); box-shadow: inset 4px 4px 8px rgba(0,0,0,0.05), inset -4px -4px 8px rgba(255,255,255,1); margin-bottom: 1rem; }
        .clay-btn { background: var(--primary); color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 99px; cursor: pointer; font-weight: 600; width: 100%; transition: 0.2s; box-shadow: 2px 2px 6px rgba(167,139,250,0.4);}
        .clay-btn:hover { filter: brightness(1.05); transform:translateY(-2px); }
        
        .sidebar { width: 260px; background: var(--surface); padding: 2rem; border-right: 1px solid rgba(255,255,255,0.5); display:flex; flex-direction:column; }
        .sidebar h2 { color: var(--primary-dark); margin-bottom: 2rem; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; }
        .sidebar a { display: flex; align-items:center; gap:0.5rem; padding: 1rem; color: var(--text); text-decoration: none; border-radius: 12px; margin-bottom: 0.5rem; font-weight: 500; transition: 0.2s;}
        .sidebar a:hover, .sidebar a.active { background: var(--bg); box-shadow: var(--shadow); color: var(--primary-dark); }
        
        .main-content { flex: 1; padding: 3rem; overflow-y: auto; }
        .header { margin-bottom: 2.5rem; }
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { background: var(--bg); padding: 1.5rem; border-radius: 16px; box-shadow: var(--shadow); border: 2px solid #fff; text-align: center; }
        .stat-card h3 { font-size: 2.5rem; color: var(--primary-dark); margin-bottom: 0.5rem; }
        
        table { width: 100%; border-collapse: collapse; background: var(--bg); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow); border:2px solid #fff;}
        th, td { padding: 1rem 1.5rem; text-align: left; border-bottom: 1px solid rgba(0,0,0,0.05); }
        th { background: var(--surface); font-weight: 600; color:var(--text); }
        .badge { padding: 0.35rem 0.85rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; text-transform:uppercase;}
        .badge.pending, .badge.new { background: #FEF3C7; color: #D97706; }
        .badge.confirmed, .badge.resolved { background: var(--success); color: #065F46; }
        .badge.cancelled { background: var(--danger); color: #9F1239; }
        
        .action-select { padding:0.25rem; border-radius:6px; border:1px solid #ccc; font-size:0.875rem;}
    `;
    document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

    const root = document.getElementById('admin-root');

    const apiFetch = async (url, options = {}) => {
        options.credentials = 'same-origin';
        if (!options.headers) options.headers = {};
        options.headers['X-Admin-Request'] = 'true';
        if (options.body && !(options.body instanceof FormData)) options.headers['Content-Type'] = 'application/json';
        const res = await fetch(url, options);
        if (res.status === 401) return renderLogin();
        return res;
    };

    const renderLogin = () => {
        root.innerHTML = `
            <div class="login-container">
                <div class="clay-panel" style="width:100%; max-width:400px; text-align:center;">
                    <i data-lucide="lock" style="width:48px;height:48px;color:var(--primary);margin-bottom:1rem;"></i>
                    <h2 style="margin-bottom:2rem;">Sparkle Admin Secure Login</h2>
                    <form id="login-form">
                        <input type="email" id="email" class="clay-input" placeholder="Admin Email" required>
                        <input type="password" id="password" class="clay-input" placeholder="Password" required>
                        <button type="submit" class="clay-btn">Login to Dashboard</button>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button'); btn.textContent = 'Verifying...';
            const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value }) });
            if (res.ok) initApp(); else { alert('Invalid credentials'); btn.textContent = 'Login'; }
        };
    };

    const renderLayout = (contentHTML, activeTab) => {
        root.innerHTML = `
            <div class="sidebar">
                <h2><i data-lucide="sparkles"></i> Sparkle Admin</h2>
                <a href="#dashboard" class="${activeTab==='dashboard'?'active':''}"><i data-lucide="layout-dashboard"></i> Dashboard</a>
                <a href="#appointments" class="${activeTab==='appointments'?'active':''}"><i data-lucide="calendar"></i> Appointments</a>
                <a href="#inquiries" class="${activeTab==='inquiries'?'active':''}"><i data-lucide="message-square"></i> Inquiries</a>
                <a href="/" target="_blank" style="margin-top:2rem;"><i data-lucide="external-link"></i> View Website</a>
                <a href="#" id="logout-btn" style="margin-top:auto; color:var(--danger);"><i data-lucide="log-out"></i> Secure Logout</a>
            </div>
            <div class="main-content">${contentHTML}</div>
        `;
        lucide.createIcons();
        document.getElementById('logout-btn').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); renderLogin(); };
    };

    const loadDashboard = async () => {
        renderLayout(`<div class="header"><h1>Dashboard Overview</h1></div><div id="loader">Loading analytics...</div>`, 'dashboard');
        const res = await apiFetch('/api/admin/stats'); const stats = await res.json();
        document.getElementById('loader').outerHTML = `
            <div class="grid-cards">
                <div class="stat-card"><h3>${stats.todayAppts}</h3><p>Today's Visits</p></div>
                <div class="stat-card"><h3>${stats.pending}</h3><p>Pending Bookings</p></div>
                <div class="stat-card"><h3>${stats.newInquiries}</h3><p>Unread Inquiries</p></div>
                <div class="stat-card"><h3>${stats.total}</h3><p>Total Lifetime</p></div>
            </div>
            <div class="clay-panel"><h3>Welcome back to Sparkle Dental Admin</h3><p style="margin-top:1rem; color:#6b7280;">Use the sidebar to manage your daily operations. All data is live and secured.</p></div>
        `;
    };

    const loadAppointments = async () => {
        renderLayout(`<div class="header"><h1>Manage Appointments</h1></div><div id="loader">Loading records...</div>`, 'appointments');
        const res = await apiFetch('/api/admin/appointments'); const appointments = await res.json();
        if (appointments.length === 0) return document.getElementById('loader').outerHTML = `<div class="clay-panel" style="text-align:center;">No appointments found.</div>`;

        const rows = appointments.map(appt => `
            <tr>
                <td><strong>${appt.reference}</strong><br><small>${new Date(appt.createdAt).toLocaleDateString()}</small></td>
                <td><strong>${appt.patientName}</strong><br>${appt.phone}</td>
                <td>${appt.serviceId?.name || 'N/A'}<br><small>${appt.dentistId?.name || 'N/A'}</small></td>
                <td><strong>${appt.date}</strong><br>${appt.startTime}</td>
                <td><span class="badge ${appt.status}">${appt.status}</span></td>
                <td>
                    <select class="action-select" onchange="updateApptStatus('${appt._id}', this.value)">
                        <option value="">Update...</option>
                        <option value="confirmed">Confirm</option>
                        <option value="cancelled">Cancel</option>
                        <option value="completed">Complete</option>
                    </select>
                </td>
            </tr>
        `).join('');
        document.getElementById('loader').outerHTML = `<table><thead><tr><th>Ref & Date</th><th>Patient</th><th>Service & Dr</th><th>Schedule</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    const loadInquiries = async () => {
        renderLayout(`<div class="header"><h1>Patient Inquiries</h1></div><div id="loader">Loading messages...</div>`, 'inquiries');
        const res = await apiFetch('/api/admin/inquiries'); const inqs = await res.json();
        if (inqs.length === 0) return document.getElementById('loader').outerHTML = `<div class="clay-panel" style="text-align:center;">No inquiries found.</div>`;

        const rows = inqs.map(i => `
            <tr>
                <td><strong>${i.name}</strong><br><small>${i.phone}</small></td>
                <td>${i.category}</td>
                <td style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${i.message}">${i.message}</td>
                <td><span class="badge ${i.status}">${i.status}</span></td>
                <td>
                    <select class="action-select" onchange="updateInqStatus('${i._id}', this.value)">
                        <option value="">Update...</option>
                        <option value="resolved">Mark Resolved</option>
                    </select>
                </td>
            </tr>
        `).join('');
        document.getElementById('loader').outerHTML = `<table><thead><tr><th>Contact</th><th>Category</th><th>Message</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
    };

    window.updateApptStatus = async (id, status) => {
        if(!status || !confirm(`Update status to ${status}?`)) return loadAppointments();
        await apiFetch(`/api/admin/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        loadAppointments();
    };

    window.updateInqStatus = async (id, status) => {
        if(!status || !confirm(`Mark inquiry as ${status}?`)) return loadInquiries();
        await apiFetch(`/api/admin/inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        loadInquiries();
    };

    const route = () => {
        const hash = window.location.hash.substring(1) || 'dashboard';
        if (hash === 'appointments') loadAppointments();
        else if (hash === 'inquiries') loadInquiries();
        else loadDashboard();
    };
    window.addEventListener('hashchange', route);

    const initApp = async () => {
        const res = await apiFetch('/api/admin/me');
        if (res.ok) route(); else renderLogin();
    };
    initApp();
})();
