require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');
const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const { Api }            = require('telegram');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'tg-secret-key',
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: false, maxAge: 3 * 60 * 60 * 1000 }
}));

const clientStore = new Map();
const API_ID      = parseInt(process.env.API_ID);
const API_HASH    = process.env.API_HASH;

async function getClient(sessionId, sessionString = '') {
  if (clientStore.has(sessionId)) {
    const c = clientStore.get(sessionId);
    if (!c.connected) await c.connect();
    return c;
  }
  const client = new TelegramClient(new StringSession(sessionString), API_ID, API_HASH, {
    connectionRetries: 5,
    useWSS: true,
  });
  await client.connect();
  clientStore.set(sessionId, client);
  return client;
}

function requireLogin(req, res, next) {
  if (!req.session.loggedIn) return res.status(401).json({ error: 'Not logged in' });
  next();
}

// ── Send code ──────────────────────────────
app.post('/api/send-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const client = await getClient(req.session.id);
    const result = await client.sendCode({ apiId: API_ID, apiHash: API_HASH }, phone);
    req.session.phone         = phone;
    req.session.phoneCodeHash = result.phoneCodeHash;
    res.json({ success: true });
  } catch (err) {
    console.error('send-code:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Verify code & login ────────────────────
app.post('/api/verify-code', async (req, res) => {
  const { code, password } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const { phone, phoneCodeHash } = req.session;
  if (!phone || !phoneCodeHash) return res.status(400).json({ error: 'Session expired' });
  try {
    const client = clientStore.get(req.session.id);
    if (!client) return res.status(400).json({ error: 'Client not found' });
    try {
      await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }));
    } catch (err) {
      if (err.message?.includes('SESSION_PASSWORD_NEEDED')) {
        if (!password) return res.json({ needsPassword: true });
        const pwd = await client.invoke(new Api.account.GetPassword());
        const { computeCheck } = require('telegram/Password');
        await client.invoke(new Api.auth.CheckPassword({ password: await computeCheck(pwd, password) }));
      } else throw err;
    }
    req.session.sessionString = client.session.save();
    req.session.loggedIn      = true;
    const me = await client.getMe();
    req.session.userInfo = {
      firstName: me.firstName, lastName:  me.lastName,
      username:  me.username,  phone:     me.phone,
      id:        me.id?.toString(),
    };
    res.json({ success: true, user: req.session.userInfo });
  } catch (err) {
    console.error('verify-code:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ACCOUNT ─────────────────────────
app.post('/api/delete-account', requireLogin, async (req, res) => {
  try {
    const client = clientStore.get(req.session.id);
    if (!client) return res.status(400).json({ error: 'Session expired' });

    await client.invoke(new Api.account.DeleteAccount({
      reason: 'User self-deletion via web client',
    }));

    await client.disconnect();
    clientStore.delete(req.session.id);
    req.session.destroy();

    res.json({ success: true });
  } catch (err) {
    console.error('delete-account:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CANCEL — just log out, keep account ───
app.post('/api/cancel-delete', requireLogin, async (req, res) => {
  const client = clientStore.get(req.session.id);
  if (client) { try { await client.disconnect(); } catch(e) {} clientStore.delete(req.session.id); }
  req.session.destroy();
  res.json({ success: true });
});

// ── Change number ──────────────────────────
app.post('/api/send-new-code', requireLogin, async (req, res) => {
  const { newPhone } = req.body;
  if (!newPhone) return res.status(400).json({ error: 'New phone required' });
  try {
    const client = clientStore.get(req.session.id);
    if (!client) return res.status(400).json({ error: 'Session expired' });
    const result = await client.invoke(new Api.account.SendChangePhoneCode({
      phoneNumber: newPhone,
      settings: new Api.CodeSettings({ allowFlashcall: false, currentNumber: false, allowAppHash: true, allowMissedCall: false, logoutTokens: [] }),
    }));
    req.session.newPhone         = newPhone;
    req.session.newPhoneCodeHash = result.phoneCodeHash;
    res.json({ success: true });
  } catch (err) {
    console.error('send-new-code:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/change-number', requireLogin, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });
  const { newPhone, newPhoneCodeHash } = req.session;
  if (!newPhone || !newPhoneCodeHash) return res.status(400).json({ error: 'Session expired' });
  try {
    const client = clientStore.get(req.session.id);
    if (!client) return res.status(400).json({ error: 'Session expired' });
    await client.invoke(new Api.account.ChangePhone({ phoneNumber: newPhone, phoneCodeHash: newPhoneCodeHash, phoneCode: code }));
    await client.disconnect();
    clientStore.delete(req.session.id);
    const oldPhone = req.session.phone;
    req.session.destroy();
    res.json({ success: true, newPhone, oldPhone });
  } catch (err) {
    console.error('change-number:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Status / logout ────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ loggedIn: !!req.session.loggedIn, user: req.session.userInfo || null });
});

app.post('/api/logout', async (req, res) => {
  const client = clientStore.get(req.session.id);
  if (client) { try { await client.disconnect(); } catch(e) {} clientStore.delete(req.session.id); }
  req.session.destroy();
  res.json({ success: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => {
  console.log(`\n🚀  Telegram Client  →  http://localhost:${PORT}\n`);
  if (!process.env.API_ID || process.env.API_ID === 'your_api_id_here')
    console.warn('⚠️  Add API_ID + API_HASH to .env  →  my.telegram.org\n');
});

process.on('SIGINT', async () => {
  for (const [, c] of clientStore) { try { await c.disconnect(); } catch(e) {} }
  process.exit(0);
});
