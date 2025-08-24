import { chromium } from 'playwright';
import { config } from 'dotenv';
import fs from 'fs';
import { execSync } from 'child_process';

config();

function isAuthStateValid() {
  try {
    if (!fs.existsSync('auth-state.json')) {
      console.log('📄 No auth-state.json found');
      return false;
    }

    const authState = JSON.parse(fs.readFileSync('auth-state.json', 'utf8'));
    
    // Check if cookies exist and are not expired
    const msftCookies = authState.cookies?.filter(cookie => 
      cookie.domain.includes('microsoftonline.com') || 
      cookie.domain.includes('thlonline.com')
    );

    if (!msftCookies || msftCookies.length === 0) {
      console.log('🍪 No Microsoft cookies found');
      return false;
    }

    // Check if critical persistent cookies are expired (ignore session cookies)
    const now = Date.now() / 1000;
    const criticalCookies = ['ESTSAUTHPERSISTENT', 'fpc', 'buid'];
    
    const expiredCriticalCookies = msftCookies.filter(cookie => 
      criticalCookies.includes(cookie.name) && 
      cookie.expires && 
      cookie.expires > 0 && // Ignore session cookies (expires = -1)
      cookie.expires < now
    );

    if (expiredCriticalCookies.length > 0) {
      console.log(`⏰ Critical cookies expired: ${expiredCriticalCookies.map(c => c.name).join(', ')}`);
      return false;
    }
    
    // Check if we have the essential persistent cookie
    const hasEssentialCookie = msftCookies.some(cookie => 
      cookie.name === 'ESTSAUTHPERSISTENT' && cookie.expires > now
    );
    
    if (!hasEssentialCookie) {
      console.log('🍪 Missing essential authentication cookie');
      return false;
    }

    // Check file age (regenerate if older than 50 minutes)
    const stats = fs.statSync('auth-state.json');
    const ageMinutes = (Date.now() - stats.mtime.getTime()) / (1000 * 60);
    
    if (ageMinutes > 50) {
      console.log(`⏰ Auth state is ${Math.round(ageMinutes)} minutes old, regenerating`);
      return false;
    }

    console.log(`✅ Auth state is valid (${Math.round(ageMinutes)} minutes old)`);
    return true;

  } catch (error) {
    console.log('❌ Error checking auth state:', error.message);
    return false;
  }
}

async function testAuthState() {
  console.log('🧪 Testing auth state validity...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: 'auth-state.json' });
  const page = await context.newPage();

  try {
    await page.goto('https://motek.dev.thlonline.com/');
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    
    // Check if we're redirected to login (indicates invalid auth)
    const currentUrl = page.url();
    const isLoggedIn = !currentUrl.includes('login') && !currentUrl.includes('oauth2');
    
    await browser.close();
    
    if (isLoggedIn) {
      console.log('✅ Auth state test passed - user is logged in');
      return true;
    } else {
      console.log('❌ Auth state test failed - redirected to login');
      return false;
    }
    
  } catch (error) {
    await browser.close();
    console.log('❌ Auth state test failed:', error.message);
    return false;
  }
}

async function ensureValidAuth(options = {}) {
  const { skipDeepTest = true, openHomepage = false } = options;
  
  console.log('🔐 Ensuring valid authentication state...');

  // Quick file-based check first
  if (!isAuthStateValid()) {
    console.log('🔄 Generating new auth state...');
    try {
      execSync('node src/generateAuthState.js', { stdio: 'inherit' });
      console.log('✅ Auth state regeneration completed');
      
      // Verify the new auth state was created
      if (fs.existsSync('auth-state.json')) {
        const newAuthState = JSON.parse(fs.readFileSync('auth-state.json', 'utf8'));
        console.log(`🍪 New auth state has ${newAuthState.cookies?.length || 0} cookies`);
      }
    } catch (error) {
      console.error('❌ Auth state regeneration failed:', error.message);
    }
    return;
  }

  if (skipDeepTest) {
    console.log('✅ Auth state validation passed - ready to use!');
    
    if (openHomepage) {
      console.log('🏠 Opening homepage with authenticated session...');
      await openAuthenticatedHomepage();
    }
    return;
  }

  // Optional deeper test by actually trying to use the auth state
  const isValid = await testAuthState();
  
  if (!isValid) {
    console.log('🔄 Auth state invalid, generating new one...');
    execSync('node src/generateAuthState.js', { stdio: 'inherit' });
  } else {
    console.log('✅ Existing auth state is valid and ready to use!');
    
    if (openHomepage) {
      console.log('🏠 Opening homepage with authenticated session...');
      await openAuthenticatedHomepage();
    }
  }
}

async function openAuthenticatedHomepage() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'auth-state.json' });
  const page = await context.newPage();

  try {
    await page.goto('https://motek.dev.thlonline.com/');
    console.log('✅ Homepage opened with authenticated session!');
    console.log('📋 Browser will stay open - close manually when done');
    
    // Keep browser open - don't close automatically
    // User can close manually when done
    
  } catch (error) {
    console.error('❌ Failed to open homepage:', error.message);
    await browser.close();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const openHomepage = process.argv.includes('--open');
  ensureValidAuth({ openHomepage }).catch(console.error);
}

export { ensureValidAuth, isAuthStateValid, testAuthState, openAuthenticatedHomepage };