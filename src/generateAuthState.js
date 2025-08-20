import { chromium } from 'playwright';
import { config } from 'dotenv';
import fs from 'fs';

config();

async function generateAuthState() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to your portal login page
    await page.goto('https://motek.dev.thlonline.com/');
    console.log('🔐 Starting from portal login page...');
    
    // Click the login button (only button on the page)
    try {
      await page.waitForSelector('button', { timeout: 10000 });
      await page.click('button');
      console.log('✅ Clicked login button');
    } catch (error) {
      console.log('⚠️ Login button not found, page might redirect automatically');
    }
    
    console.log('🔐 Automating login process...');

    // Wait for and fill username
    try {
      await page.waitForSelector('input[type="email"], input[name="loginfmt"], input[name="UserName"]', { timeout: 10000 });
      await page.fill('input[type="email"], input[name="loginfmt"], input[name="UserName"]', process.env.TEST_USER_EMAIL);
      await page.click('input[type="submit"], button[type="submit"]');
      console.log('✅ Username entered');
    } catch (error) {
      console.log('⚠️ Username field not found, continuing...');
    }

    // Handle ADFS/STS login page (federated authentication)
    try {
      await page.waitForURL('**/adfs/ls/**', { timeout: 10000 });
      console.log('🔄 Redirected to ADFS, filling password...');
      
      // Wait for password field and fill it
      await page.waitForSelector('input[type="password"]', { timeout: 5000 });
      await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD);
      console.log('✅ ADFS password filled');
      
      // Submit form
      await page.keyboard.press('Enter');
      console.log('✅ ADFS form submitted');
      
    } catch (error) {
      console.log('⚠️ ADFS page not found or already handled, continuing...');
    }

    // Handle "Stay signed in?" prompt
    try {
      await page.waitForSelector('input[value="Yes"], input[value="No"]', { timeout: 10000 });
      await page.click('input[value="No"]'); // Choose No to avoid persistent session
      console.log('✅ Stay signed in prompt handled');
    } catch (error) {
      console.log('⚠️ Stay signed in prompt not found, continuing...');
    }

    console.log('⏳ Waiting for redirect to portal...');
    
    // Wait for redirect to your portal
    try {
      await page.waitForURL('https://motek.dev.thlonline.com/**', { timeout: 60000 });
      console.log('✅ Successfully redirected to portal');
      await page.waitForLoadState('networkidle');
    } catch (error) {
      console.log('⚠️ Portal redirect timeout, continuing...');
    }

    // Save complete browser state (localStorage, sessionStorage, cookies)
    const authState = await context.storageState();
    fs.writeFileSync('auth-state.json', JSON.stringify(authState, null, 2));

    // Also save just the localStorage for debugging
    const localStorage = await page.evaluate(() => {
      const storage = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('msal.')) {
          storage[key] = localStorage.getItem(key);
        }
      }
      return storage;
    });
    fs.writeFileSync('localStorage.json', JSON.stringify(localStorage, null, 2));

    console.log('✅ Authentication state saved!');
    console.log('📁 Complete state: auth-state.json');
    console.log('📁 localStorage only: localStorage.json');

  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
  } finally {
    await browser.close();
  }
}

generateAuthState();