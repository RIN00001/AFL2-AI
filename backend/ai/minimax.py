"""Depth-limited Minimax with optional Alpha-Beta pruning."""
from time import monotonic
from backend.game.board import AI, HUMAN, moved
from backend.game.rules import legal_moves, winning_line
from backend.ai.evaluation import evaluate
from backend.ai.difficulty import DEFAULT_DEPTH, DEFAULT_PRUNING, SEARCH_TIME_LIMIT


def choose_move(board, depth=DEFAULT_DEPTH, pruning=DEFAULT_PRUNING, time_limit=SEARCH_TIME_LIMIT):
    started = monotonic()
    deadline = started + time_limit
    stats = {"nodes": 0, "pruned": 0, "depth": 0, "target_depth": depth,
             "algorithm": "Alpha-Beta" if pruning else "Minimax"}

    def search(position, player, remaining, alpha, beta, ply):
        stats["nodes"] += 1
        if monotonic() >= deadline:
            raise TimeoutError
        if winning_line(position, AI):
            return 10000 - ply
        if winning_line(position, HUMAN):
            return -10000 + ply
        moves = legal_moves(position, player)
        if not moves:
            return 0
        if remaining == 0:
            return evaluate(position)
        value = -float("inf") if player == AI else float("inf")
        for index, move in enumerate(moves):
            score = search(moved(position, move), 3 - player, remaining - 1,
                           alpha, beta, ply + 1)
            if player == AI:
                value = max(value, score)
                alpha = max(alpha, value)
            else:
                value = min(value, score)
                beta = min(beta, value)
            if pruning and alpha >= beta:
                stats["pruned"] += len(moves) - index - 1
                break
        return value

    moves = legal_moves(board, AI)
    if not moves:
        return None, stats
    best = moves[0]
    best_score = None
    # Finish a complete shallow iteration before trying a deeper one. A budget
    # overrun keeps the last fully searched decision rather than a partial tree.
    for current_depth in range(1, depth + 1):
        candidate, value, alpha = moves[0], -float("inf"), -float("inf")
        try:
            for move in moves:
                score = search(moved(board, move), HUMAN, current_depth - 1,
                               alpha, float("inf"), 1)
                if score > value:
                    candidate, value = move, score
                if pruning:
                    alpha = max(alpha, value)
        except TimeoutError:
            break
        best, best_score = candidate, value
        stats["depth"] = current_depth
    stats["score"] = best_score
    stats["elapsed_ms"] = round((monotonic() - started) * 1000, 1)
    return best, stats
