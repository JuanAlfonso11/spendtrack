# Progress

## 2026-09-22 — Sesión 1
- Investigación: API Portal BPD (solo tasas/ubicaciones, acceso empresarial) → sin API de estados de cuenta personales.
- Investigación: Firefly III, Actual Budget, ezBookkeeping, YAFFA, GreenStash → ideas en findings.md.
- Creado task_plan.md con 4 fases. Esperando confirmación para Phase 1.

## 2026-09-22 — Sesión 2 (diseño + MVP)
- Vite 8 + React 19 + TS, Dexie, Recharts 3, pdfjs-dist, SheetJS. PWA manual.
- Pantallas: Resumen (KPIs, barras 6 meses clicables, categorías clicables, ritmo de gasto, top comercios), Movimientos, Importar, Metas, Ajustes.
- Importar: CSV/Excel/PDF (con contraseña)/texto pegado/alertas → vista previa editable, duplicados, reglas aprendidas por comercio.
- Verificado en navegador: claro/oscuro, móvil/escritorio, importación xlsx/pdf/texto, duplicados, reglas, alta manual. `npm test` pasa.

## 2026-09-22 — Sesión 3 (tarjetas + invertir)
- Dexie v2: tablas cards y settings; Tx.account. Navegación: Resumen, Movimientos, Tarjetas, Ahorro (Metas | Invertir), Importar; Ajustes en escritorio o botón en Resumen.
- finance.ts + finance.test.ts: ciclos de corte, fecha límite, saldo al corte, disponibilidad, fondo de emergencia, proyección.
- Bugs encontrados y corregidos: saldo manual marcado como vencido; "$$" perdido en ejes; KPIs desbordando a ~800px; archivos con CRLF.
- Verificado en navegador (origen 127.0.0.1 aparte): tarjetas, importar estado de tarjeta, registrar pago, aviso de inversión, móvil claro/oscuro.
