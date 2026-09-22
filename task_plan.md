# Task Plan — SpendTrack (finanzas personales)

## Goal
App personal, usable desde el celular, para registrar ingresos/gastos, ver en qué se gasta y fijar metas de ahorro.
Datos del Banco Popular vía importación/alertas (no hay API personal — ver findings.md).

## Current Phase
Phase 4 — Deploy (Phases 1-3 hechas en diseño/MVP)

## Decisiones (propuestas)
| Decisión | Elección | Por qué |
|---|---|---|
| Tipo de app | **PWA** (web instalable en el celular) | Sin App Store, un solo código, funciona offline |
| Stack | Vite + React + TypeScript | Simple, rápido, estándar |
| Datos | **Local-first: IndexedDB (Dexie)** en el teléfono | Privado, gratis, sin servidor. Respaldo JSON exportable |
| Diseño | Tonos naturales (bosque, arena, ocre), Instrument Serif/Sans, sin morados ni texto con degradado, modo oscuro | Pedido del usuario; paleta de gráficos validada para daltonismo |
| PWA | manifest + sw.js a mano (sin plugin) | Menos dependencias |
| Gráficos | Recharts | Ligero, suficiente |
| Hosting | Vercel (estático, gratis) | HTTPS requerido para instalar PWA |
| Moneda | DOP por defecto, USD opcional | Uso en RD |
| Sync multi-dispositivo | **Fuera del MVP** | Añadir (Supabase) solo si se usa en >1 dispositivo |

### Phase 1: MVP registro + dashboard
**Status:** complete
- [ ] Scaffold Vite+React+TS+PWA (manifest, service worker)
- [ ] Modelo: Transaction {id, fecha, monto, tipo ingreso/gasto, categoría, nota, cuenta}; Category; Goal
- [ ] Pantalla "+" registro rápido (monto → categoría → guardar)
- [ ] Lista de movimientos del mes (editar/borrar)
- [ ] Dashboard: ingresos vs gastos, balance, gasto por categoría, tendencia 6 meses
- [ ] Exportar/Importar respaldo JSON
- Criterio: instalable en Android/iPhone, funciona offline, datos persisten tras cerrar

### Phase 2: Metas de ahorro + presupuestos
**Status:** in_progress (metas hechas; presupuestos por categoría pendientes)
- [ ] Metas: nombre, monto objetivo, fecha, aportes → % y "ahorra X/semana para llegar"
- [ ] Presupuesto mensual por categoría con alerta visual al 80%/100%

### Phase 3: Datos del Banco Popular
**Status:** in_progress (CSV/Excel/PDF/texto/alertas hechos; falta validar con un estado real del Popular)
- [ ] Importar CSV/Excel del estado de cuenta (vista previa → confirmar, deduplicar)
- [ ] Pegar texto de alerta de consumo BPD (correo/SMS) → parser → transacción
- [ ] Reglas de auto-categorización por comercio
- [ ] (Opcional) Importar PDF de estado de cuenta
- Bloqueo: necesito un ejemplo real (anonimizado) de estado de cuenta y de alerta BPD

### Phase 5: Tarjetas de crédito
**Status:** complete
- [x] Tarjetas: límite, día de corte, fecha límite, saldo manual (entra al siguiente corte)
- [x] Pago para no generar intereses, vencimiento, uso del límite, consumos por mes/categoría
- [x] Importar estado de tarjeta (signos invertidos: consumo sube la deuda)
- [x] Pagos de tarjeta excluidos de ingresos/gastos (categorías transfer) para no contar doble

### Phase 6: Invertir el excedente
**Status:** complete
- [x] Fondo de emergencia (3/6 meses de gasto promedio) → excedente invertible
- [x] Aviso en Resumen cuando el excedente pasa el umbral del usuario
- [x] Simulador de interés compuesto (invertido vs solo guardado, ingreso pasivo)
- [x] Opciones comunes en RD, solo educativas, con aviso de no-asesoría (sin tasas inventadas)

### Phase 7: APK en GitHub Releases
**Status:** in_progress (falta solo probar en un teléfono real)
- [x] Capacitor 8 (com.spendtrack.app), íconos y splash generados
- [x] Respaldo JSON con @capacitor/filesystem + share en el APK
- [x] Gradle: firma desde android/keystore.properties; versión por -PversionName/-PversionCode
- [x] Workflow .github/workflows/android.yml: main/PR = tests + APK debug (artifact); tag v* = APK firmado en Release
- [x] README con instalación (descarga / Obtainium con token) y pasos de la clave de firma
- [x] Verificado local: assembleDebug y assembleRelease firmado (clave temporal, borrada)
- [x] Repo privado https://github.com/JuanAlfonso11/spendtrack + push (gh 2.101, scopes repo+workflow)
- [x] Keystore del usuario + 4 secrets; v0.1.0 publicado: https://github.com/JuanAlfonso11/spendtrack/releases/tag/v0.1.0 (4.4 MB, firma CN=JAlavarado, SHA-256 f69fe8de…19476)
- [ ] Probar APK en un teléfono real (no había dispositivo/emulador conectado)
- Decisión: repo PRIVADO

### Phase 4: Deploy
**Status:** pending
- [ ] Deploy a Vercel, instalar en el celular, prueba real 1 semana

## Next Step
Usuario instala v0.1.0 en su teléfono y reporta; luego estado de cuenta real del Popular para ajustar parse.ts.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| WebFetch nota de prensa popularenlinea.com vacía | 1 | Usé apiportal.popularenlinea.com directo |
