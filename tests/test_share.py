import contextlib
import io
import json
import unittest
from pathlib import Path

from guildor import play, verify
from guildor.__main__ import verify_link
from guildor.rulesets.sandbox import Sandbox
from guildor.share import decode_share, encode_share, record_from_share

VECTORS = json.loads((Path(__file__).parent / "vectors" / "sandbox.json").read_text(encoding="utf-8"))


def quiet(fn, *args):
    with contextlib.redirect_stdout(io.StringIO()):
        return fn(*args)


class VectorTests(unittest.TestCase):
    def test_python_still_matches_vectors(self):
        # Guards against accidental rule changes: the JS port is tested against the same file.
        for v in VECTORS:
            self.assertEqual(play(Sandbox(), v["seed"], v["actions"]), v["record"], v["seed"])
            self.assertEqual(encode_share(v["record"]), v["share"])


class ShareTests(unittest.TestCase):
    def setUp(self):
        self.v = VECTORS[0]

    def test_round_trip(self):
        rec, ok = record_from_share(self.v["share"])
        self.assertTrue(ok)
        self.assertEqual(rec, self.v["record"])
        self.assertTrue(verify(rec).ok)

    def test_accepts_full_url(self):
        url = "https://example.github.io/guildor/#run=" + self.v["share"]
        self.assertEqual(quiet(verify_link, url), 0)

    def test_altered_claimed_hash(self):
        p = decode_share(self.v["share"])
        p["h"] = "sha256:" + "0" * 64
        code = _encode(p)
        self.assertEqual(quiet(verify_link, code), 1)

    def test_illegal_action_in_link(self):
        p = decode_share(self.v["share"])
        p["a"][0] = [99, 0, 0]
        self.assertEqual(quiet(verify_link, _encode(p)), 1)

    def test_garbage(self):
        self.assertEqual(quiet(verify_link, "not-a-code!!"), 1)


def _encode(payload):
    import base64

    from guildor.canonical import canonical_bytes

    return base64.urlsafe_b64encode(canonical_bytes(payload)).decode().rstrip("=")


if __name__ == "__main__":
    unittest.main()
