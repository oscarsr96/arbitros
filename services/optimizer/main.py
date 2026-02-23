"""
Microservicio de optimizacion de designaciones FBM.

Endpoints:
  POST /optimize — Resuelve el problema de asignacion
  GET  /health   — Health check
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import OptimizationRequest, OptimizationResponse
from solver import solve

app = FastAPI(
    title="FBM Optimizer",
    description="Motor de asignacion de arbitros y anotadores",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "solvers": ["greedy-v1", "cpsat-v2"]}


@app.post("/optimize", response_model=OptimizationResponse)
async def optimize(request: OptimizationRequest):
    try:
        result = solve(
            matches=request.matches,
            persons=request.persons,
            distances=request.distances,
            parameters=request.parameters,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
