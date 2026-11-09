import copy
import unittest

from guildor import play, verify
from guildor.canonical import CanonicalError, hash_value
from guildor.rulesets.sandbox import Sandbox
from guildor.ruleset import ruleset_hash

SEED = "test-seed-1"
ACTIONS = [
    {"gather": 6, "hire": 0, "craft": 0},
    {"gather": 2, "hire": 2, "craft": 2},
    {"gather": 2, "hire": 2, "craft": 2},
    {"gather": 0, "hire": 3, "craft": 3},
    {"gather": 0, "hire": 3, "craft": 3},
]


def reseal(rec):
    """Recompute run_hash, as a forger who edited the file would."""
    body = {k: v for k, v in rec.items() if k != "run_hash"}
    rec["run_hash"] = hash_value(body)
    return rec


class VerifyTests(unittest.TestCase):
    def setUp(self):
        self.rec = play(Sandbox(), SEED, ACTIONS)

    def test_honest_run_verifies(self):
        res = verify(self.rec)
        self.assertTrue(res.ok, res.errors)
        self.assertEqual(res.score, self.rec["score"])

    def test_deterministic(self):
        self.assertEqual(self.rec, play(Sandbox(), SEED, ACTIONS))

    def test_seed_changes_outcome(self):
        other = play(Sandbox(), "another-seed", ACTIONS)
        self.assertNotEqual(self.rec["genesis_hash"], other["genesis_hash"])

    def test_edited_score_detected(self):
        rec = copy.deepcopy(self.rec)
        rec["score"]["damage"] += 100
        self.assertFalse(verify(rec).ok)
        self.assertFalse(verify(reseal(rec)).ok)  # even with a fixed-up run_hash

    def test_edited_final_state_detected(self):
        rec = copy.deepcopy(self.rec)
        rec["final_state"]["warriors"] += 5
        self.assertFalse(verify(reseal(rec)).ok)

    def test_swapped_action_detected(self):
        rec = copy.deepcopy(self.rec)
        rec["turns"][1]["action"] = {"gather": 0, "hire": 6, "craft": 0}
        res = verify(reseal(rec))
        self.assertFalse(res.ok)
        self.assertIn("turn 2", res.errors[-1])

    def test_illegal_action_detected(self):
        rec = copy.deepcopy(self.rec)
        rec["turns"][0]["action"] = {"gather": 99, "hire": 0, "craft": 0}
        self.assertFalse(verify(reseal(rec)).ok)

    def test_changed_seed_detected(self):
        rec = copy.deepcopy(self.rec)
        rec["seed"] = "lucky-seed"
        self.assertFalse(verify(reseal(rec)).ok)

    def test_truncated_run_detected(self):
        rec = copy.deepcopy(self.rec)
        rec["turns"].pop()
        self.assertFalse(verify(reseal(rec)).ok)

    def test_custom_constants_need_expected_hash(self):
        # A fully re-played run under edited constants is self-consistent...
        easy = play(Sandbox(gear_dmg=100), SEED, ACTIONS)
        self.assertTrue(verify(easy).ok)
        # ...so the leaderboard pins the official ruleset hash.
        official = ruleset_hash(Sandbox())
        self.assertFalse(verify(easy, expected_ruleset_hash=official).ok)
        self.assertTrue(verify(self.rec, expected_ruleset_hash=official).ok)

    def test_floats_rejected(self):
        with self.assertRaises(CanonicalError):
            hash_value({"x": 1.5})


if __name__ == "__main__":
    unittest.main()
