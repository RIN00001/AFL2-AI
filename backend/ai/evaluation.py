"""Positional scoring shared by both search modes."""
from backend.game.board import AI, HUMAN, WINNING_LINES
from backend.game.rules import legal_moves


def evaluate(board):
    score = 8 * ((board[8] == AI) - (board[8] == HUMAN))
    score += len(legal_moves(board, AI)) - len(legal_moves(board, HUMAN))
    for line in WINNING_LINES:
        a = sum(board[i] == AI for i in line)
        h = sum(board[i] == HUMAN for i in line)
        if not h:
            score += (0, 2, 18, 0)[a]
        if not a:
            score -= (0, 2, 18, 0)[h]
    return score

