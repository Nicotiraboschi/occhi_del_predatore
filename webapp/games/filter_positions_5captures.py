import chess.pgn

input_path = "games.pgn"           # Il tuo file PGN gigante
output_path = "positions_5captures.txt"  # File con solo le FEN

with open(input_path, encoding="utf-8") as pgn_in, open(output_path, "w", encoding="utf-8") as out:
    count = 0
    while True:
        game = chess.pgn.read_game(pgn_in)
        if game is None:
            break
        board = game.board()
        for move in game.mainline_moves():
            board.push(move)
            num_captures = sum(1 for m in board.legal_moves if board.is_capture(m))
            if num_captures >= 5:
                out.write(board.fen() + "\n")
                count += 1
                if count % 100 == 0:
                    print(f"Salvate {count} posizioni con almeno 5 catture legali...")
    print(f"Totale posizioni salvate: {count}")
