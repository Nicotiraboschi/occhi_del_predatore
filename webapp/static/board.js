let selected = null;
let foundCaptures = [];
let totalCaptures = 0; // Counter globale delle catture trovate in corsa ai 10
let totalErrors = 0;   // Counter globale degli errori su 'Fatto' in corsa ai 10

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



            // --- DRAG & DROP VISIVO ---
            let dragPiece = null;
            let dragOrigin = null;
            let dragImg = null;

            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Previene selezione testo/caselle
                if (!data.pieces[sq]) return;
                dragPiece = data.pieces[sq];
                dragOrigin = sq;
                // Crea immagine flottante
                dragImg = document.createElement('img');
                dragImg.src = `/static/pieces/${dragPiece}.png`;
                dragImg.style.position = 'fixed';
                dragImg.style.pointerEvents = 'none';
                dragImg.style.zIndex = 9999;
                dragImg.style.width = '60px';
                dragImg.style.height = '60px';
                document.body.appendChild(dragImg);
                moveDragImg(e);
                document.addEventListener('mousemove', moveDragImg);
                document.addEventListener('mouseup', endDrag);
            });

            div.addEventListener('touchstart', (e) => {
                if (!data.pieces[sq]) return;
                e.preventDefault();
                // Rimuovi eventuali immagini flottanti residue
                document.querySelectorAll('img[style*="position: fixed"]').forEach(img => img.remove());
                dragPiece = data.pieces[sq];
                dragOrigin = sq;
                dragImg = document.createElement('img');
                dragImg.src = `/static/pieces/${dragPiece}.png`;
                dragImg.style.position = 'fixed';
                dragImg.style.pointerEvents = 'none';
                dragImg.style.zIndex = 9999;
                dragImg.style.width = '60px';
                dragImg.style.height = '60px';
                document.body.appendChild(dragImg);
                moveDragImg(e.touches[0]);
                document.addEventListener('touchmove', moveDragTouch, {passive:false});
                document.addEventListener('touchend', endDragTouch);
            });

            function moveDragImg(e) {
                if (dragImg) {
                    dragImg.style.left = (e.clientX - 30) + 'px';
                    dragImg.style.top = (e.clientY - 30) + 'px';
                }
            }

            function moveDragTouch(e) {
                if (dragImg && e.touches && e.touches[0]) {
                    const x = e.touches[0].clientX - 30;
                    const y = e.touches[0].clientY - 30;
                    window.requestAnimationFrame(() => {
                        dragImg.style.left = x + 'px';
                        dragImg.style.top = y + 'px';
                    });
                }
            }

            function endDrag(e) {
                if (!dragImg) return;
                dragImg.remove();
                document.removeEventListener('mousemove', moveDragImg);
                document.removeEventListener('mouseup', endDrag);
                // Trova la casella sotto il mouse
                const elem = document.elementFromPoint(e.clientX, e.clientY);
                if (elem && elem.classList.contains('square')) {
                    const toSq = elem.id;
                    if (dragOrigin && toSq && dragOrigin !== toSq) {
                        fetch('/move', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({from: dragOrigin, to: toSq})
                        })
                        .then(res => res.json())
                        .then(data => {
                            selected = null;
                            if (raceMode && data.success) {
                                totalCaptures++;
                                aggiornaCaptureCounter();
                            }
                            loadBoard(); // Aggiorna subito la board
                        });
                    }
                }
                dragPiece = null;
                dragOrigin = null;
                dragImg = null;
            }

            function endDragTouch(e) {
                if (!dragImg) return;
                dragImg.remove();
                document.removeEventListener('touchmove', moveDragTouch);
                document.removeEventListener('touchend', endDragTouch);
                // Trova la casella sotto il dito
                const touch = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
                if (touch) {
                    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (elem && elem.classList.contains('square')) {
                        const toSq = elem.id;
                        if (dragOrigin && toSq && dragOrigin !== toSq) {
                            fetch('/move', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({from: dragOrigin, to: toSq})
                            })
                            .then(res => res.json())
                            .then(data => {
                                selected = null;
                                if (raceMode && data.success) {
                                    totalCaptures++;
                                    aggiornaCaptureCounter();
                                }
                                loadBoard(); // Aggiorna subito la board
                            });
                        }
                    }
                }
                dragPiece = null;
                dragOrigin = null;
                dragImg = null;
            }

            const handleSelect = (ev) => {
                ev.preventDefault();
                selectSquare(sq);
            };

            // click desktop
            div.addEventListener('click', handleSelect);

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
    aggiornaCaptureCounter();
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
            // Se la mossa è una cattura valida, incrementa il counter
            if (raceMode && data.success) {
                totalCaptures++;
                aggiornaCaptureCounter();
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

    // Freccia curva semplificata per performance mobile
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const normX = dx / len;
    const normY = dy / len;

    // Punto di controllo per la curva
    const ctrlX = (x1 + x2) / 2 + normY * 32;
    const ctrlY = (y1 + y2) / 2 - normX * 32;

    const arrowPath = `M${x1},${y1} Q${ctrlX},${ctrlY} ${x2},${y2}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', arrowPath);
    let arrowColor = 'rgb(130,0,0)';
    if (color === 'w') arrowColor = 'rgb(255,255,255)';
    if (color === 'b') arrowColor = 'rgb(130,0,0)';
    path.setAttribute('stroke', arrowColor);
    path.setAttribute('stroke-width', '5');
    path.setAttribute('opacity', '0.95');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    // Niente filter per performance
    svg.appendChild(path);

    // Punta arrotondata semplificata
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    head.setAttribute('cx', x2);
    head.setAttribute('cy', y2);
    head.setAttribute('r', '5');
    head.setAttribute('fill', arrowColor);
    head.setAttribute('stroke', '#222');
    head.setAttribute('stroke-width', '1.5');
    // Niente filter per performance
    svg.appendChild(head);
}
let timerInterval = null;
let eserciziRisolti = 0;
const NUM_ESERCIZI = 10;
let raceMode = false;

function aggiornaTimer() {
    if (!timerStart && !document.getElementById('timer-div')) return;
    const now = Date.now();
    const elapsed = timerStart ? Math.floor((now - timerStart) / 1000) : 0;
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    let timerDiv = document.getElementById('timer-div');
    if (!timerDiv) {
        timerDiv = document.createElement('div');
        timerDiv.id = 'timer-div';
        timerDiv.style.fontSize = '1.1em';
        timerDiv.style.fontWeight = 'bold';
        timerDiv.style.color = '#fff';
        timerDiv.style.textAlign = 'center';
        timerDiv.style.marginBottom = '8px';
        // Inserisci sopra la barra bottoni
        const btnRow = document.querySelector('.btn-row');
        if (btnRow && btnRow.parentNode) {
            btnRow.parentNode.insertBefore(timerDiv, btnRow);
        }
    }
    timerDiv.style.display = '';
    timerDiv.innerText = `Esercizio ${eserciziRisolti+1} di ${NUM_ESERCIZI} | Tempo: ${min}:${sec.toString().padStart(2,'0')}`;
    aggiornaCaptureCounter();
}

function mostraTempoTotale(elapsed) {
    // Crea o aggiorna il div del messaggio di fine
    let fineDiv = document.getElementById('fine-msg');
    if (!fineDiv) {
        fineDiv = document.createElement('div');
        fineDiv.id = 'fine-msg';
        fineDiv.style.fontSize = '1.15em';
        fineDiv.style.fontWeight = 'bold';
        fineDiv.style.color = '#ffe066';
        fineDiv.style.textAlign = 'center';
        fineDiv.style.margin = '18px 0 8px 0';
        // Inserisci sopra la barra bottoni
        const btnContainer = document.querySelector('body > div');
        if (btnContainer && btnContainer.parentNode) {
            btnContainer.parentNode.insertBefore(fineDiv, btnContainer);
        }
    }
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    fineDiv.innerText = `Hai risolto ${NUM_ESERCIZI} esercizi in ${min} minuti e ${sec} secondi!`;
    // Nascondi timer e bottone "Fine"
    let timerDiv = document.getElementById('timer-div');
    if (timerDiv) timerDiv.style.display = 'none';
    const endBtn = document.getElementById('endbtn');
    if (endBtn) endBtn.style.display = 'none';
    aggiornaCaptureCounter();
}

function aggiornaCaptureCounter() {
    const captureBtn = document.getElementById('capture-btn');
    const errorBtn = document.getElementById('error-btn');
    if (captureBtn) {
        if (raceMode) {
            captureBtn.style.display = '';
            captureBtn.innerText = totalCaptures;
        } else {
            captureBtn.style.display = 'none';
        }
    }
    if (errorBtn) {
        if (raceMode) {
            errorBtn.style.display = '';
            errorBtn.innerText = totalErrors;
        } else {
            errorBtn.style.display = 'none';
        }
    }
    // Mostra il bottone "Fine" durante la challenge, nascondilo solo quando la challenge è terminata
    const endBtn = document.getElementById('endbtn');
    if (endBtn) {
        if (raceMode && eserciziRisolti < NUM_ESERCIZI) {
            endBtn.style.display = '';
        } else {
            endBtn.style.display = 'none';
        }
    }
}

function resettaSessione() {
    eserciziRisolti = 0;
    timerStart = null;
    if (timerInterval) clearInterval(timerInterval);
    let timerDiv = document.getElementById('timer-div');
    if (timerDiv) {
        timerDiv.innerText = '';
        timerDiv.style.display = '';
    }
    let fineDiv = document.getElementById('fine-msg');
    if (fineDiv && fineDiv.parentNode) fineDiv.parentNode.removeChild(fineDiv);
    totalCaptures = 0;
    totalErrors = 0;
    aggiornaCaptureCounter();
    raceMode = false;
    // Nascondi i bottoni numerici e "Fine"
    const captureBtn = document.getElementById('capture-btn');
    const errorBtn = document.getElementById('error-btn');
    const endBtn = document.getElementById('endbtn');
    if (captureBtn) captureBtn.style.display = 'none';
    if (errorBtn) errorBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'none';
}

// In selectSquare e drag&drop, dopo una mossa:
document.addEventListener('DOMContentLoaded', () => {
    loadBoard();

    const nextBtn = document.getElementById('nextpos');
    const doneBtn = document.getElementById('donebtn');
    const raceBtn = document.getElementById('race10btn');
    const endBtn = document.getElementById('endbtn');

    // Modalità "Corsa ai 10"
    raceBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        resettaSessione();
        raceMode = true;
        eserciziRisolti = 0;
        timerStart = Date.now();
        aggiornaTimer();
        timerInterval = setInterval(aggiornaTimer, 1000);
        // Mostra tutti i bottoni
        nextBtn.style.display = '';
        raceBtn.style.display = 'none';
        doneBtn.style.display = '';
        // Carica la prima posizione
        fetch('/')
            .then(() => {
                loadBoard();
            });
    });


    // Gestione bottone "Fatto" con nuova route
    // Stato per sapere se si è appena finito il primo colore
    let justCompletedColor = false;
    const doneHandler = (ev) => {
        ev.preventDefault();
        fetch('/done', {method: 'POST'})
            .then(res => res.json())
            .then(data => {
                // Feedback bottone
                if (data.banner && (data.banner.startsWith('Bravo!') || data.banner.startsWith('Il colore attuale'))) {
                    doneBtn.classList.remove('donebtn-blue', 'donebtn-red');
                    doneBtn.classList.add('donebtn-green');
                    doneBtn.innerHTML = '✔';
                } else if (data.banner && data.banner.startsWith('Ti sei perso')) {
                    doneBtn.classList.remove('donebtn-blue', 'donebtn-green');
                    doneBtn.classList.add('donebtn-red');
                    doneBtn.innerHTML = '✗';
                    if (raceMode) {
                        totalErrors++;
                        aggiornaCaptureCounter();
                    }
                } else {
                    doneBtn.classList.remove('donebtn-green', 'donebtn-red');
                    doneBtn.classList.add('donebtn-blue');
                    doneBtn.innerHTML = 'Fatto';
                }
                // Se il backend restituisce arrows (quando si cambia colore), aggiorna subito la board per togliere le frecce
                if (data.arrows !== undefined) {
                    loadBoard();
                }
                // Se la posizione è completata (entrambi i colori), cambia posizione subito
                if (data.step_completed) {
                    setTimeout(() => {
                        doneBtn.classList.remove('donebtn-green', 'donebtn-red');
                        doneBtn.classList.add('donebtn-blue');
                        doneBtn.innerHTML = 'Fatto';
                        if (raceMode) {
                            eserciziRisolti++;
                            if (eserciziRisolti >= NUM_ESERCIZI) {
                                if (timerInterval) clearInterval(timerInterval);
                                const elapsed = Math.floor((Date.now() - timerStart) / 1000);
                                mostraTempoTotale(elapsed);
                                doneBtn.style.display = 'none';
                                raceBtn.style.display = '';
                                nextBtn.style.display = '';
                                return;
                            }
                        }
                        aggiornaTimer();
                        fetch('/')
                            .then(() => {
                                loadBoard();
                            });
                        selected = null;
                    }, 1200);
                } else {
                    setTimeout(() => {
                        if (!doneBtn.classList.contains('donebtn-blue')) {
                            doneBtn.classList.remove('donebtn-green', 'donebtn-red');
                            doneBtn.classList.add('donebtn-blue');
                            doneBtn.innerHTML = 'Fatto';
                        }
                        aggiornaTimer();
                        selected = null;
                    }, 1200);
                }
            })
            .catch(() => {
                doneBtn.classList.remove('donebtn-green', 'donebtn-blue');
                doneBtn.classList.add('donebtn-red');
                doneBtn.innerHTML = '✗';
                setTimeout(() => {
                    doneBtn.classList.remove('donebtn-red');
                    doneBtn.classList.add('donebtn-blue');
                    doneBtn.innerHTML = 'Fatto';
                }, 1200);
            });
    };
    // Assicura che i pulsanti siano sempre collegati
    if (doneBtn) {
        doneBtn.onclick = doneHandler;
        doneBtn.ontouchstart = (ev) => { doneHandler(ev); return false; };
    }

    // Gestione bottone "Prossima posizione" (ora abilitato anche in corsa ai 10)
    const handler = (ev) => {
        ev.preventDefault();
        if (raceMode) {
            eserciziRisolti++;
            aggiornaTimer();
            aggiornaCaptureCounter();
            if (eserciziRisolti >= NUM_ESERCIZI) {
                if (timerInterval) clearInterval(timerInterval);
                const elapsed = Math.floor((Date.now() - timerStart) / 1000);
                mostraTempoTotale(elapsed);
                doneBtn.style.display = 'none';
                raceBtn.style.display = '';
                nextBtn.style.display = '';
                return;
            }
        }
        fetch('/')
            .then(() => {
                loadBoard();
                aggiornaTimer();
                aggiornaCaptureCounter();
            });
        selected = null;
    };

    if (nextBtn) {
        nextBtn.onclick = handler;
        nextBtn.ontouchstart = (ev) => { handler(ev); return false; };
    }

    // Gestione bottone "Fine" (nuova logica)
    if (endBtn) {
        endBtn.onclick = () => {
            resettaSessione();
            // Mostra i bottoni principali
            nextBtn.style.display = '';
            raceBtn.style.display = '';
            doneBtn.style.display = '';
            aggiornaCaptureCounter();
        };
    }

    // All'avvio, mostra tutti i bottoni
    nextBtn.style.display = '';
    raceBtn.style.display = '';
    doneBtn.style.display = '';
});