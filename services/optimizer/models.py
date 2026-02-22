"""Pydantic schemas para el microservicio de optimizacion."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class PersonRole(str, Enum):
    ARBITRO = "arbitro"
    ANOTADOR = "anotador"


class RefereeCategory(str, Enum):
    PROVINCIAL = "provincial"
    AUTONOMICO = "autonomico"
    NACIONAL = "nacional"
    FEB = "feb"


# ── Request models ───────────────────────────────────────────────────────────


class Venue(BaseModel):
    id: str
    name: str
    municipality_id: str


class Competition(BaseModel):
    id: str
    name: str
    category: str
    min_ref_category: str
    referees_needed: int
    scorers_needed: int


class Designation(BaseModel):
    id: str
    match_id: str
    person_id: str
    role: PersonRole
    status: str


class Match(BaseModel):
    id: str
    date: str
    time: str
    home_team: str
    away_team: str
    venue: Venue
    competition: Competition
    referees_needed: int
    scorers_needed: int
    designations: list[Designation] = Field(default_factory=list)


class Availability(BaseModel):
    person_id: str
    day_of_week: int
    start_time: str
    end_time: str


class Incompatibility(BaseModel):
    person_id: str
    team_name: str


class Distance(BaseModel):
    origin_id: str
    dest_id: str
    distance_km: float


class Person(BaseModel):
    id: str
    name: str
    role: PersonRole
    category: Optional[str] = None
    municipality_id: str
    active: bool = True
    availabilities: list[Availability] = Field(default_factory=list)
    incompatibilities: list[Incompatibility] = Field(default_factory=list)


class SolverParameters(BaseModel):
    cost_weight: float = Field(default=0.7, ge=0, le=1)
    balance_weight: float = Field(default=0.3, ge=0, le=1)
    max_matches_per_person: int = Field(default=3, ge=1, le=10)
    force_existing: bool = True


class OptimizationRequest(BaseModel):
    matches: list[Match]
    persons: list[Person]
    distances: list[Distance]
    parameters: SolverParameters = Field(default_factory=SolverParameters)


# ── Response models ──────────────────────────────────────────────────────────


class ProposedAssignment(BaseModel):
    match_id: str
    person_id: str
    person_name: str
    role: PersonRole
    travel_cost: float
    distance_km: float
    is_new: bool


class UnassignedSlot(BaseModel):
    match_id: str
    match_label: str
    role: PersonRole
    slot_index: int
    reason: str


class SolverMetrics(BaseModel):
    total_cost: float
    coverage: float
    covered_slots: int
    total_slots: int
    resolution_time_ms: int


class OptimizationResponse(BaseModel):
    status: str  # optimal, feasible, partial, no_solution
    assignments: list[ProposedAssignment]
    metrics: SolverMetrics
    unassigned: list[UnassignedSlot]
