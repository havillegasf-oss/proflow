# Claude Code Quick Reference

## Estado actual
- instalado: sí
- logueado: sí
- Pro: sí
- CLI: sí
- ACP/OpenClaw: sí
- nivel actual: **experto operativo ~90%**

## Cuándo usarlo primero
- muchos archivos
- mucho contexto
- exploración técnica
- scripts / automatización
- debugging largo
- refactors
- auditorías

## Modos de permiso importantes
- `default`: pide para comandos/edits
- `acceptEdits`: autoedita dentro del repo
- `plan`: analiza antes de cambiar
- `dontAsk`: solo lo preaprobado
- `bypassPermissions`: casi todo, solo en entornos aislados
- `auto`: potente pero **no asumir disponible** en nuestro plan actual

## Cosas finas que sí aprendí
- `claude --help` no muestra todo
- `-p` sirve para automatización seria, JSON y pipelines
- hay persistencia de sesiones (`-c`, `-r`, `--fork-session`)
- `CLAUDE.md` + auto memory = memoria real del proyecto
- hooks = automatización determinista
- MCP = conectar herramientas externas
- Chrome = usar sesiones logueadas del navegador
- Remote Control = seguir la sesión local desde otra pantalla
- Routines = automatización cloud programada

## Útil para Andrés
- scripts potentes
- herramientas de apoyo
- procesamiento de datos
- scraping / extracción
- exploración grande de código o archivos
- delegar tareas difíciles antes de hacerlas manualmente

## No asumir
- que puede saltarse permisos/logins
- que toda web automation será estable
- que reemplaza criterio estratégico
- que `auto mode` está realmente disponible para nosotros hoy

## Regla simple
Si una tarea es difícil, técnica y lenta:
**Claude Code entra temprano, no al final.**
