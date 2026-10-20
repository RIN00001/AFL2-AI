"""Pure game rules. Nodes 0..7 go clockwise from the top; 8 is the center."""
from itertools import combinations
from random import choice

EMPTY, HUMAN, AI = 0, 1, 2
ADJACENCY = {i: ((i - 1) % 8, (i + 1) % 8, 8) for i in range(8)}
ADJACENCY[8] = tuple(range(8))
WINNING_LINES = ((0, 8, 4), (6, 8, 2), (7, 8, 3), (1, 8, 5))


def legal_moves(board, player):
    return [(source, target) for source in range(9) if board[source] == player
            for target in ADJACENCY[source] if board[target] == EMPTY]


def moved(board, move):
    result = list(board)
    source, target = move
    result[target], result[source] = result[source], EMPTY
    return tuple(result)


def winning_line(board, player):
    return next((line for line in WINNING_LINES
                 if all(board[i] == player for i in line)), None)


def immediate_win(board, player):
    return any(winning_line(moved(board, move), player)
               for move in legal_moves(board, player))


def valid_start(board):
    return (board.count(HUMAN) == board.count(AI) == 3
            and board.count(EMPTY) == 3
            and all(not winning_line(board, p) and not immediate_win(board, p)
                    and legal_moves(board, p) for p in (HUMAN, AI)))


def starting_boards():
    """Enumerate and validate the small state space once, avoiding retry loops."""
    boards = []
    for human in combinations(range(9), 3):
        remaining = [i for i in range(9) if i not in human]
        for ai in combinations(remaining, 3):
            board = tuple(HUMAN if i in human else AI if i in ai else EMPTY
                          for i in range(9))
            if valid_start(board):
                boards.append(board)
    return tuple(boards)


STARTING_BOARDS = starting_boards()


def new_board():
    # The entire pool is symmetric under exchanging players. This avoids a
    # color bias; it does not claim every position is game-theoretically equal.
    return choice(STARTING_BOARDS)
