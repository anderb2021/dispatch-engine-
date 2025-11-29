# Twilio WhatsApp Webhook Setup Guide

## The Problem
Twilio needs a publicly accessible URL to send incoming WhatsApp messages to your server. Since your server is running on `localhost:3000`, Twilio can't reach it directly.

## Solution Options

### Option 1: Use ngrok (Recommended for Testing/Demo)

1. **Install ngrok** (if not already installed):
   - Download from: https://ngrok.com/download
   - Or use: `choco install ngrok` (if you have Chocolatey)

2. **Start your server** (in one terminal):
   ```bash
   cd "c:\Users\Brian\Desktop\DISPATCH ENGINE"
   node index.js
   ```

3. **Start ngrok** (in another terminal):
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (it will look like: `https://abc123.ngrok.io`)

5. **Configure Twilio Webhook**:
   - Go to: https://console.twilio.com/us1/develop/sms/sandbox
   - Find "When a message comes in" section
   - Set the webhook URL to: `https://your-ngrok-url.ngrok.io/webhooks/twilio/sms-incoming`
   - Method: POST
   - Click "Save"

### Option 2: Manual Acceptance via Web Link (For Testing)

Instead of using WhatsApp, you can manually accept jobs by visiting the claim URL directly in your browser.

The URL format is:
```
http://localhost:3000/jobs/{jobId}/claim?providerId={providerId}
```

To find the provider ID for +12014075804, check the debug endpoint or database.

---

## Quick Test Without Webhook

You can test job acceptance by:

1. **Get the job ID** from the form submission response or `/debug/jobs`

2. **Get the provider ID** for +12014075804:
   - Visit: `http://localhost:3000/debug/jobs`
   - Find the provider with phone +12014075804
   - Note the provider ID

3. **Manually accept the job**:
   - Visit: `http://localhost:3000/jobs/15/claim?providerId=4`
   - (Replace 15 with your job ID and 4 with your provider ID)

---

## After Configuring Webhook

Once the webhook is configured:
- Send "ACCEPT 15" to your Twilio WhatsApp sandbox number
- The server will process it and accept the job
- All other providers will be notified

