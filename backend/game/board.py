"""Board representation, connections, and immutable movement."""
# State representation: a nine-value tuple; each value identifies the owner.
# Indices 0-7 are outer positions (screen labels 01-08); index 8 is the center.
EMPTY, HUMAN, AI = 0, 1, 2
# Outer positions connect to their two ring neighbors and the center.
ADJACENCY = {i: ((i - 1) % 8, (i + 1) % 8, 8) for i in range(8)}
ADJACENCY[8] = tuple(range(8))
# Goal patterns: opposite outer positions plus the center. Outer arcs do not win.
WINNING_LINES = ((0, 8, 4), (6, 8, 2), (7, 8, 3), (1, 8, 5))


def moved(board, move):
    # Transition: apply an already-legal (source, target) move to a copy.
    # Returning a new tuple lets the AI simulate moves without changing the match.
    result = list(board)
    source, target = move
    result[target], result[source] = result[source], EMPTY
    return tuple(result)

