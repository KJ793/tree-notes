"""Neo4j driver and request-scoped session dependency.

Mirrors backend/database.py, with one deliberate difference: an unreachable
Postgres is fatal, an unreachable Neo4j is not. Every note in the app still
loads, saves and renders without a graph, so nothing here raises at import
time and the driver is created lazily.

The synchronous driver is used on purpose. Every router in this codebase is
`def`, not `async def`, so FastAPI already runs them in a threadpool; a sync
driver fits that model without introducing async/await halfway through the
project. The driver is thread-safe and pools its own connections, so it is
created once per process and a session is opened per request.
"""

import logging
import os
from typing import Optional

from dotenv import load_dotenv
from neo4j import Driver, GraphDatabase

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

log = logging.getLogger("uvicorn.error")

_driver: Optional[Driver] = None


class GraphUnavailable(RuntimeError):
    """Neo4j could not be reached or was never configured.

    Routers translate this into a 503 rather than a 500: the request was valid
    and retrying later may well succeed.
    """


def get_driver() -> Driver:
    """Return the process-wide driver, creating it on first use.

    GraphDatabase.driver() does not open a connection, so this stays cheap and
    does not fail when Neo4j is still booting - the first real query is what
    surfaces a connection problem.
    """
    global _driver

    if _driver is None:
        if not NEO4J_PASSWORD:
            raise GraphUnavailable(
                "NEO4J_PASSWORD is not set; the graph store is unconfigured"
            )
        _driver = GraphDatabase.driver(
            NEO4J_URI,
            auth=(NEO4J_USER, NEO4J_PASSWORD),
        )

    return _driver


def close_driver() -> None:
    """Release pooled connections on shutdown."""
    global _driver

    if _driver is not None:
        _driver.close()
        _driver = None


def check_connectivity() -> bool:
    """Report whether Neo4j is currently reachable. Never raises.

    Used by /health, which must describe a degraded stack rather than fail
    alongside it.
    """
    try:
        get_driver().verify_connectivity()
        return True
    except Exception as exc:
        log.debug("Neo4j connectivity check failed: %s", exc)
        return False


def get_graph():
    """FastAPI dependency yielding a session, closed when the request ends."""
    try:
        driver = get_driver()
    except GraphUnavailable:
        raise
    except Exception as exc:
        raise GraphUnavailable(f"Could not initialise the Neo4j driver: {exc}")

    session = driver.session()
    try:
        yield session
    finally:
        session.close()
