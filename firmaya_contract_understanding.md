# Firmaya - Entendimiento inicial de documentos

## Objetivo
Construir una base de datos para flujo de caja de inversionistas a partir de los PDFs descargados desde Firmaya.

## Hallazgos iniciales
Se probó extracción real de texto desde PDFs con `pypdf` y sí se puede leer contenido útil.

## Tipos de documento detectados

### 1) Contrato de mutuo de dinero
Documento principal para flujo de caja.

Campos visibles en muestras reales:
- Fecha de firma del contrato
- Mutuante (inversionista)
- RUT del inversionista
- Domicilio del inversionista
- Mutuario: DrinkTech SpA
- RUT de DrinkTech
- Representante legal: Hernán Andrés Villegas Flores
- Monto capital
- Plazo
- Tasa de interés mensual
- Cuenta de pago del inversionista
- Tabla de pagos con:
  - monto de interés
  - fechas de pago
  - número de mes/cuota
  - pago final de capital
- Condición de retiro / devolución de capital
- Interés moratorio
- CVE de validación Firmaya

### 2) Fin de contrato de mutuo
Importante para saber que un contrato anterior terminó o fue renovado.

Campos visibles:
- Fecha de término
- Partes
- Referencia al contrato anterior
- Capital/saldo que se reutiliza para un nuevo contrato
- CVE

### 3) Mandatos / poderes / arriendos / otros
No son el foco inicial del flujo de caja de inversionistas.
Deben clasificarse aparte para no contaminar la base principal.

## Implicancia práctica
La base no debe ser solo un listado de PDFs.
Debe separar al menos:
- contratos activos
- contratos finalizados
- contratos renovados
- documentos no financieros / administrativos
- documentos inválidos o sin PDF útil

## Esquema base sugerido

### Tabla `documents`
- doc_id_firmaya
- cve
- tipo_documento
- archivo
- inversionista_nombre
- inversionista_rut
- contraparte_nombre
- contraparte_rut
- fecha_firma
- fecha_inicio
- fecha_fin_pactada
- capital
- interes_mensual_pct
- interes_mensual_monto
- estado_documento
- contrato_referencia
- observaciones

### Tabla `payment_schedule`
- doc_id_firmaya
- cuota_numero
- fecha_pago
- monto_pago
- tipo_pago (interes / capital / mixto)
- periodo_texto
- estado_pago (pendiente / pagado / por conciliar)
- fuente_estado

### Tabla `investors`
- nombre
- rut
- email
- cuenta_bancaria_texto
- banco
- numero_cuenta
- tipo_cuenta
- observaciones

## Regla clave
No asumir que un PDF descargado significa deuda vigente.
Muchos documentos pueden estar:
- totalmente pagados
- refinanciados
- reemplazados por otro contrato
- cerrados por fin de contrato

## Siguiente fase
1. Clasificar masivamente los PDFs por tipo documental
2. Extraer campos estructurados de contratos de mutuo
3. Detectar relaciones entre contrato original y fin de contrato / renovación
4. Cruzar luego con el archivo manual de pagos que entregará Andrés
5. Marcar estado real de cada obligación para construir flujo de caja confiable
