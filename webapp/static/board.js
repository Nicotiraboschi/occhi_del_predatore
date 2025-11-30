let selected = null;
let foundCaptures = [];

async function loadBoard() {
    const res = await fetch('/get_board');
    const data = await res.json();
    window.stepColor = data.step_color;
    window.stepCompleted = data.step_completed;

    const boardDiv = document.getElementById('board');
    boardDiv.innerHTML = '';

    // Rimuovi SVG frecce se presente
    const oldsvg = document.getElementById('arrowsvg');
    if (oldsvg) oldsvg.remove();

    // Flip board se tocca al nero
    const flip = data.fen.split(' ')[1] === 'b';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {

            let file = flip ? 7 - c : c;
            let rank = flip ? r : 7 - r;

            const sq = String.fromCharCode(97 + file) + (rank + 1);
            const color = (r + c) % 2 === 0 ? 'white' : 'red';

            const div = document.createElement('div');
            div.className = 'square ' + color;
            div.id = sq;

            const handleSelect = (ev) => {
                ev.preventDefault();
                selectSquare(sq);
            };

            // click desktop
            div.addEventListener('click', handleSelect);

            // tap mobile
            div.addEventListener('touchstart', handleSelect, { passive: false });

            // Mostra pezzo se presente
            if (data.pieces[sq]) {
                const img = document.createElement('img');
                img.src = `/static/pieces/${data.pieces[sq]}.png`;
                img.style.margin = '0';
                img.style.display = 'block';
                img.style.pointerEvents = 'none';
                div.appendChild(img);
            }

            if (selected === sq) {
                div.classList.add('selected');
            }

            boardDiv.appendChild(div);
        }
    }

    // Disegna solo le frecce per le catture trovate dall'utente
    if (data.arrows && data.arrows.length > 0) {
        data.arrows.forEach(([from, to, color]) => {
            drawArrow(from, to, color);
        });
    }
}

function selectSquare(sq) {
    if (selected === sq) {
        selected = null;
        loadBoard();
        return;
    }

    if (selected === null) {
        selected = sq;
        loadBoard();
    } else {
        // Prova la mossa
        fetch('/move', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({from: selected, to: sq})
        })
        .then(res => res.json())
        .then(data => {
            selected = null;
            if (data.success) {
                showPopup("");
            } else {
                if (data.banner) {
                    showPopup(data.banner);
                } else {
                    showPopup('Non è una cattura!');
                }
            }
            loadBoard();
        });
    }
}

// Funzione per disegnare una freccia SVG sopra la scacchiera
function drawArrow(from, to, color) {
    const boardDiv = document.getElementById('board');

    // calcolo dinamico della dimensione della casella (importante per mobile)
    const size = boardDiv.offsetWidth / 8;

    const fileMap = {a:0,b:1,c:2,d:3,e:4,f:5,g:6,h:7};

    // Flip board: controllo usando la prima casella
    const flip = document.querySelector('#board').children[0].id[1] === '1';

    let fromFile = fileMap[from[0]];
    let fromRank = 8 - parseInt(from[1]);
    let toFile = fileMap[to[0]];
    let toRank = 8 - parseInt(to[1]);

    if (flip) {
        fromFile = 7 - fromFile;
        fromRank = 7 - fromRank;
        toFile = 7 - toFile;
        toRank = 7 - toRank;
    }

    const x1 = fromFile * size + size / 2;
    const y1 = fromRank * size + size / 2;
    const x2 = toFile * size + size / 2;
    const y2 = toRank * size + size / 2;

    let svg = document.getElementById('arrowsvg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('id', 'arrowsvg');
        svg.style.position = 'absolute';
        svg.style.left = '0';
        svg.style.top = '0';
        svg.style.width = boardDiv.offsetWidth + 'px';
        svg.style.height = boardDiv.offsetWidth + 'px'; // quadrato, come il board (aspect-ratio 1/1)
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = 100;
        boardDiv.appendChild(svg);
    }

    // Freccia curva con punta arrotondata e ombra
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const normX = dx / len;
    const normY = dy / len;

    // Punto di controllo per la curva
    const ctrlX = (x1 + x2) / 2 + normY * 40;
    const ctrlY = (y1 + y2) / 2 - normX * 40;

    const arrowPath = `M${x1},${y1} Q${ctrlX},${ctrlY} ${x2},${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', arrowPath);
    let arrowColor = 'rgb(130,0,0)';
    if (color === 'w') arrowColor = 'rgb(255,255,255)';
    if (color === 'b') arrowColor = 'rgb(130,0,0)';
    path.setAttribute('stroke', arrowColor);
    path.setAttribute('stroke-width', '14');
    path.setAttribute('opacity', '0.98');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('filter', 'drop-shadow(0 0 12px #222)');
    svg.appendChild(path);

    // Punta arrotondata
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    head.setAttribute('cx', x2);
    head.setAttribute('cy', y2);
    head.setAttribute('r', '13');
    head.setAttribute('fill', arrowColor);
    head.setAttribute('stroke', '#222');
    head.setAttribute('stroke-width', '5');
    head.setAttribute('filter', 'drop-shadow(0 0 8px #222)');
    svg.appendChild(head);
}

function showPopup(msg) {
    const bravoDiv = document.getElementById('bravo-msg');
    if (msg) {
        bravoDiv.innerText = msg;
        bravoDiv.classList.remove('hidden');
    } else {
        bravoDiv.innerText = '';
        bravoDiv.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadBoard();

    const nextBtn = document.getElementById('nextpos');
    const doneBtn = document.getElementById('donebtn');


    // Gestione bottone "Fatto" con nuova route
    const doneHandler = (ev) => {
        ev.preventDefault();
        fetch('/done', {method: 'POST'})
            .then(res => res.json())
            .then(data => {
                showPopup(data.banner);
                setTimeout(() => {
                    showPopup("");
                    loadBoard();
                }, 1800);
            });
    };
    doneBtn.addEventListener('click', doneHandler);
    doneBtn.addEventListener('touchstart', doneHandler, { passive: false });

    // Gestione bottone "Prossima posizione"
    const handler = (ev) => {
        ev.preventDefault();
        fetch('/')
            .then(() => {
                showPopup("");
                loadBoard();
            });
        selected = null;
    };

    nextBtn.addEventListener('click', handler);
    nextBtn.addEventListener('touchstart', handler, { passive: false });
});