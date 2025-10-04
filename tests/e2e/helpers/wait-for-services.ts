/**
 * Waits for both frontend and backend services to be ready
 */
async function waitForServices() {
  const maxAttempts = 60; // 60 seconds total
  const delay = 1000; // 1 second between attempts

  console.log('Waiting for services to be ready...');

  // Wait for frontend
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:3000');
      if (response.ok || response.status === 404) {
        console.log('✓ Frontend is ready on port 3000');
        break;
      }
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('Frontend failed to start on port 3000');
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Wait for backend
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      // Any response (even error) means the backend is running
      console.log('✓ Backend is ready on port 5000');
      break;
    } catch (error) {
      if (i === maxAttempts - 1) {
        throw new Error('Backend failed to start on port 5000');
      }
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  console.log('✓ All services are ready!');
}

export default waitForServices;
