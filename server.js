require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();

// --- VERCEL ROUTING FIX ---
app.use((req, res, next) => {
    if (req.query.vpath !== undefined) {
        req.url = '/' + req.query.vpath;
        delete req.query.vpath;
    } else if (req.url === '/server.js') {
        req.url = req.headers['x-invoke-path'] || '/';
    }
    next();
});
// ---------------------------

// --- PLATFORM & SECURITY MIDDLEWARE ---
app.set('view engine', 'ejs');
app.set('views', __dirname);
app.use(helmet({ contentSecurityPolicy: false })); 
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());

// Rate Limiter
const rateLimitMap = new Map();
const rateLimiter = (limit, windowMs) => (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const requests = (rateLimitMap.get(ip) || []).filter(ts => ts > now - windowMs);
    if (requests.length >= limit) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    requests.push(now);
    rateLimitMap.set(ip, requests);
    next();
};

const requireAdminCSRF = (req, res, next) => {
    if (req.method !== 'GET' && req.headers['x-admin-request'] !== 'true') return res.status(403).json({ error: 'Missing CSRF.' });
    next();
};

// --- MONGODB CONNECTION ---
let cachedDb = null;
const connectDB = async () => {
    if (cachedDb && mongoose.connection.readyState === 1) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || 'sparkledental', maxPoolSize: 10 });
        cachedDb = true;
        console.log('MongoDB Connected successfully.');
    } catch (error) { console.error('MongoDB Connection Error:', error); throw error; }
};

// --- MONGODB MODELS ---
const ServiceSchema = new mongoose.Schema({
    name: { type: String, required: true }, slug: { type: String, required: true, unique: true },
    description: String, price: { type: Number, required: true }, duration: { type: Number, default: 30 },
    icon: String, isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Service = mongoose.models.Service || mongoose.model('Service', ServiceSchema);

const DentistSchema = new mongoose.Schema({
    name: { type: String, required: true }, slug: { type: String, required: true, unique: true },
    specialty: String, bio: String, imageUrl: String, isActive: { type: Boolean, default: true },
    workingHours: { start: { type: String, default: '10:00' }, end: { type: String, default: '20:00' } }
}, { timestamps: true });
const Dentist = mongoose.models.Dentist || mongoose.model('Dentist', DentistSchema);

const AppointmentSchema = new mongoose.Schema({
    reference: { type: String, unique: true, required: true },
    patientName: { type: String, required: true }, phone: { type: String, required: true }, email: { type: String, required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    dentistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dentist', required: true },
    date: { type: String, required: true }, startTime: { type: String, required: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    patientNotes: String, adminNotes: String
}, { timestamps: true });
AppointmentSchema.index({ dentistId: 1, date: 1, startTime: 1, status: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } });
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);

const InquirySchema = new mongoose.Schema({
    reference: { type: String, unique: true }, name: String, email: String, phone: String, 
    category: String, message: String, status: { type: String, default: 'new' }
}, { timestamps: true });
const Inquiry = mongoose.models.Inquiry || mongoose.model('Inquiry', InquirySchema);

const AdminSchema = new mongoose.Schema({ email: { type: String, unique: true, required: true }, passwordHash: { type: String, required: true }, role: { type: String, default: 'admin' } }, { timestamps: true });
const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

// --- SEED DATA ---
const initializeData = async () => {
    try {
        if (await Admin.countDocuments() === 0) {
            const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
            await Admin.create({ email: process.env.ADMIN_EMAIL || 'admin@sparkledental.in', passwordHash: hash });
        }
        if (await Service.countDocuments() === 0) {
            await Service.insertMany([
                { name: 'Dental Implants', slug: 'dental-implants', description: 'Permanent and natural-looking tooth replacement solutions.', price: 15000, duration: 60, icon: 'layers' },
                { name: 'General Checkup', slug: 'general-checkup', description: 'Comprehensive oral examination and consultation.', price: 500, duration: 30, icon: 'stethoscope' },
                { name: 'Teeth Cleaning', slug: 'teeth-cleaning', description: 'Professional plaque removal and polishing for oral hygiene.', price: 1000, duration: 45, icon: 'sparkles' },
                { name: 'Root Canal', slug: 'root-canal', description: 'Advanced endodontic treatment to save your natural tooth.', price: 4000, duration: 90, icon: 'activity' }
            ]);
        }
        if (await Dentist.countDocuments() === 0) {
            await Dentist.insertMany([
                { name: 'Dr. Rohit Shah', slug: 'dr-rohit-shah', specialty: 'Implantologist & General Dentist', bio: 'Extremely skilled and professional. Outstanding at making every visit comfortable while educating patients on oral hygiene.', imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&q=80' }
            ]);
        }
    } catch (e) { console.error('Seeding error:', e.message); }
};

app.use(async (req, res, next) => { try { await connectDB(); if(req.path === '/') await initializeData(); next(); } catch (err) { res.status(503).send('Database Error'); } });

// --- PUBLIC VIEW ROUTES (Multi-Page EJS Rendering) ---
const renderPage = async (req, res, page, extraData = {}) => {
    try {
        const services = await Service.find({ isActive: true }).lean();
        const dentists = await Dentist.find({ isActive: true }).lean();
        res.render('index', { page, services, dentists, ...extraData });
    } catch (err) { res.status(500).send('Server Error'); }
};

app.get('/', (req, res) => renderPage(req, res, 'home'));
app.get('/about', (req, res) => renderPage(req, res, 'about'));
app.get('/services', (req, res) => renderPage(req, res, 'services'));
app.get('/dentists', (req, res) => renderPage(req, res, 'dentists'));
app.get('/inquiry', (req, res) => renderPage(req, res, 'inquiry'));
app.get('/contact', (req, res) => renderPage(req, res, 'contact'));
app.get('/book-appointment', (req, res) => renderPage(req, res, 'book'));
app.get('/patient-information', (req, res) => renderPage(req, res, 'patient-info', { query: req.query }));
app.get('/booking-confirmation', (req, res) => renderPage(req, res, 'confirmation', { ref: req.query.ref }));
app.get('/privacy-policy', (req, res) => renderPage(req, res, 'privacy'));
app.get('/terms', (req, res) => renderPage(req, res, 'terms'));

// --- PUBLIC APIs ---
app.get('/api/availability', async (req, res) => {
    try {
        const { date, dentistId } = req.query;
        if (!date || !dentistId) return res.status(400).json({ error: 'Date and dentist required.' });
        
        const targetDate = new Date(date);
        if (targetDate.getDay() === 0) return res.json({ slots: [], message: 'Clinic is closed on Sundays.' }); // Sunday Closed
        if (targetDate < new Date(new Date().setHours(0,0,0,0))) return res.status(400).json({ error: 'Past dates not allowed.' });

        const dentist = await Dentist.findById(dentistId);
        if (!dentist) return res.status(404).json({ error: 'Dentist not found.' });

        let slots = [];
        let current = new Date(`${date}T${dentist.workingHours.start}:00+05:30`);
        const end = new Date(`${date}T${dentist.workingHours.end}:00+05:30`);
        const now = new Date();

        while (current < end) {
            const timeStr = current.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
            if (!(date === now.toISOString().split('T')[0] && current <= now)) slots.push(timeStr);
            current.setMinutes(current.getMinutes() + 30);
        }

        const appointments = await Appointment.find({ dentistId, date, status: { $in: ['pending', 'confirmed'] } });
        const bookedTimes = appointments.map(a => a.startTime);
        slots = slots.filter(s => !bookedTimes.includes(s));

        res.json({ slots });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/appointments', rateLimiter(5, 60000), async (req, res) => {
    try {
        const { serviceId, dentistId, date, startTime, patientName, phone, email, patientNotes } = req.body;
        if (!serviceId || !dentistId || !date || !startTime || !patientName || !phone || !email) return res.status(400).json({ error: 'All fields are required.' });
        
        const reference = 'SPKL-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const appointment = await Appointment.create({ reference, serviceId, dentistId, date, startTime, patientName, phone, email, patientNotes });
        res.status(201).json({ success: true, reference: appointment.reference });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'This time slot was just booked by someone else. Please select another.' });
        res.status(500).json({ error: 'Booking failed.', details: error.message });
    }
});

app.post('/api/inquiries', rateLimiter(3, 60000), async (req, res) => {
    try {
        const reference = 'INQ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await Inquiry.create({ ...req.body, reference });
        res.status(201).json({ success: true, reference });
    } catch (error) { res.status(500).json({ error: 'Submission failed.' }); }
});

// --- ADMIN ROUTES & API ---
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light"><title>Sparkle Dental Admin</title><script src="https://unpkg.com/lucide@latest"></script></head>
        <body style="margin:0; font-family:'Inter', sans-serif; background:#FFFDF8; color:#243047;"><div id="admin-root"></div><script src="/admin.js"></script></body></html>
    `);
});

app.get('/admin.js', (req, res) => { res.type('application/javascript'); res.sendFile(path.join(__dirname, 'admin.js')); });

const authAdmin = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try { req.admin = jwt.verify(token, process.env.SESSION_SECRET || 'fallback-secret-for-demo'); next(); } 
    catch (err) { res.status(401).json({ error: 'Invalid Session' }); }
};

app.post('/api/admin/login', rateLimiter(5, 60000), async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.SESSION_SECRET || 'fallback-secret-for-demo', { expiresIn: '8h' });
        res.cookie('adminToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 3600000 });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

app.post('/api/admin/logout', (req, res) => { res.clearCookie('adminToken'); res.json({ success: true }); });
app.get('/api/admin/me', authAdmin, (req, res) => res.json({ success: true }));

app.get('/api/admin/stats', authAdmin, async (req, res) => {
    try {
        const total = await Appointment.countDocuments();
        const pending = await Appointment.countDocuments({ status: 'pending' });
        const todayAppts = await Appointment.countDocuments({ date: new Date().toISOString().split('T')[0] });
        const newInquiries = await Inquiry.countDocuments({ status: 'new' });
        res.json({ total, pending, todayAppts, newInquiries });
    } catch (error) { res.status(500).json({ error: 'Failed to load stats' }); }
});

app.get('/api/admin/appointments', authAdmin, async (req, res) => {
    try {
        const appointments = await Appointment.find().populate('serviceId dentistId').sort({ date: -1, startTime: 1 }).lean();
        res.json(appointments);
    } catch (error) { res.status(500).json({ error: 'Failed to load appointments' }); }
});

app.patch('/api/admin/appointments/:id', authAdmin, requireAdminCSRF, async (req, res) => {
    try {
        const appt = await Appointment.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
        res.json({ success: true, appointment: appt });
    } catch (error) { res.status(500).json({ error: 'Update failed' }); }
});

app.get('/api/admin/inquiries', authAdmin, async (req, res) => {
    try { res.json(await Inquiry.find().sort({ createdAt: -1 }).lean()); } catch (error) { res.status(500).json({ error: 'Failed to load inquiries' }); }
});
app.patch('/api/admin/inquiries/:id', authAdmin, requireAdminCSRF, async (req, res) => {
    try { await Inquiry.findByIdAndUpdate(req.params.id, { status: req.body.status }); res.json({ success: true }); } catch (error) { res.status(500).json({ error: 'Update failed' }); }
});

if (process.env.NODE_ENV !== 'production' || require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}
module.exports = app;
