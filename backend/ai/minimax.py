"""Depth-limited Minimax with optional Alpha-Beta pruning."""
from time import monotonic
from backend.game.board import AI, HUMAN, moved
from backend.game.rules import legal_moves, winning_line
from backend.ai.evaluation import evaluate
from backend.ai.difficulty import DEFAULT_DEPTH, DEFAULT_PRUNING, SEARCH_TIME_LIMIT


def choose_move(board, depth=DEFAULT_DEPTH, pruning=DEFAULT_PRUNING, time_limit=SEARCH_TIME_LIMIT):
    # Search starts from the current board on the AI's turn, not the fixed opening.
    # The search models board/turn outcomes; the human clock is managed by Match.
    started = monotonic()
    deadline = started + time_limit
    stats = {"nodes": 0, "pruned": 0, "depth": 0, "target_depth": depth,
             "algorithm": "Alpha-Beta" if pruning else "Minimax"}

    def search(position, player, remaining, alpha, beta, ply):
        # Search state = position + player. ply is distance from this decision's root,
        # not the total match move count. Minimax has no separate path-cost objective.
        # Count calls, including repeated positions and all depth attempts; not unique
        # boards. The root itself is handled outside search() and is not counted.
        stats["nodes"] += 1
        if monotonic() >= deadline:
            raise TimeoutError
        # Terminal utility: +/-10000 dominates all heuristic scores at allowed depths.
        # The ply adjustment prefers quicker wins and delays unavoidable losses.
        if winning_line(position, AI):
            return 10000 - ply
        if winning_line(position, HUMAN):
            return -10000 + ply
        moves = legal_moves(position, player)
        if not moves:
            # No legal moves is a draw under this game's rules.
            return 0
        if remaining == 0:
            # Depth cutoff is not a goal: estimate this unfinished position instead.
            return evaluate(position)
        value = -float("inf") if player == AI else float("inf")
        for index, move in enumerate(moves):
            # Simulate on a new board. 3 - player switches HUMAN (1) and AI (2).
            score = search(moved(position, move), 3 - player, remaining - 1,
                           alpha, beta, ply + 1)
            # Scores always use the AI's perspective: AI is MAX, human is MIN.
            # Alpha is MAX's lower bound; beta is MIN's upper bound.
            if player == AI:
                value = max(value, score)
                alpha = max(alpha, value)
            else:
                value = min(value, score)
                beta = min(beta, value)
            # Alpha-Beta skips responses that cannot improve the relevant decision.
            # Disabling pruning keeps the same Minimax score/move at a completed depth.
            if pruning and alpha >= beta:
                # Count skipped immediate child branches, not all unseen descendants.
                stats["pruned"] += len(moves) - index - 1
                break
        return value

    # Root actions: compare every legal AI move against the human's best responses.
    moves = legal_moves(board, AI)
    if not moves:
        return None, stats
    # Legal fallback if the time budget expires before even depth 1 completes.
    best = moves[0]
    best_score = None
    # Iterative deepening: finish a shallow iteration before trying a deeper one. A budget
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
    # Total elapsed search time includes all depth attempts, even an interrupted one.
    # Network requests, the cosmetic thinking delay, and animation are outside this timer.
    stats["elapsed_ms"] = round((monotonic() - started) * 1000, 1)
    return best, stats
