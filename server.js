const mongoose = require("mongoose");
const dotenv = require("dotenv");

// 1. IMPORT THE SERVER (which wraps the app)
const server = require("./index");

dotenv.config({ path: "./.env" });

const DB = process.env.DATABASE.replace(
  "<db_password>",
  process.env.DATABASE_PASSWORD,
);

mongoose.connect(DB).then(() => {
  console.log("DB connection successful");
});

const PORT = process.env.PORT || 8002;

// 2. LISTEN ON THE SERVER INSTANCE
// If you use 'app.listen' here, Socket.IO will NOT work!
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port:", PORT);
});
