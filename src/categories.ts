export type TxType = 'ingreso' | 'gasto'

export type Category = { id: string; label: string; type: TxType; keywords: string[]; transfer?: boolean }

// Palabras clave en mayúsculas sin acentos; se comparan como palabra completa.
export const CATEGORIES: Category[] = [
  { id: 'super', label: 'Supermercado', type: 'gasto', keywords: ['SIRENA', 'NACIONAL', 'JUMBO', 'BRAVO', 'PLAZA LAMA', 'OLE', 'CARREFOUR', 'PRICESMART', 'SUPERMERC', 'SUPERMERCADO', 'HIPER', 'COLMADO', 'LA CADENA', 'POLA'] },
  { id: 'comida', label: 'Restaurantes', type: 'gasto', keywords: ['RESTAURANT', 'RESTAURANTE', 'PIZZA', 'PIZZERIA', 'BURGER', 'MCDONALDS', 'MC DONALDS', 'KFC', 'WENDYS', 'STARBUCKS', 'CAFE', 'CAFETERIA', 'PEDIDOSYA', 'UBER EATS', 'HELADOS', 'PAPA JOHNS', 'DOMINOS', 'TACO BELL', 'SUBWAY', 'BARRA PAYAN'] },
  { id: 'transporte', label: 'Transporte', type: 'gasto', keywords: ['UBER', 'CABIFY', 'INDRIVE', 'DIDI', 'SHELL', 'TEXACO', 'TOTAL', 'ESSO', 'SUNIX', 'GASOLINA', 'GASOLINERA', 'COMBUSTIBLE', 'PEAJE', 'PASO RAPIDO', 'PARQUEO', 'METRO', 'OMSA'] },
  { id: 'servicios', label: 'Servicios del hogar', type: 'gasto', keywords: ['EDESUR', 'EDENORTE', 'EDEESTE', 'CAASD', 'CORAASAN', 'CLARO', 'ALTICE', 'VIVA', 'WIND', 'INTERNET', 'PROPAGAS', 'TROPIGAS', 'GAS'] },
  { id: 'salud', label: 'Salud', type: 'gasto', keywords: ['FARMACIA', 'FARMACIAS', 'CAROL', 'HIDALGOS', 'CLINICA', 'HOSPITAL', 'LABORATORIO', 'REFERENCIA', 'AMADITA', 'HUMANO', 'SENASA', 'MAPFRE', 'MEDICO', 'ODONTO', 'DENTAL', 'OPTICA'] },
  { id: 'suscripciones', label: 'Suscripciones', type: 'gasto', keywords: ['NETFLIX', 'SPOTIFY', 'DISNEY', 'HBO', 'MAX', 'YOUTUBE', 'APPLE COM', 'APPLE', 'GOOGLE', 'PRIME VIDEO', 'ICLOUD', 'CHATGPT', 'OPENAI', 'CLAUDE', 'ANTHROPIC', 'STEAM', 'PLAYSTATION', 'XBOX'] },
  { id: 'ocio', label: 'Ocio y salidas', type: 'gasto', keywords: ['CINE', 'CINEMAS', 'CARIBBEAN CINEMAS', 'PALACIO DEL CINE', 'BAR', 'DISCOTECA', 'TEATRO', 'TICKET', 'UEPA', 'HOTEL', 'AIRBNB', 'BOOKING'] },
  { id: 'compras', label: 'Compras', type: 'gasto', keywords: ['AMAZON', 'SHEIN', 'TEMU', 'ALIEXPRESS', 'EBAY', 'ZARA', 'IKEA', 'CUESTA', 'MULTICENTRO', 'TIENDA', 'BOUTIQUE', 'FERRETERIA', 'OCHOA', 'AMERICANA'] },
  { id: 'educacion', label: 'Educación', type: 'gasto', keywords: ['UNIVERSIDAD', 'COLEGIO', 'PUCMM', 'INTEC', 'UNAPEC', 'UASD', 'UNIBE', 'UDEMY', 'COURSERA', 'PLATZI', 'LIBRERIA'] },
  { id: 'efectivo', label: 'Retiros de efectivo', type: 'gasto', keywords: ['RETIRO', 'CAJERO', 'ATM', 'AVANCE EFECTIVO'] },
  { id: 'banco', label: 'Comisiones e impuestos', type: 'gasto', keywords: ['COMISION', 'CARGO POR', 'CARGO MANEJO', 'IMPUESTO', 'DGII', 'ITBIS', 'MEMBRESIA', 'INTERES FINANCIAMIENTO', 'MORA'] },
  // Pagar la tarjeta no es un gasto nuevo: el gasto ya se contó en cada consumo.
  { id: 'pago_tarjeta', label: 'Pago de tarjeta', type: 'gasto', transfer: true, keywords: ['PAGO TARJETA', 'PAGO TC', 'PAGO A TARJETA', 'PAGO DE TARJETA', 'PAGO TARJETA CREDITO'] },
  { id: 'transfer_out', label: 'Transferencias enviadas', type: 'gasto', keywords: ['TRANSF', 'TRANSFERENCIA', 'ACH', 'LBTR', 'PAGO PRESTAMO'] },
  { id: 'otros_gasto', label: 'Otros gastos', type: 'gasto', keywords: [] },
  { id: 'pago_recibido', label: 'Pago a la tarjeta', type: 'ingreso', transfer: true, keywords: ['SU PAGO', 'PAGO RECIBIDO', 'PAGO GRACIAS', 'GRACIAS POR SU PAGO', 'PAGO TARJETA'] },
  { id: 'salario', label: 'Salario', type: 'ingreso', keywords: ['NOMINA', 'SALARIO', 'SUELDO', 'PAYROLL', 'QUINCENA', 'REGALIA'] },
  { id: 'transfer_in', label: 'Transferencias recibidas', type: 'ingreso', keywords: ['TRANSF', 'TRANSFERENCIA', 'ACH', 'LBTR', 'DEPOSITO'] },
  { id: 'otros_ingreso', label: 'Otros ingresos', type: 'ingreso', keywords: ['INTERES GANADO', 'INTERESES', 'DEVOLUCION', 'REEMBOLSO', 'CASHBACK', 'DIVIDENDO'] },
]

export const categoryById = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES.find((c) => c.id === 'otros_gasto')!
// Movimientos entre tu cuenta y tu tarjeta: no cuentan como ingreso ni gasto.
export const isTransfer = (id: string) => Boolean(CATEGORIES.find((c) => c.id === id)?.transfer)
export const fallbackCategory = (type: TxType) => (type === 'ingreso' ? 'otros_ingreso' : 'otros_gasto')

// Palabras que indican que un movimiento sin signo claro es un ingreso.
export const INCOME_HINTS = ['NOMINA', 'SALARIO', 'SUELDO', 'DEPOSITO', 'CREDITO', 'ABONO', 'RECIBID', 'INTERES GANADO', 'DEVOLUCION', 'REEMBOLSO', 'REVERSO', 'SU PAGO', 'PAGO RECIBIDO', 'PAGO GRACIAS']
