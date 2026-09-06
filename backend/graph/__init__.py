"""Neo4j graph layer.

Boundaries worth keeping:

- `repository.py` is the only module that contains Cypher. Routers call it and
  never write queries of their own.
- Every repository function takes `user_id` as a required argument and every
  query anchors on it. Cypher has no equivalent of the SQLAlchemy filters that
  scope the rest of the app, so this is the whole of the auth boundary.
- `normalisation.py` and `projections.py` are pure. They are the parts worth
  unit testing without a database.
"""
