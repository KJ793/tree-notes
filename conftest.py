"""Present so pytest puts the repository root on sys.path.

Without it, `from backend.graph...` inside backend/tests/ fails to resolve:
pytest's default import mode inserts the test file's own directory, not the
project root.
"""
