// Autoverificación del lector de estados de cuenta: `npm test`
import assert from 'node:assert/strict'
import { alertToDraft, categorize, linesToDrafts, parseAmount, parseCSV, parseDate, rowsToDrafts, textToDrafts } from './parse.ts'

assert.equal(parseDate('22/09/2026'), '2026-09-22')
assert.equal(parseDate('05-01-26'), '2026-01-05')
assert.equal(parseDate('2026-09-22'), '2026-09-22')
assert.equal(parseDate('22 SEP 2026'), '2026-09-22')
assert.equal(parseDate('3-Ago-26'), '2026-08-03')
assert.equal(parseDate('UBER 22'), null)

assert.equal(parseAmount('RD$1,234.56'), 1234.56)
assert.equal(parseAmount('(500.00)'), -500)
assert.equal(parseAmount('1,234.56-'), -1234.56)
assert.equal(parseAmount('75.00 DB'), -75)

assert.equal(categorize('SUPERMERCADOS NACIONAL 27 FEB', 'gasto'), 'super')
assert.equal(categorize('UBER *TRIP HELP.UBER.COM', 'gasto'), 'transporte')
assert.equal(categorize('NETFLIX.COM', 'gasto'), 'suscripciones')
assert.equal(categorize('PAGO NOMINA EMPRESA XYZ', 'ingreso'), 'salario')
assert.equal(categorize('COLMADO DON JOSE', 'gasto', [{ match: 'COLMADO DON JOSE', category: 'comida' }]), 'comida')

// CSV con columnas separadas de débito/crédito
const csv = parseCSV('Fecha,Descripción,Débito,Crédito,Balance\n01/09/2026,"PAGO NOMINA ACME",,"45,000.00","50,000.00"\n02/09/2026,FARMACIA CAROL,850.00,,"49,150.00"\n')
const rows = rowsToDrafts(csv)
assert.equal(rows.length, 2)
assert.deepEqual(rows[0], { date: '2026-09-01', description: 'PAGO NOMINA ACME', amount: 45000, type: 'ingreso', category: 'salario' })
assert.equal(rows[1].type, 'gasto')
assert.equal(rows[1].category, 'salud')

// CSV con monto con signo y ; como separador
const signed = rowsToDrafts(parseCSV('Fecha;Concepto;Monto\n2026-09-03;SHELL WINSTON;-2,000.00\n2026-09-04;TRANSFERENCIA RECIBIDA;3,500.00'))
assert.equal(signed[0].type, 'gasto')
assert.equal(signed[0].category, 'transporte')
assert.equal(signed[1].type, 'ingreso')

// Líneas de PDF: el balance decide si es ingreso o gasto
const pdf = linesToDrafts([
  'Balance anterior 10,000.00',
  '01/09/2026 01/09/2026 DEPOSITO 1,000.00 11,000.00',
  '02/09/2026 SUPERMERCADO BRAVO 1,500.00 9,500.00',
  '03/09/2026 CREDITO TRANSF 200.00 9,700.00',
])
assert.equal(pdf.length, 3)
assert.equal(pdf[1].type, 'gasto')
assert.equal(pdf[1].description, 'SUPERMERCADO BRAVO')
assert.equal(pdf[2].type, 'ingreso')

// Alerta de consumo
const a = alertToDraft('Popular: Consumo por RD$1,250.00 en SUPERMERCADOS NACIONAL con su tarjeta ***1234 el 22/09/2026')!
assert.equal(a.amount, 1250)
assert.equal(a.description, 'SUPERMERCADOS NACIONAL')
assert.equal(a.date, '2026-09-22')
assert.equal(a.category, 'super')
assert.equal(textToDrafts('Consumo por RD$300.00 en STARBUCKS el 21/09/2026\n\nConsumo por RD$99.00 en SPOTIFY el 20/09/2026').length, 2)

console.log('parse: todas las pruebas pasaron')
