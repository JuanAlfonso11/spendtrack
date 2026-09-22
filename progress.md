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
