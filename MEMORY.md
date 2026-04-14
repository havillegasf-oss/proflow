# Andrés – Contexto Estratégico

Andrés es un emprendedor con múltiples negocios, enfocado en construir sistemas de flujo de dinero y escalabilidad.

Tiene alto potencial, buena capacidad estratégica, pero su principal problema histórico ha sido:

- desorden
- falta de foco sostenido
- dispersión
- ejecución inconsistente

---

# Negocio principal: La Caja Chica / ProFlow

La Caja Chica es un modelo financiero basado en la compra de cupos en dólares de tarjetas de crédito.

Funcionamiento:

- Clientes venden su cupo en USD
- Se les paga en CLP
- Se obtiene margen en la conversión

Este modelo depende críticamente de:

- liquidez
- rotación de capital
- confianza de inversionistas

---

# Evolución: ProFlow

ProFlow es la evolución estratégica de La Caja Chica.

Objetivo:

- escalar el modelo
- hacerlo más formal y expandible
- posicionarlo como plataforma financiera

---

# Estado actual (crítico)

Andrés enfrenta:

- presión de liquidez
- compromisos financieros activos
- necesidad urgente de flujo

Esto genera:

- estrés operativo
- toma de decisiones reactivas
- riesgo de desorden

---

# Prioridad número 1

Resolver liquidez.

Esto implica:

- cerrar operaciones hoy
- conseguir capital
- activar inversionistas
- asegurar flujo inmediato

---

# Regla de oro

Si no hay liquidez:

- todo lo demás pierde prioridad
- cualquier otra tarea es secundaria

---

# Patrón de comportamiento

Andrés tiende a:

- probar cosas en vez de ejecutar
- dispersarse cuando hay presión
- evitar definir la prioridad real
- moverse mucho sin avanzar realmente

---

# Rol del asistente

El asistente debe:

- detectar dispersión
- forzar definición de prioridades
- llevar a acción concreta
- evitar autoengaño
- empujar ejecución real

---

# Pregunta clave diaria

¿Qué acción concreta hoy resuelve el problema más importante?


# Modos de operación

Andrés tiene dos modos claros:

## Modo ejecución
- foco en generar dinero
- cerrar operaciones
- resolver liquidez
- acción directa

## Modo construcción
- configurar sistemas
- mejorar estructura
- preparar operación futura

---

# Regla crítica

El asistente debe distinguir el contexto:

- Si es horario operativo → empujar ejecución
- Si es horario no operativo (noche/domingo) → permitir construcción útil

---

# Regla práctica

Nunca empujar ejecución cuando:

- no hay contexto real de cierre (ej: domingo noche)
- el objetivo es preparar el sistema

En esos casos:

- guiar construcción
- optimizar sistema
- dejar listo para ejecutar al día siguiente

# Infra operativa útil

- Ya existe una automatización funcional para Firmaya basada en Playwright y sesión persistente.
- El script clave es `firmaya_download_all.js`.
- La descarga masiva organizada por inversionista quedó en `state/firmaya-by-investor-v2`.
- Hay 2 documentos que aparecen en Firmaya pero no disparan descarga PDF (`error` y `NO VALIDO`), registrados en `_failures.json`.

# Lógica de negocio importante para Firmaya / flujo de caja

- Un `fin de contrato` normalmente significa renovación anticipada, no necesariamente cierre definitivo pagado.
- La ausencia de `fin de contrato` NO significa que el mutuo siga vigente, porque muchas renovaciones se hacen creando otro mutuo al vencimiento natural.
- La secuencia de nombres importa: `Contrato X`, luego `Contrato X 2`, `Contrato X 3`, etc. El primer contrato normalmente no lleva `1`.
- La futura base debe agrupar contratos por `familia` o `línea de renovación` por inversionista, no tratarlos como PDFs aislados.
- Muchas renovaciones mantienen el mismo capital y solo reinician el plazo/tabla de pagos en un nuevo contrato.
- A veces el capital se mantiene; otras veces aumenta. La base debe separar `capital rolado` de `capital nuevo/incremental`.

# Memoria y continuidad (crítico)

- Andrés valora mucho que el asistente tenga memoria real y continuidad entre sesiones.
- No quiere volver a empezar desde cero ni tener que reexplicar el contexto base cada vez.
- La memoria no es un lujo: es parte central del valor del asistente.
- El asistente debe capturar decisiones, contexto, reglas operativas, aprendizajes y cambios importantes para poder hablar con propiedad y trabajar “desde un desde”.
- En trabajos largos, Andrés prefiere recibir updates de progreso visibles, idealmente con una especie de porcentaje o “barra mental” (por ejemplo 30%, 70%, 82%) para saber que sí se está avanzando y en qué etapa va la tarea.

# Aprendizajes fuertes desde el export de ChatGPT

- El problema principal de Andrés no es capacidad, sino la combinación de `foco + estructura + caja`.
- El motor más valioso y repetido es `La Caja Chica / ProFlow`; cuando funciona bien, Andrés lo ve como la pieza capaz de resolver gran parte de su estrés financiero.
- Se repiten como patrones de riesgo: mezcla de caja entre negocios, dependencia excesiva de Meta/Instagram, uso de deuda para sostener deuda, mutuos caros y dispersión hacia proyectos épicos con poca contribución a caja.
- Andrés piensa bien en sistemas, automatización, dashboards y arquitectura operativa, pero suele formalizar la estructura después de que el problema ya explotó.
- Andrés no necesita un asistente complaciente; necesita uno que recuerde bien, contraste, ordene, baje a tierra y empuje a ejecución.
