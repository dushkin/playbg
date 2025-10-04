import { request } from '@playwright/test';

interface TestUser {
  username: string;
  email: string;
  password: string;
}

const createdUsers: TestUser[] = [];

/**
 * Register a test user and track it for cleanup
 */
export async function registerTestUser(user: TestUser): Promise<void> {
  createdUsers.push(user);
}

/**
 * Clean up all test users created during the test run
 */
export async function cleanupTestUsers(): Promise<void> {
  if (createdUsers.length === 0) return;

  const apiContext = await request.newContext({
    baseURL: process.env.BASE_URL || 'http://localhost:5000',
  });

  for (const user of createdUsers) {
    try {
      // Login to get auth token
      const loginResponse = await apiContext.post('/api/auth/login', {
        data: {
          email: user.email,
          password: user.password,
        },
      });

      if (loginResponse.ok()) {
        const { token } = await loginResponse.json();

        // Delete the user account
        await apiContext.delete('/api/users/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.warn(`Failed to cleanup test user ${user.email}:`, error);
    }
  }

  // Clear the array
  createdUsers.length = 0;

  await apiContext.dispose();
}

/**
 * Direct database cleanup (requires database access)
 * Use this in CI environments or when API deletion is not available
 */
export async function cleanupTestUsersDirectDB(): Promise<void> {
  const { MongoClient } = await import('mongodb');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/playbg';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db();

    // Delete all users with test email patterns
    await db.collection('users').deleteMany({
      $or: [
        { email: { $regex: /^(test|dup|pass)\d+@example\.com$/} },
        { username: { $regex: /^(test|dup1|dup2|pass|user)\d+$/ } }
      ]
    });

  } catch (error) {
    console.warn('Failed to cleanup test users from database:', error);
  } finally {
    await client.close();
  }
}
