const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Cached transporter instance
let transporter = null;

// Resolve an active transporter. Uses real creds when provided; otherwise
// in non-production, falls back to Ethereal for testing.
async function getActiveTransporter() {
  if (transporter) return transporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      const emailConfig = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: { rejectUnauthorized: false },
      };
      transporter = nodemailer.createTransport(emailConfig);
      logger.info('✅ Email transporter created successfully');
      return transporter;
    } catch (error) {
      logger.error('❌ Failed to create email transporter:', error.message);
      transporter = null;
    }
  }

  // Dev/test fallback: Ethereal (only if not in production)
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      logger.warn('⚠️ Email credentials not provided. Using Ethereal test SMTP.');
      logger.info(`🔐 Ethereal user: ${testAccount.user}`);
      logger.info(`🔐 Ethereal pass: ${testAccount.pass}`);
      return transporter;
    } catch (error) {
      logger.error('❌ Failed to create Ethereal test transporter:', error.message);
      transporter = null;
    }
  } else {
    logger.warn('⚠️ Email credentials not provided. Email functionality will be disabled.');
  }

  return null;
}

// Verify email configuration
const verifyEmailConfig = async () => {
  const active = await getActiveTransporter();
  if (!active) {
    logger.warn('⚠️ Email transporter not available. Email functionality disabled.');
    return false;
  }
  try {
    await active.verify();
    logger.info('✅ Email server is ready to send messages');
    return true;
  } catch (error) {
    logger.error('❌ Email server configuration error:', error.message);
    return false;
  }
};

// Generate HTML email template
const generateResetEmailHTML = (resetLink, email) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - IoT Dashboard</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #dc2626;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 10px;
        }
        .title {
          font-size: 24px;
          color: #1f2937;
          margin-bottom: 20px;
        }
        .content {
          margin-bottom: 30px;
        }
        .reset-button {
          display: inline-block;
          background-color: #dc2626;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          text-align: center;
          margin: 20px 0;
          transition: background-color 0.3s;
        }
        .reset-button:hover {
          background-color: #b91c1c;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
          text-align: center;
        }
        .warning {
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
          color: #991b1b;
        }
        .link-fallback {
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 15px;
          margin: 20px 0;
          word-break: break-all;
          font-family: monospace;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🔧 IoT Dashboard</div>
          <h1 class="title">Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>Hello,</p>
          
          <p>We received a request to reset your password for your IoT Dashboard account associated with <strong>${email}</strong>.</p>
          
          <p>If you made this request, click the button below to reset your password:</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="reset-button">Reset My Password</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important:</strong> This link will expire in 24 hours for security reasons.
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <div class="link-fallback">${resetLink}</div>
          
          <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        
        <div class="footer">
          <p>This email was sent from IoT Dashboard. If you have any questions, please contact our support team.</p>
          <p>© 2024 IoT Dashboard. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generate plain text email template
const generateResetEmailText = (resetLink, email) => {
  return `
Password Reset Request - IoT Dashboard

Hello,

We received a request to reset your password for your IoT Dashboard account associated with ${email}.

If you made this request, click the link below to reset your password:

${resetLink}

IMPORTANT: This link will expire in 24 hours for security reasons.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

This email was sent from IoT Dashboard. If you have any questions, please contact our support team.

© 2024 IoT Dashboard. All rights reserved.
  `;
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetLink) => {
  const active = await getActiveTransporter();
  if (!active) {
    logger.warn('⚠️ Email transporter not available. Cannot send password reset email.');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'IoT Dashboard <no-reply@example.com>',
      to: email,
      subject: 'Password Reset Request - IoT Dashboard',
      text: generateResetEmailText(resetLink, email),
      html: generateResetEmailHTML(resetLink, email),
    };

    const result = await active.sendMail(mailOptions);
    logger.info('✅ Password reset email sent successfully:', result.messageId);

    // Log preview URL for Ethereal
    const previewUrl = nodemailer.getTestMessageUrl(result);
    if (previewUrl) {
      logger.info(`🔗 Preview email at: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: result.messageId,
      message: 'Password reset email sent successfully',
      ...(previewUrl ? { previewUrl } : {}),
    };
  } catch (error) {
    logger.error('❌ Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  transporter,
  getActiveTransporter,
  verifyEmailConfig,
  generateResetEmailHTML,
  generateResetEmailText,
  sendPasswordResetEmail
};

