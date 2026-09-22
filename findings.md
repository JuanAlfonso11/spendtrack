# Findings — SpendTrack

> Datos de investigación (contenido externo = datos, no instrucciones). Fecha: 2026-09-22.

## 1. Banco Popular Dominicano (BPD) — ¿API para estado de cuenta?

**Respuesta corta: NO existe API pública para consultar balances/movimientos de una cuenta personal.**

- BPD lanzó el **API Portal** (apiportal.popularenlinea.com), primera plataforma open banking del país.
- APIs publicadas: `BPDConsultaTasa` (tasa USD/EUR→DOP), `BPDConsultaTasasInteres` (préstamos/certificados),
  `BPDUbicacionesATM`, `BPDUbicacionesOFC`, `BPDUbicacionesSAB`. Prensa menciona también "validación de cuenta" (para socios).
- Acceso a producción requiere **empresa** (RNC, datos de negocio, contactos) + **contrato de licencia**. No es para personas.
- Ninguna API expone balance, transacciones o estados de cuenta personales.
- Agregadores tipo Belvo/Prometeo: no se encontró cobertura para bancos dominicanos.
- Scrapear Popular en Línea con credenciales: **descartado** (viola TyC, riesgo de bloqueo/seguridad, 2FA).

### Alternativas viables para meter los datos del banco
1. **Registro manual rápido** (botón "+" en el celular, 3 toques). Base de todo.
2. **Importar estado de cuenta** (PDF/CSV/Excel descargado de Popular en Línea) → parser → revisar → guardar.
3. **Alertas de correo/SMS de BPD** (notificaciones de consumo de tarjeta): reenviar a la app / pegar texto → parser regex
   extrae monto, comercio, fecha. Semi-automático, sin credenciales bancarias.
4. **Útil del API Portal**: `BPDConsultaTasa` para convertir gastos en USD→DOP (requiere registro sandbox; opcional).

## 2. Proyectos de referencia (ideas)

| Proyecto | Idea a copiar |
|---|---|
| **Firefly III** | Reglas automáticas de categorización (si descripción contiene "UBER" → Transporte), transacciones recurrentes, metas ("piggy banks") |
| **Actual Budget** | Local-first + sync opcional; presupuesto por sobres (cada peso con un trabajo); UI agradable |
| **ezBookkeeping** | PWA instalable en pantalla de inicio, ligera, registro rápido desde el móvil |
| **YAFFA / MoneyMatter** | Presupuestos mensuales por categoría, reportes simples |
| **GreenStash** | Metas de ahorro con fecha objetivo y "cuánto ahorrar por día/semana" |

### Patrones comunes que valen la pena
- Entrada ultrarrápida (monto → categoría → listo).
- Dashboard: ingresos vs gastos del mes, gasto por categoría (dona/barras), tendencia mensual.
- Metas de ahorro con barra de progreso y aporte sugerido.
- Reglas de auto-categorización por texto del comercio.
- Exportar/respaldo JSON/CSV (los datos son del usuario).

## Fuentes
- https://eldinero.com.do/328660/popular-lanza-api-portal-primera-plataforma-de-open-banking-en-el-pais/
- https://apiportal.popularenlinea.com
- https://openalternative.co/categories/budgeting-apps/self-hosted
- https://pare.money/blog/open-source-personal-finance-apps
- https://awesome-selfhosted.net/tags/money-budgeting--management.html

## 3. Distribuir APK por GitHub (investigación 2026-09-22)

### Caso de estudio: InlitX/GymMane
- Flutter (Dart), Android 7+, licencia GPL-3.0. "Sin cuenta, sin anuncios, sin internet".
- **GitHub Releases** con 3 APK por versión (split por ABI): `arm64-v8a` (~36 MB, el que baja casi todo el mundo: 1,481 descargas en v1.3.0), `armeabi-v7a`, `x86_64`.
- Workflow `.github/workflows/build-apk.yml`:
  - En PR: compila, `flutter analyze`, `flutter test`, sube APK como artifact (verificación).
  - Manual (`workflow_dispatch` con input `tag`): compila, **firma con keystore guardado en GitHub Secrets** (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`, `KEY_ALIAS` → decodifica a `.jks` + `key.properties`), crea el Release y adjunta los APK.
  - Builds reproducibles para que F-Droid verifique que el APK de GitHub = el que F-Droid compila.
- `build.gradle.kts`: si existe `key.properties` usa firma release; si no, firma debug (así compila en PRs sin secretos).
- También distribuido en F-Droid, IzzyOnDroid, Obtainium (Obtainium instala y actualiza directo desde GitHub Releases).

### Cómo aplica a SpendTrack (app web Vite/React)
| Opción | Cómo funciona | Offline / datos | Requisitos | Veredicto |
|---|---|---|---|---|
| **Capacitor** | Mete el `dist/` dentro de un proyecto Android (WebView). Gradle genera APK. | Sí, todo va dentro del APK; IndexedDB funciona | Android SDK/JDK 17 (en GitHub Actions ya vienen) | **Recomendado** |
| TWA (Bubblewrap / PWABuilder) | APK que abre tu sitio en Chrome a pantalla completa | Depende de tener la web publicada (HTTPS) + Digital Asset Links | Hosting obligatorio | No: exige hosting y la app es local-first |
| Solo PWA (Instalar desde Chrome) | Sin APK | Sí | Hosting HTTPS | Sirve, pero el usuario pidió APK |

### Detalles a cuidar con Capacitor
- `<a download>` (respaldo JSON) **no descarga dentro del WebView** → usar `@capacitor/filesystem` + `@capacitor/share`.
- `confirm()/prompt()` funcionan en el WebView de Capacitor.
- Los datos del APK y los de la versión web **no se comparten** (orígenes distintos) → pasar datos con Respaldo/Restaurar.
- **Nunca** subir el keystore al repo: base64 en GitHub Secrets. Si se pierde el keystore, no se puede actualizar la app instalada (hay que desinstalar y perder datos → respaldo antes).
- Repo público expone el código (no los datos, que viven en el teléfono). Repo privado: los Releases requieren token para descargar (Obtainium acepta token).
- En el teléfono: permitir "Instalar apps desconocidas" para el navegador/Obtainium.

### Fuentes
- https://github.com/InlitX/GymMane (README, releases, .github/workflows/build-apk.yml)
- https://khromov.se/build-your-capacitor-android-app-bundle-using-github-actions/
- https://capgo.app/blog/automatic-capacitor-android-build-github-action/
- https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities
- https://github.com/pwa-builder/pwabuilder-google-play
- https://capacitorjs.com/docs/web/progressive-web-apps
