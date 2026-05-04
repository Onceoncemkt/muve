# TWA de Muvet (`https://muvet.mx`)
## Archivos incluidos
- `build.gradle`: configuración base de la app Android (package `mx.muvet.app`) y placeholders TWA.
- `app/src/main/AndroidManifest.xml`: actividad `LauncherActivity` para TWA y URL por defecto.
- `assetlinks.json`: archivo para publicar en `https://muvet.mx/.well-known/assetlinks.json`.

## Pasos para abrir en Android Studio
1. Abre Android Studio.
2. Selecciona **Open** y elige la carpeta `twa`.
3. Espera a que termine el **Gradle Sync**.
4. Si Android Studio lo pide, instala la versión de SDK/Build Tools sugerida.

## Generar Android App Bundle (`.aab`)
1. En Android Studio: **Build > Generate Signed Bundle / APK...**
2. Selecciona **Android App Bundle**.
3. Crea o selecciona un **keystore** de firma.
4. Elige el build type `release`.
5. Finaliza el asistente; el `.aab` quedará en `twa/app/release/` o en la ruta que indique Android Studio.

## Publicar `assetlinks.json`
1. Reemplaza en `assetlinks.json` el valor:
   - `REEMPLAZAR_CON_SHA256_DEL_CERTIFICADO_DE_FIRMA`
2. Obtén el SHA256 del certificado de firma (ejemplo):
   - `keytool -list -v -keystore <tu-keystore.jks> -alias <tu-alias>`
3. Publica el JSON final en:
   - `https://muvet.mx/.well-known/assetlinks.json`
