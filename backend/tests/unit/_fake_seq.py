"""A sequenced fake Supabase admin client for unit tests that need to assert
exact multi-query call order and return different data per call — the shared
``conftest.FakeAdminClient`` returns one canned response for every query,
which isn't enough to exercise branching logic (idempotent retries,
per-field conflict detection) that makes several distinct queries per call.

Usage: ``install(sb_singleton, [("payments", {...}), ("payments", [...])])``
installs a fake that expects ``from_("payments")`` to be called twice, in
that order, returning the given result (a dict/list for ``.data``, or an
Exception instance to be raised from ``.execute()``).
"""


class _FakeExecuted:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else (1 if data else 0)


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def __getattr__(self, name):
        def _chain(*_args, **_kwargs):
            return self

        return _chain

    def execute(self):
        if isinstance(self._result, Exception):
            raise self._result
        return _FakeExecuted(self._result)


class FakeAdminSeq:
    def __init__(self, sequence):
        self._sequence = list(sequence)
        self.calls = []

    def from_(self, table):
        self.calls.append(table)
        if not self._sequence:
            raise AssertionError(f"Unexpected extra call to from_('{table}')")
        expected_table, result = self._sequence.pop(0)
        assert table == expected_table, (
            f"expected from_('{expected_table}') but got from_('{table}') "
            f"(calls so far: {self.calls})"
        )
        return _FakeQuery(result)

    def assert_exhausted(self):
        assert not self._sequence, f"Unconsumed expected calls: {self._sequence}"


def install(sb_singleton, sequence):
    """Installs a FakeAdminSeq, returning the previous admin to restore."""
    previous = sb_singleton._admin
    fake = FakeAdminSeq(sequence)
    sb_singleton._admin = fake
    return previous, fake
