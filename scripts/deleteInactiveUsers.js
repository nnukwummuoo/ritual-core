const mongoose = require('mongoose');
const userdb = require('../Creators/userdb');
const deletedbs = require('../utiils/Deletes/deleteaccount');

// Connect to database
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mmekosocial');
        console.log('MongoDB connected for inactive user cleanup');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const cleanupInactiveUsers = async () => {
    try {
       const now = new Date();
        const thirtySixMonthsAgo = new Date(now.getTime() - (1080 * 24 * 60 * 60 * 1000)); // Approx 36 months

        console.log(`Starting cleanup for users inactive since: ${thirtySixMonthsAgo.toISOString()}`);

        const inactiveQuery = {
            $or: [
                { lastActive: { $lt: thirtySixMonthsAgo } },
                {
                    lastActive: { $exists: false },
                    updatedAt: { $lt: thirtySixMonthsAgo }
                }
            ]
        };

        // Count users first
        const count = await userdb.countDocuments(inactiveQuery);
        console.log(`Found ${count} inactive users eligible for deletion.`);

        if (count === 0) {
            console.log('No inactive users found.');
            return;
        }

        // Process in batches to avoid memory issues
        const batchSize = 50;
        let processed = 0;

        // We use cursor to stream users
        const cursor = userdb.find(inactiveQuery).cursor();

        for (let user = await cursor.next(); user != null; user = await cursor.next()) {
            try {
                console.log(`Deleting inactive user: ${user.username || 'Unknown'} (${user._id}) - Last active: ${user.lastActive || user.updatedAt}`);

                // Call the deletion utility
                await deletedbs(user._id.toString());

                processed++;
                if (processed % 10 === 0) {
                    console.log(`Processed ${processed}/${count} users...`);
                }
            } catch (err) {
                console.error(`Failed to delete user ${user._id}:`, err);
            }
        }

        console.log(`Cleanup complete. deleted ${processed} users.`);

    } catch (err) {
        console.error("Error during inactive user cleanup:", err);
    }
};

// Run the script
const runScript = async () => {
    if (!process.env.MONGODB_URI) {
        // Load env vars if not present (e.g. from .env file if we were using dotenv, 
        // but assuming context has it or hardcoded fallback)
        require('dotenv').config({ path: __dirname + '/../.env' });
    }

    await connectDB();
    await cleanupInactiveUsers();
    process.exit(0);
};

// Run if called directly
if (require.main === module) {
    runScript();
}

module.exports = { cleanupInactiveUsers };
