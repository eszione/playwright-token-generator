import { PublicClientApplication } from '@azure/msal-node';
import { config } from 'dotenv';
import fs from 'fs';

config();

async function generateTokens() {
  const pca = new PublicClientApplication({
    auth: {
      clientId: process.env.TEST_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    },
  });

  try {
    const response = await pca.acquireTokenByUsernamePassword({
      scopes: [`api://${process.env.PROD_CLIENT_ID}/Authentication`],
      username: process.env.TEST_USER_EMAIL,
      password: process.env.TEST_USER_PASSWORD,
    });

    const msalCache = createMsalCache(response);
    
    fs.writeFileSync('auth-cache.json', JSON.stringify(msalCache, null, 2));
    console.log('✅ Tokens generated successfully!');
    console.log('📁 Saved to auth-cache.json');
    
  } catch (error) {
    console.error('❌ Token generation failed:', error.message);
  }
}

function createMsalCache(tokenResponse) {
  const clientId = process.env.PROD_CLIENT_ID; // Use SPA client ID for cache
  const account = tokenResponse.account;
  const accountKey = `${account.homeAccountId}-${account.environment}-${clientId}`;
  
  return {
    [`msal.account.${accountKey}`]: JSON.stringify({
      homeAccountId: account.homeAccountId,
      environment: account.environment,
      tenantId: account.tenantId,
      username: account.username,
      localAccountId: account.localAccountId,
      name: account.name,
      clientInfo: account.clientInfo,
    }),

    [`msal.idtoken.${accountKey}.${clientId}.${account.tenantId}`]: JSON.stringify({
      credentialType: 'IdToken',
      homeAccountId: account.homeAccountId,
      environment: account.environment,
      clientId: clientId,
      secret: tokenResponse.idToken,
      realm: account.tenantId,
    }),

    [`msal.accesstoken.${accountKey}.${clientId}.${account.tenantId}.authentication`]: JSON.stringify({
      credentialType: 'AccessToken',
      homeAccountId: account.homeAccountId,
      environment: account.environment,
      clientId: clientId,
      secret: tokenResponse.accessToken,
      realm: account.tenantId,
      target: `api://${clientId}/Authentication`,
      expiresOn: Math.floor(Date.now() / 1000) + 3600,
    }),
  };
}

generateTokens();