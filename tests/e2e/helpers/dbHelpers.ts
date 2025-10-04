import { MongoClient } from 'mongodb';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/playbg';

/**
 * Check if a user exists in the database
 */
export async function userExistsInDB(email: string): Promise<boolean> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db();
    const user = await db.collection('users').findOne({ email });
    return user !== null;
  } catch (error) {
    console.error('Error checking user in database:', error);
    return false;
  } finally {
    await client.close();
  }
}

/**
 * Get user from database
 */
export async function getUserFromDB(email: string): Promise<any> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db();
    const user = await db.collection('users').findOne({ email });
    return user;
  } catch (error) {
    console.error('Error getting user from database:', error);
    return null;
  } finally {
    await client.close();
  }
}

/**
 * Delete user from database
 */
export async function deleteUserFromDB(email: string): Promise<boolean> {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db();
    const result = await db.collection('users').deleteOne({ email });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting user from database:', error);
    return false;
  } finally {
    await client.close();
  }
}
