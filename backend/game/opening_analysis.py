"""Exact retrograde analysis of the untimed game, with repetition allowed.

Cycles without a forced victory are draws in this analysis, not new runtime
draw rules. This does not establish fairness against a timed human player.
"""
from collections import Counter, deque
from itertools import combinations

from backend.game.board import HUMAN, AI, moved
from backend.game.rules import FIXED_OPENING, STARTING_BOARDS, legal_moves, winning_line
from backend.ai.evaluation import evaluate


def solve():
    boards = []
    for human in combinations(range(9), 3):
        for ai in combinations([i for i in range(9) if i not in human], 3):
            boards.append(tuple(HUMAN if i in human else AI if i in ai else 0
                                for i in range(9)))
    states = [(board, player) for board in boards for player in (HUMAN, AI)]
    parents = {state: [] for state in states}
    remaining, outcomes, queue = {}, {}, deque()
    for state in states:
        board, player = state
        if winning_line(board, player) or winning_line(board, 3 - player):
            outcomes[state] = 1 if winning_line(board, player) else -1
            queue.append(state)
            continue
        children = [(moved(board, move), 3 - player) for move in legal_moves(board, player)]
        remaining[state] = len(children)
        for child in children:
            parents[child].append(state)
    while queue:
        state = queue.popleft()
        for parent in parents[state]:
            if parent in outcomes:
                continue
            if outcomes[state] == -1:
                outcomes[parent] = 1
                queue.append(parent)
            else:
                remaining[parent] -= 1
                if remaining[parent] == 0:
                    outcomes[parent] = -1
                    queue.append(parent)
    return {state: outcomes.get(state, 0) for state in states}


def opening_metrics(board, outcomes):
    moves = [legal_moves(board, player) for player in (HUMAN, AI)]
    return {
        "board": board,
        "heuristic": evaluate(board),
        "outcomes_by_first_player": [outcomes[board, p] for p in (HUMAN, AI)],
        "legal_moves": [len(ms) for ms in moves],
        "draw_preserving_moves": [sum(outcomes[moved(board, m), 3 - p] == 0 for m in ms)
                                  for p, ms in zip((HUMAN, AI), moves)],
        "half_turn_color_symmetry": board[8] == 0 and all(
            board[(i + 4) % 8] == (3 - board[i] if board[i] else 0) for i in range(8)),
    }


if __name__ == "__main__":
    outcomes = solve()
    print("States (win/draw/loss relative to side to move):", Counter(outcomes.values()))
    print("Validated candidate openings:", len(STARTING_BOARDS))
    print("Selected opening:", opening_metrics(FIXED_OPENING, outcomes))
