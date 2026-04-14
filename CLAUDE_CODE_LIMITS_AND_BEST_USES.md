# Claude Code - Limits and Best Uses

## Best uses

Claude Code conviene más cuando:
- el problema es técnico
- hay mucho contexto o muchos archivos
- hace falta explorar antes de decidir
- vale la pena crear una herramienta o script
- una tarea larga puede descomponerse
- la ejecución manual sería tonta o lenta

## Best uses con Andrés

Conviene usarlo para:
- automatizaciones nuevas
- procesamiento de exports y datasets
- auditorías de lógica o arquitectura
- generación rápida de herramientas auxiliares
- debugging largo
- scraping y extracción cuando conviene combinar código + navegador
- tareas que yo podría olvidar pasarle, pero debería pasarle

## Límites reales

### 1. Permisos y entorno
No supera por magia:
- permisos del sistema
- logins faltantes
- políticas del entorno
- restricciones del runtime

### 2. Auto mode no es un derecho universal
La documentación fina deja claro que `auto` tiene condiciones fuertes.
No debo asumirlo en nuestro plan actual.

### 3. Web automation sigue siendo frágil
Chrome integration ayuda mucho, pero:
- está en beta
- depende del navegador soportado
- CAPTCHA/login manual siguen existiendo
- no reemplaza 100% a Playwright

### 4. Reglas de permisos no equivalen a aislamiento total
Negar `Read(.env)` no bloquea necesariamente un `cat .env` vía Bash.
Si hace falta aislamiento real, pensar en sandbox.

### 5. No sustituye criterio
Puede ejecutar muy bien, pero no reemplaza priorización, juicio financiero, riesgo y dirección.

### 6. Riesgo en MCP y conectores externos
Un MCP tercero puede ser útil o peligroso.
Hay que tratarlo como superficie real de seguridad.

## Regla de oro

Claude Code = motor técnico fuerte.
No = permiso universal.
No = cerebro estratégico único.

## Uso recomendado

1. Definir prioridad real.
2. Preguntarse si la tarea merece Claude Code.
3. Si sí, usarlo temprano.
4. Si la tarea depende de web/logins/UI, prepararlo bien.
5. Revisar resultados, no asumir perfección.
