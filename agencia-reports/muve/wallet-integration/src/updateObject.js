const path = require('path');
const { google } = require('googleapis');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const SCOPES = ['https://www.googleapis.com/auth/wallet_object'];

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

async function getWalletClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: getCredentialsPath(),
    scopes: SCOPES,
  });
  const authClient = await auth.getClient();
  return google.walletobjects({ version: 'v1', auth: authClient });
}

async function updateObject() {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const objectSuffix = process.argv[2] || process.env.GOOGLE_WALLET_OBJECT_SUFFIX;
  const newState = (process.argv[3] || process.env.GOOGLE_WALLET_OBJECT_STATE || 'ACTIVE').toUpperCase();
  const statusText = process.argv[4] || `Actualizado en ${new Date().toISOString()}`;

  if (!objectSuffix) {
    throw new Error('Debes pasar OBJECT_SUFFIX por .env o como argumento: node src/updateObject.js <objectSuffix>');
  }

  const objectId = `${issuerId}.${objectSuffix}`;
  const walletobjects = await getWalletClient();

  const response = await walletobjects.genericobject.patch({
    resourceId: objectId,
    requestBody: {
      state: newState,
      textModulesData: [
        {
          id: 'estado',
          header: 'Estado',
          body: statusText,
        },
      ],
    },
  });

  console.log('Generic Object actualizado:', response.data.id);
}

updateObject().catch((error) => {
  console.error('Error actualizando Generic Object:', error.response?.data || error.message);
  process.exit(1);
});
