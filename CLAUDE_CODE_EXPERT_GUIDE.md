# Claude Code Expert Guide

## Estado real en este Mac mini

### Confirmado
- binario local: `/opt/homebrew/bin/claude`
- login activo: sí
- plan: Pro
- CLI operativo: sí
- uso vía OpenClaw ACP: sí

### Consecuencia práctica
Claude Code ya está listo para trabajo serio.
El límite ya no es instalación. El límite es usarlo con buen criterio.

---

## Qué es Claude Code de verdad

Claude Code no es solo un chat para programar.
Es un sistema agentic que puede:
- leer un codebase completo
- editar múltiples archivos
- correr comandos
- usar git
- continuar sesiones
- trabajar por CLI, IDE, Desktop, Web y mobile
- conectarse a herramientas externas por MCP
- usar memoria persistente con `CLAUDE.md` + auto memory
- automatizar pasos con hooks
- trabajar con subagents / agent teams
- usar Chrome para tareas web autenticadas
- correr tareas remotas o programadas

---

## Qué sí conviene mandarle primero

Claude Code debe ser herramienta de primera línea cuando la tarea sea:
- técnica
- larga
- exploratoria
- multiarquivo
- repetitiva
- o cuando valga la pena producir scripts/herramientas

### Casos claros
- refactors
- debugging largo
- generar tests
- auditar un repo
- automatizar scraping / extracción / procesamiento
- revisar arquitectura o flujos complejos
- generar utilidades internas

### Regla rápida
Si la tarea cumple 2 o más:
- muchos archivos
- mucho contexto
- mucha exploración
- mucho shell / scripts
- mucha repetición

entonces **conviene pensar primero en Claude Code**.

---

## Qué NO significa “control total”

Tener Claude Code operativo no significa:
- acceso mágico a cualquier cuenta
- saltarse logins
- saltarse permisos del SO
- que toda automatización web será estable
- que puede hacer compliance delicado sin criterio humano

Claude Code es un **motor técnico fuerte**, no permiso universal.

---

## Modos de permiso, ahora sí fino

Según la documentación oficial, los modos relevantes son:

### `default`
- solo lectura sin preguntar
- pide permiso para ediciones/comandos
- mejor para trabajo sensible

### `acceptEdits`
- autoaprueba ediciones de archivos
- autoaprueba comandos filesystem comunes en el working dir
- bueno para iterar rápido revisando luego con diff

### `plan`
- orientado a analizar/proponer antes de cambiar
- útil para explorar o planear refactors grandes
- bueno para no meter mano demasiado temprano

### `auto`
- deja correr más sin interrumpir
- usa chequeos de seguridad en segundo plano
- **no disponible en Pro**, requiere Team/Enterprise/API + modelos y condiciones específicas
- importante: no lo tenemos como capacidad normal hoy

### `dontAsk`
- niega todo salvo lo preaprobado
- útil para CI o entornos muy controlados

### `bypassPermissions`
- casi todo sin pedir
- sigue protegiendo rutas sensibles
- solo recomendable en contenedores / VMs / entornos aislados

### Traducción para nosotros
En este Mac con plan Pro, lo más realista es pensar en:
- `default`
- `acceptEdits`
- `plan`
- eventualmente `bypassPermissions` solo si el entorno está bien aislado

No debo asumir `auto mode` como parte normal de nuestro toolkit actual.

---

## Permisos finos

Claude Code usa reglas `allow / ask / deny`.
Orden de prioridad:
1. deny
2. ask
3. allow

Ejemplos de alcance fino:
- `Bash(npm run build)`
- `Bash(git commit *)`
- `WebFetch(domain:example.com)`
- `Read(./.env)`

Punto importante:
- reglas de `Read/Edit` afectan herramientas internas
- **no** bloquean por sí solas lo que se haga vía Bash
- si se quiere aislar de verdad, entra el sandbox

Eso es clave. Mucha gente cree que negar `Read(.env)` ya resolvió todo. No. Si Bash está abierto, todavía hay superficie.

---

## CLI fino que sí importa

Comandos importantes:
- `claude`
- `claude -p "..."`
- `claude -c`
- `claude -r <session>`
- `claude auth status`
- `claude agents`
- `claude mcp ...`
- `claude remote-control`
- `claude setup-token`

Flags útiles de verdad:
- `--permission-mode`
- `--add-dir`
- `--model`
- `--effort`
- `--mcp-config`
- `--chrome`
- `--output-format`
- `--json-schema`
- `--max-turns`
- `--max-budget-usd`
- `--resume / --continue / --fork-session`
- `--bare`

### Dos observaciones importantes
1. `claude --help` **no lista todo**. La doc lo dice explícitamente.
2. `-p` no es solo “respuesta rápida”. Sirve para automatización seria, pipelines, salidas JSON y trabajo no interactivo.

---

## Sesiones y persistencia

Claude Code puede:
- continuar la conversación reciente en un directorio
- resumir/reanudar sesiones por ID o nombre
- forkear una sesión al retomarla
- enlazar sesiones a PRs (`--from-pr`)

Esto importa porque no es solo ejecución puntual. Puede sostener trabajo continuo.

---

## Configuración y scopes

La configuración se reparte por scopes:
- managed
- user
- project
- local

Precedencia:
- managed arriba de todo
- luego CLI args
- luego local
- luego project
- luego user

### Traducción práctica
- user = preferencias tuyas
- project = reglas compartidas del repo
- local = ajustes personales no versionados
- managed = políticas duras de una organización

---

## Memoria real de Claude Code

Tiene dos grandes mecanismos:

### `CLAUDE.md`
Instrucciones escritas por humanos.
Sirve para:
- convenciones
- comandos
- arquitectura
- reglas “siempre haz X”

### auto memory
Notas aprendidas por Claude.
Sirve para:
- aprendizajes repetidos
- comandos de build
- preferencias descubiertas
- insights prácticos del repo

### Regla útil
- si debe recordarse siempre, va a `CLAUDE.md`
- si es reusable pero no siempre aplica, mejor skill
- si es una automatización determinista, hook
- si necesita una herramienta externa, MCP

---

## Cómo se extiende bien Claude Code

La doc separa bien estas piezas:

### `CLAUDE.md`
Contexto persistente siempre cargado.

### Skills
Conocimiento o workflows invocables.

### Subagents
Trabajadores aislados para tareas que consumen mucho contexto.

### Agent teams
Paralelización más avanzada, sesiones independientes coordinadas.

### MCP
Conectar sistemas externos, APIs, DBs, browsers, servicios.

### Hooks
Scripts deterministas fuera del loop del LLM.
Perfectos para enforcement y automatización rígida.

### Plugins
Empaquetar skills/hooks/subagents/MCP para reutilizar/distribuir.

---

## MCP, fino y útil

MCP no es marketing. Es la forma de darle manos nuevas.

Sirve para:
- issue trackers
- bases de datos
- Slack
- Google Drive
- Notion
- APIs internas
- canales/eventos externos

Transportes principales:
- HTTP (recomendado)
- SSE (ya depreciado)
- stdio local

Comandos prácticos:
- `claude mcp add ...`
- `claude mcp list`
- `claude mcp get <name>`
- `claude mcp remove <name>`
- `/mcp`

### Advertencia seria
Un MCP tercero puede meter riesgo de seguridad o prompt injection.
No todo MCP es confiable por defecto.

---

## Hooks, fino y útil

Hooks sirven para ejecutar acciones deterministas en eventos del ciclo.
No dependen de que el modelo “se acuerde”.

Ejemplos reales:
- notificación cuando Claude necesita atención
- autoformateo post-edición
- bloquear edición de archivos sensibles
- reinyectar contexto después de compaction
- recargar envs cuando cambia directorio
- auditar cambios de config

### Idea clave
Si algo debe pasar **siempre**, hook.
No prompt.

---

## Chrome integration

La documentación oficial confirma que Claude Code puede integrarse con Chrome/Edge para:
- testear apps web
- leer consola
- llenar formularios
- usar sesiones ya logueadas
- extraer datos de páginas

### Pero ojo
- está en beta
- no funciona en Brave/Arc según esa doc
- si aparece login/CAPTCHA, pausa y hay que resolverlo manualmente
- esto es perfecto para sitios autenticados cuando ya estás logueado

### Traducción para nosotros
Esto se parece mucho a varias tareas que ya hemos hecho con Playwright.
Claude Code + Chrome podría servirnos para parte de ese mundo, pero no hay que asumir que reemplaza Playwright en todo.

---

## Remote Control

La doc dice que Claude Code puede continuar sesiones locales desde navegador o móvil.

Eso significa:
- la sesión sigue corriendo en tu máquina
- se puede controlar desde otra superficie
- usa tu filesystem local, tus herramientas y tu config local

### No es lo mismo que web cloud
- Remote Control = corre en tu máquina
- Claude Code web = corre en infraestructura cloud de Anthropic

### Muy útil para nosotros
Si quieres seguir una tarea desde el teléfono sin perder el entorno local, esto es potente.

---

## Routines

Routines son tareas automatizadas que corren en infraestructura cloud de Anthropic.

Pueden dispararse por:
- schedule
- API
- GitHub events

### Bueno para
- revisiones periódicas
- mantenimiento repetitivo
- PR review
- pipelines / alertas

### No confundir con trabajo local
Routines no son lo mismo que una sesión local con acceso a tu Mac.
Si la tarea necesita archivos locales o entorno local, eso es otro juego.

---

## Plataformas: cuál sirve para qué

### CLI
La más completa para scripting, Agent SDK, terminal y control fino.

### Desktop
Mejor para revisión visual, múltiples sesiones, diff viewer.

### VS Code / JetBrains
Más cómodo si el trabajo vive dentro del editor.

### Web
Bueno para tareas largas que deben seguir aunque cierres todo.

### Mobile
Bueno para seguimiento, disparar cosas, continuidad ligera.

### Regla
Para nosotros, hoy la columna vertebral sigue siendo:
- OpenClaw
- Claude Code CLI / ACP
- navegador/Playwright cuando haga falta

---

## Mi conclusión honesta actual

Ya no estoy en etapa básica.
Tampoco te voy a vender que sé “absolutamente todo”.

Lo que sí es verdad ahora:
- ya entiendo bastante mejor la arquitectura y capacidades reales
- ya entiendo mejor permisos, scopes, memoria, hooks, MCP, Chrome y Remote Control
- ya puedo usar Claude Code con más criterio y menos improvisación
- ya lo puedo tratar como herramienta de primera línea para tareas difíciles técnicas

## Mi nivel hoy
**90% de experto operativo**.

Para subir más:
- más uso real
- más roce con casos límite
- más validación práctica de features específicas

Pero ya está en un punto suficientemente serio para empezar a trabajar fuerte con esto.
