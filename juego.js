/* =========================================================
   CORREDOR UNIVERSITARIO · juego.js  (Fase 4: partida completa)

   Cómo se guarda una sala en Firebase:
   salas/
     ABCD/
       estado:        "lobby" | "cuenta" | "carrera" | "final" |
                      "pregunta" | "revelar" | "gameover" | "podio"
       ronda:         1 a 6
       inicio:        hora (del servidor) en que suena "¡YA!"
       enPartida:     [ids de quienes empezaron la partida]
       participantes: [ids de quienes corren esta ronda]
       jugadores/     { id: { nombre, personaje, unido } }
       personajes/    { idPersonaje: idJugador }   ← evita repetidos
       toques/        { id: número de toques }
       resultado:     [ids en orden de llegada de la ronda]
       ganados/       { id: puntos ganados en la ronda }
       puntos/        { id: puntos totales }
       eliminados/    { id: ronda en que quedó eliminado }
       pregunta:      { jid, idx, orden, fin, respuesta, acierto }
       podio:         [ids en orden final]

   La pantalla grande es la que decide todo; los celulares solo
   escriben nombre, personaje, toques y la respuesta.
   ========================================================= */

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const HORA_SERVIDOR = firebase.database.ServerValue.TIMESTAMP;

const META_TOQUES = 70;              // toques necesarios para llegar a la meta
const PAUSA_MIN = 60;                // ms mínimos entre toques (tope ≈16 por segundo)
const MAX_JUGADORES = 5;
const RONDAS = 6;
const PUNTOS_PUESTO = [5, 4, 3, 2, 1];
const BONO_ACIERTO = 2;
const T_CUENTA = 4000;               // cuenta regresiva
const T_RESULTADOS = 5000;           // tabla de la ronda antes de la pregunta
const T_PREGUNTA = 15000;            // tiempo para responder
const T_REVELAR = 3500;              // se ve la respuesta antes del GAME OVER

// Cada aparato tiene su propio reloj. Firebase nos dice cuánto se
// diferencia el nuestro del suyo, y así todos cuentan "3, 2, 1" a la vez.
let desfase = 0;
db.ref('.info/serverTimeOffset').on('value', s => { desfase = s.val() || 0; });
const ahora = () => Date.now() + desfase;

const $ = id => document.getElementById(id);
function mostrarVista(id) { document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== id; }); }
const baseURL = location.href.split('?')[0].split('#')[0];

function barajar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}


/* =========================================================
   VISTA 1: INICIO
   ========================================================= */
function iniciarInicio() {
  mostrarVista('vInicio');
  $('iCrear').addEventListener('click', () => { location.href = baseURL + '?modo=pantalla'; });
  $('iUnirme').addEventListener('submit', e => {
    e.preventDefault();
    const codigo = $('iCodigo').value.trim().toUpperCase();
    if (codigo.length === 4) location.href = baseURL + '?sala=' + codigo;
  });
}


/* =========================================================
   VISTA 2: PANTALLA GRANDE
   ========================================================= */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // sin I ni O para no confundir con 1 y 0
function codigoAleatorio() {
  let c = '';
  for (let i = 0; i < 4; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return c;
}

let lienzo, ctx;
let fuentesListas = false;
const fondos = {};
function fondo(id) {                 // cada escenario se dibuja una vez y se guarda
  if (!fondos[id] && fuentesListas) fondos[id] = id === 'podio' ? crearEscenario('coliseo', false) : crearEscenario(id);
  return fondos[id];
}
function prepararLienzo() {
  lienzo = $('pista');
  ctx = lienzo.getContext('2d');
  lienzo.width = W * ESC; lienzo.height = H * ESC;
  ctx.scale(ESC, ESC);
  Promise.all([document.fonts.load('20px "Luckiest Guy"'), document.fonts.load('800 16px "Nunito"')])
    .catch(() => {}).finally(() => { fuentesListas = true; });
}

async function iniciarPantalla() {
  mostrarVista('vPantalla');
  prepararLienzo();

  // 1) Crear una sala con un código que no exista
  let codigo, sala;
  try {
    do {
      codigo = codigoAleatorio();
      sala = db.ref('salas/' + codigo);
    } while ((await sala.get()).exists());
    await sala.set({ estado: 'lobby', creada: HORA_SERVIDOR });
  } catch (err) {
    $('pEstado').textContent = 'No se pudo conectar con Firebase. Revisa las reglas de la base de datos. (' + err.message + ')';
    return;
  }
  sala.onDisconnect().remove();     // si se cierra esta pestaña, la sala se borra

  // 2) Mostrar código, link y QR
  const link = baseURL + '?sala=' + codigo;
  $('pCodigo').textContent = codigo;
  $('pLink').textContent = link;
  $('pPrueba').href = link;
  $('pEstado').textContent = 'Sala lista. Esperando jugadores…';
  if (window.QRCode) {
    new QRCode($('qr'), { text: link, width: 260, height: 260, colorDark: '#1d1714', colorLight: '#fbf3df', correctLevel: QRCode.CorrectLevel.M });
  }

  // 3) Estado de la partida (vive en esta pantalla)
  const P = {
    sala, jugadores: {}, toques: {}, modo: 'lobby',
    ronda: 0, enPartida: [], info: {}, puntos: {}, eliminados: {}, puestos: {}, usadas: [],
    inicio: 0, corredores: [], llegadas: [], orden: [], ganados: {},
    pregunta: null, hasta: 0, tGO: 0, ranking: [], botonListo: false,
  };

  // 4) Escuchar lo que escriben los celulares
  sala.child('jugadores').on('value', s => { P.jugadores = s.val() || {}; dibujarLobby(P); });
  sala.child('toques').on('value', s => { P.toques = s.val() || {}; });
  sala.child('pregunta/respuesta').on('value', s => {
    const v = s.val();
    if (P.modo === 'pregunta' && v !== null && v !== undefined) revelar(P, v);
  });

  $('pEmpezar').addEventListener('click', () => empezarPartida(P));
  $('pSiguiente').addEventListener('click', () => {
    if (P.modo === 'podio') volverAlLobby(P);
    else siguienteRonda(P);
  });
  $('pTerminar').addEventListener('click', () => volverAlLobby(P));

  let ultimo = performance.now();
  const cuadro = t => {
    const dt = Math.min(0.05, (t - ultimo) / 1000);
    ultimo = t;
    actualizar(P, dt);
    if (P.modo !== 'lobby') dibujarPantalla(P, t / 1000);
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}

function dibujarLobby(P) {
  const entradas = Object.entries(P.jugadores).sort((a, b) => (a[1].unido || 0) - (b[1].unido || 0));
  const lista = $('pLista');
  lista.replaceChildren();
  if (!entradas.length) {
    const li = document.createElement('li');
    li.className = 'vacio'; li.textContent = 'Todavía no hay nadie. ¡Escaneen el código!';
    lista.append(li);
  }
  entradas.forEach(([, j]) => {
    const p = PERSONAJES.find(x => x.id === j.personaje);
    const li = document.createElement('li');
    li.style.setProperty('--c', p ? p.color : '#bbb');
    const nombre = document.createElement('strong');
    nombre.textContent = j.nombre;                  // textContent: nunca interpreta HTML
    const detalle = document.createElement('small');
    detalle.textContent = p ? p.nombre : 'Eligiendo personaje…';
    const caja = document.createElement('span');
    caja.append(nombre, detalle);
    li.append(miniatura(p, 48), caja);
    lista.append(li);
  });
  $('pCuenta').textContent = `${entradas.length}/${MAX_JUGADORES}`;
  $('pEmpezar').disabled = !entradas.some(([, j]) => j.personaje);
}

// ---------- Flujo de la partida ----------
function empezarPartida(P) {
  const ids = Object.entries(P.jugadores).filter(([, j]) => j.personaje).map(([id]) => id);
  if (!ids.length) return;
  P.enPartida = ids;
  P.info = {};
  ids.forEach(id => {
    const j = P.jugadores[id];
    P.info[id] = { nombre: j.nombre, carril: PERSONAJES.findIndex(p => p.id === j.personaje) };
  });
  P.puntos = Object.fromEntries(ids.map(id => [id, 0]));
  P.puestos = Object.fromEntries(ids.map(id => [id, []]));
  P.eliminados = {}; P.usadas = []; P.ronda = 0; P.ranking = [];
  $('pLobby').hidden = true; $('pCarrera').hidden = false;
  P.sala.update({ enPartida: ids, puntos: P.puntos, eliminados: null, pregunta: null, podio: null, ganados: null });
  siguienteRonda(P);
}

const vivos = P => P.enPartida.filter(id => !P.eliminados[id] && P.info[id].carril >= 0);
const partidaTermina = P =>
  P.ronda >= RONDAS || vivos(P).length === 0 || (P.enPartida.length > 1 && vivos(P).length <= 1);

function siguienteRonda(P) {
  if (partidaTermina(P)) return mostrarPodio(P);
  P.ronda++;
  const ids = vivos(P);
  P.corredores = ids.map(id => ({ id, ...P.info[id], disp: 0, fase: 0, mov: 0, llego: null }));
  P.llegadas = []; P.orden = []; P.toques = {}; P.ganados = {}; P.pregunta = null;
  P.inicio = ahora() + T_CUENTA;
  P.modo = 'cuenta'; P.botonListo = false;
  $('pAcciones').hidden = true; $('pPregunta').hidden = true;
  $('pRonda').textContent = `Ronda ${P.ronda} de ${RONDAS} · ${ESCENARIOS[P.ronda - 1].nombre}`;
  dibujarMarcador(P);
  P.sala.update({
    estado: 'cuenta', ronda: P.ronda, inicio: P.inicio, toques: null, resultado: null,
    ganados: null, pregunta: null, participantes: ids,
  });
}

function actualizar(P, dt) {
  if (P.modo === 'cuenta' && ahora() >= P.inicio) {
    P.modo = 'carrera';
    P.sala.update({ estado: 'carrera' });
  }
  if (P.modo === 'carrera' || P.modo === 'final') {
    P.corredores.forEach(c => {
      const objetivo = Math.min(1, (P.toques[c.id] || 0) / META_TOQUES);
      const antes = c.disp;
      c.disp += (objetivo - c.disp) * Math.min(1, dt * 8);   // se acerca suave al objetivo
      if (objetivo - c.disp < 0.001) c.disp = objetivo;
      c.mov = c.disp - antes;
      c.fase += c.mov * 150;
      if (objetivo >= 1 && c.llego === null && P.modo === 'carrera') {
        c.llego = ahora() - P.inicio;
        P.llegadas.push(c);
      }
    });
    // La carrera termina cuando llegan todos menos uno (o el único que corre)
    if (P.modo === 'carrera' && P.llegadas.length >= Math.max(1, P.corredores.length - 1)) terminarCarrera(P);
  } else {
    P.corredores.forEach(c => { c.mov = 0; });       // quietos mientras no hay carrera
  }

  // Pasos automáticos según el reloj
  if (P.modo === 'final' && ahora() >= P.hasta) {
    if (P.corredores.length > 1) hacerPregunta(P);
    else { P.modo = 'pausa'; mostrarSiguiente(P); }
  }
  if (P.modo === 'pregunta') {
    const resto = Math.max(0, P.pregunta.fin - ahora());
    $('pqTiempo').style.width = (resto / T_PREGUNTA * 100) + '%';
    if (resto <= 0) revelar(P, null);
  }
  if (P.modo === 'revelar' && ahora() >= P.hasta) {
    if (P.pregunta.acierto) { P.modo = 'pausa'; mostrarSiguiente(P); }
    else gameOver(P);
  }
  if (P.modo === 'gameover' && ahora() >= P.hasta && !P.botonListo) mostrarSiguiente(P);
}

function terminarCarrera(P) {
  const resto = P.corredores
    .filter(c => c.llego === null)
    .sort((a, b) => (P.toques[b.id] || 0) - (P.toques[a.id] || 0));
  P.orden = [...P.llegadas, ...resto];
  P.ganados = {};
  P.orden.forEach((c, k) => {
    const pts = PUNTOS_PUESTO[k] || 0;
    P.ganados[c.id] = pts;
    P.puntos[c.id] += pts;
    P.puestos[c.id].push(k + 1);
  });
  P.modo = 'final';
  P.hasta = ahora() + T_RESULTADOS;
  P.sala.update({ estado: 'final', resultado: P.orden.map(c => c.id), ganados: P.ganados, puntos: P.puntos });
  dibujarMarcador(P);
}

function hacerPregunta(P) {
  const perdedor = P.orden[P.orden.length - 1];
  let libres = PREGUNTAS.map((_, i) => i).filter(i => !P.usadas.includes(i));
  if (!libres.length) { P.usadas = []; libres = PREGUNTAS.map((_, i) => i); }
  const idx = libres[Math.floor(Math.random() * libres.length)];
  P.usadas.push(idx);
  P.pregunta = { jid: perdedor.id, idx, orden: barajar([0, 1, 2, 3]), fin: ahora() + T_PREGUNTA, respuesta: null, acierto: null };
  P.modo = 'pregunta';
  mostrarPreguntaPantalla(P, false);
  P.sala.update({
    estado: 'pregunta',
    pregunta: { jid: perdedor.id, idx, orden: P.pregunta.orden, fin: P.pregunta.fin },
  });
}

function revelar(P, respuesta) {
  if (P.modo !== 'pregunta') return;
  const q = PREGUNTAS[P.pregunta.idx];
  const acierto = respuesta === q.correcta;
  P.pregunta.respuesta = respuesta;
  P.pregunta.acierto = acierto;
  if (acierto) P.puntos[P.pregunta.jid] += BONO_ACIERTO;
  P.modo = 'revelar';
  P.hasta = ahora() + T_REVELAR;
  mostrarPreguntaPantalla(P, true);
  dibujarMarcador(P);
  P.sala.update({ estado: 'revelar', 'pregunta/respuesta': respuesta, 'pregunta/acierto': acierto, puntos: P.puntos });
}

function gameOver(P) {
  P.eliminados[P.pregunta.jid] = P.ronda;
  P.modo = 'gameover';
  P.tGO = performance.now() / 1000;
  P.hasta = ahora() + 2800;
  $('pPregunta').hidden = true;
  dibujarMarcador(P);
  P.sala.update({ estado: 'gameover', eliminados: P.eliminados });
}

function mostrarSiguiente(P) {
  P.botonListo = true;
  $('pSiguiente').textContent = partidaTermina(P) ? 'Ver ganador' : 'Siguiente ronda';
  $('pAcciones').hidden = false;
}

function ordenarRanking(P) {
  const promedio = id => P.puestos[id].reduce((a, b) => a + b, 0) / Math.max(1, P.puestos[id].length);
  const comparar = (a, b) => (P.puntos[b] - P.puntos[a]) || (promedio(a) - promedio(b));
  const siguen = vivos(P).sort(comparar);
  const fuera = P.enPartida.filter(id => P.eliminados[id]).sort((a, b) => (P.eliminados[b] - P.eliminados[a]) || comparar(a, b));
  return [...siguen, ...fuera];          // el eliminado nunca puede ganar
}

function mostrarPodio(P) {
  P.ranking = ordenarRanking(P);
  P.modo = 'podio';
  P.tPodio = performance.now() / 1000;
  $('pPregunta').hidden = true;
  $('pRonda').textContent = 'Fin de la partida';
  dibujarMarcador(P);
  $('pSiguiente').textContent = 'Nueva partida';
  $('pTerminar').hidden = true;
  $('pAcciones').hidden = false;
  P.sala.update({ estado: 'podio', podio: P.ranking, puntos: P.puntos });
}

function volverAlLobby(P) {
  P.modo = 'lobby';
  $('pTerminar').hidden = false;
  $('pLobby').hidden = false; $('pCarrera').hidden = true;
  P.sala.update({
    estado: 'lobby', ronda: null, toques: null, resultado: null, participantes: null, ganados: null,
    pregunta: null, enPartida: null, puntos: null, eliminados: null, podio: null,
  });
  dibujarLobby(P);
}

// ---------- Lo que se ve en la pantalla grande ----------
function dibujarMarcador(P) {
  const ul = $('pMarcador');
  ul.replaceChildren();
  const ids = P.modo === 'podio' ? P.ranking : P.enPartida;
  ids.forEach((id, k) => {
    const info = P.info[id];
    const p = PERSONAJES[info.carril];
    const li = document.createElement('li');
    li.style.setProperty('--c', p.color);
    if (P.eliminados[id]) li.classList.add('fuera');
    const punto = document.createElement('span'); punto.className = 'punto';
    const nombre = document.createElement('span'); nombre.className = 'nombre';
    nombre.textContent = (P.modo === 'podio' ? `${k + 1}.º ` : '') + info.nombre;
    const pts = document.createElement('b'); pts.textContent = P.puntos[id];
    li.append(punto, nombre, pts);
    if (P.eliminados[id]) {
      const s = document.createElement('small'); s.textContent = `GAME OVER R${P.eliminados[id]}`;
      li.append(s);
    }
    ul.append(li);
  });
}

function mostrarPreguntaPantalla(P, revelado) {
  const pq = P.pregunta;
  const q = PREGUNTAS[pq.idx];
  $('pqQuien').textContent = `Pregunta para ${P.info[pq.jid].nombre}, que llegó de último`;
  $('pqTexto').textContent = q.texto;
  const ol = $('pqOpciones');
  ol.replaceChildren();
  pq.orden.forEach((oi, k) => {
    const li = document.createElement('li');
    li.dataset.letra = 'ABCD'[k];
    li.textContent = q.opciones[oi];
    if (revelado && oi === q.correcta) li.classList.add('correcta');
    if (revelado && oi === pq.respuesta && oi !== q.correcta) li.classList.add('mal');
    ol.append(li);
  });
  const ex = $('pqExplicacion');
  if (revelado) {
    const inicio = pq.acierto ? `¡Correcto! +${BONO_ACIERTO} puntos. `
      : pq.respuesta === null ? '¡Se acabó el tiempo! ' : 'Respuesta incorrecta. ';
    ex.textContent = inicio + q.explicacion;
    ex.className = 'explicacion ' + (pq.acierto ? 'bien' : 'mal');
    ex.hidden = false;
  } else {
    ex.hidden = true;
    $('pqTiempo').style.width = '100%';
  }
  $('pPregunta').hidden = false;
}

function dibujarPantalla(P, t) {
  const esc = P.modo === 'podio' ? 'coliseo' : ESCENARIOS[Math.max(0, P.ronda - 1)].id;
  const f = fondo(P.modo === 'podio' ? 'podio' : esc);
  if (f) ctx.drawImage(f, 0, 0, W, H);
  else { ctx.fillStyle = '#e9d4a8'; ctx.fillRect(0, 0, W, H); }
  animarEscenario(ctx, esc, t, P.modo === 'carrera' || P.modo === 'podio' ? 1.6 : 0.6);

  if (P.modo === 'podio') { dibujarPodio(P, t); efectoPelicula(ctx); return; }
  if (P.modo === 'gameover') { pantallaGameOver(P, t); efectoPelicula(ctx); return; }

  const porCarril = new Map(P.corredores.map(c => [c.carril, c]));
  for (let i = 0; i < PERSONAJES.length; i++) {       // de atrás hacia adelante
    const c = porCarril.get(i);
    if (!c) continue;
    dibujarCorredor(ctx, PERSONAJES[i], SALIDA_X + c.disp * (META_X - SALIDA_X), carrilY(i), escala(i), {
      fase: c.fase,
      corriendo: c.mov > 0.0004,
      celebra: (P.modo === 'final' || P.modo === 'pausa') && P.orden[0] === c,
      t, etiqueta: c.nombre,
    });
  }

  if (P.modo === 'cuenta') {
    cartelRonda(P);
    const falta = Math.ceil((P.inicio - ahora()) / 1000);
    letrero(falta > 0 ? String(falta) : '¡YA!', 150);
  } else if (P.modo === 'carrera' && ahora() - P.inicio < 800) {
    letrero('¡YA!', 150);
  } else if (P.modo === 'final' || (P.modo === 'pausa' && P.corredores.length === 1)) {
    tablaResultados(P);
  }
  efectoPelicula(ctx);
}

function letrero(txt, tam, y = H / 2 + tam * 0.3) {
  ctx.font = `${tam}px "Luckiest Guy", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.strokeStyle = TINTA;
  ctx.strokeText(txt, W / 2, y);
  ctx.fillStyle = '#c8362b'; ctx.fillText(txt, W / 2, y);
}

function cartelRonda(P) {
  const txt = `RONDA ${P.ronda} · ${ESCENARIOS[P.ronda - 1].nombre.toUpperCase()}`;
  ctx.font = '28px "Luckiest Guy", Impact, sans-serif';
  const ancho = ctx.measureText(txt).width + 50;
  rr(ctx, W / 2 - ancho / 2 + 5, 41, ancho, 52, 12); pintar(ctx, TINTA, 0);
  rr(ctx, W / 2 - ancho / 2, 36, ancho, 52, 12); pintar(ctx, CREMA, 4);
  texto(ctx, txt, W / 2, 72, 28, TINTA);
}

function tablaResultados(P) {
  const n = P.orden.length;
  const alto = 70 + n * 38;
  const x = W / 2 - 210, y = 36;
  rr(ctx, x + 6, y + 6, 420, alto, 14); pintar(ctx, TINTA, 0);
  rr(ctx, x, y, 420, alto, 14); pintar(ctx, CREMA, 4);
  texto(ctx, `RONDA ${P.ronda}`, W / 2, y + 44, 32, '#c8362b');
  P.orden.forEach((c, k) => {
    const fy = y + 84 + k * 38;
    const ultimo = n > 1 && k === n - 1;
    ovalo(ctx, x + 34, fy - 7, 10, 10, PERSONAJES[c.carril].color, 2.5);
    ctx.font = '800 20px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = ultimo ? '#c8362b' : TINTA;
    ctx.fillText(`${k + 1}.º  ${c.nombre}${ultimo ? '  · ÚLTIMO' : ''}`, x + 54, fy);
    ctx.textAlign = 'right'; ctx.fillStyle = TINTA;
    ctx.fillText(`+${P.ganados[c.id]}`, x + 396, fy);
  });
}

function pantallaGameOver(P, t) {
  const e = t - P.tGO;
  const id = P.pregunta.jid;
  const p = PERSONAJES[P.info[id].carril];
  ctx.fillStyle = 'rgba(29,23,20,.25)'; ctx.fillRect(0, 0, W, H);
  dibujarLlanto(ctx, p, W / 2, 420, 1.35, e);
  const r = reducido ? 220 : Math.max(220, 760 - e * 900);   // cierre de iris
  ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, 330, r, 0, Math.PI * 2);
  ctx.fillStyle = TINTA; ctx.fill('evenodd');
  ctx.beginPath(); ctx.arc(W / 2, 330, r, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = CREMA; ctx.stroke();
  if (r <= 221) {
    ctx.font = '66px "Luckiest Guy", Impact, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 8; ctx.strokeStyle = CREMA; ctx.strokeText('GAME OVER', W / 2, 86);
    texto(ctx, 'GAME OVER', W / 2, 86, 66, '#c8362b');
    const txt = `${P.info[id].nombre.toUpperCase()} QUEDA ELIMINADO`;
    ctx.font = '18px "Luckiest Guy", Impact, sans-serif';
    const ancho = Math.max(320, ctx.measureText(txt).width + 40);
    rr(ctx, W / 2 - ancho / 2, 482, ancho, 40, 10); pintar(ctx, CREMA, 3);
    texto(ctx, txt, W / 2, 510, 18, TINTA);
  }
}

function dibujarPodio(P, t) {
  const top = P.ranking.filter(id => !P.eliminados[id]).slice(0, 3);
  const base = 528;
  const lugares = [
    { k: 1, x: W / 2 - 210, h: 110, color: '#d6d6d0' },
    { k: 0, x: W / 2,       h: 160, color: '#e3ab1f' },
    { k: 2, x: W / 2 + 210, h: 80,  color: '#c48a4a' },
  ];
  lugares.forEach(({ k, x, h, color }) => {
    rr(ctx, x - 85, base - h, 170, h, 6); pintar(ctx, color, 4);
    texto(ctx, String(k + 1), x, base - h / 2 + 20, 52, TINTA);
    const id = top[k];
    if (!id) return;
    const info = P.info[id];
    dibujarCorredor(ctx, PERSONAJES[info.carril], x, base - h, 0.9, {
      celebra: k === 0, t, etiqueta: `${info.nombre} · ${P.puntos[id]} pts`,
    });
  });
  if (top[0]) {
    const txt = `¡CAMPEÓN: ${P.info[top[0]].nombre.toUpperCase()}!`;
    ctx.font = '40px "Luckiest Guy", Impact, sans-serif';
    const ancho = ctx.measureText(txt).width + 60;
    rr(ctx, W / 2 - ancho / 2 + 6, 42, ancho, 70, 14); pintar(ctx, TINTA, 0);
    rr(ctx, W / 2 - ancho / 2, 36, ancho, 70, 14); pintar(ctx, CREMA, 4);
    texto(ctx, txt, W / 2, 86, 40, '#c8362b');
  }
  if (!reducido) {                         // confeti
    const colores = ['#c8362b', '#2f6db5', '#3f9a4a', '#e3ab1f', '#7b4fa8', '#fbf3df'];
    for (let i = 0; i < 70; i++) {
      const x = (i * 137.5 + Math.sin(t * 2 + i) * 20) % W;
      const y = ((t - P.tPodio) * (60 + (i % 5) * 18) + i * 47) % (H + 20) - 10;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i);
      ctx.fillStyle = colores[i % colores.length]; ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
  }
}


/* =========================================================
   VISTA 3: CONTROL (celular)
   ========================================================= */
let hayError = false;
function mostrarPaso(id) { document.querySelectorAll('#vControl .paso').forEach(p => { p.hidden = p.id !== id; }); }
function errorControl(msg) { hayError = true; $('cErrorTxt').textContent = msg; mostrarPaso('cError'); }

let timerAviso;
function aviso(msg) {
  const el = $('cAviso');
  el.textContent = msg; el.hidden = false;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => { el.hidden = true; }, 2000);
}

async function iniciarControl(codigo) {
  mostrarVista('vControl');
  $('cSala').textContent = codigo;
  const sala = db.ref('salas/' + codigo);

  let existe = false;
  try { existe = (await sala.child('estado').get()).exists(); }
  catch (err) { return errorControl('No se pudo conectar. Revisa tu internet. (' + err.message + ')'); }
  if (!existe) return errorControl(`La sala ${codigo} no existe o ya se cerró.`);

  // Un identificador para este celular (se guarda para poder recargar la página)
  const clave = 'corredor-id-' + codigo;
  let jid = null;
  try { jid = localStorage.getItem(clave); } catch (e) {}
  if (!jid) {
    jid = 'j' + Math.random().toString(36).slice(2, 10);
    try { localStorage.setItem(clave, jid); } catch (e) {}
  }

  const C = {
    sala, jid, yo: null, jugadores: {}, personajes: {}, estado: 'lobby', inicio: 0, ronda: 0,
    enPartida: null, participantes: null, resultado: null, ganados: {}, puntos: {}, eliminados: {},
    pregunta: null, podio: null, misToques: 0, enviados: 0, cambiando: false, pqClave: '', miRespuesta: null,
  };
  const escuchar = (ruta, campo, vacio = null) =>
    sala.child(ruta).on('value', s => { C[campo] = s.val() ?? vacio; render(C); });

  sala.child('estado').on('value', s => {
    if (!s.exists()) return errorControl('La pantalla grande cerró la sala.');
    C.estado = s.val(); render(C);
  });
  sala.child('jugadores').on('value', s => { C.jugadores = s.val() || {}; C.yo = C.jugadores[jid] || null; render(C); });
  escuchar('personajes', 'personajes', {});
  escuchar('enPartida', 'enPartida');
  escuchar('participantes', 'participantes');
  escuchar('resultado', 'resultado');
  escuchar('ganados', 'ganados', {});
  escuchar('puntos', 'puntos', {});
  escuchar('eliminados', 'eliminados', {});
  escuchar('pregunta', 'pregunta');
  escuchar('podio', 'podio');
  escuchar('ronda', 'ronda', 0);
  sala.child('inicio').on('value', s => {
    const v = s.val() || 0;
    if (v !== C.inicio) { C.inicio = v; C.misToques = 0; C.enviados = 0; $('cToques').textContent = ''; }
    render(C);
  });

  $('cFormNombre').addEventListener('submit', async e => {
    e.preventDefault();
    const nombre = $('cNombreInput').value.trim().slice(0, 14);
    if (!nombre) return;
    const otros = Object.keys(C.jugadores).filter(k => k !== jid).length;
    if (otros >= MAX_JUGADORES) return errorControl('La sala ya tiene 5 jugadores.');
    await sala.child('jugadores/' + jid).set({ nombre, unido: HORA_SERVIDOR });
  });
  $('cCambiar').addEventListener('click', () => { C.cambiando = true; render(C); });

  configurarBoton(C);
  setInterval(() => enviarToques(C), 100);   // los toques se envían en paquetes cada 0,1 s
  setInterval(() => {                         // barra de tiempo de la pregunta
    if (C.estado === 'pregunta' && C.pregunta) {
      const resto = Math.max(0, C.pregunta.fin - ahora());
      $('cpTiempo').style.width = (resto / T_PREGUNTA * 100) + '%';
    }
  }, 100);
}

const participa = C => !C.participantes || C.participantes.includes(C.jid);
const nombreDe = (C, id) => (C.jugadores[id] && C.jugadores[id].nombre) || 'Alguien';

function render(C) {
  if (hayError) return;
  if (!C.yo) return mostrarPaso('cNombre');

  const mio = C.yo.personaje;
  if (!mio || (C.cambiando && C.estado === 'lobby')) {
    dibujarOpciones(C);
    return mostrarPaso('cElegir');
  }
  const p = PERSONAJES.find(x => x.id === mio);
  document.documentElement.style.setProperty('--btn', p.color);

  const enJuego = C.estado !== 'lobby' && C.enPartida && C.enPartida.includes(C.jid);
  const misPuntos = C.puntos[C.jid];
  $('cPuntos').hidden = !enJuego || misPuntos === undefined;
  $('cPuntos').textContent = `${misPuntos || 0} pts`;

  if (!enJuego) {
    $('cEsperaNombre').textContent = C.yo.nombre;
    $('cEsperaMini').replaceChildren(miniatura(p, 110));
    $('cEsperaTexto').textContent = C.estado === 'lobby'
      ? `Corres con ${p.nombre}. Mira la pantalla grande: la partida empieza pronto.`
      : `Corres con ${p.nombre}. Hay una partida en curso; entrarás en la siguiente.`;
    $('cCambiar').hidden = C.estado !== 'lobby';
    return mostrarPaso('cEspera');
  }

  if (C.eliminados[C.jid] && C.estado !== 'podio') return mostrarEliminado(C, p);

  switch (C.estado) {
    case 'cuenta':
    case 'carrera':
      $('cQuien').textContent = `Ronda ${C.ronda} · ${C.yo.nombre}`;
      return mostrarPaso('cJuego');
    case 'final': {
      const orden = C.resultado || [];
      const pos = orden.indexOf(C.jid);
      const ultimo = orden.length > 1 && pos === orden.length - 1;
      $('crRonda').textContent = `Ronda ${C.ronda} de ${RONDAS}`;
      $('crPuesto').textContent = pos === 0 ? '¡Ganaste la ronda!' : ultimo ? 'Llegaste de último' : `Llegaste ${pos + 1}.º`;
      $('crPuntos').textContent = `+${C.ganados[C.jid] || 0} puntos · Total: ${misPuntos || 0}`;
      $('crSigue').textContent = ultimo ? 'Prepárate: te toca responder una pregunta sobre el ensayo.' : 'Mira la pantalla grande.';
      return mostrarPaso('cRonda');
    }
    case 'pregunta':
    case 'revelar':
      if (!C.pregunta) return;
      renderPregunta(C);
      return mostrarPaso('cPregunta');
    case 'gameover': {
      const caido = Object.keys(C.eliminados).find(id => C.eliminados[id] === C.ronda);
      $('crRonda').textContent = `Ronda ${C.ronda} de ${RONDAS}`;
      $('crPuesto').textContent = 'GAME OVER';
      $('crPuntos').textContent = caido ? `${nombreDe(C, caido)} quedó eliminado.` : '';
      $('crSigue').textContent = `Sigues en carrera con ${misPuntos || 0} puntos.`;
      return mostrarPaso('cRonda');
    }
    case 'podio': {
      const orden = C.podio || [];
      const pos = orden.indexOf(C.jid);
      const fuera = C.eliminados[C.jid];
      $('cpdTexto').textContent = pos === 0 ? '¡Eres el campeón!'
        : fuera ? `Quedaste eliminado en la ronda ${fuera}` : `Terminaste en el puesto ${pos + 1}.º`;
      $('cpdPuntos').textContent = `${misPuntos || 0} puntos`;
      return mostrarPaso('cPodio');
    }
  }
}

function renderPregunta(C) {
  const pq = C.pregunta;
  const q = PREGUNTAS[pq.idx];
  const soyYo = pq.jid === C.jid;
  const revelado = C.estado === 'revelar';
  const clave = `${C.ronda}-${pq.idx}-${pq.jid}`;
  const cont = $('cpOpciones');
  if (C.pqClave !== clave) {               // pregunta nueva: crear los botones
    C.pqClave = clave; C.miRespuesta = null;
    cont.replaceChildren();
    pq.orden.forEach((oi, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'opcion-tel'; b.dataset.oi = oi;
      const letra = document.createElement('span'); letra.textContent = 'ABCD'[k];
      const txt = document.createElement('span'); txt.textContent = q.opciones[oi];
      b.append(letra, txt);
      b.addEventListener('click', () => responder(C, oi));
      cont.append(b);
    });
    $('cpTiempo').style.width = '100%';
  }
  $('cpQuien').textContent = soyYo ? '¡Te toca responder!' : `Responde ${nombreDe(C, pq.jid)}`;
  $('cpTexto').textContent = q.texto;
  cont.querySelectorAll('.opcion-tel').forEach(b => {
    const oi = Number(b.dataset.oi);
    b.classList.toggle('correcta', revelado && oi === q.correcta);
    b.classList.toggle('mal', revelado && oi === pq.respuesta && oi !== q.correcta);
    b.classList.toggle('elegida', !revelado && C.miRespuesta === oi);
    b.disabled = !soyYo || revelado || C.miRespuesta !== null;
  });
  let estado;
  if (revelado) {
    estado = pq.acierto
      ? `¡Correcto! ${soyYo ? 'Ganas' : nombreDe(C, pq.jid) + ' gana'} ${BONO_ACIERTO} puntos. `
      : (pq.respuesta === null || pq.respuesta === undefined ? 'Se acabó el tiempo. ' : 'Respuesta incorrecta. ');
    estado += q.explicacion;
  } else {
    estado = soyYo ? 'Tienes 15 segundos. Si fallas, quedas eliminado.' : 'Si falla, queda eliminado.';
  }
  $('cpEstado').textContent = estado;
}

function responder(C, oi) {
  const pq = C.pregunta;
  if (!pq || C.estado !== 'pregunta' || pq.jid !== C.jid || ahora() > pq.fin || C.miRespuesta !== null) return;
  C.miRespuesta = oi;
  renderPregunta(C);
  C.sala.child('pregunta/respuesta').transaction(actual => (actual === null || actual === undefined) ? oi : undefined);
}

// Pantalla de eliminado: el personaje llorando en el celular
let llantoActivo = false;
function mostrarEliminado(C, p) {
  mostrarPaso('cEliminado');
  if (llantoActivo) return;
  llantoActivo = true;
  const cv = $('cLlanto');
  const c = cv.getContext('2d');
  cv.width = 600; cv.height = 520;
  const t0 = performance.now() / 1000;
  const bucle = () => {
    if ($('cEliminado').hidden) { llantoActivo = false; return; }
    c.setTransform(2, 0, 0, 2, 0, 0);
    c.fillStyle = '#f7eed8'; c.fillRect(0, 0, 300, 260);
    dibujarLlanto(c, p, 150, 222, 1, performance.now() / 1000 - t0);
    requestAnimationFrame(bucle);
  };
  requestAnimationFrame(bucle);
}

function dibujarOpciones(C) {
  const cont = $('cPersonajes');
  cont.replaceChildren();
  PERSONAJES.forEach(p => {
    const dueno = C.personajes[p.id];
    const tomado = dueno && dueno !== C.jid;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'personaje' + (dueno === C.jid ? ' mio' : '');
    b.style.setProperty('--c', p.color);
    b.disabled = !!tomado;
    const info = document.createElement('span');
    const nombre = document.createElement('span');
    nombre.textContent = p.nombre;
    const detalle = document.createElement('small');
    detalle.textContent = tomado ? 'Lo tiene ' + nombreDe(C, dueno) : dueno === C.jid ? 'Es tuyo' : p.rasgo;
    info.append(nombre, detalle);
    b.append(miniatura(p, 52), info);
    b.addEventListener('click', () => elegirPersonaje(C, p));
    cont.append(b);
  });
}

// Una "transacción" revisa y escribe en un solo paso en el servidor:
// si dos celulares tocan el mismo personaje a la vez, solo uno gana.
async function elegirPersonaje(C, p) {
  const ref = C.sala.child('personajes/' + p.id);
  const res = await ref.transaction(actual => (actual === null || actual === C.jid) ? C.jid : undefined);
  if (!res.committed) { aviso('¡Alguien lo eligió primero! Escoge otro.'); return; }
  const anterior = C.yo && C.yo.personaje;
  if (anterior && anterior !== p.id) await C.sala.child('personajes/' + anterior).remove();
  await C.sala.child('jugadores/' + C.jid + '/personaje').set(p.id);
  C.cambiando = false;
  render(C);
}

let bloqueoPantalla = null;
function mantenerPantallaEncendida() {
  if (bloqueoPantalla || !('wakeLock' in navigator)) return;
  navigator.wakeLock.request('screen')
    .then(l => { bloqueoPantalla = l; l.addEventListener('release', () => { bloqueoPantalla = null; }); })
    .catch(() => {});
}

function configurarBoton(C) {
  const b = $('cBoton');
  const dedos = new Set();
  let ultimo = 0;

  const tocar = () => {
    if (!(C.estado === 'cuenta' || C.estado === 'carrera') || !participa(C)) return;
    if (ahora() < C.inicio) return;                  // antes del "¡YA!" no cuenta
    const t = performance.now();
    if (t - ultimo < PAUSA_MIN) return;
    ultimo = t;
    C.misToques++;
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
    b.classList.add('golpe');
    setTimeout(() => b.classList.remove('golpe'), 80);
    $('cToques').textContent = C.misToques + ' toques';
  };

  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    mantenerPantallaEncendida();
    const primerDedo = dedos.size === 0;
    dedos.add(e.pointerId);
    if (primerDedo) tocar();                         // un toque = un empujón
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, e => dedos.delete(e.pointerId)));
  b.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerdown', mantenerPantallaEncendida, { once: true });

  // Cuenta regresiva en el celular
  setInterval(() => {
    if (C.estado !== 'cuenta' && C.estado !== 'carrera') return;
    const falta = C.inicio - ahora();
    if (!participa(C)) {
      b.disabled = true;
      $('cCuenta').textContent = 'Esta carrera ya empezó. Espera la siguiente.';
    } else if (falta > 0) {
      b.disabled = true;
      $('cCuenta').textContent = 'Prepárate… ' + Math.ceil(falta / 1000);
    } else {
      b.disabled = false;
      $('cCuenta').textContent = '¡CORRE!';
    }
  }, 100);
}

function enviarToques(C) {
  if (C.misToques === C.enviados) return;
  if (C.estado !== 'cuenta' && C.estado !== 'carrera') return;
  C.enviados = C.misToques;
  C.sala.child('toques/' + C.jid).set(C.misToques);
}


/* =========================================================
   ARRANQUE: ¿qué vista mostramos? Depende de lo que traiga el link.
   (Va al final para que todo lo de arriba ya exista.)
   ========================================================= */
const params = new URLSearchParams(location.search);
if (params.get('modo') === 'pantalla') iniciarPantalla();
else if (params.get('sala')) iniciarControl(params.get('sala').trim().toUpperCase());
else iniciarInicio();
