# Wallet Integration (Google Wallet API) - MUVET

Integración base en Node.js para Google Wallet usando la librería oficial `googleapis`.

## Estructura

```
wallet-integration/
├── credentials/
│   └── .gitkeep
├── src/
│   ├── createClass.js
│   ├── createObject.js
│   ├── generateJWT.js
│   └── updateObject.js
├── .env.example
└── README.md
```

## Requisitos

- Node.js 18+
- Issuer de Google Wallet configurado
- Service account con permisos de Wallet Objects

## Setup

1. Copia el JSON del service account en `wallet-integration/credentials/service-account.json`
2. Crea el archivo `.env` en `wallet-integration/` basándote en `.env.example`
3. Instala dependencias dentro de `wallet-integration`:

```bash
npm init -y
npm install googleapis dotenv
```

## Scripts

Desde `wallet-integration/`:

### 1) Crear Generic Class
```bash
node src/createClass.js
```

Opcional: enviar sufijo custom:
```bash
node src/createClass.js mi_class_suffix
```

### 2) Crear Generic Object
```bash
node src/createObject.js
```

Opcional: enviar sufijo custom:
```bash
node src/createObject.js mi_object_suffix
```

### 3) Generar JWT / Save URL
```bash
node src/generateJWT.js
```

Opcional: enviar object suffix:
```bash
node src/generateJWT.js mi_object_suffix
```

### 4) Actualizar Generic Object
```bash
node src/updateObject.js mi_object_suffix ACTIVE "Renovación vigente"
```

## Notas

- `createClass.js` crea la clase con `reviewStatus: UNDER_REVIEW`.
- `generateJWT.js` construye y firma el JWT con la clave privada del service account.
- El JSON de credenciales está excluido de git en `.gitignore`.
