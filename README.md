# SpendTrack

App personal para registrar ingresos y gastos, importar estados de cuenta del Banco Popular (PDF, Excel, CSV o texto), controlar tarjetas de crédito, ponerse metas de ahorro y ver cuándo el excedente se puede invertir.

Tus datos se guardan **solo en tu teléfono** (IndexedDB). No hay servidor ni cuentas. Haz respaldos desde **Ajustes → Descargar respaldo**.

## Instalar en Android

1. Abre la página **Releases** de este repositorio y descarga `SpendTrack-vX.Y.Z.apk`.
2. Ábrelo en el teléfono y permite "Instalar apps desconocidas" cuando Android lo pida.

Para recibir actualizaciones solas usa [Obtainium](https://github.com/ImranR98/Obtainium): *Agregar app* → URL de este repositorio. Como el repositorio es privado, en Obtainium ve a *Ajustes → GitHub* y pega un token personal de GitHub con permiso de solo lectura a este repositorio (*Contents: Read-only*).

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas del lector de estados de cuenta, tarjetas e inversión
npm run android    # compila la web y la copia al proyecto Android
```

APK de prueba en tu PC (necesita JDK 21 y Android SDK): `cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`.

## Publicar una versión

GitHub Actions (`.github/workflows/android.yml`) compila y prueba cada cambio. Al subir una etiqueta `v*` crea un Release con el APK firmado:

```bash
git tag v0.2.0
git push origin v0.2.0
```

### Clave de firma (una sola vez)

Android solo instala una actualización si viene firmada con **la misma clave**. Si la pierdes, habrá que desinstalar la app (y perder los datos si no hay respaldo). Guárdala junto con sus contraseñas en un lugar seguro, fuera del repositorio.

1. Crea la clave (te pedirá una contraseña):
   ```bash
   keytool -genkeypair -v -keystore spendtrack-release.jks -alias spendtrack -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Conviértela a texto base64 (PowerShell):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("spendtrack-release.jks")) | Set-Clipboard
   ```
3. En GitHub: *Settings → Secrets and variables → Actions → New repository secret*, crea:
   | Secret | Valor |
   |---|---|
   | `KEYSTORE_BASE64` | el texto copiado en el paso 2 |
   | `KEYSTORE_PASSWORD` | la contraseña de la clave |
   | `KEY_ALIAS` | `spendtrack` |
   | `KEY_PASSWORD` | la contraseña de la clave (la misma, si no pusiste otra) |

`.gitignore` ya excluye `*.jks` y `keystore.properties`.
