"""Tests para el solver CP-SAT y greedy."""

import time

import pytest

from models import (
    Availability,
    Competition,
    Designation,
    Distance,
    Match,
    Person,
    Incompatibility,
    SolverParameters,
    Venue,
)
from solver import solve


# ── Helpers ─────────────────────────────────────────────────────────────────


def make_venue(muni_id: str = "muni-001") -> Venue:
    return Venue(id="venue-1", name="Pabellon Test", municipality_id=muni_id)


def make_competition(
    min_ref_category: str = "provincial",
    referees_needed: int = 2,
    scorers_needed: int = 1,
) -> Competition:
    return Competition(
        id="comp-1",
        name="Liga Test",
        category="senior",
        min_ref_category=min_ref_category,
        referees_needed=referees_needed,
        scorers_needed=scorers_needed,
    )


def make_match(
    match_id: str = "match-1",
    date: str = "2026-03-07",
    time: str = "10:00",
    venue: Venue | None = None,
    competition: Competition | None = None,
    referees_needed: int = 2,
    scorers_needed: int = 1,
    home_team: str = "Team A",
    away_team: str = "Team B",
    designations: list[Designation] | None = None,
) -> Match:
    return Match(
        id=match_id,
        date=date,
        time=time,
        home_team=home_team,
        away_team=away_team,
        venue=venue or make_venue(),
        competition=competition or make_competition(
            referees_needed=referees_needed,
            scorers_needed=scorers_needed,
        ),
        referees_needed=referees_needed,
        scorers_needed=scorers_needed,
        designations=designations or [],
    )


def make_person(
    person_id: str = "person-1",
    name: str = "Test Person",
    role: str = "arbitro",
    category: str = "provincial",
    muni_id: str = "muni-001",
    active: bool = True,
    availabilities: list[Availability] | None = None,
    incompatibilities: list[Incompatibility] | None = None,
) -> Person:
    return Person(
        id=person_id,
        name=name,
        role=role,
        category=category,
        municipality_id=muni_id,
        active=active,
        availabilities=availabilities or [],
        incompatibilities=incompatibilities or [],
    )


def make_distance(
    origin: str = "muni-001",
    dest: str = "muni-002",
    km: float = 20.0,
) -> Distance:
    return Distance(origin_id=origin, dest_id=dest, distance_km=km)


def default_params(**kwargs) -> SolverParameters:
    defaults = dict(
        cost_weight=0.7,
        balance_weight=0.3,
        max_matches_per_person=3,
        force_existing=False,
        max_time_seconds=10,
        solver_type="cpsat",
    )
    defaults.update(kwargs)
    return SolverParameters(**defaults)


# ── Tests ───────────────────────────────────────────────────────────────────


class TestTrivial:
    """1 partido, 1 arbitro, 1 anotador — solucion trivial."""

    def test_trivial_assignment(self):
        match = make_match(referees_needed=1, scorers_needed=1)
        ref = make_person("ref-1", "Ref 1", "arbitro")
        scorer = make_person("sco-1", "Scorer 1", "anotador")
        distances = [make_distance()]

        result = solve([match], [ref, scorer], distances, default_params())

        assert result.status == "optimal"
        assert result.metrics.coverage == 100.0
        assert len(result.assignments) == 2
        assert len(result.unassigned) == 0
        assert result.metrics.solver_type == "cpsat"

        roles_assigned = {a.role for a in result.assignments}
        assert "arbitro" in roles_assigned
        assert "anotador" in roles_assigned


class TestNoPersons:
    """1 partido, 0 personas — no hay solucion posible."""

    def test_no_persons(self):
        match = make_match(referees_needed=1, scorers_needed=1)

        result = solve([match], [], [], default_params())

        assert result.status in ("no_solution", "partial", "optimal", "feasible")
        assert result.metrics.coverage < 100.0 or len(result.unassigned) > 0


class TestIncompatibility:
    """Persona incompatible excluida, otra asignada."""

    def test_incompatible_excluded(self):
        match = make_match(
            referees_needed=1,
            scorers_needed=0,
            home_team="CB Madrid Norte",
            away_team="AD Parla",
        )
        # ref-1 es incompatible con CB Madrid Norte
        ref_incompat = make_person(
            "ref-1",
            "Ref Incompatible",
            "arbitro",
            incompatibilities=[
                Incompatibility(person_id="ref-1", team_name="CB Madrid Norte")
            ],
        )
        ref_ok = make_person("ref-2", "Ref OK", "arbitro")
        scorer = make_person("sco-1", "Scorer", "anotador")

        result = solve(
            [match],
            [ref_incompat, ref_ok, scorer],
            [],
            default_params(),
        )

        ref_assignments = [a for a in result.assignments if a.role == "arbitro"]
        assert len(ref_assignments) == 1
        assert ref_assignments[0].person_id == "ref-2"


class TestCategoryMinimum:
    """Persona con categoria insuficiente excluida."""

    def test_low_category_excluded(self):
        comp = make_competition(
            min_ref_category="nacional",
            referees_needed=1,
            scorers_needed=0,
        )
        match = make_match(
            referees_needed=1,
            scorers_needed=0,
            competition=comp,
        )
        ref_low = make_person("ref-1", "Ref Provincial", "arbitro", category="provincial")
        ref_high = make_person("ref-2", "Ref Nacional", "arbitro", category="nacional")

        result = solve([match], [ref_low, ref_high], [], default_params())

        ref_assignments = [a for a in result.assignments if a.role == "arbitro"]
        assert len(ref_assignments) == 1
        assert ref_assignments[0].person_id == "ref-2"


class TestOverlap:
    """2 partidos a 1h de diferencia, 1 persona — solo 1 asignacion."""

    def test_temporal_overlap(self):
        match1 = make_match("m1", time="10:00", referees_needed=1, scorers_needed=0)
        match2 = make_match("m2", time="11:00", referees_needed=1, scorers_needed=0)
        ref = make_person("ref-1", "Solo Ref", "arbitro")

        result = solve([match1, match2], [ref], [], default_params())

        ref_assignments = [a for a in result.assignments if a.role == "arbitro"]
        # Solo puede ir a 1 de los 2
        assert len(ref_assignments) == 1
        assert len(result.unassigned) == 1


class TestMaxLoad:
    """5 partidos, 1 persona, max=2 — solo 2 asignaciones."""

    def test_max_matches_respected(self):
        # 5 partidos en horarios distintos (no solapan)
        matches = [
            make_match(
                f"m{i}",
                time=f"{9 + i * 3}:00",
                referees_needed=1,
                scorers_needed=0,
            )
            for i in range(5)
        ]
        ref = make_person("ref-1", "Solo Ref", "arbitro")

        params = default_params(max_matches_per_person=2)
        result = solve(matches, [ref], [], params)

        ref_assignments = [a for a in result.assignments if a.role == "arbitro"]
        assert len(ref_assignments) <= 2


class TestPerformance50:
    """50 partidos, 30 personas — debe resolver en <10s."""

    def test_50_matches(self):
        matches = []
        times = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"]
        dates = ["2026-03-07", "2026-03-08"]
        for i in range(50):
            matches.append(
                make_match(
                    f"m-{i}",
                    date=dates[i % 2],
                    time=times[i % len(times)],
                    referees_needed=2,
                    scorers_needed=1,
                    venue=make_venue(f"muni-{(i % 10) + 1:03d}"),
                )
            )

        persons = []
        for i in range(20):
            persons.append(
                make_person(
                    f"ref-{i}",
                    f"Ref {i}",
                    "arbitro",
                    category="autonomico",
                    muni_id=f"muni-{(i % 10) + 1:03d}",
                )
            )
        for i in range(10):
            persons.append(
                make_person(
                    f"sco-{i}",
                    f"Scorer {i}",
                    "anotador",
                    muni_id=f"muni-{(i % 10) + 1:03d}",
                )
            )

        distances = []
        for i in range(10):
            for j in range(i + 1, 10):
                distances.append(
                    make_distance(f"muni-{i + 1:03d}", f"muni-{j + 1:03d}", 15.0 + i + j)
                )

        start = time.time()
        result = solve(matches, persons, distances, default_params(max_time_seconds=10))
        elapsed = time.time() - start

        assert elapsed < 10, f"Solver tardo {elapsed:.1f}s (>10s)"
        assert result.metrics.coverage > 50, f"Cobertura {result.metrics.coverage}% (<50%)"
        assert len(result.assignments) > 0


class TestPerformance200:
    """200 partidos, 80 personas — debe resolver en <30s."""

    def test_200_matches(self):
        matches = []
        times = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"]
        dates = ["2026-03-07", "2026-03-08"]
        for i in range(200):
            matches.append(
                make_match(
                    f"m-{i}",
                    date=dates[i % 2],
                    time=times[i % len(times)],
                    referees_needed=2,
                    scorers_needed=1,
                    venue=make_venue(f"muni-{(i % 15) + 1:03d}"),
                )
            )

        persons = []
        for i in range(55):
            persons.append(
                make_person(
                    f"ref-{i}",
                    f"Ref {i}",
                    "arbitro",
                    category="autonomico",
                    muni_id=f"muni-{(i % 15) + 1:03d}",
                )
            )
        for i in range(25):
            persons.append(
                make_person(
                    f"sco-{i}",
                    f"Scorer {i}",
                    "anotador",
                    muni_id=f"muni-{(i % 15) + 1:03d}",
                )
            )

        distances = []
        for i in range(15):
            for j in range(i + 1, 15):
                distances.append(
                    make_distance(f"muni-{i + 1:03d}", f"muni-{j + 1:03d}", 10.0 + i + j)
                )

        start = time.time()
        result = solve(
            matches, persons, distances, default_params(max_time_seconds=30)
        )
        elapsed = time.time() - start

        assert elapsed < 35, f"Solver tardo {elapsed:.1f}s (>35s)"
        assert len(result.assignments) > 0, "Debe generar al menos alguna asignacion"


class TestHasCar:
    """Persona sin coche penalizada para partidos lejanos."""

    def test_prefers_person_with_car(self):
        # Partido en municipio lejano (muni-002), ambos arbitros en muni-001
        venue = make_venue("muni-002")
        match = make_match(
            referees_needed=1,
            scorers_needed=0,
            venue=venue,
        )
        # 40km de distancia entre muni-001 y muni-002
        dist = make_distance("muni-001", "muni-002", 40.0)

        ref_car = make_person("ref-1", "Ref Con Coche", "arbitro", muni_id="muni-001")
        ref_car.has_car = True

        ref_nocar = make_person("ref-2", "Ref Sin Coche", "arbitro", muni_id="muni-001")
        ref_nocar.has_car = False

        for solver_type in ["cpsat", "greedy"]:
            result = solve(
                [match],
                [ref_car, ref_nocar],
                [dist],
                default_params(solver_type=solver_type),
            )

            ref_assignments = [a for a in result.assignments if a.role == "arbitro"]
            assert len(ref_assignments) == 1, f"[{solver_type}] Expected 1 assignment"
            assert ref_assignments[0].person_id == "ref-1", (
                f"[{solver_type}] Expected person with car (ref-1), got {ref_assignments[0].person_id}"
            )


class TestDispatch:
    """solver_type='greedy' debe usar el solver greedy."""

    def test_greedy_dispatch(self):
        match = make_match(referees_needed=1, scorers_needed=1)
        ref = make_person("ref-1", "Ref 1", "arbitro")
        scorer = make_person("sco-1", "Scorer 1", "anotador")

        params = default_params(solver_type="greedy")
        result = solve([match], [ref, scorer], [], params)

        assert result.metrics.solver_type == "greedy"
        assert len(result.assignments) == 2
