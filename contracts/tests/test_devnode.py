"""Run with python3 contracts/tests/test_devnode.py (Leo 4.4.6, npm)."""

import json
import os
import re
import signal
import socket
import subprocess
import tempfile
import time
import unittest
from pathlib import Path
from urllib.error import URLError
from urllib.parse import quote
from urllib.request import urlopen

PROJECT = Path(__file__).resolve().parents[1]
# Published devnode fixtures. This suite creates its own loopback ledger.
MAKER = "aleo1rhgdu77hgyqd3xjj8ucu3jj9r2krwz6mnzyd80gncr5fxcwlh5rsvzp9px"
BREAKER = "aleo1s3ws5tra87fjycnjrwsjcrnw2qxr8jfqqdugnf0xzqqw29q9m5pqem2u4t"
MAKER_KEY = "APrivateKey1zkp8CZNn3yeCseEtxuVPbDCwSyhGW6yZKUYKfgXmcpoGPWH"
BREAKER_KEY = "APrivateKey1zkp2RWGDcde3efb89rjhME1VYA8QMxcxep5DShNBR6n8Yjh"
SECRET = "[0u8,0u8,5u8,5u8]"
MISS = "[1u8,1u8,1u8,1u8]"


def compact(value):
    return "".join(value.split())


def output_record(output):
    return re.search(r"• (\{\s*owner:.*?\n\})", output, re.S).group(1)


class Mastermind(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.endpoint = f"http://127.0.0.1:{port}"
        cls.ledger = subprocess.Popen(
            ["npx", "--yes", "@provablehq/aleo-devnode@0.4.0", "start",
             "--socket-addr", f"127.0.0.1:{port}", "--private-key", MAKER_KEY],
            start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
        )
        cls.addClassCleanup(cls.stop_node)
        for _ in range(240):
            if cls.ledger.poll() is not None:
                raise RuntimeError("Devnode failed to start")
            try:
                cls.read("block/height/latest")
                break
            except URLError:
                time.sleep(0.25)
        else:
            raise TimeoutError("Devnode did not become ready")
        # Isolate the build and omit any public-network .env in the project.
        directory = tempfile.TemporaryDirectory()
        cls.addClassCleanup(directory.cleanup)
        cls.project = Path(directory.name)
        (cls.project / "src").mkdir()
        for path in ("program.json", "src/main.leo"):
            (cls.project / path).write_bytes((PROJECT / path).read_bytes())
        result = cls.leo(MAKER_KEY, "deploy")
        if result.returncode or "Deployment confirmed!" not in result.stdout:
            raise RuntimeError(result.stdout[-2000:])

    @classmethod
    def stop_node(cls):
        if cls.ledger.poll() is None:
            os.killpg(cls.ledger.pid, signal.SIGTERM)
            cls.ledger.wait(timeout=15)

    @classmethod
    def read(cls, path):
        with urlopen(f"{cls.endpoint}/testnet/{path}", timeout=5) as response:
            return json.load(response)

    @classmethod
    def leo(cls, key, *args, project=None):
        return subprocess.run(
            ["leo", *args, "--network", "testnet", "--devnet", "--endpoint", cls.endpoint,
             "--broadcast", "--yes"],
            env={**os.environ, "PRIVATE_KEY": key}, cwd=project or cls.project,
            text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=300,
        )

    def mapping(self, name, key):
        return self.read(f"program/mastermind.aleo/mapping/{name}/{quote(key, safe='')}")

    def transition(self, output):
        txid = re.search(r"transaction ID: '(at1\w+)'", output).group(1)
        return self.read("transaction/" + txid)["execution"]["transitions"][0]

    def execute(self, key, fn, *args, reject=False, prove=False):
        flags = [] if prove else ["--skip-execute-proof"]
        result = self.leo(key, "execute", fn, *args, *flags)
        if reject:
            self.assertNotIn("Execution confirmed!", result.stdout)
            self.assertRegex(result.stdout, r"Transaction rejected\.|'assert\.eq' failed")
        else:
            self.assertEqual(result.returncode, 0, result.stdout[-1500:])
            self.assertIn("Execution confirmed!", result.stdout)
        return result.stdout

    def create(self, game, **options):
        return self.execute(MAKER_KEY, "codemaker_create_game", BREAKER, game, SECRET, **options)

    def guess(self, game, colors, key=BREAKER_KEY, **options):
        return self.execute(key, "codebreaker_guess", game, colors, **options)

    def feedback(self, game, colors, record, state=None, **options):
        if state is None:
            state = self.mapping("games", game)
        return self.execute(MAKER_KEY, "codemaker_feedback", game, state, colors, record, **options)

    def check_indexes(self, games, removed=()):
        for player in [MAKER, BREAKER]:
            count = self.mapping("active_count", player) or "0u64"
            self.assertEqual(count, f"{len(games)}u64")
            for i, game in enumerate(games):
                slot = f"{i}u64"
                self.assertEqual(self.mapping("active_game", f"{{player:{player},slot:{slot}}}"), game)
                self.assertEqual(self.mapping("active_slot", f"{{player:{player},game_id:{game}}}"), slot)
            self.assertIsNone(self.mapping("active_game", f"{{player:{player},slot:{len(games)}u64}}"))
            for game in removed:
                self.assertIsNone(self.mapping("active_slot", f"{{player:{player},game_id:{game}}}"))

    def test_upgrade_authority(self):
        # Exercise the real constructor with a known admin key in an isolated test program.
        admin = "aleo1s04xz7v48t8jyf5kyzv5f080ctm3wfcrv0ezk2u0l863q79neuxsv2yg9n"
        source = (self.project / "src/main.leo").read_text()
        self.assertEqual(source.count(admin), 1)
        name = "mastermind_policy_test.aleo"
        with tempfile.TemporaryDirectory() as directory:
            fixture = Path(directory)
            manifest = json.loads((self.project / "program.json").read_text())
            manifest["program"] = name
            (fixture / "program.json").write_text(json.dumps(manifest))
            (fixture / "src").mkdir()
            main = fixture / "src/main.leo"
            source = source.replace("program mastermind.aleo", f"program {name}").replace(admin, BREAKER)
            main.write_text(source)
            deployed = self.leo(MAKER_KEY, "deploy", project=fixture)
            self.assertIn("Deployment confirmed!", deployed.stdout, deployed.stdout[-1600:])

            main.write_text(source.replace("    @custom", "    fn version() -> u8 { return 1u8; }\n\n    @custom"))
            denied = self.leo(MAKER_KEY, "upgrade", project=fixture)
            self.assertIn("Transaction rejected.", denied.stdout, denied.stdout[-1600:])
            self.assertNotIn("function version:", self.read("program/" + name))
            approved = self.leo(BREAKER_KEY, "upgrade", project=fixture)
            self.assertEqual(approved.returncode, 0, approved.stdout[-1600:])
            self.assertIn("function version:", self.read("program/" + name))

    def test_two_games(self):
        first, second = "0u64", "1u64"
        self.execute(MAKER_KEY, "codemaker_create_game", MAKER, first, SECRET, reject=True)
        self.execute(MAKER_KEY, "codemaker_create_game", BREAKER, first, "[6u8,0u8,0u8,0u8]", reject=True)
        self.check_indexes([])
        created = self.create(first, prove=True)
        record = output_record(created)
        self.create(first, reject=True)  # Two clients selected the same next ID.
        other_record = output_record(self.create(second))
        self.check_indexes([first, second])

        # Inspect the accepted transaction itself, including the public future.
        creation = self.transition(created)
        self.assertEqual(creation["inputs"][2]["type"], "private")
        self.assertEqual(creation["outputs"][0]["type"], "record")
        future = compact(creation["outputs"][1]["value"])
        self.assertIn(f"arguments:[{first},{MAKER},{BREAKER}]", future)
        self.assertNotIn(SECRET, future)

        state = self.mapping("games", first)
        self.assertIn("solution:[0u8,0u8,0u8,0u8]", compact(state))
        self.feedback(first, MISS, record, reject=True)  # No guess yet.
        self.guess(first, MISS, key=MAKER_KEY, reject=True)
        self.guess(first, "[0u8,6u8,1u8,2u8]", reject=True)
        key = "{game_id:0u64,round:0u8}"
        self.assertIsNone(self.mapping("guesses", key))

        # Three guesses exercise exact + duplicate overlap, all wrong positions, and a win.
        guesses = [("[0u8,5u8,0u8,0u8]", "[2u8,1u8]"), ("[5u8,5u8,0u8,0u8]", "[4u8,0u8]"), (SECRET, "[0u8,4u8]")]
        for i, (guess, expected) in enumerate(guesses):
            self.guess(first, guess, prove=i == 0)
            if i == 0:
                self.guess(first, MISS, reject=True)
                self.feedback(first, MISS, record, reject=True)
                self.feedback(first, guess, other_record, reject=True)
                self.assertIsNone(self.mapping("pegs", key))
                self.assertEqual(self.mapping("games", first), state)
            if i == 1:
                self.feedback(first, guess, record, state=state, reject=True)
            feedback = self.feedback(first, guess, record, prove=i == 0)
            record = output_record(feedback)
            self.assertEqual(compact(self.mapping("pegs", f"{{game_id:0u64,round:{i}u8}}")), expected)
            current = compact(self.mapping("games", first))
            self.assertIn(f"round:{i + 1}u8", current)
            if guess != SECRET:
                public_future = self.transition(feedback)["outputs"][1]["value"]
                self.assertNotIn(SECRET, compact(public_future))
                self.assertIn("completed:false,solution:[0u8,0u8,0u8,0u8]", current)
                self.check_indexes([first, second])

        self.assertIn("completed:true,solution:" + SECRET, current)
        self.guess(first, SECRET, reject=True)
        self.feedback(first, SECRET, record, reject=True)
        self.check_indexes([second], removed=[first])

        # Ten misses exhaust the second game. Verify reveal and cleanup exactly at round ten.
        for i in range(10):
            self.guess(second, MISS)
            other_record = output_record(self.feedback(second, MISS, other_record))
            self.assertEqual(compact(self.mapping("pegs", f"{{game_id:1u64,round:{i}u8}}")), "[0u8,0u8]")
            current = compact(self.mapping("games", second))
            if i < 9:
                self.assertIn("completed:false,solution:[0u8,0u8,0u8,0u8]", current)
        self.assertIn("round:10u8,completed:true,solution:" + SECRET, current)
        self.check_indexes([], removed=[first, second])
        self.guess(second, MISS, reject=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
