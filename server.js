require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();

// --- PLATFORM & SECURITY MIDDLEWARE ---
app.set('view engine', 'ejs');
app.set('views', __dirname);
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled for inline scripts/styles in this demo
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(cookieParser());

// Lightweight IP-based Rate Limiter (Memory bound per lambda instance)
const rateLimitMap = new Map();
const rateLimiter = (limit, windowMs) => (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    const requests = (rateLimitMap.get(ip) || []).filter(timestamp => timestamp > windowStart);
    if (requests.length >= limit) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    requests.push(now);
    rateLimitMap.set(ip, requests);
    next();
};

// CSRF Protection for Admin API
const requireAdminCSRF = (req, res, next) => {
    if (req.method !== 'GET' && req.headers['x-admin-request'] !== 'true') {
        return res.status(403).json({ error: 'Missing CSRF validation header.' });
    }
    next();
};

// --- DATABASE CONNECTION (Serverless Optimized) ---
let cachedDb = null;
const connectDB = async () => {
    if (cachedDb && mongoose.connection.readyState === 1) return;
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI is not defined.');
        const dbName = process.env.MONGODB_DB_NAME || 'lumasmile';
        await mongoose.connect(uri, { dbName, maxPoolSize: 10 });
        cachedDb = true;
        console.log('MongoDB Connected successfully.');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        throw error;
    }
};

// --- MONGOOSE MODELS ---
const ServiceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    price: { type: Number, required: true }, // Stored as integer (INR)
    duration: { type: Number, default: 30 }, // minutes
    icon: String,
    isActive: { type: Boolean, default: true }
}, { timestamps: true });
const Service = mongoose.models.Service || mongoose.model('Service', ServiceSchema);

const DentistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    specialty: String,
    bio: String,
    imageUrl: String,
    isActive: { type: Boolean, default: true },
    workingHours: { start: { type: String, default: '09:00' }, end: { type: String, default: '19:00' } }
}, { timestamps: true });
const Dentist = mongoose.models.Dentist || mongoose.model('Dentist', DentistSchema);

const AppointmentSchema = new mongoose.Schema({
    reference: { type: String, unique: true, required: true },
    patientName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    dentistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dentist', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' },
    patientNotes: String,
    adminNotes: String
}, { timestamps: true });
// Unique constraint prevents double-booking at the database level atomically
AppointmentSchema.index({ dentistId: 1, date: 1, startTime: 1, status: 1 }, { 
    unique: true, 
    partialFilterExpression: { status: { $in: ['pending', 'confirmed'] } } 
});
const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);

const AdminSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'admin' }
}, { timestamps: true });
const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);

const ContactSchema = new mongoose.Schema({
    name: String, email: String, phone: String, message: String, status: { type: String, default: 'unread' }
}, { timestamps: true });
const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

// --- SAMPLE DATA INITIALIZATION ---
const initializeData = async () => {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
            await Admin.create({ email: process.env.ADMIN_EMAIL || 'admin@lumasmile.example', passwordHash: hash });
        }
        
        if (await Service.countDocuments() === 0) {
            await Service.insertMany([
                { name: 'General Checkup', description: 'Comprehensive oral examination.', price: 499, duration: 30, icon: 'stethoscope' },
                { name: 'Teeth Cleaning', description: 'Professional plaque removal.', price: 999, duration: 45, icon: 'sparkles' },
                { name: 'Teeth Whitening', description: 'Brighten your smile safely.', price: 2499, duration: 60, icon: 'smile' },
                { name: 'Root Canal', description: 'Advanced endodontic treatment.', price: 3999, duration: 90, icon: 'activity' }
            ]);
        }

        if (await Dentist.countDocuments() === 0) {
            await Dentist.insertMany([
                { name: 'Dr. Aanya Sharma', specialty: 'General Dentistry', bio: 'BDS, MDS. 10+ years creating perfect smiles.', imageUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&q=80' },
                { name: 'Dr. Rohan Mehta', specialty: 'Orthodontics', bio: 'Expert in braces and aligners.', imageUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&q=80' },
                { name: 'Dr. Priya Verma', specialty: 'Pediatric Dentistry', bio: 'Gentle care for our youngest patients.', imageUrl: 'https://images.unsplash.com/photo-1594824432258-208b06c64147?w=500&q=80' }
            ]);
        }
    } catch (e) { console.error('Seeding error:', e); }
};

// Database Connection Middleware
app.use(async (req, res, next) => {
    try { await connectDB(); if(req.path === '/') await initializeData(); next(); } 
    catch (err) { res.status(503).send('Service Unavailable: Database Connection Failed.'); }
});

// --- PUBLIC ROUTES & VIEWS ---
app.get('/', async (req, res) => {
    try {
        const services = await Service.find({ isActive: true }).lean();
        const dentists = await Dentist.find({ isActive: true }).lean();
        res.render('index', { services, dentists });
    } catch (error) { res.status(500).send('Error loading page.'); }
});

app.get('/api/availability', async (req, res) => {
    try {
        const { date, dentistId } = req.query;
        if (!date || !dentistId) return res.status(400).json({ error: 'Date and dentist required.' });
        
        const dentist = await Dentist.findById(dentistId);
        if (!dentist) return res.status(404).json({ error: 'Dentist not found.' });

        // Generate slots
        let slots = [];
        let current = new Date(`${date}T${dentist.workingHours.start}:00`);
        const end = new Date(`${date}T${dentist.workingHours.end}:00`);
        const now = new Date();

        while (current < end) {
            const timeStr = current.toTimeString().substring(0, 5);
            // Block past times if today
            if (date === now.toISOString().split('T')[0] && current <= now) {
                current.setMinutes(current.getMinutes() + 30);
                continue;
            }
            slots.push(timeStr);
            current.setMinutes(current.getMinutes() + 30);
        }

        // Remove booked slots
        const appointments = await Appointment.find({ dentistId, date, status: { $in: ['pending', 'confirmed'] } });
        const bookedTimes = appointments.map(a => a.startTime);
        slots = slots.filter(s => !bookedTimes.includes(s));

        res.json({ slots });
    } catch (error) { res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/appointments', rateLimiter(5, 60000), async (req, res) => {
    try {
        const { serviceId, dentistId, date, startTime, patientName, phone, email, patientNotes } = req.body;
        // Basic validation
        if (!serviceId || !dentistId || !date || !startTime || !patientName || !phone || !email) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        
        // Prevent past dates
        const apptDate = new Date(`${date}T${startTime}:00`);
        if (apptDate < new Date()) return res.status(400).json({ error: 'Cannot book in the past.' });

        const reference = 'LUMA-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Creation handles concurrency via Mongoose unique index catching duplicate times
        const appointment = await Appointment.create({
            reference, serviceId, dentistId, date, startTime, patientName, phone, email, patientNotes
        });

        res.status(201).json({ success: true, reference: appointment.reference });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ error: 'Time slot is already booked. Please refresh.' });
        res.status(500).json({ error: 'Booking failed.', details: error.message });
    }
});

app.post('/api/appointments/cancel', rateLimiter(5, 60000), async (req, res) => {
    try {
        const { reference, email } = req.body;
        const appt = await Appointment.findOne({ reference, email });
        if (!appt) return res.status(404).json({ error: 'Appointment not found or credentials mismatch.' });
        if (appt.status === 'cancelled' || appt.status === 'completed') return res.status(400).json({ error: `Cannot cancel a ${appt.status} appointment.` });
        
        appt.status = 'cancelled';
        await appt.save();
        res.json({ success: true, message: 'Appointment cancelled successfully.' });
    } catch (error) { res.status(500).json({ error: 'Cancellation failed.' }); }
});

app.post('/api/contact', rateLimiter(3, 60000), async (req, res) => {
    try {
        await Contact.create(req.body);
        res.status(201).json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Submission failed.' }); }
});


// --- ADMIN ROUTES & API ---
app.get('/admin', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LumaSmile Admin Dashboard</title>
            <script src="https://unpkg.com/lucide@latest"></script>
        </head>
        <body style="margin:0; font-family:'Inter', sans-serif; background:#FFFDF8; color:#243047;">
            <div id="admin-root"></div>
            <script src="/admin.js"></script>
        </body>
        </html>
    `);
});

// Explicitly serve admin.js 
app.get('/admin.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'admin.js'));
});

// Admin Auth Middleware
const authAdmin = (req, res, next) => {
    const token = req.cookies.adminToken;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.admin = jwt.verify(token, process.env.SESSION_SECRET || 'fallback-secret-for-demo');
        next();
    } catch (err) { res.status(401).json({ error: 'Invalid Session' }); }
};

app.post('/api/admin/login', rateLimiter(5, 60000), async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.SESSION_SECRET || 'fallback-secret-for-demo', { expiresIn: '8h' });
        res.cookie('adminToken', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 3600000 });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: 'Login failed' }); }
});

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true });
});

app.get('/api/admin/me', authAdmin, (req, res) => res.json({ success: true }));

app.get('/api/admin/stats', authAdmin, async (req, res) => {
    try {
        const total = await Appointment.countDocuments();
        const pending = await Appointment.countDocuments({ status: 'pending' });
        const confirmed = await Appointment.countDocuments({ status: 'confirmed' });
        const todayStr = new Date().toISOString().split('T')[0];
        const todayAppts = await Appointment.countDocuments({ date: todayStr });
        res.json({ total, pending, confirmed, todayAppts });
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
        const { status } = req.body;
        const appt = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true });
        res.json({ success: true, appointment: appt });
    } catch (error) { res.status(500).json({ error: 'Update failed' }); }
});

// Start Server locally (Ignored by Vercel standard export)
if (process.env.NODE_ENV !== 'production' || require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app; // For Vercel Serverless Functions
