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
function defaultObjectPayload({ objectId, classId }) {
  return {
    id: objectId,
    classId,
    state: process.env.GOOGLE_WALLET_OBJECT_STATE || 'ACTIVE',
    cardTitle: {
      defaultValue: {
        language: 'es-ES',
        value: process.env.GOOGLE_WALLET_CARD_TITLE || 'MUVET',
      },
    },
    header: {
      defaultValue: {
        language: 'es-ES',
        value: process.env.GOOGLE_WALLET_HEADER || 'Membresía MUVET',
      },
    },
    heroImage: {
      sourceUri: {
        uri:
          process.env.GOOGLE_WALLET_HERO_IMAGE_URI ||
          'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg',
      },
      contentDescription: {
        defaultValue: {
          language: 'es-ES',
          value: 'Imagen principal de la tarjeta',
        },
      },
    },
    logo: {
      sourceUri: {
        uri:
          process.env.GOOGLE_WALLET_LOGO_URI ||
          'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg',
      },
      contentDescription: {
        defaultValue: {
          language: 'es-ES',
          value: 'Logo de MUVET',
        },
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: process.env.GOOGLE_WALLET_BARCODE_VALUE || objectId,
    },
    hexBackgroundColor: process.env.GOOGLE_WALLET_BG_COLOR || '#0D47A1',
    textModulesData: [
      {
        id: 'beneficio',
        header: 'Beneficio',
        body: 'Acceso a beneficios exclusivos MUVET.',
      },
    ],
  };
}

function payloadFromMember({
  objectId,
  classId,
  nombre,
  plan,
  ciudad,
  visitasUsadas,
  visitasTotales,
  fechaVencimiento,
  idSocio,
  qrCode,
}) {
  return {
    id: objectId,
    classId,
    state: 'ACTIVE',
    cardTitle: {
      defaultValue: {
        language: 'es-ES',
        value: 'MUVET',
      },
    },
    header: {
      defaultValue: {
        language: 'es-ES',
        value: nombre || 'Socio MUVET',
      },
    },
    subheader: {
      defaultValue: {
        language: 'es-ES',
        value: `Membresía activa · ${ciudad}`,
      },
    },
    logo: {
      sourceUri: {
        uri:
          process.env.GOOGLE_WALLET_LOGO_URI ||
          'https://storage.googleapis.com/wallet-lab-tools-codelab-artifacts-public/pass_google_logo.jpg',
      },
      contentDescription: {
        defaultValue: {
          language: 'es-ES',
          value: 'Logo de MUVET',
        },
      },
    },
    barcode: {
      type: 'QR_CODE',
      value: qrCode || objectId,
      alternateText: idSocio,
    },
    hexBackgroundColor: '#0A0A0A',
    textModulesData: [
      {
        id: 'plan',
        header: 'Plan',
        body: plan,
      },
      {
        id: 'visitas',
        header: 'Visitas',
        body: `${visitasUsadas}/${visitasTotales}`,
      },
      {
        id: 'vigencia',
        header: 'Válido hasta',
        body: fechaVencimiento,
      },
    ],
  };
}

async function createMuvetObject(payload, options = {}) {
  const walletobjects = await getWalletClient();
  const requestBody = payloadFromMember(payload);

  try {
    const response = await walletobjects.genericobject.insert({ requestBody });
    return response.data;
  } catch (error) {
    if (error?.code === 409 || String(error?.message || '').toLowerCase().includes('already exists')) {
      if (!options.updateIfExists) throw error;
      const response = await walletobjects.genericobject.patch({
        resourceId: payload.objectId,
        requestBody,
      });
      return response.data;
    }
    throw error;
  }
}

async function createObject() {
  const issuerId = requireEnv('GOOGLE_WALLET_ISSUER_ID');
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || 'muvet_generic_class';
  const objectSuffix =
    process.argv[2] ||
    process.env.GOOGLE_WALLET_OBJECT_SUFFIX ||
    `muvet_member_${Date.now()}`;

  const classId = `${issuerId}.${classSuffix}`;
  const objectId = `${issuerId}.${objectSuffix}`;

  const walletobjects = await getWalletClient();
  const requestBody = defaultObjectPayload({ objectId, classId });

  try {
    const response = await walletobjects.genericobject.insert({ requestBody });
    console.log('Generic Object creado:', response.data.id);
  } catch (error) {
    if (error?.code === 409) {
      console.log(`El object ${objectId} ya existe.`);
      return;
    }
    throw error;
  }
}

module.exports = {
  createObject,
  createMuvetObject,
};

if (require.main === module) {
  createObject().catch((error) => {
    console.error('Error creando Generic Object:', error.response?.data || error.message);
    process.exit(1);
  });
}
