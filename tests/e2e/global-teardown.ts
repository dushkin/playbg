import { cleanupTestUsersDirectDB } from './helpers/cleanup';

/**
 * Global teardown runs after all test files have completed
 * This ensures all test users are cleaned up even if individual test cleanup fails
 */
async function globalTeardown() {
  console.log('Running global teardown...');

  try {
    await cleanupTestUsersDirectDB();
    console.log('Test users cleaned up successfully');
  } catch (error) {
    console.error('Failed to cleanup test users:', error);
  }
}

export default globalTeardown;
