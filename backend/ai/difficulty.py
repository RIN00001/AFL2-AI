"""Search settings used by the server and Minimax."""
# Depth counts individual moves (ply), not rounds. Hard: AI -> human -> AI -> human.
DEFAULT_DEPTH = 3
HARD_DEPTH = 4
SEARCH_DEPTHS = (DEFAULT_DEPTH, HARD_DEPTH)
# Both modes use Minimax; this flag only enables/disables Alpha-Beta cutoffs.
DEFAULT_PRUNING = True
# Computation budget for all iterative-deepening passes in one AI decision.
SEARCH_TIME_LIMIT = 5.0  # seconds
