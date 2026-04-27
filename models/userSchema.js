const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please tell us your name!"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    phone: {
      type: String,
      required: [true, "Please provide your phone number"],
      unique: true,
      match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],
    },
    photo: String,
    role: {
      type: String,
      enum: ["superadmin", "owner"],
      default: "owner",
    },
    password: {
      type: String,
      required: [true, "Please provide a password"],
      minlength: 8,
      select: false, // Security: Never show password in output
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        // This only works on CREATE and SAVE!!!
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords are not the same!",
      },
    },
    passwordChangedAt: Date, // Tracks when password was last changed
    passwordResetToken: String, // Stores the Hashed Token
    passwordResetExpires: Date, // Stores the Expiry Time
  },
  {
    timestamps: true,
  },
);

// ===============================================================================================
// Pre
// ===============================================================================================
// --- MIDDLEWARE: Encryption & Cleanup ---

// --- MIDDLEWARE: Encryption & Cleanup ---

UserSchema.pre("save", async function () {
  // 1. If password wasn't modified, exit the function immediately.
  // (In an async function, 'return' acts like 'next()')
  if (!this.isModified("password")) return;

  // 2. Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // 3. Delete passwordConfirm field
  this.passwordConfirm = undefined;

  // No need to call next()!
  // When this function finishes successfully, Mongoose moves on.
});

UserSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Inside models/User.js

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    // Convert date to timestamp (seconds) to match JWT format
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    // If password changed time > token issue time, then token is OLD/INVALID
    return changedTimestamp > JWTTimestamp;
  }

  // False means password was NOT changed
  return false;
};

UserSchema.methods.createPasswordResetToken = function () {
  // 1. Generate a random 32-character hex string
  const resetToken = crypto.randomBytes(32).toString("hex");

  // 2. Hash it and save to Database (Security: Never save raw tokens)
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // 3. Set expiration (10 minutes from now)
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  // 4. Return the RAW token (to send in email)
  return resetToken;
};

module.exports = mongoose.model("User", UserSchema);
