"""Positional scoring shared by both search modes."""
from backend.game.board import AI, HUMAN, WINNING_LINES
from backend.game.rules import legal_moves


def evaluate(board):
    # Heuristic for unfinished positions: positive favors AI, negative favors human.
    # These hand-set weights express priorities; they are not proven optimal.
    # Center control: every winning line includes index 8. Booleans act as 1 or 0.
    score = 8 * ((board[8] == AI) - (board[8] == HUMAN))
    # Mobility: one point per extra legal move compared with the opponent.
    score += len(legal_moves(board, AI)) - len(legal_moves(board, HUMAN))
    # Potential lines: mixed ownership contributes zero to this part of the score.
    for line in WINNING_LINES:
        a = sum(board[i] == AI for i in line)
        h = sum(board[i] == HUMAN for i in line)
        # Lookup by piece count: 0 -> 0, 1 -> 2, 2 -> 18.
        # Two pieces suggest progress, but do not guarantee a legal one-move win.
        # Three-piece wins are scored separately before search calls evaluate().
        if not h:
            score += (0, 2, 18, 0)[a]
        # Apply the same weights negatively to the human's unblocked lines.
        if not a:
            score -= (0, 2, 18, 0)[h]
    # Zero means balanced by this estimate, not a proven draw.
    return score

