/* =========================================================
   CORREDOR UNIVERSITARIO · juego.js  (Fase 2: conexión)

   Cómo se guarda una sala en Firebase:
   salas/
     ABCD/
       estado:        "lobby" | "cuenta" | "carrera" | "final"
       inicio:        hora (del servidor) en que suena "¡YA!"
       participantes: [ids de quienes corren esta carrera]
       jugadores/     { idJugador: { nombre, personaje, unido } }
       personajes/    { idPersonaje: idJugador }   ← evita repetidos
       toques/        { idJugador: número de toques }
       resultado:     [ids en orden de llegada]

   La pantalla grande CREA la sala y decide; los celulares
   solo escriben su nombre, su personaje y sus toques.
   ========================================================= */

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const HORA_SERVIDOR = firebase.database.ServerValue.TIMESTAMP;

const META_TOQUES = 70;     // toques necesarios para llegar a la meta
const PAUSA_MIN = 60;       // ms mínimos entre toques (tope ≈16 por segundo)
const MAX_JUGADORES = 5;

// Cada aparato tiene su propio reloj. Firebase nos dice cuánto se
// diferencia el nuestro del suyo, y así todos cuentan "3, 2, 1" a la vez.
let desfase = 0;
db.ref('.info/serverTimeOffset').on('value', s => { desfase = s.val() || 0; });
const ahora = () => Date.now() + desfase;

const $ = id => document.getElementById(id);
function mostrarVista(id) { document.querySelectorAll('.vista').forEach(v => { v.hidden = v.id !== id; }); }
const baseURL = location.href.split('?')[0].split('#')[0];



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

let lienzo, ctx, pasillo = null;
function prepararLienzo() {
  lienzo = $('pista');
  ctx = lienzo.getContext('2d');
  lienzo.width = W * ESC; lienzo.height = H * ESC;
  ctx.scale(ESC, ESC);
  Promise.all([document.fonts.load('20px "Luckiest Guy"'), document.fonts.load('800 16px "Nunito"')])
    .catch(() => {}).finally(() => { pasillo = crearPasillo(); });
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

  // 3) Escuchar lo que escriben los celulares
  const P = { sala, jugadores: {}, toques: {}, modo: 'lobby', inicio: 0, corredores: [], llegadas: [], orden: [] };
  sala.child('jugadores').on('value', s => { P.jugadores = s.val() || {}; dibujarLobby(P); });
  sala.child('toques').on('value', s => { P.toques = s.val() || {}; });

  $('pEmpezar').addEventListener('click', () => empezarCarrera(P));
  $('pOtra').addEventListener('click', () => empezarCarrera(P));
  $('pVolver').addEventListener('click', () => volverAlLobby(P));

  let ultimo = performance.now();
  const cuadro = t => {
    const dt = Math.min(0.05, (t - ultimo) / 1000);
    ultimo = t;
    actualizarCarrera(P, dt);
    if (P.modo !== 'lobby') dibujarCarrera(P, t / 1000);
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

function empezarCarrera(P) {
  const listos = Object.entries(P.jugadores).filter(([, j]) => j.personaje);
  if (!listos.length) return;
  P.corredores = listos.map(([id, j]) => ({
    id, nombre: j.nombre,
    carril: PERSONAJES.findIndex(p => p.id === j.personaje),   // cada personaje tiene su carril
    disp: 0, fase: 0, mov: 0, llego: null,
  })).filter(c => c.carril >= 0);
  P.llegadas = []; P.orden = []; P.toques = {};
  P.inicio = ahora() + 3500;                  // 3,5 s de cuenta regresiva
  P.modo = 'cuenta';
  $('pLobby').hidden = true; $('pCarrera').hidden = false; $('pAcciones').hidden = true;
  P.sala.update({
    estado: 'cuenta', inicio: P.inicio, toques: null, resultado: null,
    participantes: P.corredores.map(c => c.id),
  });
}

function volverAlLobby(P) {
  P.modo = 'lobby';
  $('pLobby').hidden = false; $('pCarrera').hidden = true;
  P.sala.update({ estado: 'lobby', toques: null, resultado: null, participantes: null });
  dibujarLobby(P);
}

function actualizarCarrera(P, dt) {
  if (P.modo === 'cuenta' && ahora() >= P.inicio) {
    P.modo = 'carrera';
    P.sala.update({ estado: 'carrera' });
  }
  if (P.modo !== 'carrera' && P.modo !== 'final') return;

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
}

function terminarCarrera(P) {
  const resto = P.corredores
    .filter(c => c.llego === null)
    .sort((a, b) => (P.toques[b.id] || 0) - (P.toques[a.id] || 0));
  P.orden = [...P.llegadas, ...resto];
  P.modo = 'final';
  P.sala.update({ estado: 'final', resultado: P.orden.map(c => c.id) });
  setTimeout(() => { $('pAcciones').hidden = false; }, 1200);
}

function dibujarCarrera(P, t) {
  if (pasillo) ctx.drawImage(pasillo, 0, 0, W, H);
  else { ctx.fillStyle = '#e9d4a8'; ctx.fillRect(0, 0, W, H); }

  const porCarril = new Map(P.corredores.map(c => [c.carril, c]));
  for (let i = 0; i < PERSONAJES.length; i++) {       // de atrás hacia adelante
    const c = porCarril.get(i);
    if (!c) continue;
    dibujarCorredor(ctx, PERSONAJES[i], SALIDA_X + c.disp * (META_X - SALIDA_X), carrilY(i), escala(i), {
      fase: c.fase,
      corriendo: c.mov > 0.0004,
      celebra: P.modo === 'final' && P.orden[0] === c,
      t, etiqueta: c.nombre,
    });
  }

  if (P.modo === 'cuenta') {
    const falta = Math.ceil((P.inicio - ahora()) / 1000);
    letrero(falta > 0 ? String(falta) : '¡YA!', 150);
  } else if (P.modo === 'carrera' && ahora() - P.inicio < 800) {
    letrero('¡YA!', 150);
  } else if (P.modo === 'final') {
    tablaResultados(P);
  }
  efectoPelicula(ctx);
}

function letrero(txt, tam) {
  ctx.font = `${tam}px "Luckiest Guy", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 14; ctx.lineJoin = 'round'; ctx.strokeStyle = TINTA;
  ctx.strokeText(txt, W / 2, H / 2 + tam * 0.3);
  ctx.fillStyle = '#c8362b'; ctx.fillText(txt, W / 2, H / 2 + tam * 0.3);
}

function tablaResultados(P) {
  const n = P.orden.length;
  const alto = 70 + n * 38;
  const x = W / 2 - 200, y = 40;
  rr(ctx, x + 6, y + 6, 400, alto, 14); pintar(ctx, TINTA, 0);
  rr(ctx, x, y, 400, alto, 14); pintar(ctx, CREMA, 4);
  texto(ctx, 'RESULTADOS', W / 2, y + 44, 32, '#c8362b');
  P.orden.forEach((c, k) => {
    const fy = y + 84 + k * 38;
    const p = PERSONAJES[c.carril];
    ovalo(ctx, x + 36, fy - 7, 10, 10, p.color, 2.5);
    ctx.font = '800 20px Nunito, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.fillStyle = TINTA;
    ctx.fillText(`${k + 1}.º  ${c.nombre}`, x + 56, fy);
    if (n > 1 && k === n - 1) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#c8362b';
      ctx.fillText('ÚLTIMO', x + 380, fy);
    }
  });
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

  const C = { sala, jid, yo: null, jugadores: {}, personajes: {}, estado: 'lobby', inicio: 0,
              participantes: null, resultado: null, misToques: 0, enviados: 0, cambiando: false };

  sala.child('estado').on('value', s => {
    if (!s.exists()) return errorControl('La pantalla grande cerró la sala.');
    C.estado = s.val(); render(C);
  });
  sala.child('jugadores').on('value', s => { C.jugadores = s.val() || {}; C.yo = C.jugadores[jid] || null; render(C); });
  sala.child('personajes').on('value', s => { C.personajes = s.val() || {}; render(C); });
  sala.child('participantes').on('value', s => { C.participantes = s.val(); render(C); });
  sala.child('resultado').on('value', s => { C.resultado = s.val(); render(C); });
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
}

const participa = C => !C.participantes || C.participantes.includes(C.jid);

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

  if (C.estado === 'lobby') {
    $('cEsperaNombre').textContent = C.yo.nombre;
    $('cEsperaPersonaje').textContent = p.nombre;
    $('cEsperaMini').replaceChildren(miniatura(p, 110));
    return mostrarPaso('cEspera');
  }
  if (C.estado === 'cuenta' || C.estado === 'carrera') {
    $('cQuien').textContent = `${C.yo.nombre} · ${p.nombre}`;
    return mostrarPaso('cJuego');
  }
  if (C.estado === 'final') {
    const orden = C.resultado || [];
    const pos = orden.indexOf(C.jid);
    let txt = 'Esta vez no corriste. Espera la próxima carrera.';
    if (pos === 0) txt = '¡Ganaste la carrera!';
    else if (pos > 0 && pos === orden.length - 1) txt = `Llegaste de último (${pos + 1}.º)`;
    else if (pos > 0) txt = `Llegaste en el puesto ${pos + 1}.º`;
    $('cPuesto').textContent = txt;
    return mostrarPaso('cFin');
  }
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
    detalle.textContent = tomado
      ? 'Lo tiene ' + ((C.jugadores[dueno] && C.jugadores[dueno].nombre) || 'otra persona')
      : dueno === C.jid ? 'Es tuyo' : p.rasgo;
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
