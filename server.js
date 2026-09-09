const express = require('express');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 5001;
const ADMIN_KEY = process.env.ADMIN_KEY || 'aquashield-demo';
const db = new Database(path.join(__dirname, 'data', 'aquashield.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,
  path TEXT NOT NULL,
  source TEXT,
  campaign TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT,
  created_at TEXT NOT NULL
);
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function todayUTC(){ return new Date().toISOString().slice(0,10); }
function visitorId(req){
  const raw = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  return crypto.createHash('sha256').update(raw + '|' + (req.get('user-agent') || '')).digest('hex').slice(0,20);
}

app.post('/api/track', (req,res)=>{
  const { path: page='/', source='direct', campaign='', referrer='' } = req.body || {};
  db.prepare('INSERT INTO visits(visitor_id,path,source,campaign,referrer,created_at) VALUES(?,?,?,?,?,?)')
    .run(visitorId(req), page, source, campaign, referrer, new Date().toISOString());
  res.json({ok:true});
});

app.post('/api/waitlist', (req,res)=>{
  const email = String(req.body?.email || '').trim().toLowerCase();
  const referralCode = String(req.body?.referralCode || '').trim();
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ok:false,error:'Enter a valid email.'});
  try {
    db.prepare('INSERT INTO leads(email,referral_code,created_at) VALUES(?,?,?)').run(email, referralCode, new Date().toISOString());
    res.json({ok:true});
  } catch(e){
    if(String(e.message).includes('UNIQUE')) return res.json({ok:true,existing:true});
    res.status(500).json({ok:false,error:'Could not join the waitlist.'});
  }
});

app.get('/api/stats', (req,res)=>{
  if((req.query.key || '') !== ADMIN_KEY) return res.status(401).json({error:'Unauthorized'});
  const total = db.prepare('SELECT COUNT(*) c FROM visits').get().c;
  const unique = db.prepare('SELECT COUNT(DISTINCT visitor_id) c FROM visits').get().c;
  const today = db.prepare('SELECT COUNT(*) c FROM visits WHERE substr(created_at,1,10)=?').get(todayUTC()).c;
  const leads = db.prepare('SELECT COUNT(*) c FROM leads').get().c;
  const sources = db.prepare(`SELECT COALESCE(NULLIF(source,''),'direct') source, COUNT(*) visits FROM visits GROUP BY source ORDER BY visits DESC LIMIT 8`).all();
  const pages = db.prepare(`SELECT path, COUNT(*) visits FROM visits GROUP BY path ORDER BY visits DESC LIMIT 8`).all();
  const recent = db.prepare(`SELECT created_at,path,source,campaign FROM visits ORDER BY id DESC LIMIT 20`).all();
  res.json({total,unique,today,leads,sources,pages,recent});
});

app.get('/admin', (req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.listen(PORT,()=>console.log(`AquaShield running on http://localhost:${PORT}`));
