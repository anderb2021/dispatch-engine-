# Dispatch Engine - Demo Setup Guide

## 🚀 Quick Start

The server should now be running! Here's what you need to know:

### Access the Application

1. **Client Intake Form**: Open your browser and go to:
   ```
   http://localhost:3000
   ```

2. **Health Check**: Verify server is running:
   ```
   http://localhost:3000/health
   ```

3. **Debug Endpoint** (View all jobs):
   ```
   http://localhost:3000/debug/jobs
   ```

### 📋 Demo Flow

1. **Fill out the form** with:
   - First Name & Last Name
   - Phone Number
   - Exact Location
   - Issue Type (select from dropdown)
   - Emergency Level (1-5)
   - If "Other" is selected, add notes

2. **Submit the form** - A job will be created

3. **Service providers** will receive WhatsApp messages (if Twilio is configured)

4. **First provider to click the link** accepts the job

5. **All other providers** receive a notification that the job was accepted

### ⚙️ Configuration (Optional for Full Functionality)

For WhatsApp messaging to work, create a `.env` file in the project root:

```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
BASE_URL=http://localhost:3000
PORT=3000
```

**Note**: The app will run without Twilio credentials, but WhatsApp messages won't be sent. You can still:
- Submit job requests
- View jobs via the debug endpoint
- Test the claim links manually

### 🧪 Testing Without WhatsApp

1. Create a job via the form
2. Get the job ID from the response or `/debug/jobs`
3. Manually visit: `http://localhost:3000/jobs/{jobId}/claim?providerId={providerId}`
   - Get provider IDs from the database or seed file

### 📊 Current Status

- ✅ Database migrated and ready
- ✅ Professional form created
- ✅ All new fields implemented
- ✅ Enhanced broadcast messages
- ✅ Notification system active

### 🛑 To Stop the Server

Press `Ctrl+C` in the terminal where the server is running.

