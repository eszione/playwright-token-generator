# Playwright Token Generator

Generate Entra AccessTokens with Public Clients Flow.

## Setup

1. Install dependencies:
   ```bash
   yarn
   ```

2. Set your environment variables and rename .env.example to .env
   - TEST_CLIENT_ID=your-public-client-id
   - PROD_CLIENT_ID=your-spa-client-id
   - TENANT_ID=your-tenant-id
   - TEST_USER_EMAIL=testuser@yourdomain.com
   - TEST_USER_PASSWORD=your-test-password

3. Run the app:
   ```bash
   yarn start
   ```

## Usage

The app logs the tokens you need for saving into localStorage for a Playwright browser session
