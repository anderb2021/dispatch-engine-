# Email Notification Setup Guide

## Overview

The dispatch system now sends email notifications to service requesters when:
1. **Job Created** - Confirmation email when a job request is submitted
2. **Job Accepted** - Notification when a service provider accepts the job

## Email Configuration

### Option 1: Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "Dispatch Engine" as the name
   - Copy the generated 16-character password

3. **Add to your `.env` file:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

### Option 2: Other SMTP Providers

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

**Mailgun:**
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
EMAIL_FROM=noreply@yourdomain.com
```

**Outlook/Office 365:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
EMAIL_FROM=your-email@outlook.com
```

### Option 3: Local Testing (Mailtrap)

For development/testing, use Mailtrap (free):
1. Sign up at: https://mailtrap.io
2. Get your SMTP credentials from the inbox
3. Add to `.env`:
   ```env
   SMTP_HOST=sandbox.smtp.mailtrap.io
   SMTP_PORT=2525
   SMTP_SECURE=false
   SMTP_USER=your-mailtrap-username
   SMTP_PASS=your-mailtrap-password
   EMAIL_FROM=noreply@dispatchengine.com
   ```

## Environment Variables

Add these to your `.env` file:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

## Testing

1. **Start your server:**
   ```bash
   node index.js
   ```

2. **Submit a job request** with an email address

3. **Check your email** for:
   - Confirmation email when job is created
   - Acceptance email when provider accepts

## Email Templates

The system sends two types of emails:

### 1. Job Confirmation Email
- Sent immediately when job is created
- Includes job details and confirmation
- Professional HTML format

### 2. Job Acceptance Email
- Sent when a provider accepts the job
- Includes provider contact information
- Next steps for the customer

## Troubleshooting

**Emails not sending?**
- Check that all SMTP environment variables are set
- Verify SMTP credentials are correct
- Check server logs for email errors
- Ensure firewall allows SMTP connections

**Gmail issues?**
- Make sure you're using an App Password, not your regular password
- Enable "Less secure app access" if not using 2FA (not recommended)

**Testing without real emails?**
- Use Mailtrap for development
- Check Mailtrap inbox to see sent emails

## Notes

- Emails are sent asynchronously (won't block job creation)
- If email fails, the job still processes successfully
- Email errors are logged to console
- System works without email configured (just skips sending)

