const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const { sendPasswordResetEmail } = require('../config/email');
const { getStorage } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get in-memory storage
const storage = getStorage();

// Rate limiting for password reset requests
const resetPasswordLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 3, // 3 requests per window
  message: {
    success: false,
    error: 'Too many password reset requests. Please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const requestResetSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  })
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Password must be at least 6 characters long',
    'any.required': 'New password is required'
  })
});

// Request password reset
router.post('/request-reset', resetPasswordLimiter, async (req, res) => {
  try {
    logger.info('Password reset request received:', { email: req.body.email, ip: req.ip });

    // Validate request body
    const { error, value } = requestResetSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { email } = value;
    const normalizedEmail = email.toLowerCase();

    // Check if user exists (in production, check against your user database)
    // For demo purposes, we'll accept any email
    logger.info(`Processing password reset for: ${normalizedEmail}`);

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store reset token
    storage.resetTokens.set(resetToken, {
      email: normalizedEmail,
      expiry: resetExpiry,
      used: false,
      createdAt: new Date().toISOString(),
      ip: req.ip
    });

    // Generate reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    logger.info('Generated reset link:', { token: resetToken, email: normalizedEmail });

    // Send email
    const emailResult = await sendPasswordResetEmail(normalizedEmail, resetLink);

    if (emailResult.success) {
      logger.info('Password reset email sent successfully:', { email: normalizedEmail, messageId: emailResult.messageId });
      res.json({
        success: true,
        message: 'Password reset email sent successfully. Please check your inbox.',
        email: normalizedEmail
      });
    } else {
      // Clean up token if email failed
      storage.resetTokens.delete(resetToken);
      logger.error('Failed to send email:', emailResult.error);
      res.status(500).json({
        success: false,
        error: 'Failed to send password reset email. Please try again later.'
      });
    }
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    logger.info('Password reset attempt:', { email: req.body.email, ip: req.ip });

    // Validate request body
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      logger.warn('Validation error:', error.details[0].message);
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { token, email, newPassword } = value;
    const normalizedEmail = email.toLowerCase();

    // Check if token exists and is valid
    const tokenData = storage.resetTokens.get(token);
    if (!tokenData) {
      logger.warn('Invalid token used:', { token, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Check if token is expired
    if (new Date() > tokenData.expiry) {
      storage.resetTokens.delete(token);
      logger.warn('Expired token used:', { token, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired. Please request a new one.'
      });
    }

    // Check if token is already used
    if (tokenData.used) {
      logger.warn('Already used token:', { token, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Reset token has already been used. Please request a new one.'
      });
    }

    // Check if email matches
    if (tokenData.email !== normalizedEmail) {
      logger.warn('Email mismatch:', { token, expectedEmail: tokenData.email, providedEmail: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Invalid email for this reset token'
      });
    }

    // Mark token as used
    tokenData.used = true;
    tokenData.usedAt = new Date().toISOString();
    storage.resetTokens.set(token, tokenData);

    // In production, update the user's password in your database
    logger.info(`Password reset successful for: ${normalizedEmail}`);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// Validate reset token
router.get('/validate-reset-token', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        error: 'Token and email are required'
      });
    }

    const normalizedEmail = email.toLowerCase();
    const tokenData = storage.resetTokens.get(token);

    if (!tokenData) {
      logger.warn('Token validation failed - token not found:', { token, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Invalid reset token'
      });
    }

    if (new Date() > tokenData.expiry) {
      storage.resetTokens.delete(token);
      logger.warn('Token validation failed - expired:', { token, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired'
      });
    }

    if (tokenData.used) {
      logger.warn('Token validation failed - already used:', { token, email: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Reset token has already been used'
      });
    }

    if (tokenData.email !== normalizedEmail) {
      logger.warn('Token validation failed - email mismatch:', { token, expectedEmail: tokenData.email, providedEmail: normalizedEmail });
      return res.status(400).json({
        success: false,
        error: 'Invalid email for this reset token'
      });
    }

    logger.info('Token validation successful:', { token, email: normalizedEmail });
    res.json({
      success: true,
      message: 'Reset token is valid'
    });
  } catch (error) {
    logger.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred'
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Auth service is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeTokens: storage.resetTokens.size
  });
});

module.exports = router;























