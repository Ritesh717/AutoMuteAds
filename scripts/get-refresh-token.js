import http from 'http';
import https from 'https';
// We use Node.js readline to prompt the user
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('==================================================');
  console.log('  Google OAuth2 Refresh Token Generator Helper');
  console.log('==================================================\n');
  console.log('Prerequisites:');
  console.log('1. Go to Google Cloud Console (https://console.cloud.google.com).');
  console.log('2. Create a project and enable the "Chrome Web Store API".');
  console.log('3. Configure the OAuth Consent Screen (External/Testing).');
  console.log('4. Create OAuth Client ID credentials (type: Web Application).');
  console.log('5. Add "http://localhost:8080" as an Authorized Redirect URI.\n');

  const clientId = (await question('Enter your OAuth Client ID: ')).trim();
  const clientSecret = (await question('Enter your OAuth Client Secret: ')).trim();

  if (!clientId || !clientSecret) {
    console.error('Error: Both Client ID and Client Secret are required.');
    rl.close();
    process.exit(1);
  }

  const port = 8080;
  const redirectUri = `http://localhost:${port}`;
  
  // Create authentication URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `response_type=code&` +
    `scope=https://www.googleapis.com/auth/chromewebstore&` +
    `access_type=offline&` +
    `prompt=consent`;

  const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const code = urlObj.searchParams.get('code');

    if (code) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Authorization Successful!</h1><p>You can close this tab and return to the terminal.</p>');
      
      // Stop the server and exchange the code
      server.close();
      exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);
    } else {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Authorization code missing.');
    }
  });

  server.listen(port, () => {
    console.log('\n--------------------------------------------------');
    console.log('Step 1: Open the following URL in your web browser:\n');
    console.log(authUrl);
    console.log('\nStep 2: Sign in and click "Continue/Allow".');
    console.log('--------------------------------------------------\n');
    console.log('Waiting for authorization redirect on port 8080...');
  });
}

function exchangeCodeForTokens(code, clientId, clientSecret, redirectUri) {
  const postData = JSON.stringify({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });

  const options = {
    hostname: 'oauth2.googleapis.com',
    port: 443,
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let responseBody = '';

    res.on('data', (chunk) => {
      responseBody += chunk;
    });

    res.on('end', () => {
      rl.close();
      if (res.statusCode === 200) {
        try {
          const tokens = JSON.parse(responseBody);
          console.log('\n==================================================');
          console.log('  SUCCESS! Tokens retrieved successfully.');
          console.log('==================================================\n');
          console.log('Google OAuth2 Refresh Token:');
          console.log('\x1b[32m%s\x1b[0m', tokens.refresh_token);
          console.log('\nCopy this Refresh Token and save it in your GitHub repository secrets as REFRESH_TOKEN.');
          console.log('Note: Keep this token highly secure!\n');
        } catch (e) {
          console.error('Failed to parse tokens response:', e);
        }
      } else {
        console.error(`\nError exchanging code (HTTP ${res.statusCode}):`);
        console.error(responseBody);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Network error requesting tokens:', e);
    rl.close();
  });

  req.write(postData);
  req.end();
}

main().catch(console.error);
