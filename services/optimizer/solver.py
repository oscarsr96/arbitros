"""
Motor de asignacion con OR-Tools CP-SAT.

Resuelve el problema de asignacion de arbitros y anotadores a partidos
minimizando coste de desplazamiento y equilibrando carga.

Version actual: scaffold con estructura completa.
TODO: implementar solver CP-SAT completo.
"""

from __future__ import annotations

import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import (
        Distance,
        Match,
        OptimizationResponse,
        Person,
        ProposedAssignment,
        SolverMetrics,
        SolverParameters,
        UnassignedSlot,
    )

# Jerarquia de categorias
CATEGORY_RANK = {
    "provincial": 1,
    "autonomico": 2,
    "nacional": 3,
    "feb": 4,
}


def build_distance_lookup(distances: list[Distance]) -> dict[tuple[str, str], float]:
    """Construye lookup bidireccional de distancias."""
    lookup: dict[tuple[str, str], float] = {}
    for d in distances:
        lookup[(d.origin_id, d.dest_id)] = d.distance_km
        lookup[(d.dest_id, d.origin_id)] = d.distance_km
    return lookup


def get_travel_cost(
    person_muni: str,
    venue_muni: str,
    dist_lookup: dict[tuple[str, str], float],
) -> tuple[float, float]:
    """Calcula coste y distancia de desplazamiento."""
    if person_muni == venue_muni:
        return 3.0, 0.0
    km = dist_lookup.get((person_muni, venue_muni), 35.0)
    return round(km * 0.1, 2), km


def solve(
    matches: list[Match],
    persons: list[Person],
    distances: list[Distance],
    parameters: SolverParameters,
) -> OptimizationResponse:
    """
    Solver principal.

    Fase actual: greedy heuristico (equivalente al solver TypeScript).
    Fase futura: OR-Tools CP-SAT para solucion optima.

    El solver CP-SAT modelaria:
      - Variables: x[p][m] in {0, 1} — persona p asignada a partido m
      - Objetivo: minimizar alpha * sum(cost * x) + beta * (max_load - min_load)
      - Restricciones:
        1. sum(x[arbitros][m]) == m.referees_needed para cada m
        2. sum(x[anotadores][m]) == m.scorers_needed para cada m
        3. x[p][m] == 0 si p no disponible para m
        4. x[p][m1] + x[p][m2] <= 1 si m1 y m2 solapan
        5. x[p][m] == 0 si p incompatible con equipo de m
        6. sum(x[p][*]) <= max_matches para cada p
        7. x[p][m] == 0 si categoria(p) < min_categoria(m)
    """
    from models import (
        OptimizationResponse,
        ProposedAssignment,
        SolverMetrics,
        UnassignedSlot,
    )

    start = time.time()
    dist_lookup = build_distance_lookup(distances)

    assignments: list[ProposedAssignment] = []
    unassigned: list[UnassignedSlot] = []
    person_load: dict[str, int] = {p.id: 0 for p in persons}
    assigned_times: dict[str, list[tuple[str, int]]] = {p.id: [] for p in persons}

    # Cargar designaciones existentes
    if parameters.force_existing:
        for match in matches:
            for d in match.designations:
                if d.status == "rejected":
                    continue
                person = next((p for p in persons if p.id == d.person_id), None)
                if not person:
                    continue
                cost, km = get_travel_cost(
                    person.municipality_id, match.venue.municipality_id, dist_lookup
                )
                assignments.append(
                    ProposedAssignment(
                        match_id=match.id,
                        person_id=person.id,
                        person_name=person.name,
                        role=d.role,
                        travel_cost=cost,
                        distance_km=km,
                        is_new=False,
                    )
                )
                person_load[person.id] = person_load.get(person.id, 0) + 1
                match_hour = int(match.time.split(":")[0])
                assigned_times.setdefault(person.id, []).append((match.date, match_hour))

    # Ordenar partidos: menos asignaciones primero, mayor categoria primero
    sorted_matches = sorted(
        matches,
        key=lambda m: (
            len([d for d in m.designations if d.status != "rejected"]),
            -CATEGORY_RANK.get(m.competition.min_ref_category, 0),
        ),
    )

    for match in sorted_matches:
        existing = [d for d in match.designations if d.status != "rejected"]
        venue_muni = match.venue.municipality_id

        for role, needed_total in [
            ("arbitro", match.referees_needed),
            ("anotador", match.scorers_needed),
        ]:
            existing_role = [d for d in existing if d.role == role]
            needed = needed_total - (len(existing_role) if parameters.force_existing else 0)

            for slot_idx in range(needed):
                candidate = _find_best(
                    match,
                    role,
                    venue_muni,
                    persons,
                    person_load,
                    assigned_times,
                    assignments,
                    dist_lookup,
                    parameters,
                )
                if candidate:
                    p, cost, km = candidate
                    assignments.append(
                        ProposedAssignment(
                            match_id=match.id,
                            person_id=p.id,
                            person_name=p.name,
                            role=role,
                            travel_cost=cost,
                            distance_km=km,
                            is_new=True,
                        )
                    )
                    person_load[p.id] = person_load.get(p.id, 0) + 1
                    match_hour = int(match.time.split(":")[0])
                    assigned_times.setdefault(p.id, []).append((match.date, match_hour))
                else:
                    actual_idx = (
                        len(existing_role) + slot_idx if parameters.force_existing else slot_idx
                    )
                    unassigned.append(
                        UnassignedSlot(
                            match_id=match.id,
                            match_label=f"{match.home_team} vs {match.away_team}",
                            role=role,
                            slot_index=actual_idx,
                            reason="Sin candidatos validos",
                        )
                    )

    elapsed_ms = int((time.time() - start) * 1000)
    new_assignments = [a for a in assignments if a.is_new]
    total_slots = sum(m.referees_needed + m.scorers_needed for m in matches)
    covered = total_slots - len(unassigned)

    status = "optimal" if not unassigned else ("partial" if new_assignments else "no_solution")

    return OptimizationResponse(
        status=status,
        assignments=assignments,
        metrics=SolverMetrics(
            total_cost=round(sum(a.travel_cost for a in new_assignments), 2),
            coverage=round(covered / total_slots * 100, 1) if total_slots else 100,
            covered_slots=covered,
            total_slots=total_slots,
            resolution_time_ms=elapsed_ms,
        ),
        unassigned=unassigned,
    )


def _find_best(
    match: Match,
    role: str,
    venue_muni: str,
    persons: list[Person],
    person_load: dict[str, int],
    assigned_times: dict[str, list[tuple[str, int]]],
    current_assignments: list[ProposedAssignment],
    dist_lookup: dict[tuple[str, str], float],
    parameters: SolverParameters,
) -> tuple[Person, float, float] | None:
    """Encuentra el mejor candidato para un slot."""
    match_hour = int(match.time.split(":")[0])
    max_load = max(1, max(person_load.values(), default=1))
    candidates = []

    for p in persons:
        if p.role != role or not p.active:
            continue
        if any(a.match_id == match.id and a.person_id == p.id for a in current_assignments):
            continue
        if person_load.get(p.id, 0) >= parameters.max_matches_per_person:
            continue

        # Disponibilidad (simplificada — en produccion consultar BD)
        # TODO: verificar disponibilidad real contra p.availabilities

        # Solapamiento temporal
        times = assigned_times.get(p.id, [])
        if any(d == match.date and abs(h - match_hour) < 2 for d, h in times):
            continue

        # Categoria minima
        if role == "arbitro" and match.competition.min_ref_category:
            if CATEGORY_RANK.get(p.category or "", 0) < CATEGORY_RANK.get(
                match.competition.min_ref_category, 0
            ):
                continue

        # Incompatibilidades
        if any(
            match.home_team.lower().find(inc.team_name.lower()) >= 0
            or match.away_team.lower().find(inc.team_name.lower()) >= 0
            for inc in p.incompatibilities
        ):
            continue

        cost, km = get_travel_cost(p.municipality_id, venue_muni, dist_lookup)
        norm_cost = cost / 10
        norm_load = person_load.get(p.id, 0) / max_load
        score = parameters.cost_weight * norm_cost + parameters.balance_weight * norm_load
        candidates.append((p, cost, km, score))

    if not candidates:
        return None

    candidates.sort(key=lambda x: x[3])
    best = candidates[0]
    return best[0], best[1], best[2]
