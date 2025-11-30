import chess.pgn

input_path = "games.pgn"           # Il tuo file PGN gigante
output_path = "filtered_3captures.pgn"  # Il nuovo file PGN ridotto

def has_at_least_n_captures(game, n=3):
    board = game.board()
    for move in game.mainline_moves():
        board.push(move)
        num_captures = sum(1 for m in board.legal_moves if board.is_capture(m))
        if num_captures >= n:
            return True
    return False

with open(input_path, encoding="utf-8") as pgn_in, open(output_path, "w", encoding="utf-8") as pgn_out:
    count = 0
    while True:
        game = chess.pgn.read_game(pgn_in)
        if game is None:
            break
        if has_at_least_n_captures(game, n=3):
            print(game, file=pgn_out, end="\n\n")
            count += 1
            if count % 100 == 0:
                print(f"Salvate {count} partite con almeno 3 catture legali...")
    print(f"Totale partite filtrate: {count}")