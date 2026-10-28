(function() {
    const styles = `
        :root { 
            --primary: #A78BFA; 
            --primary-dark: #8B5CF6;
            --bg: #F3F4F6;
            --text: #1F2937; 
            --surface: #FFFFFF; 
            --danger: #EF4444; 
            --success: #10B981; 
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); 
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        
        /* 🚀 FIX: Isne hi layout theek kiya hai taaki cheezein side-by-side aayen */
        body { background: var(--bg); color: var(--text); overflow: hidden; }
        #admin-root { display: flex; width: 100%; height: 100vh; }
        
        .login-container { display: flex; justify-content: center; align-items: center; height: 100vh; width: 100%; background:var(--bg); }
        .clay-panel { background: var(--surface); border-radius: 16px; box-shadow: var(--shadow); padding: 2.5rem; }
        
        .clay-input, .clay-select { width: 100%; padding: 0.875rem 1rem; border-radius: 8px; border: 1px solid #D1D5DB; background: var(--surface); margin-bottom: 1.25rem; font-size:1rem;}
        .clay-input:focus { outline: 2px solid var(--primary); border-color:transparent;}
        
        .clay-btn { background: var(--primary); color: white; border: none; padding: 0.875rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%; transition: 0.2s; font-size:1rem;}
        .clay-btn:hover { background: var(--primary-dark); }
        
        .sidebar { width: 280px; min-width: 280px; background: var(--surface); padding: 2rem; border-right: 1px solid #E5E7EB; display:flex; flex-direction:column; height: 100vh;}
        .sidebar h2 { color: var(--text); margin-bottom: 2.5rem; font-size: 1.25rem; display: flex; align-items: center; gap: 0.75rem; font-weight:700;}
        .sidebar a { display: flex; align-items:center; gap:0.75rem; padding: 0.875rem 1rem; color: #4B5563; text-decoration: none; border-radius: 8px; margin-bottom: 0.5rem; font-weight: 500; transition: 0.2s;}
        .sidebar a:hover { background: #F3F4F6; color: var(--text); }
        .sidebar a.active { background: #EEF2FF; color: var(--primary-dark); font-weight:600;}
        
        .main-content { flex: 1; padding: 3rem; overflow-y: auto; height: 100vh;}
        .header { margin-bottom: 2.5rem; }
        .header h1 { font-size: 1.875rem; font-weight:700; color:var(--text); }
        
        .grid-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
        .stat-card { background: var(--surface); padding: 1.5rem; border-radius: 12px; box-shadow: var(--shadow); border:1px solid #E5E7EB; display:flex; flex-direction:column; justify-content:center;}
        .stat-card h3 { font-size: 2.25rem; color: var(--primary-dark); margin-bottom: 0.25rem; font-weight:800;}
        .stat-card p { color:#6B7280; font-size:0.875rem; font-weight:500;}
        
        .table-container { background:var(--surface); border-radius:12px; box-shadow:var(--shadow); border:1px solid #E5E7EB; overflow:hidden;}
        table { width: 100%; border-collapse: collapse; text-align:left;}
        th, td { padding: 1rem 1.5rem; border-bottom: 1px solid #E5E7EB; }
        th { background: #F9FAFB; font-weight: 600; color:#4B5563; font-size:0.875rem; text-transform:uppercase; letter-spacing:0.05em;}
        td { font-size:0.95rem; color:var(--text);}
        td small { color:#6B7280;}
        
        .badge { padding: 0.25rem 0.75rem; border-radius: 99px; font-size: 0.75rem; font-weight: 700; text-transform:uppercase; display:inline-block;}
        .badge.pending, .badge.new { background: #FEF3C7; color: #D97706; }
        .badge.confirmed, .badge.resolved { background: #D1FAE5; color: #065F46; }
        .badge.cancelled { background: #FEE2E2; color: #9F1239; }
        .badge.completed { background: #DBEAFE; color: #1E40AF; }
        
        .action-select { padding:0.4rem; border-radius:6px; border:1px solid #D1D5DB; font-size:0.875rem; background:#fff; cursor:pointer;}
        .action-select:focus { outline:none; border-color:var(--primary);}
    `;
    document.head.insertAdjacentHTML('beforeend', `<style>${styles}</style>`);

    const root = document.getElementById('admin-root');

    const apiFetch = async (url, options = {}) => {
        options.credentials = 'same-origin';
        if (!options.headers) options.headers = {};
        options.headers['X-Admin-Request'] = 'true';
        if (options.body && !(options.body instanceof FormData)) options.headers['Content-Type'] = 'application/json';
        const res = await fetch(url, options);
        if (res.status === 401) {
            renderLogin();
            throw new Error('Unauthorized'); // Extra security & crash prevention
        }
        return res;
    };

    const renderLogin = () => {
        root.innerHTML = `
            <div class="login-container">
                <div class="clay-panel" style="width:100%; max-width:400px; text-align:center;">
                    <i data-lucide="shield-check" style="width:56px;height:56px;color:var(--primary);margin-bottom:1rem;"></i>
                    <h2 style="margin-bottom:2rem; font-weight:700;">Sparkle Admin Login</h2>
                    <form id="login-form">
                        <input type="email" id="email" class="clay-input" placeholder="Admin Email" required>
                        <input type="password" id="password" class="clay-input" placeholder="Password" required>
                        <button type="submit" class="clay-btn">Access Dashboard</button>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button'); btn.textContent = 'Verifying...';
            const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value }) });
            if (res.ok) initApp(); else { alert('Invalid credentials'); btn.textContent = 'Access Dashboard'; }
        };
    };

    const renderLayout = (contentHTML, activeTab) => {
        root.innerHTML = `
            <div class="sidebar">
                <h2><i data-lucide="sparkles" style="color:var(--primary)"></i> Sparkle Admin</h2>
                <a href="#dashboard" class="${activeTab==='dashboard'?'active':''}"><i data-lucide="layout-dashboard" style="width:20px;"></i> Dashboard</a>
                <a href="#appointments" class="${activeTab==='appointments'?'active':''}"><i data-lucide="calendar" style="width:20px;"></i> Appointments</a>
                <a href="#inquiries" class="${activeTab==='inquiries'?'active':''}"><i data-lucide="message-square" style="width:20px;"></i> Inquiries</a>
                
                <div style="margin-top:auto; padding-top:2rem; border-top:1px solid #E5E7EB;">
                    <a href="/" target="_blank"><i data-lucide="external-link" style="width:20px;"></i> View Live Site</a>
                    <a href="#" id="logout-btn" style="color:var(--danger);"><i data-lucide="log-out" style="width:20px;"></i> Logout</a>
                </div>
            </div>
            <div class="main-content">${contentHTML}</div>
        `;
        lucide.createIcons();
        document.getElementById('logout-btn').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); renderLogin(); };
    };

    const loadDashboard = async () => {
        renderLayout(`<div class="header"><h1>Dashboard Overview</h1></div><div id="loader">Loading analytics...</div>`, 'dashboard');
        try {
            const res = await apiFetch('/api/admin/stats'); const stats = await res.json();
            document.getElementById('loader').outerHTML = `
                <div class="grid-cards">
                    <div class="stat-card"><h3>${stats.todayAppts}</h3><p>Today's Visits</p></div>
                    <div class="stat-card"><h3>${stats.pending}</h3><p>Pending Bookings</p></div>
                    <div class="stat-card"><h3>${stats.newInquiries}</h3><p>Unread Inquiries</p></div>
                    <div class="stat-card"><h3>${stats.total}</h3><p>Lifetime Appointments</p></div>
                </div>
                <div class="clay-panel" style="margin-top: 1rem;">
                    <h3 style="margin-bottom:0.5rem; font-weight:700;">Welcome to Sparkle Dental Admin</h3>
                    <p style="color:#4B5563; font-size:0.95rem;">Select 'Appointments' or 'Inquiries' from the left menu to manage your patient flow and respond to new requests.</p>
                </div>
            `;
        } catch(e) { document.getElementById('loader').innerHTML = 'Error loading stats.'; }
    };

    const loadAppointments = async () => {
        renderLayout(`<div class="header"><h1>Manage Appointments</h1></div><div id="loader">Loading records...</div>`, 'appointments');
        try {
            const res = await apiFetch('/api/admin/appointments'); const appointments = await res.json();
            if (appointments.length === 0) return document.getElementById('loader').outerHTML = `<div class="clay-panel" style="text-align:center; color:#6B7280;">No appointments found in the system.</div>`;

            const rows = appointments.map(appt => `
                <tr>
                    <td><strong>${appt.reference}</strong><br><small>Booked: ${new Date(appt.createdAt).toLocaleDateString()}</small></td>
                    <td><strong>${appt.patientName}</strong><br><small>${appt.phone}</small></td>
                    <td>${appt.serviceId?.name || 'N/A'}<br><small>${appt.dentistId?.name || 'N/A'}</small></td>
                    <td><strong>${appt.date}</strong><br><small>${appt.startTime}</small></td>
                    <td><span class="badge ${appt.status}">${appt.status}</span></td>
                    <td>
                        <select class="action-select" onchange="updateApptStatus('${appt._id}', this.value)">
                            <option value="">Actions...</option>
                            <option value="confirmed">Confirm</option>
                            <option value="cancelled">Cancel</option>
                            <option value="completed">Mark Complete</option>
                        </select>
                    </td>
                </tr>
            `).join('');
            document.getElementById('loader').outerHTML = `<div class="table-container"><table><thead><tr><th>Ref ID</th><th>Patient Details</th><th>Treatment / Dr.</th><th>Schedule</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        } catch(e) { document.getElementById('loader').innerHTML = 'Error loading appointments.'; }
    };

    const loadInquiries = async () => {
        renderLayout(`<div class="header"><h1>Patient Inquiries</h1></div><div id="loader">Loading messages...</div>`, 'inquiries');
        try {
            const res = await apiFetch('/api/admin/inquiries'); const inqs = await res.json();
            if (inqs.length === 0) return document.getElementById('loader').outerHTML = `<div class="clay-panel" style="text-align:center; color:#6B7280;">No pending inquiries found.</div>`;

            const rows = inqs.map(i => `
                <tr>
                    <td><strong>${i.name}</strong><br><small>${i.phone}</small></td>
                    <td><span style="font-weight:500;">${i.category}</span></td>
                    <td style="max-width:350px; line-height:1.4;">${i.message}</td>
                    <td><span class="badge ${i.status}">${i.status}</span></td>
                    <td>
                        <select class="action-select" onchange="updateInqStatus('${i._id}', this.value)">
                            <option value="">Actions...</option>
                            <option value="resolved">Mark Resolved</option>
                            <option value="new">Mark Unread</option>
                        </select>
                    </td>
                </tr>
            `).join('');
            document.getElementById('loader').outerHTML = `<div class="table-container"><table><thead><tr><th>Contact Info</th><th>Topic</th><th>Message Details</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        } catch(e) { document.getElementById('loader').innerHTML = 'Error loading inquiries.'; }
    };

    window.updateApptStatus = async (id, status) => {
        if(!status || !confirm(`Are you sure you want to update this appointment to: ${status.toUpperCase()}?`)) return loadAppointments();
        await apiFetch(`/api/admin/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
        loadAppointments();
    };

    window.updateInqStatus = async (id, status) => {
        if(!status || !confirm(`Mark this inquiry as ${status.toUpperCase()}?`)) return loadInquiries();
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
