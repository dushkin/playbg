import mongoose from 'mongoose';
import { User } from '../models/User';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const KEEP_EMAILS = ['taltene@gmail.com', 'taltabtal@gmail.com'];

async function cleanupUsers() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/playbg';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Find all users
    const allUsers = await User.find({});
    console.log(`Total users in database: ${allUsers.length}`);

    // Delete users not in the keep list
    const result = await User.deleteMany({
      email: { $nin: KEEP_EMAILS }
    });

    console.log(`Deleted ${result.deletedCount} users`);

    // Show remaining users
    const remainingUsers = await User.find({});
    console.log('\nRemaining users:');
    remainingUsers.forEach(user => {
      console.log(`- ${user.email} (${user.username})`);
    });

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupUsers();
