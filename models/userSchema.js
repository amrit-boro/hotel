const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please tell us your name"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name too long"],
    },

    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      trim: true,

      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
        },
        message: "Please provide a valid email",
      },
    },

    photo: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      enum: ["superadmin", "owner", "user"],
      default: "user",
    },

    googleId: {
      type: String,
      default: null,
    },

    password: {
      type: String,

      required: function () {
        return !this.googleId;
      },

      minlength: [6, "Password must be at least 6 characters"],

      select: false,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },

    passwordChangedAt: Date,

    passwordResetToken: String,

    passwordResetExpires: Date,
  },
  {
    timestamps: true,
  },
);

// ======================================================
// HASH PASSWORD
// ======================================================

UserSchema.pre("save", async function () {
  // only run if password modified
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 12);
});

// ======================================================
// CHECK PASSWORD
// ======================================================

UserSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// ======================================================
// CHECK PASSWORD CHANGED AFTER JWT
// ======================================================

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    return changedTimestamp > JWTTimestamp;
  }

  return false;
};

// ======================================================
// CREATE RESET TOKEN
// ======================================================

UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model("User", UserSchema);
