"""Legal moves, victories, and the verified fixed competition opening."""
from itertools import combinations
from backend.game.board import EMPTY, HUMAN, AI, ADJACENCY, WINNING_LINES, moved


def legal_moves(board, player):
    # Available actions: own the source AND connect to the target AND target is empty.
    # These logical conditions are implemented directly, without an inference engine.
    return [(source, target) for source in range(9) if board[source] == player
            for target in ADJACENCY[source] if board[target] == EMPTY]


def winning_line(board, player):
    # Goal test: AND across ownership of three positions; OR across winning lines.
    # Return the matching triple for display, or None when no line is complete.
    return next((line for line in WINNING_LINES
                 if all(board[i] == player for i in line)), None)


def immediate_win(board, player):
    # Check whether any legal next move would complete a winning line.
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


# Analysis/test pool; actual matches use FIXED_OPENING below.
STARTING_BOARDS = starting_boards()

# IDs 0-7 run clockwise from north; 8 is the center.
# Equal mobility, color/half-turn symmetry, no immediate wins, and a draw
# under untimed perfect play for either first player. Reproduce the analysis
# with: python -m backend.game.opening_analysis
# Initial board: human on 01/03/06, AI on 02/05/07; 04/08/center are empty.
FIXED_OPENING = (HUMAN, AI, HUMAN, EMPTY, AI, HUMAN, AI, EMPTY, EMPTY)


def new_board():
    # Match sets the initial turn to HUMAN; the board alone does not store the turn.
    return FIXED_OPENING
