const User = require('../models/User'); // adjust to your model

const adjustAllUserPlans = async (data) => {
  console.log('🚀 Running weekly adjustment for all users...');

  // Example: fetch all active users and adjust their plans
  const users = await User.find({ isActive: true });

  for (const user of users) {
    try {
      // your adjustment logic here
      console.log(`Adjusting plan for user ${user._id}`);
    } catch (err) {
      console.error(`Failed for user ${user._id}:`, err.message);
    }
  }

  console.log(`✅ Adjusted plans for ${users.length} users`);
};

module.exports = { adjustAllUserPlans };