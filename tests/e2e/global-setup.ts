import waitForServices from './helpers/wait-for-services';

/**
 * Global setup runs once before all tests
 * Ensures both frontend and backend services are ready
 */
async function globalSetup() {
  console.log('Running global setup...');
  await waitForServices();
}

export default globalSetup;
