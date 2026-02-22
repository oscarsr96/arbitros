# CLAUDE.md — Sistema de Designaciones FBM

## Visión del Proyecto

Aplicación web para la Federación de Baloncesto de Madrid que automatiza la asignación de árbitros y oficiales de mesa a los partidos de todas las categorías que se disputan en la Comunidad de Madrid. El sistema gestiona la disponibilidad del personal, calcula costes de desplazamiento, optimiza las asignaciones minimizando coste y equilibrando carga, y proporciona paneles diferenciados para cada rol.

---

## Stack Tecnológico

| Capa                      | Tecnología                                                                                      | Justificación                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Frontend**              | Next.js 14 (App Router) + TypeScript                                                            | SSR para SEO del portal público, RSC para rendimiento, rutas API integradas para prototipos rápidos |
| **UI**                    | Tailwind CSS + shadcn/ui + Framer Motion                                                        | Componentes accesibles y consistentes, animaciones fluidas, diseño rápido sin CSS custom            |
| **Estado cliente**        | Zustand                                                                                         | Ligero, sin boilerplate, perfecto para estado de UI (filtros, selecciones)                          |
| **Backend**               | Next.js Route Handlers (fase 1) → migrar a servicio separado con Hono/Node si escala (fase 4+)  |
| **Base de datos**         | PostgreSQL 16 (Supabase hosted)                                                                 | Relacional, robusto, extensiones geográficas con PostGIS, Row Level Security nativa                 |
| **ORM**                   | Drizzle ORM                                                                                     | Type-safe, SQL-first, migraciones declarativas, excelente DX con TypeScript                         |
| **Autenticación**         | Supabase Auth (magic link + OAuth Google)                                                       | Sin contraseñas para árbitros (simplifica onboarding), SSO para admins FBM                          |
| **Motor de optimización** | Python (OR-Tools) como microservicio o Edge Function                                            | Google OR-Tools es el estándar para problemas de asignación con restricciones                       |
| **Distancias**            | Matriz precalculada en PostgreSQL + Google Distance Matrix API (para seed inicial)              | ~180 municipios = ~32.000 pares, se calcula una vez y se cachea                                     |
| **Notificaciones**        | Resend (email) + Web Push API                                                                   | Emails transaccionales y notificaciones push para designaciones                                     |
| **Hosting**               | Vercel (frontend + API routes) + Supabase (DB + Auth) + Railway o Fly.io (microservicio Python) |
| **Monitorización**        | Sentry (errores) + Vercel Analytics (rendimiento)                                               |
| **CI/CD**                 | GitHub Actions → preview deploys en Vercel                                                      |

---

## Modelo de Datos

### Diagrama Entidad-Relación

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   persons    │────<│  availabilities  │     │    venues        │
│─────────────│     │──────────────────│     │─────────────────│
│ id (PK)      │     │ id (PK)          │     │ id (PK)          │
│ name         │     │ person_id (FK)   │     │ name             │
│ email        │     │ week_start       │     │ address          │
│ phone        │     │ day_of_week      │     │ municipality_id  │
│ role (enum)  │     │ start_time       │     │ latitude         │
│ category     │     │ end_time         │     │ longitude        │
│ address      │     │ created_at       │     │ postal_code      │
│ postal_code  │     └──────────────────┘     └─────────────────┘
│ municipality │                                       │
│ latitude     │     ┌──────────────────┐              │
│ longitude    │     │    matches       │──────────────┘
│ bank_iban    │     │──────────────────│
│ active       │     │ id (PK)          │
│ auth_user_id │     │ date             │
│ created_at   │     │ time             │
└─────────────┘     │ venue_id (FK)    │
       │            │ competition_id   │
       │            │ home_team        │
       │            │ away_team        │
       │            │ referees_needed  │
       │            │ scorers_needed   │
       │            │ status (enum)    │
       │            │ season_id        │
       │            │ matchday         │
       │            └──────────────────┘
       │                     │
       │            ┌──────────────────┐
       └───────────>│  designations    │
                    │──────────────────│
                    │ id (PK)          │
                    │ match_id (FK)    │
                    │ person_id (FK)   │
                    │ role (enum)      │     ┌──────────────────┐
                    │ travel_cost      │     │  municipalities  │
                    │ distance_km      │     │──────────────────│
                    │ status (enum)    │     │ id (PK)          │
                    │ notified_at      │     │ name             │
                    │ confirmed_at     │     │ province         │
                    │ created_at       │     └──────────────────┘
                    └──────────────────┘              │
                                                     │
                                              ┌──────────────────┐
                                              │   distances      │
                                              │──────────────────│
                                              │ origin_id (FK)   │
                                              │ dest_id (FK)     │
                                              │ distance_km      │
                                              │ (PK: origin+dest)│
                                              └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│  competitions     │     │  seasons          │
│──────────────────│     │──────────────────│
│ id (PK)          │     │ id (PK)          │
│ name             │     │ name             │
│ category         │     │ start_date       │
│ gender           │     │ end_date         │
│ referees_needed  │     │ active           │
│ scorers_needed   │     └──────────────────│
│ min_ref_category │
│ season_id (FK)   │
└──────────────────┘

┌──────────────────┐
│ incompatibilities │
│──────────────────│
│ person_id (FK)   │
│ team_name        │
│ reason           │
│ (árbitro no puede│
│  pitar a su club)│
└──────────────────┘
```

### Enums

```typescript
enum PersonRole {
  REFEREE = 'arbitro',
  SCORER = 'anotador',
}

enum RefereeCategory {
  PROVINCIAL = 'provincial',
  AUTONOMICO = 'autonomico',
  NACIONAL = 'nacional',
  FEB = 'feb',
}

enum DesignationStatus {
  PENDING = 'pending', // Asignado, pendiente de notificar
  NOTIFIED = 'notified', // Notificación enviada
  CONFIRMED = 'confirmed', // Árbitro confirma
  REJECTED = 'rejected', // Árbitro rechaza (necesita sustituto)
  COMPLETED = 'completed', // Partido jugado
}

enum MatchStatus {
  SCHEDULED = 'scheduled',
  DESIGNATED = 'designated', // Todos los oficiales asignados
  PLAYED = 'played',
  SUSPENDED = 'suspended',
}
```

---

## Lógica de Coste de Desplazamiento

```typescript
function calculateTravelCost(person: Person, venue: Venue): { cost: number; km: number } {
  // Mismo municipio → tarifa fija
  if (person.municipality_id === venue.municipality_id) {
    return { cost: 3.0, km: 0 }
  }

  // Distinto municipio → consultar matriz de distancias
  const distance = await db.query(
    `
    SELECT distance_km FROM distances
    WHERE origin_id = $1 AND dest_id = $2
  `,
    [person.municipality_id, venue.municipality_id],
  )

  const km = distance.rows[0].distance_km
  return { cost: km * 0.1, km }
}
```

### Seed de la Matriz de Distancias

Script que se ejecuta una vez para poblar la tabla `distances`:

1. Obtener lista de los ~180 municipios de la Comunidad de Madrid.
2. Para cada par (origen, destino), llamar a Google Distance Matrix API (modo driving).
3. Insertar en tabla `distances`. Coste estimado: ~32.000 pares ÷ 25 por request = ~1.300 llamadas API ≈ 6,50 USD.
4. Actualizar periódicamente (anualmente es suficiente, las carreteras no cambian).

---

## Motor de Asignación Automática

### Definición del Problema

Es un problema de **asignación con restricciones** (Constraint Satisfaction + Optimization). Se modela como un problema de programación lineal entera (ILP).

### Variables de Decisión

```
x[p][m] ∈ {0, 1}  — persona p asignada al partido m
```

### Función Objetivo

```
minimizar:
  α × Σ(coste_desplazamiento[p][m] × x[p][m])     // Minimizar coste total
+ β × max(partidos_por_persona) - min(partidos_por_persona)  // Equilibrar carga
```

Donde α y β son pesos configurables por el designador. Por defecto α=0.7, β=0.3.

### Restricciones

1. **Cobertura**: cada partido tiene exactamente N árbitros y M anotadores asignados.
2. **Disponibilidad**: solo asignar personas disponibles en la franja horaria del partido.
3. **Rol**: árbitros solo se asignan como árbitros, anotadores como anotadores.
4. **Categoría mínima**: el nivel del árbitro debe ser ≥ al requerido por la competición.
5. **Sin solapamiento**: una persona no puede estar en dos partidos cuya franja horaria se solape (considerar duración del partido ~1,5h + margen de desplazamiento).
6. **Incompatibilidades**: un árbitro no puede pitar partidos de su propio club.
7. **Carga máxima**: ninguna persona puede superar X partidos por jornada (configurable, por defecto 3).

### Implementación

```python
# microservicio: optimizer/main.py
from ortools.sat.python import cp_model
from fastapi import FastAPI

app = FastAPI()

@app.post("/optimize")
async def optimize(request: OptimizationRequest):
    model = cp_model.CpModel()

    # Variables
    x = {}
    for p in request.persons:
        for m in request.matches:
            x[p.id, m.id] = model.NewBoolVar(f'x_{p.id}_{m.id}')

    # Restricción: cobertura exacta por partido
    for m in request.matches:
        referees = [x[p.id, m.id] for p in request.persons if p.role == 'arbitro']
        scorers = [x[p.id, m.id] for p in request.persons if p.role == 'anotador']
        model.Add(sum(referees) == m.referees_needed)
        model.Add(sum(scorers) == m.scorers_needed)

    # Restricción: disponibilidad
    for p in request.persons:
        for m in request.matches:
            if not is_available(p, m):
                model.Add(x[p.id, m.id] == 0)

    # Restricción: sin solapamiento temporal
    for p in request.persons:
        for m1, m2 in overlapping_pairs(request.matches):
            model.Add(x[p.id, m1.id] + x[p.id, m2.id] <= 1)

    # Restricción: incompatibilidades
    for p in request.persons:
        for m in request.matches:
            if is_incompatible(p, m):
                model.Add(x[p.id, m.id] == 0)

    # Objetivo: minimizar coste
    cost_terms = []
    for p in request.persons:
        for m in request.matches:
            cost = get_travel_cost(p, m)
            cost_terms.append(cost * x[p.id, m.id])
    model.Minimize(sum(cost_terms))

    # Resolver
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    status = solver.Solve(model)

    # Extraer solución
    assignments = []
    for p in request.persons:
        for m in request.matches:
            if solver.Value(x[p.id, m.id]) == 1:
                assignments.append({"person_id": p.id, "match_id": m.id})

    return {"status": status, "assignments": assignments}
```

---

## Estructura del Proyecto

```
fbm-designaciones/
├── apps/
│   └── web/                          # Next.js 14 App
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── layout.tsx
│       │   ├── (portal)/             # Portal árbitro/anotador
│       │   │   ├── disponibilidad/page.tsx
│       │   │   ├── designaciones/page.tsx
│       │   │   ├── perfil/page.tsx
│       │   │   └── layout.tsx
│       │   ├── (admin)/              # Panel designador
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── partidos/page.tsx
│       │   │   ├── partidos/[id]/page.tsx
│       │   │   ├── personal/page.tsx
│       │   │   ├── personal/[id]/page.tsx
│       │   │   ├── asignacion/page.tsx
│       │   │   ├── reportes/page.tsx
│       │   │   └── layout.tsx
│       │   ├── api/
│       │   │   ├── matches/route.ts
│       │   │   ├── persons/route.ts
│       │   │   ├── availabilities/route.ts
│       │   │   ├── designations/route.ts
│       │   │   ├── optimize/route.ts   # Proxy al microservicio Python
│       │   │   └── webhooks/route.ts
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── ui/                    # shadcn/ui components
│       │   ├── availability-grid.tsx
│       │   ├── match-card.tsx
│       │   ├── assignment-panel.tsx
│       │   ├── person-card.tsx
│       │   ├── stats-bar.tsx
│       │   └── cost-badge.tsx
│       ├── lib/
│       │   ├── db/
│       │   │   ├── schema.ts          # Drizzle schema
│       │   │   ├── migrations/
│       │   │   └── seed.ts
│       │   ├── auth.ts
│       │   ├── travel-cost.ts
│       │   └── utils.ts
│       ├── stores/
│       │   ├── assignment-store.ts    # Zustand
│       │   └── filter-store.ts
│       ├── tailwind.config.ts
│       ├── drizzle.config.ts
│       └── package.json
│
├── services/
│   └── optimizer/                     # Microservicio Python
│       ├── main.py                    # FastAPI app
│       ├── solver.py                  # Lógica OR-Tools
│       ├── models.py                  # Pydantic schemas
│       ├── requirements.txt
│       └── Dockerfile
│
├── scripts/
│   ├── seed-distances.ts              # Poblar matriz de distancias
│   ├── seed-municipalities.ts         # Importar municipios CM
│   ├── import-matches.ts             # Importar partidos desde CSV/API FBM
│   └── seed-demo-data.ts
│
├── docs/
│   ├── api.md
│   ├── deployment.md
│   └── user-guide.md
│
├── turbo.json                         # Turborepo config
├── package.json
└── README.md
```

---

## Roles y Permisos

| Acción                            | Árbitro/Anotador | Designador | Admin FBM |
| --------------------------------- | :--------------: | :--------: | :-------: |
| Ver su disponibilidad             |        ✅        |     —      |    ✅     |
| Editar su disponibilidad          |        ✅        |     —      |    ✅     |
| Ver sus designaciones             |        ✅        |     —      |    ✅     |
| Confirmar/rechazar designación    |        ✅        |     —      |    ✅     |
| Ver todos los partidos            |        —         |     ✅     |    ✅     |
| Ver toda la disponibilidad        |        —         |     ✅     |    ✅     |
| Asignar manualmente               |        —         |     ✅     |    ✅     |
| Lanzar asignación automática      |        —         |     ✅     |    ✅     |
| Publicar designaciones            |        —         |     ✅     |    ✅     |
| Gestionar personal (alta/baja)    |        —         |     —      |    ✅     |
| Gestionar competiciones           |        —         |     —      |    ✅     |
| Gestionar pabellones              |        —         |     —      |    ✅     |
| Ver reportes financieros          |        —         |     ✅     |    ✅     |
| Configurar parámetros del sistema |        —         |     —      |    ✅     |

Implementación: Supabase RLS (Row Level Security) con roles en metadata del JWT.

---

## Flujos Principales

### Flujo 1: Árbitro introduce disponibilidad

```
1. Árbitro recibe email/push: "Introduce tu disponibilidad para la semana del 10/03"
2. Accede al portal → Pestaña Disponibilidad
3. Ve cuadrícula semanal (lunes a domingo, 08:00 a 22:00)
4. Marca las franjas en las que está disponible haciendo clic
5. Pulsa "Guardar disponibilidad"
6. Sistema registra las franjas con timestamp
7. Si la fecha límite pasa sin disponibilidad → se marca como "no disponible toda la semana"
```

### Flujo 2: Designador asigna jornada

```
1. 7 días antes de la jornada, los partidos ya están cargados en el sistema
2. Designador accede a Panel → Asignación
3. Ve resumen: X partidos, Y árbitros disponibles, Z anotadores disponibles
4. Pulsa "Asignación Automática"
5. El sistema envía datos al microservicio Python (OR-Tools)
6. OR-Tools devuelve la solución óptima en <30 segundos
7. El designador ve la propuesta con indicadores de coste y cobertura
8. Revisa, ajusta manualmente si necesita (drag & drop o selección)
9. Pulsa "Publicar designaciones"
10. Sistema envía email + push a cada persona con sus partidos asignados
11. Cada persona confirma o rechaza
12. Si hay rechazos, el designador busca sustituto (manual o re-optimización parcial)
```

### Flujo 3: Importación de partidos

```
1. Admin sube CSV con partidos de la jornada (o se integra con API de FBM si existe)
2. Sistema parsea: fecha, hora, pabellón, equipos, categoría
3. Valida que los pabellones existen, la categoría es conocida
4. Crea los registros de partidos con estado "scheduled"
5. Deduce automáticamente el número de árbitros y anotadores por la categoría
```

---

## Roadmap por Fases

### Fase 0 — Setup y Fundamentos (Semana 1-2)

**Objetivo**: Infraestructura lista para desarrollar.

- [ ] Crear repo con Turborepo, configurar Next.js 14 + TypeScript + Tailwind + shadcn/ui
- [ ] Configurar Supabase: proyecto, base de datos PostgreSQL, Auth con magic link
- [ ] Definir schema de Drizzle ORM completo y ejecutar migraciones iniciales
- [ ] Script de seed: municipios de la Comunidad de Madrid (~180)
- [ ] Script de seed: matriz de distancias (Google Distance Matrix API, ejecución única)
- [ ] Script de seed: datos de demo (árbitros ficticios, pabellones, partidos de ejemplo)
- [ ] Configurar Sentry, linting (ESLint + Prettier), Husky pre-commit hooks
- [ ] CI básico con GitHub Actions (lint + type-check + build)

**Entregable**: `npm run dev` funciona, DB poblada con datos de demo, auth operativo.

---

### Fase 1 — Portal del Árbitro/Anotador (Semana 3-5)

**Objetivo**: Los árbitros y anotadores pueden gestionar su disponibilidad y ver sus designaciones.

- [ ] Layout del portal con navegación (disponibilidad, designaciones, perfil)
- [ ] Página de disponibilidad:
  - Cuadrícula semanal interactiva (click para marcar/desmarcar franjas)
  - Selector de semana (solo semanas futuras dentro del rango de 10 días)
  - Guardar en base de datos con optimistic updates
  - Indicador visual de franjas guardadas vs pendientes
- [ ] Página de designaciones:
  - Lista de partidos asignados con detalle completo
  - Estado de cada designación (pendiente / confirmada)
  - Botón confirmar / rechazar designación
  - Resumen semanal: partidos, coste total de desplazamiento
- [ ] Página de perfil:
  - Datos personales (solo lectura excepto teléfono y dirección)
  - Historial de temporada: partidos pitados, total cobrado
- [ ] Emails transaccionales con Resend:
  - "Introduce tu disponibilidad" (recordatorio automático a los 10 días)
  - "Nueva designación publicada"
  - "Designación modificada"
- [ ] Tests E2E con Playwright para flujos críticos (marcar disponibilidad, confirmar designación)

**Entregable**: Portal funcional para árbitros y anotadores. Se puede usar en producción para recoger disponibilidad.

---

### Fase 2 — Panel del Designador (Semana 6-9)

**Objetivo**: El designador puede ver toda la información y asignar manualmente.

- [ ] Dashboard principal:
  - Resumen de jornada: partidos totales, cubiertos, pendientes, coste estimado
  - Barra de progreso de cobertura
  - Alertas: partidos sin cobertura, personas sin disponibilidad
- [ ] Vista de partidos:
  - Tabla/lista de todos los partidos de la jornada
  - Filtros: día, categoría, municipio, estado de cobertura
  - Detalle expandible por partido con slots de asignación
- [ ] Asignación manual:
  - Al expandir un partido, ver lista de personas disponibles para esa franja
  - Para cada persona: nombre, municipio, coste de desplazamiento, carga actual
  - Ordenación por coste (menor primero) o por cercanía
  - Click para asignar, click para desasignar
  - Validaciones en tiempo real (solapamiento, incompatibilidades, categoría)
- [ ] Vista de personal:
  - Grid de tarjetas con todos los árbitros y anotadores
  - Filtros: rol, categoría, municipio, disponibilidad en la jornada
  - Detalle por persona: disponibilidad de la semana, partidos asignados, carga histórica
- [ ] Importación de partidos:
  - Subida de CSV con formato definido
  - Preview y validación antes de importar
  - Creación automática de partidos
- [ ] Publicación de designaciones:
  - Botón "Publicar" que cambia estado y dispara notificaciones
  - Vista previa de lo que se enviará a cada persona

**Entregable**: Designación manual completa y operativa. El designador puede trabajar sin el motor de optimización.

---

### Fase 3 — Motor de Asignación Automática (Semana 10-12)

**Objetivo**: Optimización automática de designaciones.

- [ ] Microservicio Python con FastAPI:
  - Endpoint POST `/optimize` que recibe partidos + personas + disponibilidad + distancias
  - Solver con OR-Tools (CP-SAT) implementando todas las restricciones
  - Respuesta con asignaciones óptimas y métricas (coste total, cobertura, tiempo de resolución)
- [ ] Dockerfile y deploy en Railway o Fly.io
- [ ] Integración desde Next.js:
  - Botón "Asignación Automática" en el panel del designador
  - Loading state con progreso estimado
  - Resultado mostrado como propuesta editable (no se aplica directamente)
  - Diff visual: qué cambiaría respecto a asignaciones manuales existentes
- [ ] Parámetros configurables:
  - Peso coste vs equilibrio de carga (slider)
  - Máximo de partidos por persona y jornada
  - Forzar asignaciones previas (personas ya asignadas manualmente no se mueven)
- [ ] Re-optimización parcial:
  - Si un árbitro rechaza, re-optimizar solo ese slot sin tocar el resto
- [ ] Tests del solver:
  - Caso trivial (1 partido, 1 árbitro)
  - Caso sin solución (más partidos que personas)
  - Caso con incompatibilidades
  - Caso de rendimiento (50 partidos, 30 personas)

**Entregable**: Asignación automática funcional. El designador lanza la optimización, revisa, ajusta y publica.

---

### Fase 4 — Reportes y Liquidaciones (Semana 13-15)

**Objetivo**: Visibilidad financiera y liquidación de pagos.

- [ ] Panel de reportes del designador:
  - Coste total por jornada / mes / temporada
  - Coste por municipio (mapa de calor)
  - Carga por persona (gráfico de barras, detectar desequilibrios)
  - Partidos sin cubrir histórico
- [ ] Liquidación mensual:
  - Generación automática de listado: persona, partidos, desglose de desplazamiento, total
  - Exportación a Excel (XLSX) para el departamento financiero
  - Exportación a PDF para enviar al árbitro como justificante
- [ ] Historial por persona:
  - Todos los partidos de la temporada con coste de cada uno
  - Total acumulado
  - Accesible tanto para el árbitro (sus datos) como para el admin (todos)

**Entregable**: Informes financieros exportables. El departamento de tesorería de la FBM puede liquidar mensualmente.

---

### Fase 5 — Notificaciones Avanzadas y PWA (Semana 16-18)

**Objetivo**: Comunicación en tiempo real y acceso móvil offline.

- [ ] Web Push Notifications:
  - Solicitar permiso al primer login
  - Push cuando se publica una designación
  - Push recordatorio de disponibilidad
  - Push si se modifica una designación ya confirmada
- [ ] Configurar Next.js como PWA:
  - Service worker para cache de shell
  - Manifest con icono FBM
  - Instalable en móvil (Add to Home Screen)
  - Modo offline: ver designaciones cacheadas, cola de cambios de disponibilidad
- [ ] Canal de Telegram/WhatsApp (opcional):
  - Bot que envía resumen semanal de designaciones
  - Respuesta rápida para confirmar/rechazar

**Entregable**: Los árbitros reciben notificaciones push y pueden usar la app desde el móvil como si fuera nativa.

---

### Fase 6 — Integraciones y Automatización (Semana 19-22)

**Objetivo**: Reducir trabajo manual del designador al mínimo.

- [ ] Integración con sistema de competiciones FBM:
  - API o scraping para importar automáticamente los partidos de cada jornada
  - Sincronización de equipos, pabellones, categorías
- [ ] Recordatorios automáticos:
  - Cron job: 10 días antes → email pidiendo disponibilidad
  - Cron job: 3 días antes → recordatorio a quienes no han introducido disponibilidad
  - Cron job: día anterior → resumen al designador del estado de cobertura
- [ ] Auto-designación programada:
  - Opción de que el sistema lance la optimización automáticamente a una hora configurada (ej: miércoles a las 20:00)
  - El designador solo revisa y publica
- [ ] Gestión de sustituciones:
  - Si un árbitro cancela con menos de 48h, el sistema propone sustitutos automáticamente ordenados por coste + cercanía
  - Notificación urgente al sustituto propuesto

**Entregable**: Sistema casi autónomo. El designador supervisa en lugar de ejecutar.

---

### Fase 7 — Admin Avanzado y Auditoría (Semana 23-25)

**Objetivo**: Gestión completa para la administración de la FBM.

- [ ] CRUD completo de entidades:
  - Personas (alta, baja, edición, cambio de categoría)
  - Pabellones (nuevo pabellón, cambio de dirección)
  - Competiciones (nueva liga, cambio de requisitos)
- [ ] Log de auditoría:
  - Quién designó a quién, cuándo, y si fue manual o automático
  - Historial de cambios en designaciones
  - Quién publicó las designaciones
- [ ] Gestión de temporadas:
  - Crear nueva temporada, archivar la anterior
  - Migrar personas activas a nueva temporada
- [ ] Configuración del sistema:
  - Tarifa por km (actualmente 0.10 €)
  - Tarifa mismo municipio (actualmente 3 €)
  - Días de antelación para disponibilidad (actualmente 10)
  - Duración media de partido por categoría
  - Tiempo mínimo entre partidos

**Entregable**: Panel de administración completo. La FBM puede gestionar todo el ciclo de vida sin intervención técnica.

---

## Decisiones Técnicas Clave

### ¿Por qué PostgreSQL y no MongoDB?

El dominio es inherentemente relacional: personas se asignan a partidos, partidos pertenecen a competiciones, las distancias son relaciones entre municipios. PostgreSQL con PostGIS además permite queries geográficas eficientes si en el futuro se quieren calcular distancias en línea recta como fallback.

### ¿Por qué un microservicio Python separado para OR-Tools?

OR-Tools es una librería nativa de C++ con bindings Python. No existe un equivalente maduro en JavaScript. Mantenerlo como microservicio desacopla la optimización del frontend, permite escalarlo independientemente, y el endpoint se puede llamar también desde scripts o desde otros sistemas.

### ¿Por qué Supabase Auth con magic link?

Los árbitros y anotadores son personas no técnicas que arbitran como actividad secundaria. Pedirles que recuerden contraseñas genera fricción y soporte. Un magic link por email es un clic y están dentro. Para los admins FBM, se puede añadir OAuth con Google (dominio @fbm.es).

### ¿Por qué matriz de distancias precalculada?

Llamar a Google Maps en cada asignación sería lento y caro. Con ~180 municipios, la matriz tiene ~32.000 entradas que se calculan una vez y se consultan en <1ms. Si se añade un municipio nuevo, se calculan solo las ~180 nuevas distancias.

### ¿Por qué Zustand y no Redux/Context?

El estado global de la app es moderado: filtros activos, partido seleccionado, asignaciones en curso. Zustand resuelve esto con una fracción del boilerplate de Redux y sin los problemas de rendimiento de Context para actualizaciones frecuentes.

---

## Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optimizer service
OPTIMIZER_URL=https://optimizer.railway.app

# Google Maps (solo para seed de distancias)
GOOGLE_MAPS_API_KEY=AIza...

# Resend (emails)
RESEND_API_KEY=re_...
EMAIL_FROM=designaciones@fbm.es

# Sentry
SENTRY_DSN=https://...

# App
NEXT_PUBLIC_APP_URL=https://designaciones.fbm.es
TRAVEL_COST_PER_KM=0.10
TRAVEL_COST_SAME_MUNICIPALITY=3.00
AVAILABILITY_DAYS_ADVANCE=10
```

---

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev                    # Next.js en localhost:3000

# Base de datos
npm run db:generate            # Generar migraciones Drizzle
npm run db:migrate             # Ejecutar migraciones
npm run db:seed                # Poblar datos de demo
npm run db:seed:distances      # Poblar matriz de distancias (requiere API key)

# Optimizer (desde /services/optimizer)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Tests
npm run test                   # Unit tests (Vitest)
npm run test:e2e               # E2E (Playwright)

# Build y deploy
npm run build
npm run lint
npm run typecheck
```
