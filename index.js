// Load environment variables from .env
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const twilio = require("twilio");
const nodemailer = require("nodemailer");

const app = express();
const prisma = new PrismaClient();

// ------------------------------------------------------
// Middleware
// ------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------------------------------
// Basic routes: serve the form + health + debug
// ------------------------------------------------------

// Root -> form.html
app.get("/", (req, res) => {
  const fullPath = path.join(__dirname, "public", "form.html");
  console.log("Serving / from:", fullPath);
  res.sendFile(fullPath);
});

// Explicit /form.html route
app.get("/form.html", (req, res) => {
  const fullPath = path.join(__dirname, "public", "form.html");
  console.log("Serving /form.html from:", fullPath);
  res.sendFile(fullPath);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Debug: list jobs with broadcasts + accepted provider
app.get("/debug/jobs", async (req, res) => {
  try {
    const jobs = await prisma.jobRequest.findMany({
      include: { broadcasts: true, acceptedProvider: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching debug jobs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// Dashboard API endpoints
// ------------------------------------------------------

// Dashboard route - serve the dashboard page
app.get("/dashboard", (req, res) => {
  const fullPath = path.join(__dirname, "public", "dashboard.html");
  res.sendFile(fullPath);
});

// Dashboard stats
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const [
      totalJobs,
      pendingJobs,
      broadcastingJobs,
      acceptedJobs,
      totalProviders,
      activeProviders,
    ] = await Promise.all([
      prisma.jobRequest.count(),
      prisma.jobRequest.count({ where: { status: "PENDING" } }),
      prisma.jobRequest.count({ where: { status: "BROADCASTING" } }),
      prisma.jobRequest.count({ where: { status: "ACCEPTED" } }),
      prisma.provider.count(),
      prisma.provider.count({ where: { isActive: true } }),
    ]);

    res.json({
      jobs: {
        total: totalJobs,
        pending: pendingJobs,
        broadcasting: broadcastingJobs,
        accepted: acceptedJobs,
      },
      providers: {
        total: totalProviders,
        active: activeProviders,
      },
    });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Dashboard jobs with full details
app.get("/api/dashboard/jobs", async (req, res) => {
  try {
    const jobs = await prisma.jobRequest.findMany({
      include: {
        broadcasts: {
          include: {
            provider: {
              include: {
                user: true,
              },
            },
          },
        },
        acceptedProvider: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Format jobs for dashboard
    const formattedJobs = jobs.map((job) => {
      const customerName = job.customerFirstName && job.customerLastName
        ? `${job.customerFirstName} ${job.customerLastName}`
        : job.customerName;

      const location = job.exactLocation || job.locationText;
      const issueInfo = job.issueType
        ? (job.issueType === "Other" && job.issueNotes
            ? job.issueNotes
            : job.issueType + (job.issueNotes ? `: ${job.issueNotes}` : ""))
        : job.problemDescription;

      return {
        id: job.id,
        customerName,
        customerPhone: job.customerPhone,
        location,
        issueInfo,
        emergencyLevel: job.emergencyLevel,
        status: job.status,
        intakeChannel: job.intakeChannel,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        acceptedProvider: job.acceptedProvider
          ? {
              id: job.acceptedProvider.id,
              name: job.acceptedProvider.user.name,
              phone: job.acceptedProvider.user.phoneNumber,
            }
          : null,
        broadcasts: job.broadcasts.map((broadcast) => ({
          id: broadcast.id,
          providerName: broadcast.provider.user.name,
          providerPhone: broadcast.provider.user.phoneNumber,
          responseStatus: broadcast.responseStatus,
          sentAt: broadcast.sentAt,
          respondedAt: broadcast.respondedAt,
        })),
        broadcastCount: job.broadcasts.length,
      };
    });

    res.json(formattedJobs);
  } catch (err) {
    console.error("Error fetching dashboard jobs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Dashboard providers
app.get("/api/dashboard/providers", async (req, res) => {
  try {
    const providers = await prisma.provider.findMany({
      include: {
        user: true,
        acceptedJobs: true,
        broadcasts: {
          include: {
            job: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedProviders = providers.map((provider) => ({
      id: provider.id,
      userId: provider.userId,
      name: provider.user.name,
      phone: provider.user.phoneNumber,
      serviceArea: provider.serviceArea,
      isActive: provider.isActive,
      acceptedJobsCount: provider.acceptedJobs.length,
      totalBroadcasts: provider.broadcasts.length,
      createdAt: provider.createdAt,
    }));

    res.json(formattedProviders);
  } catch (err) {
    console.error("Error fetching dashboard providers:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update provider
app.put("/api/dashboard/providers/:id", async (req, res) => {
  try {
    const providerId = parseInt(req.params.id, 10);
    const { name, phone, serviceArea, isActive } = req.body;

    if (isNaN(providerId)) {
      return res.status(400).json({ error: "Invalid provider ID" });
    }

    // Get provider with user
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      include: { user: true },
    });

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    // Update user if name or phone changed
    if (name || phone) {
      const userUpdate = {};
      if (name) userUpdate.name = name;
      if (phone) {
        // Check if phone is already taken by another user
        const existingUser = await prisma.user.findUnique({
          where: { phoneNumber: phone },
        });
        if (existingUser && existingUser.id !== provider.userId) {
          return res.status(400).json({ error: "Phone number already in use" });
        }
        userUpdate.phoneNumber = phone;
      }
      await prisma.user.update({
        where: { id: provider.userId },
        data: userUpdate,
      });
    }

    // Update provider
    const providerUpdate = {};
    if (serviceArea !== undefined) providerUpdate.serviceArea = serviceArea;
    if (isActive !== undefined) providerUpdate.isActive = isActive;

    const updatedProvider = await prisma.provider.update({
      where: { id: providerId },
      data: providerUpdate,
      include: {
        user: true,
        acceptedJobs: true,
        broadcasts: true,
      },
    });

    res.json({
      id: updatedProvider.id,
      userId: updatedProvider.userId,
      name: updatedProvider.user.name,
      phone: updatedProvider.user.phoneNumber,
      serviceArea: updatedProvider.serviceArea,
      isActive: updatedProvider.isActive,
      acceptedJobsCount: updatedProvider.acceptedJobs.length,
      totalBroadcasts: updatedProvider.broadcasts.length,
      createdAt: updatedProvider.createdAt,
    });
  } catch (err) {
    console.error("Error updating provider:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// Twilio (WhatsApp Sandbox) setup
// ------------------------------------------------------
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

// Example: "whatsapp:+14155238886" (from Twilio WhatsApp Sandbox)
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------
// Email setup (nodemailer)
// ------------------------------------------------------
let emailTransporter = null;

if (
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
) {
  emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("✅ Email service configured");
} else {
  console.log("⚠️  Email service not configured (SMTP settings missing)");
}

const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@dispatchengine.com";

// ------------------------------------------------------
// Helper: send email notification to customer
// ------------------------------------------------------
async function sendEmailNotification(to, subject, html, text) {
  if (!emailTransporter) {
    console.log("⚠️  Email not configured, skipping email to:", to);
    return;
  }

  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    console.log(`✅ Email sent to: ${to}`);
  } catch (err) {
    console.error(`❌ Error sending email to ${to}:`, err.message);
  }
}

// Send job confirmation email
async function sendJobConfirmationEmail(job) {
  if (!job.customerEmail) {
    return;
  }

  const customerName = job.customerFirstName && job.customerLastName
    ? `${job.customerFirstName} ${job.customerLastName}`
    : job.customerName || "Customer";

  const location = job.exactLocation || job.locationText || "Location not specified";
  const issueInfo = job.issueType
    ? (job.issueType === "Other" && job.issueNotes
        ? job.issueNotes
        : job.issueType + (job.issueNotes ? `: ${job.issueNotes}` : ""))
    : job.problemDescription || "Issue not specified";

  const emergencyLabels = ["Not Critical", "Low", "Moderate", "High", "Critical"];
  const emergencyLevel = job.emergencyLevel || 1;
  const emergencyLabel = emergencyLabels[emergencyLevel - 1] || "Not Critical";

  const subject = `Service Request Confirmation - Job #${job.id}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #667eea; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Service Request Received</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Thank you for submitting your service request. We've received your request and are connecting you with qualified service providers in your area.</p>
          
          <div class="info-box">
            <strong>Job Details:</strong><br>
            Job ID: #${job.id}<br>
            Location: ${location}<br>
            Issue: ${issueInfo}<br>
            Emergency Level: ${emergencyLevel}/5 (${emergencyLabel})
          </div>

          <p>Our service providers have been notified and the first available provider will contact you shortly.</p>
          <p>You will receive another email once a provider accepts your job request.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Service Request Confirmation - Job #${job.id}

Dear ${customerName},

Thank you for submitting your service request. We've received your request and are connecting you with qualified service providers in your area.

Job Details:
- Job ID: #${job.id}
- Location: ${location}
- Issue: ${issueInfo}
- Emergency Level: ${emergencyLevel}/5 (${emergencyLabel})

Our service providers have been notified and the first available provider will contact you shortly.
You will receive another email once a provider accepts your job request.

This is an automated message. Please do not reply to this email.
  `;

  await sendEmailNotification(job.customerEmail, subject, html, text);
}

// Send job acceptance email
async function sendJobAcceptanceEmail(job, provider) {
  if (!job.customerEmail) {
    return;
  }

  const customerName = job.customerFirstName && job.customerLastName
    ? `${job.customerFirstName} ${job.customerLastName}`
    : job.customerName || "Customer";

  const location = job.exactLocation || job.locationText || "Location not specified";
  const issueInfo = job.issueType
    ? (job.issueType === "Other" && job.issueNotes
        ? job.issueNotes
        : job.issueType + (job.issueNotes ? `: ${job.issueNotes}` : ""))
    : job.problemDescription || "Issue not specified";

  const providerName = provider?.user?.name || "Service Provider";
  const providerPhone = provider?.user?.phoneNumber || "N/A";

  const subject = `Service Provider Assigned - Job #${job.id}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #28a745; }
        .provider-box { background: #d4edda; padding: 15px; margin: 15px 0; border-radius: 6px; border: 2px solid #28a745; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Service Provider Assigned!</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Great news! A service provider has accepted your job request and will be contacting you shortly.</p>
          
          <div class="provider-box">
            <strong>Your Service Provider:</strong><br>
            Name: ${providerName}<br>
            Phone: ${providerPhone}
          </div>

          <div class="info-box">
            <strong>Job Details:</strong><br>
            Job ID: #${job.id}<br>
            Location: ${location}<br>
            Issue: ${issueInfo}
          </div>

          <p><strong>What's Next?</strong></p>
          <p>Your service provider will contact you at ${job.customerPhone} to schedule a convenient time for service.</p>
          <p>If you have any questions, please contact your provider directly using the phone number above.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Service Provider Assigned - Job #${job.id}

Dear ${customerName},

Great news! A service provider has accepted your job request and will be contacting you shortly.

Your Service Provider:
- Name: ${providerName}
- Phone: ${providerPhone}

Job Details:
- Job ID: #${job.id}
- Location: ${location}
- Issue: ${issueInfo}

What's Next?
Your service provider will contact you at ${job.customerPhone} to schedule a convenient time for service.
If you have any questions, please contact your provider directly using the phone number above.

This is an automated message. Please do not reply to this email.
  `;

  await sendEmailNotification(job.customerEmail, subject, html, text);
}

// ------------------------------------------------------
// Helper: notify all providers that a job was accepted
// ------------------------------------------------------
async function notifyJobAccepted(jobId, acceptedProviderId) {
  console.log(`Notifying providers that job ${jobId} was accepted by provider ${acceptedProviderId}`);

  try {
    // Get all providers who received the broadcast for this job
    const broadcasts = await prisma.jobBroadcast.findMany({
      where: {
        jobRequestId: jobId,
        providerId: { not: acceptedProviderId }, // Exclude the provider who accepted
      },
      include: {
        provider: {
          include: {
            user: true,
          },
        },
      },
    });

    if (broadcasts.length === 0) {
      console.log("No other providers to notify for job", jobId);
      return;
    }

    // Get job details for the notification message
    const job = await prisma.jobRequest.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      console.log("Job not found for notification:", jobId);
      return;
    }

    // Get the accepted provider's name for the message
    const acceptedProvider = await prisma.provider.findUnique({
      where: { id: acceptedProviderId },
      include: { user: true },
    });

    const acceptedProviderName = acceptedProvider?.user?.name || "Another provider";
    
    const location = job.exactLocation || job.locationText || "Location not specified";
    const issueInfo = job.issueType
      ? (job.issueType === "Other" && job.issueNotes
          ? job.issueNotes
          : job.issueType + (job.issueNotes ? `: ${job.issueNotes}` : ""))
      : job.problemDescription || "Issue not specified";

    const notificationMessage = [
      `📢 *Job Update: Job #${jobId} has been accepted*`,
      ``,
      `📍 Location: ${location}`,
      `🔧 Issue: ${issueInfo}`,
      ``,
      `✅ Accepted by: ${acceptedProviderName}`,
      ``,
      `This job is no longer available. Thank you for your interest!`,
    ].join("\n");

    // Send notification to all providers who received the broadcast
    for (const broadcast of broadcasts) {
      const provider = broadcast.provider;
      if (provider.user.phoneNumber && twilioClient && WHATSAPP_FROM) {
        try {
          await twilioClient.messages.create({
            from: WHATSAPP_FROM,
            to: `whatsapp:${provider.user.phoneNumber}`,
            body: notificationMessage,
          });

          console.log(
            `Notification sent to provider ${provider.id} (${provider.user.phoneNumber}) about job ${jobId}`
          );
        } catch (err) {
          console.error(
            `Error sending notification to provider ${provider.id}:`,
            err.message
          );
        }
      }
    }

    console.log(`Notifications sent to ${broadcasts.length} providers for job ${jobId}`);
  } catch (err) {
    console.error("Error notifying providers about job acceptance:", err);
  }
}

// ------------------------------------------------------
// Helper: broadcast a job to all active providers (WhatsApp)
// ------------------------------------------------------
async function broadcastJob(job) {
  console.log("Starting broadcast for job", job.id);

  // Get all active providers + their user records (for phone numbers)
  const providers = await prisma.provider.findMany({
    where: { isActive: true },
    include: { user: true },
  });

  if (providers.length === 0) {
    console.log("No active providers to broadcast to.");
    return;
  }

  // Mark job as BROADCASTING
  await prisma.jobRequest.update({
    where: { id: job.id },
    data: { status: "BROADCASTING" },
  });

  console.log(`Broadcasting job ${job.id} to ${providers.length} providers.`);

  for (const provider of providers) {
    const claimUrl = `${BASE_URL}/jobs/${job.id}/claim?providerId=${provider.id}`;

    // Save broadcast record
    await prisma.jobBroadcast.create({
      data: {
        jobRequestId: job.id,
        providerId: provider.id,
        responseStatus: "NONE",
      },
    });

    // Build WhatsApp message with all information efficiently
    const customerName = job.customerFirstName && job.customerLastName
      ? `${job.customerFirstName} ${job.customerLastName}`
      : job.customerName || "Customer";
    
    const location = job.exactLocation || job.locationText || "Location not specified";
    
    const issueInfo = job.issueType
      ? (job.issueType === "Other" && job.issueNotes
          ? job.issueNotes
          : job.issueType + (job.issueNotes ? `: ${job.issueNotes}` : ""))
      : job.problemDescription || "Issue not specified";
    
    // Emergency level indicator
    const emergencyEmojis = ["⚪", "🟢", "🟡", "🟠", "🔴"];
    const emergencyLabels = ["Not Critical", "Low", "Moderate", "High", "Critical"];
    const emergencyLevel = job.emergencyLevel || 1;
    const emergencyEmoji = emergencyEmojis[emergencyLevel - 1] || "⚪";
    const emergencyLabel = emergencyLabels[emergencyLevel - 1] || "Not Critical";

    const messageBody = [
      `🛠 *NEW PLUMBING JOB #${job.id}*`,
      ``,
      `👤 *Customer:* ${customerName}`,
      `📞 *Phone:* ${job.customerPhone}`,
      ``,
      `📍 *Location:*`,
      `${location}`,
      ``,
      `🔧 *Issue:* ${issueInfo}`,
      ``,
      `${emergencyEmoji} *Emergency Level: ${emergencyLevel}/5 (${emergencyLabel})*`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👉 *Tap to claim:*`,
      `${claimUrl}`,
      ``,
      `Or reply:`,
      `✅ "ACCEPT ${job.id}" to claim`,
      `❌ "DECLINE ${job.id}" to pass`,
    ].join("\n");

    if (twilioClient && WHATSAPP_FROM && provider.user.phoneNumber) {
      try {
        await twilioClient.messages.create({
          from: WHATSAPP_FROM, // e.g. "whatsapp:+14155238886"
          to: `whatsapp:${provider.user.phoneNumber}`, // e.g. "whatsapp:+1201..."
          body: messageBody,
        });

        console.log(
          `WhatsApp sent to provider ${provider.id} (${provider.user.phoneNumber})`
        );
      } catch (err) {
        console.error(
          `Twilio WhatsApp error sending to provider ${provider.id}:`,
          err.message
        );
      }
    } else {
      console.log(
        `Skipping WhatsApp for provider ${provider.id} (Twilio not configured or missing phone).`
      );
    }
  }

  console.log("Broadcast complete for job", job.id);
}

// ------------------------------------------------------
// Core API routes
// ------------------------------------------------------

// Create a job (used by your web form and API clients)
app.post("/jobs", async (req, res) => {
  try {
    const {
      // New fields
      customerFirstName,
      customerLastName,
      customerPhone,
      customerEmail,
      exactLocation,
      issueType,
      issueNotes,
      emergencyLevel,
      // Legacy fields (for backward compatibility)
      customerName,
      locationText,
      problemDescription,
    } = req.body;

    // Validate required fields
    if (!customerPhone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Use new fields if available, otherwise fall back to legacy fields
    const firstName = customerFirstName || (customerName ? customerName.split(" ")[0] : null);
    const lastName = customerLastName || (customerName ? customerName.split(" ").slice(1).join(" ") : null);
    const location = exactLocation || locationText;
    const issue = issueType || problemDescription;
    const notes = issueNotes || null;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First name and last name are required" });
    }

    if (!location) {
      return res.status(400).json({ error: "Location is required" });
    }

    if (!issue) {
      return res.status(400).json({ error: "Issue type or description is required" });
    }

    if (emergencyLevel === undefined || emergencyLevel === null) {
      return res.status(400).json({ error: "Emergency level (1-5) is required" });
    }

    if (emergencyLevel < 1 || emergencyLevel > 5) {
      return res.status(400).json({ error: "Emergency level must be between 1 and 5" });
    }

    // Build full customer name for backward compatibility
    const fullCustomerName = `${firstName} ${lastName}`.trim();

    // Build problem description from issue type and notes
    let fullProblemDescription = issue;
    if (notes && issue !== "Other") {
      fullProblemDescription = `${issue}: ${notes}`;
    } else if (notes) {
      fullProblemDescription = notes;
    }

    const job = await prisma.jobRequest.create({
      data: {
        // New fields
        customerFirstName: firstName,
        customerLastName: lastName,
        customerEmail: customerEmail || null,
        exactLocation: location,
        issueType: issue,
        issueNotes: notes,
        emergencyLevel: parseInt(emergencyLevel, 10),
        // Legacy fields for backward compatibility
        customerName: fullCustomerName,
        customerPhone,
        locationText: location,
        problemDescription: fullProblemDescription,
        status: "PENDING",
        intakeChannel: "WEB_FORM",
      },
    });

    console.log("New job created:", job.id);

    // Send confirmation email (don't block the response)
    if (customerEmail) {
      sendJobConfirmationEmail(job).catch((err) =>
        console.error("Error sending confirmation email:", err)
      );
    }

    // Fire off broadcast (don't block the response)
    broadcastJob(job).catch((err) =>
      console.error("Error broadcasting job:", err)
    );

    res.status(201).json(job);
  } catch (err) {
    console.error("Error creating job:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Simple list of jobs
app.get("/jobs", async (req, res) => {
  try {
    const jobs = await prisma.jobRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(jobs);
  } catch (err) {
    console.error("Error listing jobs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Claim a job (first provider wins)
app.get("/jobs/:id/claim", async (req, res) => {
  const jobId = parseInt(req.params.id, 10);
  const providerId = parseInt(req.query.providerId, 10);

  if (isNaN(jobId) || isNaN(providerId)) {
    return res.status(400).send("Invalid jobId or providerId");
  }

  try {
    // Atomic "first wins" update
    const result = await prisma.jobRequest.updateMany({
      where: {
        id: jobId,
        status: "BROADCASTING",
        acceptedProviderId: null,
      },
      data: {
        status: "ACCEPTED",
        acceptedProviderId: providerId,
      },
    });

    if (result.count === 0) {
      return res
        .status(409)
        .send("<h1>Sorry, this job has already been claimed.</h1>");
    }

    // Update broadcasts
    await prisma.jobBroadcast.updateMany({
      where: {
        jobRequestId: jobId,
        providerId,
      },
      data: { responseStatus: "ACCEPTED", respondedAt: new Date() },
    });

    await prisma.jobBroadcast.updateMany({
      where: {
        jobRequestId: jobId,
        providerId: { not: providerId },
      },
      data: { responseStatus: "TOO_LATE", respondedAt: new Date() },
    });

    const job = await prisma.jobRequest.findUnique({
      where: { id: jobId },
      include: {
        acceptedProvider: {
          include: {
            user: true,
          },
        },
      },
    });

    // Send acceptance email to customer
    if (job && job.acceptedProvider) {
      sendJobAcceptanceEmail(job, job.acceptedProvider).catch((err) =>
        console.error("Error sending acceptance email:", err)
      );
    }

    // Notify all other providers that the job was accepted
    notifyJobAccepted(jobId, providerId).catch((err) =>
      console.error("Error notifying providers:", err)
    );

    const customerName = job.customerFirstName && job.customerLastName
      ? `${job.customerFirstName} ${job.customerLastName}`
      : job.customerName || "Customer";
    
    const location = job.exactLocation || job.locationText || "Location not specified";
    
    const issueInfo = job.issueType
      ? (job.issueType === "Other" && job.issueNotes
          ? job.issueNotes
          : job.issueType + (job.issueNotes ? `: ${job.issueNotes}` : ""))
      : job.problemDescription || "Issue not specified";
    
    const emergencyLabels = ["Not Critical", "Low", "Moderate", "High", "Critical"];
    const emergencyLevel = job.emergencyLevel || 1;
    const emergencyLabel = emergencyLabels[emergencyLevel - 1] || "Not Critical";

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Claimed Successfully</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #28a745;
            margin-bottom: 20px;
          }
          .info-section {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
          }
          .info-section:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
          }
          .value {
            color: #666;
            margin-left: 10px;
          }
          .emergency {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 4px;
            font-weight: 600;
            background: ${emergencyLevel >= 4 ? '#dc3545' : emergencyLevel >= 3 ? '#ffc107' : '#28a745'};
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Job Claimed Successfully!</h1>
          
          <div class="info-section">
            <div class="label">Customer Name:</div>
            <div class="value">${customerName}</div>
          </div>
          
          <div class="info-section">
            <div class="label">Phone Number:</div>
            <div class="value">${job.customerPhone}</div>
          </div>
          
          <div class="info-section">
            <div class="label">Exact Location:</div>
            <div class="value">${location}</div>
          </div>
          
          <div class="info-section">
            <div class="label">Issue Type:</div>
            <div class="value">${issueInfo}</div>
          </div>
          
          <div class="info-section">
            <div class="label">Emergency Level:</div>
            <div class="value">
              <span class="emergency">Level ${emergencyLevel}/5: ${emergencyLabel}</span>
            </div>
          </div>
          
          <div class="info-section">
            <div class="label">Job ID:</div>
            <div class="value">#${job.id}</div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Error claiming job:", err);
    res.status(500).send("Internal server error");
  }
});

// ------------------------------------------------------
// Inbound Twilio webhook (WhatsApp + SMS)
// - Providers: ACCEPT <jobId> / DECLINE <jobId>
// - Customers: create a new job from free text
// ------------------------------------------------------
app.post("/webhooks/twilio/sms-incoming", async (req, res) => {
  try {
    console.log("Incoming message from Twilio:", req.body);

    const from = req.body.From; // e.g. "whatsapp:+1201..." or "+1201..."
    const rawBody = req.body.Body || "";
    const body = rawBody.trim();

    const isWhatsApp = from && from.startsWith("whatsapp:");
    const cleanPhone = isWhatsApp ? from.replace("whatsapp:", "") : from;

    // -------------------------------
    // 1) PROVIDER FLOW: ACCEPT/DECLINE
    // -------------------------------
    const upper = body.toUpperCase();
    const acceptMatch = upper.match(/^ACCEPT\s+(\d+)/);
    const declineMatch = upper.match(/^DECLINE\s+(\d+)/);

    if (acceptMatch || declineMatch) {
      const jobId = parseInt((acceptMatch || declineMatch)[1], 10);
      const action = acceptMatch ? "ACCEPT" : "DECLINE";

      // Find provider by phone
      const provider = await prisma.provider.findFirst({
        where: {
          user: {
            phoneNumber: cleanPhone,
          },
        },
        include: { user: true },
      });

      if (!provider) {
        console.log("No provider found for phone:", cleanPhone);
        res.type("text/xml").send(`
          <Response>
            <Message>We couldn't match your number to a provider account.</Message>
          </Response>
        `);
        return;
      }

      if (action === "ACCEPT") {
        // Same logic as /jobs/:id/claim
        const result = await prisma.jobRequest.updateMany({
          where: {
            id: jobId,
            status: "BROADCASTING",
            acceptedProviderId: null,
          },
          data: {
            status: "ACCEPTED",
            acceptedProviderId: provider.id,
          },
        });

        if (result.count === 0) {
          res.type("text/xml").send(`
            <Response>
              <Message>Sorry, this job has already been claimed.</Message>
            </Response>
          `);
          return;
        }

        await prisma.jobBroadcast.updateMany({
          where: { jobRequestId: jobId, providerId: provider.id },
          data: { responseStatus: "ACCEPTED", respondedAt: new Date() },
        });

        await prisma.jobBroadcast.updateMany({
          where: {
            jobRequestId: jobId,
            providerId: { not: provider.id },
          },
          data: { responseStatus: "TOO_LATE", respondedAt: new Date() },
        });

        // Get job with provider info for email
        const jobForEmail = await prisma.jobRequest.findUnique({
          where: { id: jobId },
          include: {
            acceptedProvider: {
              include: {
                user: true,
              },
            },
          },
        });

        // Send acceptance email to customer
        if (jobForEmail && jobForEmail.acceptedProvider) {
          sendJobAcceptanceEmail(jobForEmail, jobForEmail.acceptedProvider).catch((err) =>
            console.error("Error sending acceptance email:", err)
          );
        }

        // Notify all other providers that the job was accepted
        notifyJobAccepted(jobId, provider.id).catch((err) =>
          console.error("Error notifying providers:", err)
        );

        res.type("text/xml").send(`
          <Response>
            <Message>You have successfully claimed job #${jobId}.</Message>
          </Response>
        `);
        return;
      } else {
        // DECLINE: update broadcast only
        await prisma.jobBroadcast.updateMany({
          where: { jobRequestId: jobId, providerId: provider.id },
          data: { responseStatus: "REJECTED", respondedAt: new Date() },
        });

        res.type("text/xml").send(`
          <Response>
            <Message>You have declined job #${jobId}. We'll notify others.</Message>
          </Response>
        `);
        return;
      }
    }

    // -------------------------------
    // 2) CUSTOMER FLOW: create a new job
    // Format: "District 1 - pipe burst in kitchen"
    // -------------------------------
    const [locationTextRaw, descriptionRaw] = body.split("-");
    const locationText = (locationTextRaw || "Unknown location").trim();
    const problemDescription = (descriptionRaw || body || "No description").trim();

    const job = await prisma.jobRequest.create({
      data: {
        customerName: "Messaging Customer",
        customerPhone: cleanPhone,
        locationText,
        problemDescription,
        status: "PENDING",
        // Use INBOUND_SMS enum for both SMS and WhatsApp to match your schema
        intakeChannel: "INBOUND_SMS",
      },
    });

    console.log("New job from inbound message:", job.id);

    broadcastJob(job).catch((err) =>
      console.error("Error broadcasting inbound job:", err)
    );

    res.type("text/xml").send(`
      <Response>
        <Message>Thanks! We've created your plumbing request and are contacting nearby plumbers now.</Message>
      </Response>
    `);
  } catch (err) {
    console.error("Error handling inbound webhook:", err);
    res.type("text/xml").send(`
      <Response>
        <Message>Sorry, something went wrong processing your request.</Message>
      </Response>
    `);
  }
});

// Optional: simple Twilio voice handler (not critical for demo)
app.post("/webhooks/twilio/voice", async (req, res) => {
  console.log("Incoming voice call:", req.body);

  res.type("text/xml").send(`
    <Response>
      <Say>Thanks for calling the plumbing dispatch line. Please visit our website or send us a WhatsApp message to create a job request.</Say>
      <Hangup/>
    </Response>
  `);
});

// ------------------------------------------------------
// Start server
// ------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


