import unittest
from random import Random

from backend.game.board import AI, moved
from backend.game.rules import STARTING_BOARDS, legal_moves, winning_line
from backend.ai.minimax import choose_move


class AITests(unittest.TestCase):
    def test_takes_immediate_win(self):
        board = (2, 0, 1, 0, 2, 1, 1, 2, 0)
        for pruning in (False, True):
            move, stats = choose_move(board, 3, pruning, 5)
            self.assertTrue(winning_line(moved(board, move), AI))
            self.assertEqual(stats["depth"], 3)

    def test_blocks_an_immediate_threat(self):
        board = (1, 0, 2, 0, 1, 2, 2, 1, 0)
        move, _ = choose_move(board, 3, True, 5)
        self.assertEqual(move[1], 8)

    def test_pruning_preserves_minimax_score(self):
        for board in Random(47).sample(STARTING_BOARDS, 25):
            plain_move, plain = choose_move(board, 4, False, 5)
            pruned_move, pruned = choose_move(board, 4, True, 5)
            self.assertEqual(plain["depth"], 4)
            self.assertEqual(pruned["depth"], 4)
            self.assertEqual(plain["score"], pruned["score"])
            self.assertEqual(plain_move, pruned_move)
            self.assertLessEqual(pruned["nodes"], plain["nodes"])

    def test_budget_returns_legal_fallback(self):
        board = STARTING_BOARDS[0]
        move, stats = choose_move(board, 7, False, 0)
        self.assertIn(move, legal_moves(board, AI))
        self.assertEqual(stats["depth"], 0)



if __name__ == "__main__":
    unittest.main()
