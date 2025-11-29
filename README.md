# 🛠️ Dispatch Engine

A professional service dispatch system that connects customers with service providers via WhatsApp messaging. Features real-time job broadcasting, first-come-first-served job acceptance, and comprehensive admin dashboard.

## ✨ Features

### Customer Features
- **Professional Intake Form** - Collects detailed customer information including:
  - First and last name
  - Phone number and email
  - Exact service location
  - Issue type selection with custom notes
  - Emergency level (1-5 scale)
- **Email Notifications** - Automatic email confirmations when:
  - Job request is submitted
  - Service provider accepts the job

### Service Provider Features
- **WhatsApp Integration** - Providers receive job notifications via WhatsApp
- **Quick Acceptance** - Accept jobs via WhatsApp message or web link
- **Real-time Notifications** - All providers notified when a job is accepted

### Admin Dashboard
- **Real-time Statistics** - View job counts, provider status, and system metrics
- **Job Management** - See all jobs with full details, status, and provider information
- **Provider Management** - Edit provider details, activate/deactivate providers
- **Message Tracking** - See which providers received messages and their responses
- **Auto-refresh** - Dashboard updates every 30 seconds

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- SQLite (included with Prisma)
- Twilio account (for WhatsApp)
- ngrok account (for webhook testing)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd dispatch-engine
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Server
   PORT=3000
   BASE_URL=http://localhost:3000

   # Twilio (WhatsApp)
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

   # Email (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

4. **Set up the database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Seed initial data (optional)**
   ```bash
   npm run seed
   ```

6. **Start the server**
   ```bash
   npm start
   ```

7. **Set up ngrok for WhatsApp webhooks**
   ```bash
   ngrok http 3000
   ```
   Then configure the webhook URL in Twilio console.

## 📁 Project Structure

```
dispatch-engine/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── migrations/            # Database migrations
│   └── seed.js               # Seed script
├── public/
│   ├── form.html             # Customer intake form
│   └── dashboard.html        # Admin dashboard
├── index.js                  # Main server file
├── package.json              # Dependencies
└── README.md                 # This file
```

## 🔧 Configuration

### Twilio WhatsApp Setup
1. Sign up for Twilio account
2. Enable WhatsApp Sandbox
3. Configure webhook URL: `https://your-ngrok-url.ngrok.io/webhooks/twilio/sms-incoming`
4. See `WHATSAPP_WEBHOOK_SETUP.md` for detailed instructions

### Email Setup
1. Configure SMTP settings in `.env`
2. For Gmail, use App Passwords (not regular password)
3. See `EMAIL_SETUP.md` for detailed instructions

### ngrok Setup
1. Sign up for free ngrok account
2. Get authtoken from dashboard
3. Configure: `ngrok config add-authtoken YOUR_TOKEN`
4. Start: `ngrok http 3000`

## 📡 API Endpoints

### Customer
- `POST /jobs` - Create a new job request
- `GET /jobs` - List all jobs

### Service Provider
- `GET /jobs/:id/claim?providerId=X` - Accept a job via web link
- WhatsApp: Send `ACCEPT <jobId>` to Twilio sandbox number

### Admin
- `GET /dashboard` - Admin dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/jobs` - All jobs with details
- `GET /api/dashboard/providers` - All providers
- `PUT /api/dashboard/providers/:id` - Update provider

### Webhooks
- `POST /webhooks/twilio/sms-incoming` - Twilio WhatsApp webhook

## 🎯 Usage

### Creating a Job
1. Visit `http://localhost:3000`
2. Fill out the service request form
3. Submit - job is created and broadcast to all active providers

### Accepting a Job (Provider)
**Via WhatsApp:**
- Send `ACCEPT <jobId>` to your Twilio WhatsApp sandbox number

**Via Web:**
- Click the link in the WhatsApp message
- Or visit: `http://localhost:3000/jobs/<jobId>/claim?providerId=<providerId>`

### Admin Dashboard
1. Visit `http://localhost:3000/dashboard`
2. View real-time statistics and job status
3. Edit provider information
4. Monitor message delivery

## 🗄️ Database Schema

- **User** - User accounts (customers, providers, admins)
- **Provider** - Service provider information
- **JobRequest** - Service job requests
- **JobBroadcast** - Message delivery tracking

See `prisma/schema.prisma` for full schema details.

## 🔐 Security Notes

- Never commit `.env` file to git
- Use App Passwords for email (not regular passwords)
- Keep ngrok authtoken secure
- Use environment variables for all sensitive data

## 📝 License

[Your License Here]

## 👤 Author

[Your Name]

## 🙏 Acknowledgments

- Built with Express.js
- Database: Prisma + SQLite
- Messaging: Twilio WhatsApp
- Email: Nodemailer

