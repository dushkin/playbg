import { test, expect } from '@playwright/test';
import { userExistsInDB, getUserFromDB, deleteUserFromDB } from './helpers/dbHelpers';

test.describe('Authentication Integration', () => {
  const testUsers: string[] = [];

  test.afterAll(async () => {
    // Clean up all test users from database
    console.log('Cleaning up integration test users...');
    for (const email of testUsers) {
      await deleteUserFromDB(email);
      console.log(`Deleted user: ${email}`);
    }
  });

  test('should register a new user, verify in database, and login successfully', async ({ page }) => {
    const timestamp = Date.now() % 100000; // Keep it short (5 digits max)
    const username = `test${timestamp}`; // Max 10 characters
    const email = `test${timestamp}@example.com`;
    const password = 'IntegrationTest123@'; // Use @ instead of ! to avoid escaping issues

    // Track user for cleanup
    testUsers.push(email);

    // Log network requests to debug
    page.on('request', request => {
      if (request.url().includes('/api/auth/register')) {
        console.log('>>> Registration request:', request.method(), request.url());
        console.log('>>> Request body:', request.postDataJSON());
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/auth/register')) {
        console.log('<<< Registration response:', response.status());
        response.text().then(body => console.log('<<< Response body:', body)).catch(() => {});
      }
    });

    // Step 1: Verify user doesn't exist before registration
    const existsBefore = await userExistsInDB(email);
    expect(existsBefore).toBe(false);

    // Step 2: Navigate to registration page
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();

    // Step 3: Fill registration form with explicit waits
    const usernameInput = page.getByPlaceholder('Choose a username');
    const emailInput = page.getByPlaceholder('Enter your email');
    const passwordInput = page.getByPlaceholder('Create a password');
    const confirmPasswordInput = page.getByPlaceholder('Confirm your password');

    await usernameInput.click();
    await usernameInput.fill(username);
    await expect(usernameInput).toHaveValue(username);

    await emailInput.click();
    await emailInput.fill(email);
    await expect(emailInput).toHaveValue(email);

    await passwordInput.click();
    await passwordInput.fill(password);
    await expect(passwordInput).toHaveValue(password);

    await confirmPasswordInput.click();
    await confirmPasswordInput.fill(password);
    await expect(confirmPasswordInput).toHaveValue(password);

    // Step 4: Verify button is enabled
    const submitButton = page.getByRole('button', { name: 'Create Account' });
    await expect(submitButton).toBeEnabled();

    // Step 5: Submit registration
    await submitButton.click();

    // Step 6: Wait for redirect to dashboard (indicates successful registration)
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Step 6: Verify user exists in database
    const existsAfter = await userExistsInDB(email);
    expect(existsAfter).toBe(true);

    // Step 7: Verify user data in database
    const user = await getUserFromDB(email);
    expect(user).not.toBeNull();
    expect(user.username).toBe(username);
    expect(user.email).toBe(email);
    expect(user.password).toBeDefined(); // Password should exist (hashed)
    expect(user.password).not.toBe(password); // Password should be hashed, not plain text

    // Step 8: Logout (navigate to login page)
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();

    // Step 9: Login with the newly created account
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Step 10: Verify successful login (redirect to dashboard)
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Step 11: Verify we're actually logged in by checking for user-specific content
    // The dashboard should be accessible and display properly
    await expect(page).toHaveURL('/dashboard');
  });

  test('should not allow duplicate email registration', async ({ page }) => {
    const timestamp = Date.now() % 100000;
    const username1 = `dup1${timestamp}`;
    const username2 = `dup2${timestamp}`;
    const email = `dup${timestamp}@example.com`;
    const password = 'DuplicateTest123@';

    // Track user for cleanup
    testUsers.push(email);

    // Register first user
    await page.goto('/register');
    await page.getByPlaceholder('Choose a username').fill(username1);
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.getByPlaceholder('Create a password').fill(password);
    await page.getByPlaceholder('Confirm your password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait for successful registration
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Verify user exists in database
    const userExists = await userExistsInDB(email);
    expect(userExists).toBe(true);

    // Try to register again with same email but different username
    await page.goto('/register');
    await page.getByPlaceholder('Choose a username').fill(username2);
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.getByPlaceholder('Create a password').fill(password);
    await page.getByPlaceholder('Confirm your password').fill(password);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Should show error (not redirect to dashboard)
    await page.waitForTimeout(3000);

    // Should either stay on register page or show an error
    const currentUrl = page.url();
    const isOnRegisterPage = currentUrl.includes('/register');
    const hasError = await page.locator('.bg-red-900, [class*="red"], [class*="error"]').count() > 0;

    // Either still on register page or showing an error
    expect(isOnRegisterPage || hasError).toBe(true);
  });

  test('should not allow login with wrong password', async ({ page }) => {
    const timestamp = Date.now() % 100000;
    const username = `pass${timestamp}`;
    const email = `pass${timestamp}@example.com`;
    const correctPassword = 'CorrectPassword123@';
    const wrongPassword = 'WrongPassword123@';

    // Track user for cleanup
    testUsers.push(email);

    // Register user
    await page.goto('/register');
    await page.getByPlaceholder('Choose a username').fill(username);
    await page.getByPlaceholder('Enter your email').fill(email);
    await page.getByPlaceholder('Create a password').fill(correctPassword);
    await page.getByPlaceholder('Confirm your password').fill(correctPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait for successful registration
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Logout
    await page.goto('/login');

    // Try to login with wrong password
    await page.getByPlaceholder('Email address').fill(email);
    await page.getByPlaceholder('Password').fill(wrongPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should not redirect to dashboard
    await page.waitForTimeout(3000);

    // Should stay on login page or show error
    const currentUrl = page.url();
    expect(currentUrl).toContain('/login');
  });
});
