const User = require("../../models/userSchema");
const catchAsync = require("../../utils/catchAsync");

exports.getAllusers = catchAsync(async (req, res, next) => {
  const users = await User.find();
  console.log(users);
  res.status(200).json({
    status: "success",
    data: {
      users,
    },
  });
});
