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

## Credenciales demo por defecto
- usuario: `julio`
- clave: `proflow2026`

Puedes cambiarlas así:
```bash
DASH_USER=otro DASH_PASS=clave PORT=3080 npm start
```

## Fuente de datos
Editar:
- `data/current.json`

## Qué falta conectar esta noche
- saldos reales por cuenta
- definición exacta de qué representa Chase
- definición exacta de qué representa Santander / Office Banking
- criterio real de operaciones del día
- forma exacta de calcular y mostrar fondos retenidos y liberaciones
- si mañana la demo será local o con URL pública

## Alcance
Esto es un MVP de demostración. No es un sistema bancario ni contable final.
