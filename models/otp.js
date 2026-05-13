const mongoose = require("mongoose");
const crypto = require("crypto");

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || "10", 10);
const MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);
const COOLDOWN_MINUTES = parseInt(process.env.OTP_COOLDOWN_MINUTES || "1", 10);

// ─── Schema ───────────────────────────────────────────────────────────────────

const otpSchema = new mongoose.Schema(
  {
    // Who this OTP belongs to
    identifier: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
      // Can be email, phone number, or userId
    },

    identifierType: {
      type: String,
      enum: ["email", "phone", "userId"],
      required: true,
    },

    // Hashed OTP — never store plain text
    otpHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },

    purpose: {
      type: String,
      enum: [
        "email_verification",
        "phone_verification",
        "password_reset",
        "two_factor_auth",
        "login",
        "transaction",
      ],
      required: true,
    },

    // Expiry via MongoDB TTL index (set below)
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },

    // Rate-limiting & abuse prevention
    attempts: {
      type: Number,
      default: 0,
      max: MAX_ATTEMPTS,
    },

    maxAttempts: {
      type: Number,
      default: MAX_ATTEMPTS,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    isRevoked: {
      type: Boolean,
      default: false,
    },

    // Cooldown: block resend until this time
    resendAllowedAt: {
      type: Date,
      default: () => new Date(Date.now() + COOLDOWN_MINUTES * 60 * 1000),
    },

    // Delivery tracking
    deliveryChannel: {
      type: String,
      enum: ["sms", "email", "whatsapp", "authenticator"],
      required: true,
    },

    deliveryStatus: {
      type: String,
      enum: ["pending", "sent", "failed"],
      default: "pending",
    },

    // Security context — useful for anomaly detection
    ipAddress: {
      type: String,
      trim: true,
    },

    userAgent: {
      type: String,
      trim: true,
    },

    // Link to a user document if they're already registered
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Metadata for extensibility (e.g. transaction details, device info)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: "otps",
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

// TTL index — MongoDB auto-deletes expired documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast lookups by identifier + purpose
otpSchema.index({ identifier: 1, purpose: 1, isVerified: 1, isRevoked: 1 });

// Compound index for user-based queries
otpSchema.index({ userId: 1, purpose: 1 });

// ─── Static Methods ───────────────────────────────────────────────────────────

/**
 * Hash a plain-text OTP using SHA-256
 */
otpSchema.statics.hashOtp = function (plainOtp) {
  return crypto.createHash("sha256").update(plainOtp).digest("hex");
};

/**
 * Generate a cryptographically secure numeric OTP
 * @param {number} length - OTP digit length (default: 6)
 */
otpSchema.statics.generateOtp = function (length = 6) {
  const max = Math.pow(10, length);
  const randomBytes = crypto.randomBytes(4);
  const randomNum = randomBytes.readUInt32BE(0) % max;
  return String(randomNum).padStart(length, "0");
};

/**
 * Create and save a new OTP record
 */
otpSchema.statics.createOtp = async function ({
  identifier,
  identifierType,
  purpose,
  deliveryChannel,
  ipAddress,
  userAgent,
  userId = null,
  metadata = {},
  otpLength = 6,
}) {
  // Revoke any existing active OTPs for the same identifier + purpose
  await this.revokeExisting(identifier, purpose);

  const plainOtp = this.generateOtp(otpLength);
  const otpHash = this.hashOtp(plainOtp);

  const otpRecord = await this.create({
    identifier,
    identifierType,
    purpose,
    otpHash,
    deliveryChannel,
    ipAddress,
    userAgent,
    userId,
    metadata,
  });

  // Return the plain OTP ONCE for delivery — never persisted in plain text
  return { otpRecord, plainOtp };
};

/**
 * Verify an OTP attempt
 */
otpSchema.statics.verifyOtp = async function (identifier, purpose, plainOtp) {
  const record = await this.findOne({
    identifier,
    purpose,
    isVerified: false,
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).select("+otpHash");

  if (!record) {
    return { success: false, reason: "OTP not found or expired" };
  }

  if (record.attempts >= record.maxAttempts) {
    return { success: false, reason: "Max attempts exceeded" };
  }

  const inputHash = this.hashOtp(plainOtp);
  const isMatch = inputHash === record.otpHash;

  if (!isMatch) {
    record.attempts += 1;
    await record.save();

    const remaining = record.maxAttempts - record.attempts;
    return {
      success: false,
      reason: "Invalid OTP",
      attemptsRemaining: remaining,
    };
  }

  record.isVerified = true;
  await record.save();

  return { success: true, record };
};

/**
 * Revoke all active OTPs for a given identifier + purpose
 */
otpSchema.statics.revokeExisting = async function (identifier, purpose) {
  return this.updateMany(
    { identifier, purpose, isVerified: false, isRevoked: false },
    { $set: { isRevoked: true } },
  );
};

/**
 * Check if a resend is currently allowed (cooldown guard)
 */
otpSchema.statics.canResend = async function (identifier, purpose) {
  const recent = await this.findOne({
    identifier,
    purpose,
    isRevoked: false,
    resendAllowedAt: { $gt: new Date() },
  });

  if (recent) {
    const waitSeconds = Math.ceil((recent.resendAllowedAt - Date.now()) / 1000);
    return { allowed: false, waitSeconds };
  }

  return { allowed: true };
};

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Mark delivery status after sending
 */
otpSchema.methods.markDelivered = function (status = "sent") {
  this.deliveryStatus = status;
  return this.save();
};

// ─── Model ────────────────────────────────────────────────────────────────────

const OtpModel = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

module.exports = OtpModel;
