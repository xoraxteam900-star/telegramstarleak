# 📱 Telegram Phone Number Changer

A full-stack web app to change your Telegram account's phone number using GramJS (the official Telegram client library for Node.js).

---

## 📋 Prerequisites

- **Node.js** v16 or higher
- **npm** v8 or higher
- A Telegram account
- Telegram API credentials (free — takes 2 minutes)

---

## 🔑 Step 1 — Get your Telegram API Credentials

1. Go to **https://my.telegram.org**
2. Log in with your Telegram phone number
3. Click **"API development tools"**
4. Fill in any app name (e.g. "MyApp") and short name (e.g. "myapp")
5. Click **"Create application"**
6. Copy your **`api_id`** and **`api_hash`**

---

## 🚀 Step 2 — Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Edit the .env file
nano .env
# or open it in any text editor

# 3. Fill in your credentials in .env:
#    API_ID=123456
#    API_HASH=abcdef1234567890abcdef1234567890
#    SESSION_SECRET=any_random_string_here

# 4. Start the server
npm start

# Or for development with auto-restart:
npm run dev
```

5. Open **http://localhost:3000** in your browser

---

## 🎯 How to Use

### The app walks you through 4 steps:

**Step 1 — Login**
- Enter your current Telegram phone number (with country code, e.g. `+1234567890`)
- Click "Send Verification Code"

**Step 2 — Verify**
- Open your Telegram app — you'll get a message with a 5-digit code
- Enter the 5 digits
- If you have Two-Factor Authentication enabled, enter your 2FA password too

**Step 3 — New Number**
- Enter the new phone number you want to switch to
- Make sure this number is NOT already registered on Telegram
- Click "Send Code to New Number"

**Step 4 — Confirm**
- You'll receive an SMS on the new number with a code
- Enter the code to confirm the change

✅ Done! Your Telegram account is now linked to the new number.

---

## 🔒 Security Notes

- Your login session is stored only in memory on your server (not in a database)
- Sessions expire after 30 minutes of inactivity
- No data is sent to any third party — everything goes directly to Telegram's servers
- The session string is never exposed to the browser

---

## 📁 Project Structure

```
tg-number-changer/
├── src/
│   └── server.js        ← Express + GramJS backend
├── public/
│   └── index.html       ← Full frontend UI
├── .env                 ← Your API credentials (never commit this!)
├── package.json
└── README.md
```

---

## 🛠 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/send-code` | Send OTP to current number |
| POST | `/api/verify-code` | Verify OTP & log in |
| POST | `/api/send-new-code` | Send OTP to new number |
| POST | `/api/change-number` | Confirm & change number |
| GET  | `/api/status` | Check session status |
| POST | `/api/logout` | Log out & clear session |

---

## ⚠️ Troubleshooting

**"API_ID not set" warning**
→ Edit `.env` and add your credentials from my.telegram.org

**"PHONE_NUMBER_INVALID"**
→ Make sure you include the country code (e.g. `+1` for US)

**"PHONE_CODE_INVALID"**
→ The code expires quickly — try again and enter it faster

**"PHONE_NUMBER_OCCUPIED"**
→ The new number is already registered on Telegram. Use a different number.

**Network error in browser**
→ Make sure the server is running (`npm start`) and you're visiting `http://localhost:3000`

---

## 📦 Dependencies

- **express** — Web server
- **telegram** (GramJS) — Official Telegram client library
- **express-session** — Session management
- **dotenv** — Environment variable loading
- **cors** — Cross-origin support
