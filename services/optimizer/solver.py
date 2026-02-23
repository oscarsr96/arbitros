"""
Motor de asignacion con OR-Tools CP-SAT + fallback greedy.

Resuelve el problema de asignacion de arbitros y anotadores a partidos
minimizando coste de desplazamiento y equilibrando carga.
"""

from __future__ import annotations

import time
from datetime import date, timedelta
from typing import TYPE_CHECKING

from ortools.sat.python import cp_model

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

# Escala para convertir floats a enteros (CP-SAT solo acepta enteros)
COST_SCALE = 100


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


# ── Helpers ─────────────────────────────────────────────────────────────────


def _get_week_start(date_str: str) -> str:
    """Devuelve el lunes de la semana para una fecha YYYY-MM-DD."""
    try:
        d = date.fromisoformat(date_str)
        monday = d - timedelta(days=d.weekday())
        return monday.isoformat()
    except (ValueError, TypeError):
        return ""


def _is_person_available(person: Person, match: Match) -> bool:
    """Comprueba si una persona esta disponible para un partido."""
    if not person.availabilities:
        return True  # Sin datos de disponibilidad = disponible (demo)

    match_date_str = match.date
    match_time = match.time
    match_week = _get_week_start(match_date_str)

    try:
        match_d = date.fromisoformat(match_date_str)
        match_dow = match_d.weekday()  # 0=lunes ... 6=domingo
        # Convertir a dayOfWeek JS (0=dom, 1=lun ... 6=sab)
        js_dow = (match_dow + 1) % 7
        if js_dow == 0:
            js_dow = 7  # Usar 7 para domingo si el frontend usa 5=viernes,6=sabado
        # El frontend usa: 5=viernes, 6=sabado — dayOfWeek del ISO
        # En mock-data: dayOfWeek 5=sabado(viernes?), 6=domingo(sabado?)
        # Usar el weekday de Python: 0=lun..6=dom, y el frontend guarda 5=sab, 6=dom
        # Python: sabado=5, domingo=6 — coincide con el frontend
    except (ValueError, TypeError):
        return True

    match_hour = int(match_time.split(":")[0])

    for avail in person.availabilities:
        # Filtrar por semana si week_start esta definido
        if avail.week_start and match_week and avail.week_start != match_week:
            continue

        if avail.day_of_week != match_dow:
            continue

        avail_start = int(avail.start_time.split(":")[0])
        avail_end = int(avail.end_time.split(":")[0])
        if avail_start <= match_hour < avail_end:
            return True

    return False


def _precompute_overlapping_pairs(
    matches: list[Match],
) -> list[tuple[int, int]]:
    """Devuelve pares de indices de partidos que solapan temporalmente (<2h diferencia, mismo dia)."""
    pairs: list[tuple[int, int]] = []
    n = len(matches)
    for i in range(n):
        for j in range(i + 1, n):
            if matches[i].date != matches[j].date:
                continue
            h1 = int(matches[i].time.split(":")[0])
            h2 = int(matches[j].time.split(":")[0])
            if abs(h1 - h2) < 2:
                pairs.append((i, j))
    return pairs


# ── Dispatcher ──────────────────────────────────────────────────────────────


def solve(
    matches: list[Match],
    persons: list[Person],
    distances: list[Distance],
    parameters: SolverParameters,
) -> OptimizationResponse:
    """Dispatcher: elige solver segun parameters.solver_type."""
    if parameters.solver_type == "greedy":
        return solve_greedy(matches, persons, distances, parameters)
    return solve_cpsat(matches, persons, distances, parameters)


# ── CP-SAT Solver ───────────────────────────────────────────────────────────


def solve_cpsat(
    matches: list[Match],
    persons: list[Person],
    distances: list[Distance],
    parameters: SolverParameters,
) -> OptimizationResponse:
    """Solver optimo con OR-Tools CP-SAT."""
    from models import (
        OptimizationResponse,
        ProposedAssignment,
        SolverMetrics,
        UnassignedSlot,
    )

    start = time.time()
    dist_lookup = build_distance_lookup(distances)
    model = cp_model.CpModel()

    # ── Pre-filtrado: determinar pares (persona, partido) factibles ─────────

    # Indices para acceso rapido
    match_idx = {m.id: i for i, m in enumerate(matches)}
    person_idx = {p.id: i for i, p in enumerate(persons)}

    # Variables de decision: x[pi, mi] = 1 si persona pi asignada a partido mi
    x: dict[tuple[int, int], cp_model.IntVar] = {}
    cost_lookup: dict[tuple[int, int], int] = {}  # coste escalado a entero

    for pi, person in enumerate(persons):
        if not person.active:
            continue
        for mi, match in enumerate(matches):
            # Filtro rol
            role_needed = (
                (person.role == "arbitro" and match.referees_needed > 0)
                or (person.role == "anotador" and match.scorers_needed > 0)
            )
            if not role_needed:
                continue

            # Filtro categoria minima (solo arbitros)
            if person.role == "arbitro" and match.competition.min_ref_category:
                if CATEGORY_RANK.get(person.category or "", 0) < CATEGORY_RANK.get(
                    match.competition.min_ref_category, 0
                ):
                    continue

            # Filtro disponibilidad
            if not _is_person_available(person, match):
                continue

            # Filtro incompatibilidades
            incompatible = False
            for inc in person.incompatibilities:
                if (
                    inc.team_name.lower() in match.home_team.lower()
                    or inc.team_name.lower() in match.away_team.lower()
                ):
                    incompatible = True
                    break
            if incompatible:
                continue

            # Crear variable
            x[pi, mi] = model.new_bool_var(f"x_{pi}_{mi}")

            # Precalcular coste
            cost, km = get_travel_cost(
                person.municipality_id, match.venue.municipality_id, dist_lookup
            )
            cost_scaled = int(cost * COST_SCALE)
            if not person.has_car and km > 15:
                cost_scaled = int(cost_scaled * 2.0)
            cost_lookup[pi, mi] = cost_scaled

    # ── Restricciones ───────────────────────────────────────────────────────

    # 1. Cobertura SOFT con variables slack
    slack_vars: list[cp_model.IntVar] = []

    for mi, match in enumerate(matches):
        for role, needed in [
            ("arbitro", match.referees_needed),
            ("anotador", match.scorers_needed),
        ]:
            role_vars = [
                x[pi, mi]
                for pi, p in enumerate(persons)
                if (pi, mi) in x and p.role == role
            ]

            slack = model.new_int_var(0, needed, f"slack_{mi}_{role}")
            slack_vars.append(slack)

            if role_vars:
                model.add(sum(role_vars) + slack == needed)
            else:
                # Ningun candidato posible → slack = needed
                model.add(slack == needed)

    # 2. No solapamiento temporal
    overlapping = _precompute_overlapping_pairs(matches)
    for pi in range(len(persons)):
        for mi1, mi2 in overlapping:
            if (pi, mi1) in x and (pi, mi2) in x:
                model.add(x[pi, mi1] + x[pi, mi2] <= 1)

    # 3. Carga maxima por persona
    for pi in range(len(persons)):
        person_vars = [x[pi, mi] for mi in range(len(matches)) if (pi, mi) in x]
        if person_vars:
            model.add(sum(person_vars) <= parameters.max_matches_per_person)

    # 4. Forzar designaciones existentes
    if parameters.force_existing:
        for mi, match in enumerate(matches):
            for d in match.designations:
                pi_val = person_idx.get(d.person_id)
                if pi_val is not None and (pi_val, mi) in x:
                    model.add(x[pi_val, mi] == 1)

    # ── Equilibrio de carga ─────────────────────────────────────────────────

    # Variables de carga por persona activa
    active_persons = [pi for pi, p in enumerate(persons) if p.active]
    load_vars: list[cp_model.IntVar] = []

    for pi in active_persons:
        person_vars = [x[pi, mi] for mi in range(len(matches)) if (pi, mi) in x]
        if person_vars:
            load = model.new_int_var(
                0, parameters.max_matches_per_person, f"load_{pi}"
            )
            model.add(load == sum(person_vars))
            load_vars.append(load)

    max_load = model.new_int_var(0, parameters.max_matches_per_person, "max_load")
    min_load = model.new_int_var(0, parameters.max_matches_per_person, "min_load")

    if load_vars:
        model.add_max_equality(max_load, load_vars)
        model.add_min_equality(min_load, load_vars)
    else:
        model.add(max_load == 0)
        model.add(min_load == 0)

    # ── Funcion objetivo ────────────────────────────────────────────────────

    # Prioridad 1: maximizar cobertura (minimizar slack)
    coverage_penalty = 10000 * COST_SCALE
    coverage_term = coverage_penalty * sum(slack_vars)

    # Prioridad 2: minimizar coste de desplazamiento
    cost_weight_scaled = int(parameters.cost_weight * 100)
    cost_term = cost_weight_scaled * sum(
        cost_lookup[pi, mi] * x[pi, mi] for (pi, mi) in x
    )

    # Prioridad 3: equilibrar carga
    balance_weight_scaled = int(parameters.balance_weight * 100 * COST_SCALE)
    balance_term = balance_weight_scaled * (max_load - min_load)

    model.minimize(coverage_term + cost_term + balance_term)

    # ── Resolver ────────────────────────────────────────────────────────────

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = parameters.max_time_seconds
    solver.parameters.num_workers = 4

    status = solver.solve(model)

    # ── Extraer solucion ────────────────────────────────────────────────────

    assignments: list[ProposedAssignment] = []
    unassigned: list[UnassignedSlot] = []

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for (pi, mi), var in x.items():
            if solver.value(var) == 1:
                person = persons[pi]
                match = matches[mi]
                cost, km = get_travel_cost(
                    person.municipality_id,
                    match.venue.municipality_id,
                    dist_lookup,
                )
                # Determinar si es nueva o existente
                is_existing = False
                if parameters.force_existing:
                    for d in match.designations:
                        if d.person_id == person.id:
                            is_existing = True
                            break

                assignments.append(
                    ProposedAssignment(
                        match_id=match.id,
                        person_id=person.id,
                        person_name=person.name,
                        role=person.role,
                        travel_cost=cost,
                        distance_km=km,
                        is_new=not is_existing,
                    )
                )

        # Detectar slots sin cubrir
        for mi, match in enumerate(matches):
            for role, needed in [
                ("arbitro", match.referees_needed),
                ("anotador", match.scorers_needed),
            ]:
                assigned_count = sum(
                    1
                    for a in assignments
                    if a.match_id == match.id and a.role == role
                )
                for slot_idx in range(assigned_count, needed):
                    unassigned.append(
                        UnassignedSlot(
                            match_id=match.id,
                            match_label=f"{match.home_team} vs {match.away_team}",
                            role=role,
                            slot_index=slot_idx,
                            reason="Sin candidatos factibles",
                        )
                    )
    else:
        # No se encontro solucion — reportar todos los slots
        for mi, match in enumerate(matches):
            for role, needed in [
                ("arbitro", match.referees_needed),
                ("anotador", match.scorers_needed),
            ]:
                for slot_idx in range(needed):
                    unassigned.append(
                        UnassignedSlot(
                            match_id=match.id,
                            match_label=f"{match.home_team} vs {match.away_team}",
                            role=role,
                            slot_index=slot_idx,
                            reason="Solver no encontro solucion",
                        )
                    )

    elapsed_ms = int((time.time() - start) * 1000)
    new_assignments = [a for a in assignments if a.is_new]
    total_slots = sum(m.referees_needed + m.scorers_needed for m in matches)
    covered = total_slots - len(unassigned)

    status_str = {
        cp_model.OPTIMAL: "optimal",
        cp_model.FEASIBLE: "feasible",
        cp_model.INFEASIBLE: "no_solution",
        cp_model.MODEL_INVALID: "no_solution",
    }.get(status, "partial" if assignments else "no_solution")

    return OptimizationResponse(
        status=status_str,
        assignments=assignments,
        metrics=SolverMetrics(
            total_cost=round(sum(a.travel_cost for a in new_assignments), 2),
            coverage=round(covered / total_slots * 100, 1) if total_slots else 100,
            covered_slots=covered,
            total_slots=total_slots,
            resolution_time_ms=elapsed_ms,
            solver_type="cpsat",
        ),
        unassigned=unassigned,
    )


# ── Greedy Solver ───────────────────────────────────────────────────────────


def solve_greedy(
    matches: list[Match],
    persons: list[Person],
    distances: list[Distance],
    parameters: SolverParameters,
) -> OptimizationResponse:
    """Solver greedy heuristico — rapido, no optimo."""
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
                assigned_times.setdefault(person.id, []).append(
                    (match.date, match_hour)
                )

    # Ordenar partidos: menos asignaciones primero, mayor categoria primero
    sorted_matches = sorted(
        matches,
        key=lambda m: (
            len(m.designations),
            -CATEGORY_RANK.get(m.competition.min_ref_category, 0),
        ),
    )

    for match in sorted_matches:
        existing = list(match.designations)
        venue_muni = match.venue.municipality_id

        for role, needed_total in [
            ("arbitro", match.referees_needed),
            ("anotador", match.scorers_needed),
        ]:
            existing_role = [d for d in existing if d.role == role]
            needed = needed_total - (
                len(existing_role) if parameters.force_existing else 0
            )

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
                    assigned_times.setdefault(p.id, []).append(
                        (match.date, match_hour)
                    )
                else:
                    actual_idx = (
                        len(existing_role) + slot_idx
                        if parameters.force_existing
                        else slot_idx
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

    status = (
        "optimal"
        if not unassigned
        else ("partial" if new_assignments else "no_solution")
    )

    return OptimizationResponse(
        status=status,
        assignments=assignments,
        metrics=SolverMetrics(
            total_cost=round(sum(a.travel_cost for a in new_assignments), 2),
            coverage=round(covered / total_slots * 100, 1) if total_slots else 100,
            covered_slots=covered,
            total_slots=total_slots,
            resolution_time_ms=elapsed_ms,
            solver_type="greedy",
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
    """Encuentra el mejor candidato para un slot (greedy)."""
    match_hour = int(match.time.split(":")[0])
    max_load = max(1, max(person_load.values(), default=1))
    candidates = []

    for p in persons:
        if p.role != role or not p.active:
            continue
        if any(
            a.match_id == match.id and a.person_id == p.id
            for a in current_assignments
        ):
            continue
        if person_load.get(p.id, 0) >= parameters.max_matches_per_person:
            continue

        # Disponibilidad
        if not _is_person_available(p, match):
            continue

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
        if not p.has_car and km > 15:
            norm_cost *= 2.0
        norm_load = person_load.get(p.id, 0) / max_load
        score = parameters.cost_weight * norm_cost + parameters.balance_weight * norm_load
        candidates.append((p, cost, km, score))

    if not candidates:
        return None

    candidates.sort(key=lambda c: c[3])
    best = candidates[0]
    return best[0], best[1], best[2]
