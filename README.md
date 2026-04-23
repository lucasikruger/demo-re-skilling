# Pipeline de análisis de voz — Demo

Demo interactiva de análisis de voz con IA. Graba respuestas a preguntas de entrevista, las transcribe con Gemini, analiza la prosodia y genera un informe PDF enviado por email.

## Stack

El stack es el mismo que usa Re-Skilling en producción:

- **Backend**: Laravel 13 (PHP 8.3) — API REST, jobs en cola, migraciones, Eloquent ORM
- **Frontend**: React 19 (JavaScript) — SPA sin build framework, Vite como bundler
- **Base de datos**: PostgreSQL 17 con extensión pgvector para búsqueda semántica (RAG)
- **Cola de trabajos**: Laravel Queue con driver `database`
- **IA**: Google Gemini 2.5 Flash — transcripción de audio y análisis prosódico
- **Email**: Resend (transport HTTP de Laravel)
- **Storage**: AWS S3 en producción, disco local en desarrollo
- **Deploy**: Railway (servicios web + worker + postgres)
- **PDF**: DomPDF (barryvdh/laravel-dompdf)

## Arquitectura

```
Navegador (React SPA)
    │
    ▼
Laravel API (web)          ← graba y sube audio, crea sesiones
    │
    ▼
Cola de trabajos (worker)
    ├── ProcessInterviewAnswerJob  → llama a Gemini con el audio
    └── GenerateInterviewReportJob → genera informe + PDF + email
```

## Levantar en local

```bash
cp .env.example .env
# Completar GEMINI_API_KEY, RESEND_API_KEY, credenciales S3 en .env

docker compose up --build
```

La app queda en `http://localhost:8080`.

Para acceder desde el celular en la misma red, setear:

```
VITE_DEV_HOST=<tu-ip-local>   # ej: 192.168.0.100
```

## Variables de entorno clave

| Variable | Descripción |
|---|---|
| `GEMINI_API_KEY` | API key de Google AI Studio |
| `RESEND_API_KEY` | API key de Resend para emails |
| `MAIL_FROM_ADDRESS` | Dirección verificada en Resend |
| `DEMO_REPORTS_PASSWORD` | Contraseña para modo debug |
| `FILESYSTEM_DISK` | `local` en dev, `s3` en producción |

## Modo debug

Ingresar la contraseña en el panel "Open debug" de la pantalla de selección de modo. Con debug activo se muestran las trazas internas de cada respuesta y el contexto recuperado en el informe.
