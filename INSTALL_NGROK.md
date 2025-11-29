# Installing ngrok - Step by Step Guide

## Method 1: Direct Download (Recommended)

### Step 1: Download ngrok
1. Open your web browser
2. Go to: **https://ngrok.com/download**
3. Click on **"Download for Windows"**
4. The file `ngrok.zip` will download to your Downloads folder

### Step 2: Extract ngrok
1. Navigate to your Downloads folder
2. Right-click on `ngrok.zip`
3. Select **"Extract All..."**
4. Choose a location (e.g., `C:\ngrok\` or your Desktop)
5. Click **"Extract"**

### Step 3: Add to PATH (Optional but Recommended)
This allows you to run `ngrok` from anywhere.

**Option A: Add to PATH via System Settings**
1. Press `Win + X` and select **"System"**
2. Click **"Advanced system settings"**
3. Click **"Environment Variables"**
4. Under "User variables", find and select **"Path"**
5. Click **"Edit"**
6. Click **"New"**
7. Enter the path where you extracted ngrok (e.g., `C:\ngrok`)
8. Click **"OK"** on all windows
9. **Restart your terminal/PowerShell**

**Option B: Use ngrok from its folder**
- Just navigate to the ngrok folder when you want to use it
- Example: `cd C:\ngrok` then `.\ngrok.exe http 3000`

### Step 4: Verify Installation
Open a NEW terminal/PowerShell and run:
```powershell
ngrok version
```

If you see a version number, ngrok is installed! ✅

---

## Method 2: Using PowerShell (If you prefer)

You can also download and extract using PowerShell commands. Let me know if you want me to help with this method.

---

## After Installation

Once ngrok is installed, you can:
1. Start your server: `node index.js` (in project folder)
2. Start ngrok: `ngrok http 3000` (in a new terminal)
3. Copy the HTTPS URL from ngrok
4. Configure it in Twilio

---

## Quick Test

After installing, test it:
```powershell
ngrok http 3000
```

You should see something like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3000
```

