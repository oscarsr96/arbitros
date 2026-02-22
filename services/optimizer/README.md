# FBM Optimizer — Motor de asignacion

Microservicio Python que resuelve el problema de asignacion de arbitros y anotadores a partidos.

## Desarrollo local

```bash
cd services/optimizer
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Endpoints

- `GET /health` — Health check
- `POST /optimize` — Resolver asignacion (ver `models.py` para schemas)

## Docker

```bash
docker build -t fbm-optimizer .
docker run -p 8000:8000 fbm-optimizer
```

## Arquitectura

- `main.py` — FastAPI app con endpoints
- `solver.py` — Logica del solver (greedy actual, OR-Tools CP-SAT futuro)
- `models.py` — Pydantic schemas de request/response

## Roadmap

1. **v0.1** (actual): Solver greedy heuristico equivalente al TypeScript
2. **v0.2**: Implementar solver CP-SAT con OR-Tools para solucion optima
3. **v0.3**: Re-optimizacion parcial y warm-start desde solucion previa
