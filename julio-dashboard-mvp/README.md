# Julio Dashboard MVP

MVP read-only para mostrar a un inversionista un visualizador simple de liquidez y operaciones de ProFlow / La Caja Chica.

## Qué incluye
- login básico
- dashboard de liquidez
- vista de cuentas
- pendientes por liberar
- operaciones recientes
- fuente de datos simple basada en JSON

## Cómo correr
```bash
cd julio-dashboard-mvp
npm start
```

Luego abrir:
- `http://localhost:3080`

## Listo para deploy fuera del Mac mini
Quedó agregado:
- `Dockerfile`
- `.dockerignore`

Con eso se puede subir rápido a una plataforma tipo Render/Railway o a un VPS con Docker, sin depender del Mac mini.

## Credenciales demo por defecto
- usuario: `julio`
- clave: `proflow2026`

Puedes cambiarlas así:
```bash
DASH_USER=otro DASH_PASS=clave PORT=3080 npm start
```

## Fuente de datos
Opción 1, editar directo:
- `data/current.json`

Opción 2, usar Google Sheets como backend temporal de mañana:
- `data/accounts_template.csv`
- `data/settlements_template.csv`
- `data/operations_template.csv`

Luego exportas cada pestaña a CSV público/compartido y sincronizas así:
```bash
cd julio-dashboard-mvp
ACCOUNTS_CSV_URL='URL_CSV_1' \
SETTLEMENTS_CSV_URL='URL_CSV_2' \
OPERATIONS_CSV_URL='URL_CSV_3' \
node sync_from_google_sheets.js
```

Eso reescribe `data/current.json` con la data más reciente.

## Qué falta conectar esta noche
- saldos reales por cuenta
- definición exacta de qué representa Chase
- definición exacta de qué representa Santander / Office Banking
- criterio real de operaciones del día
- lógica exacta de NIA y Stripe dentro del dashboard
- forma exacta de calcular y mostrar fondos retenidos y liberaciones
- decisión de cómo le entregaremos el link a Julio

## Alcance
Esto es un MVP de demostración. No es un sistema bancario ni contable final.
