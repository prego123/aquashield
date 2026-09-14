const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 5001;
const ADMIN_KEY = process.env.ADMIN_KEY || 'aquashield-demo';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'shalu.pragati11@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'AquaShield <onboarding@resend.dev>';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Render-safe starter analytics. Data is kept in memory for the free MVP.
// For a production launch, replace this store with a hosted database.
const visits = [];
const leads = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function visitorId(req){
  const raw = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  return crypto.createHash('sha256').update(raw + '|' + (req.get('user-agent') || '')).digest('hex').slice(0,20);
}

async function sendVisitNotification(visit) {
  if (!resend) {
    console.warn('RESEND_API_KEY is not configured. Visit email skipped.');
    return;
  }

  const source = visit.source || 'direct';
  const campaign = visit.campaign || 'none';
  const referrer = visit.referrer || 'none';

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: [NOTIFY_EMAIL],
    subject: 'AquaShield: New website visitor',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#102333">
        <h2 style="margin-bottom:8px">Someone visited AquaShield</h2>
        <p><strong>Time:</strong> ${new Date(visit.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        <p><strong>Page:</strong> ${escapeHtml(visit.path)}</p>
        <p><strong>Source:</strong> ${escapeHtml(source)}</p>
        <p><strong>Campaign:</strong> ${escapeHtml(campaign)}</p>
        <p><strong>Referrer:</strong> ${escapeHtml(referrer)}</p>
        <p style="color:#627486;font-size:12px">This is an automated AquaShield visitor notification.</p>
      </div>
    `
  });

  if (error) {
    console.error('Visitor email failed:', error);
    return;
  }

  console.log('Visitor email sent:', data?.id || 'ok');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.post('/api/track', (req,res)=>{
  const { path: page='/', source='direct', campaign='', referrer='' } = req.body || {};
  const visit = {
    visitor_id: visitorId(req),
    path: page,
    source: source || 'direct',
    campaign,
    referrer,
    created_at: new Date().toISOString()
  };

  visits.push(visit);

  // Do not delay the visitor response while the email is being sent.
  sendVisitNotification(visit).catch((err) => {
    console.error('Unexpected visitor email error:', err);
  });

  res.json({ok:true});
});

app.post('/api/waitlist', (req,res)=>{
  const email = String(req.body?.email || '').trim().toLowerCase();
  const referralCode = String(req.body?.referralCode || '').trim();
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ok:false,error:'Enter a valid email.'});
  if(!leads.has(email)) leads.set(email, { email, referral_code: referralCode, created_at: new Date().toISOString() });
  res.json({ok:true, existing: leads.has(email)});
});

app.get('/api/stats', (req,res)=>{
  if((req.query.key || '') !== ADMIN_KEY) return res.status(401).json({error:'Unauthorized'});
  const day = new Date().toISOString().slice(0,10);
  const total = visits.length;
  const unique = new Set(visits.map(v => v.visitor_id)).size;
  const today = visits.filter(v => v.created_at.slice(0,10) === day).length;
  const sourceMap = {};
  const pageMap = {};
  for (const v of visits) {
    sourceMap[v.source || 'direct'] = (sourceMap[v.source || 'direct'] || 0) + 1;
    pageMap[v.path] = (pageMap[v.path] || 0) + 1;
  }
  const sources = Object.entries(sourceMap).map(([source, count]) => ({source, visits: count})).sort((a,b)=>b.visits-a.visits).slice(0,8);
  const pages = Object.entries(pageMap).map(([path, count]) => ({path, visits: count})).sort((a,b)=>b.visits-a.visits).slice(0,8);
  res.json({total, unique, today, leads: leads.size, sources, pages, recent: visits.slice(-20).reverse()});
});

app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.listen(PORT,()=>console.log(`AquaShield running on port ${PORT}`));
