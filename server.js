const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5001;
const ADMIN_KEY = process.env.ADMIN_KEY || 'aquashield-demo';

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

app.post('/api/track', (req,res)=>{
  const { path: page='/', source='direct', campaign='', referrer='' } = req.body || {};
  visits.push({
    visitor_id: visitorId(req),
    path: page,
    source: source || 'direct',
    campaign,
    referrer,
    created_at: new Date().toISOString()
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
