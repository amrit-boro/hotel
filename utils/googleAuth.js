const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8002/api/v1/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        // 1. Check if user exists
        let user = await User.findOne({ email });

        // 2. If not, create user (NO password)
        if (!user) {
          user = await User.create({
            name,
            email,
            googleId: profile.id,
            role: "user",
          });
        }

        // 3. If exists but no googleId → link account
        if (!user.googleId) {
          user.googleId = profile.id;
          await user.save({ validateBeforeSave: false });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

module.exports = passport;
