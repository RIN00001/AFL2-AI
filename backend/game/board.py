"""Board representation, connections, and immutable movement."""
EMPTY, HUMAN, AI = 0, 1, 2
ADJACENCY = {i: ((i - 1) % 8, (i + 1) % 8, 8) for i in range(8)}
ADJACENCY[8] = tuple(range(8))
WINNING_LINES = ((0, 8, 4), (6, 8, 2), (7, 8, 3), (1, 8, 5))


def moved(board, move):
    result = list(board)
    source, target = move
    result[target], result[source] = result[source], EMPTY
    return tuple(result)

