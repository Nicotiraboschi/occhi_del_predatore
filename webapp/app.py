# --- ROUTE /move (deve stare dopo la creazione di app) ---
from flask import Flask, render_template, request, jsonify, session
import os
import chess
import random

app = Flask(__name__)
app.secret_key = 'supersecretkey'  # Cambia in produzione

# --- ROUTE /move ---
@app.route('/move', methods=['POST'])
def move():
    data = request.get_json()
    from_sq = data.get('from')
    to_sq = data.get('to')
    board = chess.Board(session.get('fen', chess.Board().fen()))
    all_captures = session.get('all_captures', [])
    step_color = session.get('step_color', 'w')
    found = session.get('found_captures', [])
    # Cerca se la mossa è una cattura valida per il colore attuale
    found_capture = None
    for fc in all_captures:
        if fc[0] == from_sq and fc[1] == to_sq and fc[2] == step_color:
            found_capture = fc
            break
    # Cerca se la mossa è una cattura ma del colore opposto
    wrong_color_capture = None
    for fc in all_captures:
        if fc[0] == from_sq and fc[1] == to_sq and fc[2] != step_color:
            wrong_color_capture = fc
            break
    if found_capture:
        if found_capture not in found:
            found.append(found_capture)
            session['found_captures'] = found
        return jsonify({'success': True, 'from': from_sq, 'to': to_sq, 'color': found_capture[2], 'banner': None})
    elif wrong_color_capture:
        return jsonify({'success': False, 'banner': 'Sei l\'altro colore!'})
    else:
        return jsonify({'success': False, 'banner': None})


PIECES_DIR = 'static/pieces'
GAMES_DIR = 'games'

def get_random_board():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fen_file = os.path.join(base_dir, "games", "positions_5captures.txt")
    if not os.path.exists(fen_file):
        return chess.Board()
    with open(fen_file, encoding="utf-8") as f:
        fens = [line.strip() for line in f if line.strip()]
    if not fens:
        return chess.Board()
    chosen_fen = random.choice(fens)
    return chess.Board(chosen_fen)

@app.route('/')
def index():
    # Ogni volta che si apre la pagina, nuova posizione
    board = get_random_board()
    session['fen'] = board.fen()
    # Trova tutte le catture legali per entrambi i colori
    all_captures = []
    promo_captures = set()
    for color in [chess.WHITE, chess.BLACK]:
        board_turn = chess.Board(board.fen())
        board_turn.turn = color
        for move in board_turn.legal_moves:
            if board_turn.is_capture(move):
                # Se è una promozione, conta solo una cattura per quel pedone
                if move.promotion:
                    key = (chess.square_name(move.from_square), chess.square_name(move.to_square), 'w' if color else 'b')
                    if key not in promo_captures:
                        all_captures.append([chess.square_name(move.from_square), chess.square_name(move.to_square), 'w' if color else 'b'])
                        promo_captures.add(key)
                else:
                    all_captures.append([chess.square_name(move.from_square), chess.square_name(move.to_square), 'w' if color else 'b'])
    session['all_captures'] = all_captures
    # Step: prima bianco, poi nero
    session['step_color'] = 'w' if board.turn else 'b'
    session['found_captures'] = []
    session['white_completed'] = False
    session['black_completed'] = False
    return render_template('index.html')

@app.route('/get_board')
def get_board():
    board = chess.Board(session.get('fen', chess.Board().fen()))
    pieces = {}
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            pieces[chess.square_name(square)] = f"{'w' if piece.color else 'b'}{piece.symbol().upper()}"
    found = session.get('found_captures', [])
    all_captures = session.get('all_captures', [])
    step_color = session.get('step_color', 'w')
    step_completed = session.get('step_completed', False)
    return jsonify({'fen': board.fen(), 'pieces': pieces, 'arrows': found, 'all_captures': all_captures, 'step_color': step_color, 'step_completed': step_completed})
# Nuova route per il bottone "Fatto"
from flask import jsonify

@app.route('/done', methods=['POST'])
def done():
    all_captures = session.get('all_captures', [])
    step_color = session.get('step_color', 'w')
    found = session.get('found_captures', [])
    valid_captures = [fc for fc in all_captures if fc[2] == step_color]
    banner = None
    # Stato: serve completare entrambi i colori prima di cambiare posizione
    if len(valid_captures) == len(found) and valid_captures:
        # Hai finito il colore attuale, ora chiedi l'altro
        if step_color == 'w':
            session['white_completed'] = True
        else:
            session['black_completed'] = True
        # Se entrambi i colori sono completati, segnala che la posizione è finita
        if session.get('white_completed', False) and session.get('black_completed', False):
            session['white_completed'] = False
            session['black_completed'] = False
            banner = "Bravo! Hai trovato tutte le catture! Nuova posizione!"
            return jsonify({'banner': banner, 'arrows': [], 'step_completed': True})
        # Altrimenti messaggio intermedio
        banner = f"Bravo! Ora il {'nero' if step_color == 'w' else 'bianco'}"
        next_color = 'b' if step_color == 'w' else 'w'
        session['step_color'] = next_color
        session['found_captures'] = []
        next_captures = [fc for fc in all_captures if fc[2] == next_color]
        if len(next_captures) == 0:
            banner += f"\nIl colore opposto non ha catture! Premi di nuovo 'Fatto' per cambiare posizione."
        return jsonify({'banner': banner, 'arrows': [], 'step_completed': False})
    elif not valid_captures:
        banner = "Il colore attuale non ha catture!"
        return jsonify({'banner': banner, 'step_completed': False})
    else:
        banner = "Ti sei perso qualcosa!"
        return jsonify({'banner': banner, 'arrows': found, 'step_completed': False})

@app.route('/next_position', methods=['POST'])
def next_position():
    # DEBUG: termina la sfida dopo 1 esercizio
    session['challenge_count'] = session.get('challenge_count', 0) + 1
    if session['challenge_count'] >= 1:  # invece di 10
        session['challenge_count'] = 0
        return jsonify({'challenge_completed': True})
    # ...existing code...
    return jsonify({'challenge_completed': False})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=True)
