# 📱 WhatsApp Acceptance Configuration Guide

## Step-by-Step Setup

### Step 1: Install ngrok (if not installed)

**Option A: Download directly**
1. Go to: https://ngrok.com/download
2. Download the Windows version
3. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok\`)
4. Add that folder to your PATH, OR run it from that folder

**Option B: Using Chocolatey (if you have it)**
```powershell
choco install ngrok
```

**Option C: Using Scoop (if you have it)**
```powershell
scoop install ngrok
```

---

### Step 2: Start Your Server

Make sure your server is running:
```powershell
cd "c:\Users\Brian\Desktop\DISPATCH ENGINE"
node index.js
```

You should see: `Server listening on http://localhost:3000`

---

### Step 3: Start ngrok

Open a **NEW terminal window** and run:
```powershell
ngrok http 3000
```

You'll see output like:
```
Forwarding   https://abc123def456.ngrok.io -> http://localhost:3000
```

**📋 Copy the HTTPS URL** (the one starting with `https://`)

---

### Step 4: Configure Twilio Webhook

1. **Go to Twilio Console:**
   - Visit: https://console.twilio.com/us1/develop/sms/sandbox
   - Or navigate: Twilio Console → Messaging → Try it out → Send a WhatsApp message

2. **Find the Webhook Configuration:**
   - Look for "When a message comes in" section
   - Or "A message comes in" webhook URL field

3. **Set the Webhook URL:**
   - URL: `https://YOUR-NGROK-URL.ngrok.io/webhooks/twilio/sms-incoming`
   - Replace `YOUR-NGROK-URL` with your actual ngrok URL
   - Example: `https://abc123def456.ngrok.io/webhooks/twilio/sms-incoming`
   - Method: **POST**
   - Click **"Save"**

---

### Step 5: Test It!

1. **Create a new job** via the form at http://localhost:3000
2. **Send a WhatsApp message** to your Twilio sandbox number:
   - Message: `ACCEPT <jobId>`
   - Example: `ACCEPT 16`
3. **Check your server logs** - you should see the incoming message
4. **Check the job status** at http://localhost:3000/debug/jobs

---

## 🔍 Troubleshooting

### ngrok URL changes every time?
- **Free ngrok:** Yes, the URL changes each time you restart ngrok
- **Solution:** Use ngrok's free static domain feature, or upgrade to a paid plan

### Webhook not receiving messages?
1. Check ngrok is still running
2. Verify the URL in Twilio matches your current ngrok URL
3. Check server logs for incoming requests
4. Test the endpoint manually: Visit `https://YOUR-NGROK-URL.ngrok.io/health`

### "Invalid webhook URL" error?
- Make sure you're using the **HTTPS** URL (not HTTP)
- Make sure the URL ends with `/webhooks/twilio/sms-incoming`
- Make sure ngrok is running

---

## 📝 Quick Reference

**Your webhook endpoint:** `/webhooks/twilio/sms-incoming`  
**Server port:** `3000`  
**ngrok command:** `ngrok http 3000`  
**Twilio Console:** https://console.twilio.com/us1/develop/sms/sandbox

**Accept job format:** `ACCEPT <jobId>`  
**Decline job format:** `DECLINE <jobId>`

---

## ✅ Verification Checklist

- [ ] ngrok is installed
- [ ] Server is running on port 3000
- [ ] ngrok is running and forwarding to localhost:3000
- [ ] Copied the HTTPS ngrok URL
- [ ] Configured webhook URL in Twilio console
- [ ] Set method to POST
- [ ] Saved the webhook configuration
- [ ] Tested by sending "ACCEPT <jobId>" via WhatsApp

