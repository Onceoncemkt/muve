const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getCredentialsPath() {
  return path.resolve(
    __dirname,
    '..',
    process.env.GOOGLE_WALLET_CREDENTIALS_PATH || 'credentials/service-account.json'
  );
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function signJwt(unsignedToken, privateKey) {
  return crypto.createSign('RSA-SHA256').update(unsignedToken).sign(privateKey, 'base64url');
}

function buildToken({ objectId }) {
  const credentialsPath = getCredentialsPath();
  const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('El JSON de service account no contiene client_email o private_key.');
  }

  const origin = process.env.GOOGLE_WALLET_ORIGIN || 'https://muvet.app';
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    aud: 'google',
    origins: [origin],
    typ: 'savetowallet',
    iat: now,
    exp: now + 60 * 60,
    payload: {
      genericObjects: [
        {
          id: objectId,
        },
      ],
    },
  };

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;
  const signature = signJwt(unsignedToken, serviceAccount.private_key);
  return `${unsignedToken}.${signature}`;
}

function generateAddToWalletLink({ objectId }) {
  const token = buildToken({ objectId });
  return `https://pay.google.com/gp/v/save/${token}`;
}

function generateJwt() {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const objectSuffix = process.argv[2] || process.env.GOOGLE_WALLET_OBJECT_SUFFIX;

  if (!objectSuffix) {
    throw new Error('Debes pasar OBJECT_SUFFIX por .env o como argumento: node src/generateJWT.js <objectSuffix>');
  }

  const objectId = `${issuerId}.${objectSuffix}`;
  const saveUrl = generateAddToWalletLink({ objectId });

  console.log('Save URL:');
  console.log(saveUrl);
}

module.exports = {
  generateJwt,
  generateAddToWalletLink,
};

if (require.main === module) {
  try {
    generateJwt();
  } catch (error) {
    console.error('Error generando JWT:', error.message);
    process.exit(1);
  }
}
