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

async function createClass() {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const classSuffix = process.argv[2] || process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'muvet_generic_class';
  const classId = `${issuerId}.${classSuffix}`;

  const walletobjects = await getWalletClient();

  const classPayload = {
    id: classId,
    issuerName: process.env.GOOGLE_WALLET_ISSUER_NAME || 'MUVET',
    reviewStatus: 'UNDER_REVIEW',
  };

  try {
    const response = await walletobjects.genericclass.insert({
      requestBody: classPayload,
    });
    console.log('Generic Class creada:', response.data.id);
  } catch (error) {
    if (error?.code === 409) {
      console.log(`La class ${classId} ya existe.`);
      return;
    }
    throw error;
  }
}

createClass().catch((error) => {
  console.error('Error creando Generic Class:', error.response?.data || error.message);
  process.exit(1);
});
