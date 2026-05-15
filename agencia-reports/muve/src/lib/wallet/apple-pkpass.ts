import { createHash } from 'crypto'
import forge from 'node-forge'
import JSZip from 'jszip'
import { obtenerWWDRPem } from './apple-wwdr'

export type ApplePassFields = {
  organizationName: string
  description: string
  passTypeIdentifier: string
  teamIdentifier: string
  serialNumber: string
  foregroundColor: string
  backgroundColor: string
  labelColor: string
  nombre: string
  plan: string
  ciudad: string
  creditosTexto: string
  validoHasta: string
  qrValue: string
  webServiceURL?: string | null
  authenticationToken?: string | null
  infoComoUsar: string
  contacto: string
  headerMarca?: string
}

export type ApplePassAssets = {
  iconPng: Buffer
  icon2xPng: Buffer
  logoPng?: Buffer | null
  logo2xPng?: Buffer | null
  thumbnailPng?: Buffer | null
  thumbnail2xPng?: Buffer | null
}

export type AppleCertConfig = {
  signerP12Base64: string
  signerP12Password: string
}

function buildPassJson(fields: ApplePassFields): Record<string, unknown> {
  return {
    formatVersion: 1,
    passTypeIdentifier: fields.passTypeIdentifier,
    teamIdentifier: fields.teamIdentifier,
    serialNumber: fields.serialNumber,
    organizationName: fields.organizationName,
    description: fields.description,
    foregroundColor: fields.foregroundColor,
    backgroundColor: fields.backgroundColor,
    labelColor: fields.labelColor,
    ...(fields.webServiceURL && fields.authenticationToken
      ? {
        webServiceURL: fields.webServiceURL,
        authenticationToken: fields.authenticationToken,
      }
      : {}),
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: fields.qrValue,
      messageEncoding: 'iso-8859-1',
      altText: 'Pase MUVET',
    },
    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: fields.qrValue,
        messageEncoding: 'iso-8859-1',
        altText: 'Pase MUVET',
      },
    ],
    generic: {
      headerFields: [
        {
          key: 'marca',
          label: '',
          value: fields.headerMarca ?? 'WELLNESS CLUB',
        },
      ],
      primaryFields: [
        {
          key: 'nombre',
          label: 'MIEMBRO',
          value: fields.nombre,
        },
      ],
      secondaryFields: [
        {
          key: 'plan',
          label: 'PLAN',
          value: fields.plan,
        },
        {
          key: 'ciudad',
          label: 'CIUDAD',
          value: fields.ciudad,
        },
      ],
      auxiliaryFields: [
        {
          key: 'creditos',
          label: 'CRÉDITOS',
          value: fields.creditosTexto,
        },
        {
          key: 'valido',
          label: 'VÁLIDO HASTA',
          value: fields.validoHasta,
        },
      ],
      backFields: [
        {
          key: 'info',
          label: '¿Cómo usar tu pase?',
          value: fields.infoComoUsar,
        },
        {
          key: 'contacto',
          label: 'Contacto',
          value: fields.contacto,
        },
      ],
    },
  }
}

function sha1Hex(buffer: Buffer): string {
  return createHash('sha1').update(buffer).digest('hex')
}

function signManifest(
  manifestJson: string,
  cert: AppleCertConfig,
): Buffer {
  const wwdrPem = obtenerWWDRPem()
  if (!wwdrPem) {
    throw new Error('Falta APPLE_WWDR_PEM_BASE64 (cert WWDR G3 de Apple en base64)')
  }
  if (!cert.signerP12Base64) {
    throw new Error('Falta APPLE_CERT_P12_BASE64')
  }
  if (typeof cert.signerP12Password !== 'string') {
    throw new Error('Falta APPLE_CERT_PASSWORD')
  }

  const wwdrCert = forge.pki.certificateFromPem(wwdrPem)
  const p12Der = forge.util.decode64(cert.signerP12Base64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, cert.signerP12Password)

  let signerCert: forge.pki.Certificate | null = null
  let signerKey: forge.pki.rsa.PrivateKey | null = null

  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        signerCert = safeBag.cert
      } else if (
        (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag
          || safeBag.type === forge.pki.oids.keyBag)
        && safeBag.key
      ) {
        signerKey = safeBag.key as forge.pki.rsa.PrivateKey
      }
    }
  }

  if (!signerCert) throw new Error('No se encontró certificado en el P12')
  if (!signerKey) throw new Error('No se encontró llave privada en el P12')

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(manifestJson, 'utf8')
  p7.addCertificate(signerCert)
  p7.addCertificate(wwdrCert)
  p7.addSigner({
    key: signerKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      {
        type: forge.pki.oids.contentType,
        value: forge.pki.oids.data,
      },
      {
        type: forge.pki.oids.messageDigest,
      },
      {
        type: forge.pki.oids.signingTime,
        value: new Date().toString(),
      },
    ],
  })
  p7.sign({ detached: true })

  const derSignature = forge.asn1.toDer(p7.toAsn1()).getBytes()
  return Buffer.from(derSignature, 'binary')
}

export async function generarPkpass(
  fields: ApplePassFields,
  assets: ApplePassAssets,
  cert: AppleCertConfig,
): Promise<Buffer> {
  const passJsonBuffer = Buffer.from(JSON.stringify(buildPassJson(fields), null, 2), 'utf8')

  const files: Record<string, Buffer> = {
    'pass.json': passJsonBuffer,
    'icon.png': assets.iconPng,
    'icon@2x.png': assets.icon2xPng,
  }
  if (assets.logoPng) files['logo.png'] = assets.logoPng
  if (assets.logo2xPng) files['logo@2x.png'] = assets.logo2xPng
  if (assets.thumbnailPng) files['thumbnail.png'] = assets.thumbnailPng
  if (assets.thumbnail2xPng) files['thumbnail@2x.png'] = assets.thumbnail2xPng

  const manifest: Record<string, string> = {}
  for (const [name, buffer] of Object.entries(files)) {
    manifest[name] = sha1Hex(buffer)
  }
  const manifestJson = JSON.stringify(manifest)
  const signature = signManifest(manifestJson, cert)

  const zip = new JSZip()
  for (const [name, buffer] of Object.entries(files)) {
    zip.file(name, buffer)
  }
  zip.file('manifest.json', manifestJson)
  zip.file('signature', signature)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
