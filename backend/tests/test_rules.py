import unittest
from unittest.mock import patch

from backend.game.board import AI, HUMAN, ADJACENCY, WINNING_LINES, moved
from backend.game.rules import STARTING_BOARDS, legal_moves, valid_start, winning_line
from backend.main import Match


class RulesTests(unittest.TestCase):
    def test_starting_pool_is_valid_and_color_symmetric(self):
        self.assertGreater(len(STARTING_BOARDS), 20)
        pool = set(STARTING_BOARDS)
        for board in pool:
            self.assertTrue(valid_start(board))
            self.assertIn(tuple(3 - p if p else 0 for p in board), pool)

    def test_all_connections_are_bidirectional(self):
        for source, targets in ADJACENCY.items():
            for target in targets:
                self.assertIn(source, ADJACENCY[target])

    def test_legal_moves_preserve_counts_and_follow_connections(self):
        for board in STARTING_BOARDS:
            for player in (HUMAN, AI):
                for source, target in legal_moves(board, player):
                    self.assertEqual(board[source], player)
                    self.assertEqual(board[target], 0)
                    self.assertIn(target, ADJACENCY[source])
                    result = moved(board, (source, target))
                    self.assertEqual(result.count(player), 3)
                    self.assertEqual(result.count(0), 3)

    def test_exactly_four_lines_for_both_players(self):
        for player in (HUMAN, AI):
            for line in WINNING_LINES:
                board = tuple(player if i in line else 0 for i in range(9))
                self.assertEqual(winning_line(board, player), line)
        self.assertIsNone(winning_line((1, 1, 1, 0, 0, 0, 0, 0, 0), HUMAN))


class MatchTests(unittest.TestCase):
    def test_human_clock_expires_authoritatively(self):
        with patch("backend.main.monotonic", return_value=100):
            match = Match(turn=HUMAN)
        with patch("backend.main.monotonic", return_value=161):
            state = match.snapshot()
        self.assertEqual(state["status"], "ai_win")
        self.assertEqual(state["reason"], "timeout")
        self.assertEqual(state["remaining"], 0)

    def test_ai_time_does_not_consume_human_clock(self):
        match = Match(turn=AI)
        with patch("backend.main.monotonic", return_value=100000):
            self.assertEqual(match.snapshot()["remaining"], 60)

    def test_clock_carries_over_between_turns(self):
        with patch("backend.main.monotonic", return_value=100):
            match = Match(turn=HUMAN)
        with patch("backend.main.monotonic", return_value=110):
            match.tick()
            match.apply(legal_moves(match.board, HUMAN)[0])
        with patch("backend.main.monotonic", return_value=200):
            match.tick()
            self.assertEqual(match.remaining, 50)
            match.apply(legal_moves(match.board, AI)[0])
        with patch("backend.main.monotonic", return_value=205):
            match.tick()
            self.assertEqual(match.remaining, 45)

    def test_winning_move_ends_match(self):
        match = Match(board=(1, 0, 2, 0, 1, 2, 2, 1, 0), turn=HUMAN)
        match.apply((7, 8))
        self.assertEqual(match.status, "human_win")
        self.assertEqual(match.line, (0, 8, 4))
        self.assertIsNone(match.started)

    def test_no_legal_moves_is_draw(self):
        # Inject the no-move condition to cover the defensive draw handler.
        match = Match(turn=AI)
        move = legal_moves(match.board, AI)[0]
        with patch("backend.main.legal_moves", return_value=[]):
            match.apply(move)
        self.assertEqual(match.status, "draw")



if __name__ == "__main__":
    unittest.main()
