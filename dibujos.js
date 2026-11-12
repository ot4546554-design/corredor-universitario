/* =========================================================
   CORREDOR UNIVERSITARIO · dibujos.js
   Todo lo que se dibuja: personajes, pasillo y efectos.
   No sabe nada de Firebase: solo recibe datos y pinta.
   ========================================================= */

// ---------- DATOS DE LOS PERSONAJES ----------
const PERSONAJES = [
  { id: 'trasnochado', nombre: 'El Trasnochado', color: '#d64933', rasgo: 'Café y ojeras' },
  { id: 'cerebrito',   nombre: 'La Cerebrito',   color: '#2f6db5', rasgo: 'Gafas y libros' },
  { id: 'deportista',  nombre: 'El Deportista',  color: '#3f9a4a', rasgo: 'Banda y camiseta 7' },
  { id: 'dormilona',   nombre: 'La Dormilona',   color: '#e3ab1f', rasgo: 'Pijama y almohada' },
  { id: 'fisio',       nombre: 'El Fisio',       color: '#7b4fa8', rasgo: 'Bata y cinta métrica' },
];
const TINTA = '#1d1714', PIEL = '#f6d3ad', CREMA = '#fbf3df', AGUA = '#8fc1de';

const W = 960, H = 540, ESC = 2;           // tamaño lógico de la pista y nitidez (x2)

const SALIDA_X = 100, META_X = 880;
const carrilY = i => 290 + 50 * i + 44;    // dónde pisa cada corredor
const escala  = i => 0.5 + i * 0.055;      // los de adelante se ven más grandes
const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- FUNCIONES DE DIBUJO ----------
function rr(c, x, y, w, h, r) {            // rectángulo redondeado
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function pintar(c, relleno, grosor = 3) {
  if (relleno) { c.fillStyle = relleno; c.fill(); }
  if (grosor) { c.lineWidth = grosor; c.strokeStyle = TINTA; c.stroke(); }
}
function ovalo(c, x, y, rx, ry, relleno, grosor = 3, rot = 0) {
  c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); pintar(c, relleno, grosor);
}
// brazos y piernas tipo "manguera": una curva gruesa
function fideo(c, x1, y1, x2, y2, curva = 6, ancho = 7, color = TINTA) {
  c.beginPath(); c.moveTo(x1, y1);
  c.quadraticCurveTo((x1 + x2) / 2 + curva, (y1 + y2) / 2, x2, y2);
  c.lineWidth = ancho; c.lineCap = 'round'; c.strokeStyle = color; c.stroke();
}
function guante(c, x, y) { ovalo(c, x, y, 6.5, 6, '#ffffff', 2.5); }
function zapato(c, x, y, dir = 1) {
  ovalo(c, x + 5 * dir, y - 3, 11, 6.5, TINTA, 0);
  ovalo(c, x + 8 * dir, y - 6, 3, 1.6, 'rgba(255,255,255,.6)', 0);
}
function texto(c, t, x, y, tam, color, fuente = '"Luckiest Guy", Impact, sans-serif') {
  c.font = `${tam}px ${fuente}`; c.textAlign = 'center'; c.fillStyle = color; c.fillText(t, x, y);
}

// Cabeza (centro en 0,0). ojos: 'abiertos' | 'cerrados'; boca: 'sonrisa' | 'grito' | 'llanto'
function dibujarCabeza(c, p, { ojos = 'abiertos', mira = 4, boca = 'sonrisa' } = {}) {
  // gorro de dormir (va detrás de la cara)
  if (p.id === 'dormilona') {
    c.beginPath(); c.moveTo(24, -8);
    c.quadraticCurveTo(20, -38, -4, -36);
    c.quadraticCurveTo(-30, -35, -42, -16);
    c.quadraticCurveTo(-30, -22, -24, -8);
    c.closePath(); pintar(c, '#8fb8d6', 3);
  }
  ovalo(c, 0, 0, 24, 24, PIEL, 3);         // cara

  // pelo y accesorios
  c.beginPath();
  if (p.id === 'trasnochado') {             // pelo despeinado
    c.moveTo(-23, -6);
    [[-21,-27],[-12,-19],[-6,-35],[2,-21],[10,-34],[14,-20],[24,-27],[23,-6]].forEach(([x,y]) => c.lineTo(x, y));
    c.quadraticCurveTo(0, -16, -23, -6);
    pintar(c, TINTA, 0);
  } else if (p.id === 'cerebrito') {        // pelo con moño
    ovalo(c, -19, -19, 8, 8, '#4a2f1d', 2.5);
    c.beginPath(); c.arc(0, 0, 24.5, Math.PI * 1.08, Math.PI * 1.92);
    c.quadraticCurveTo(4, -10, -22, -9); pintar(c, '#4a2f1d', 2.5);
  } else if (p.id === 'deportista') {       // pelo corto y banda
    c.arc(0, 0, 24.5, Math.PI * 1.1, Math.PI * 1.9); c.quadraticCurveTo(0, -12, -22, -9);
    pintar(c, TINTA, 0);
    c.save(); c.beginPath(); c.arc(0, 0, 23, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#d64933'; c.fillRect(-26, -18, 52, 8);
    c.fillStyle = CREMA; c.fillRect(-26, -15, 52, 2);
    c.restore();
  } else if (p.id === 'dormilona') {        // pompón y flequillo
    ovalo(c, -42, -16, 6.5, 6.5, '#ffffff', 2.5);
    c.beginPath(); c.moveTo(-22, -9); c.quadraticCurveTo(0, -20, 22, -9);
    c.lineWidth = 3; c.strokeStyle = TINTA; c.stroke();
  } else if (p.id === 'fisio') {            // pelo peinado con rulito
    c.arc(0, 0, 24.5, Math.PI * 1.08, Math.PI * 1.92); c.quadraticCurveTo(0, -14, -22, -9);
    pintar(c, '#3a2617', 0);
    c.beginPath(); c.arc(6, -25, 5, Math.PI, Math.PI * 2.4); c.lineWidth = 3; c.strokeStyle = '#3a2617'; c.stroke();
  }

  // ojos estilo años 30: óvalo negro con un "corte" de pastel
  [-8, 8].forEach(dx => {
    if (ojos === 'abiertos') {
      const ex = dx + mira, ey = -3;
      ovalo(c, ex, ey, 4.6, 7.2, TINTA, 0);
      c.beginPath(); c.moveTo(ex, ey); c.arc(ex, ey, 7.6, -1.3, -0.75); c.closePath();
      c.fillStyle = PIEL; c.fill();
      if (p.id === 'trasnochado') {         // ojeras
        c.beginPath(); c.arc(ex, 6, 5, 0.15 * Math.PI, 0.85 * Math.PI);
        c.lineWidth = 2; c.strokeStyle = '#7d6a8a'; c.stroke();
      }
    } else {
      c.beginPath(); c.arc(dx, 0, 5, Math.PI, Math.PI * 2);
      c.lineWidth = 3; c.strokeStyle = TINTA; c.stroke();
    }
  });
  if (p.id === 'cerebrito') {               // gafas gigantes
    const gx = ojos === 'abiertos' ? mira * 0.6 : 0;
    [-9, 9].forEach(dx => ovalo(c, dx + gx, -3, 9, 9, 'rgba(255,255,255,.18)', 2.6));
    c.beginPath(); c.moveTo(-1 + gx, -4); c.lineTo(1 + gx, -4); c.lineWidth = 2.6; c.stroke();
  }

  ovalo(c, mira * 1.5, 5, 4.2, 3.2, '#e8957a', 2);   // nariz

  if (boca === 'sonrisa') {
    c.beginPath(); c.arc(mira, 9, 8, 0.2 * Math.PI, 0.8 * Math.PI);
    c.lineWidth = 3; c.strokeStyle = TINTA; c.stroke();
  } else if (boca === 'grito') {
    c.beginPath(); c.moveTo(mira - 9, 9); c.quadraticCurveTo(mira, 26, mira + 9, 9); c.closePath();
    pintar(c, TINTA, 0);
  } else {                                   // llanto: boca abierta
    ovalo(c, 0, 13, 9, 7.5, TINTA, 0);
    ovalo(c, 0, 17, 5, 2.6, '#d9534f', 0);
  }
}

// Cuerpo con el vestuario de cada personaje (centro en x, y)
function dibujarTorso(c, p, x, y) {
  if (p.id === 'fisio') {                    // bata blanca con camisa morada
    ovalo(c, x, y, 20, 25, '#fbfbf6', 0);
    c.save(); c.beginPath(); c.ellipse(x, y, 20, 25, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = p.color; c.fillRect(x - 6, y - 26, 12, 52); c.restore();
    c.beginPath(); c.moveTo(x - 7, y - 23); c.lineTo(x - 2, y - 4); c.moveTo(x + 7, y - 23); c.lineTo(x + 2, y - 4);
    c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
    rr(c, x + 8, y + 2, 8, 8, 1.5); pintar(c, null, 1.5);
    ovalo(c, x, y, 20, 25, null, 3);
    return;
  }
  ovalo(c, x, y, 20, 25, p.color, 3);
  if (p.id === 'trasnochado') {              // cordones del buzo
    c.beginPath(); c.moveTo(x - 4, y - 20); c.lineTo(x - 5, y - 8); c.moveTo(x + 4, y - 20); c.lineTo(x + 5, y - 8);
    c.lineWidth = 2.5; c.strokeStyle = CREMA; c.stroke();
    c.beginPath(); c.arc(x, y + 8, 10, 0.1 * Math.PI, 0.9 * Math.PI); c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
  } else if (p.id === 'cerebrito') {         // cuello de camisa
    c.beginPath(); c.moveTo(x - 9, y - 22); c.lineTo(x, y - 13); c.lineTo(x + 9, y - 22); c.closePath();
    pintar(c, '#ffffff', 2);
  } else if (p.id === 'deportista') {
    texto(c, '7', x, y + 8, 18, CREMA);
  } else if (p.id === 'dormilona') {         // pijama de puntos
    c.save(); c.beginPath(); c.ellipse(x, y, 18.5, 23.5, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = CREMA;
    [[-8,-12],[6,-16],[-2,-2],[10,2],[-10,8],[4,14],[-4,20]].forEach(([dx,dy]) => {
      c.beginPath(); c.arc(x + dx, y + dy, 2.4, 0, Math.PI * 2); c.fill();
    });
    c.restore();
  }
}

// Corredor de perfil, mirando a la derecha. (x, y) = donde pisa.
function dibujarCorredor(c, p, x, y, s, { fase = 0, corriendo = false, celebra = false, t = 0, etiqueta = '' } = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  let rebote = corriendo ? -Math.abs(Math.sin(fase)) * 5 : Math.sin(t * 2.5 + x) * 1.2;
  if (celebra) rebote = -Math.abs(Math.sin(t * 7)) * 16;

  ovalo(c, 0, 0, 26 + rebote * 0.4, 6, 'rgba(29,23,20,.2)', 0);   // sombra

  const sw = corriendo ? Math.sin(fase) : 0;
  let pieA = { x: sw * 24,  y: corriendo ? -Math.max(0,  Math.cos(fase)) * 10 : 0 };
  let pieB = { x: -sw * 24, y: corriendo ? -Math.max(0, -Math.cos(fase)) * 10 : 0 };
  if (celebra) { pieA = { x: 7, y: rebote }; pieB = { x: -7, y: rebote }; }

  if (p.id === 'cerebrito') {               // mochila con libros (detrás)
    rr(c, -30, -98 + rebote, 6, 14, 1); pintar(c, '#c8362b', 2);
    rr(c, -23, -100 + rebote, 6, 16, 1); pintar(c, '#e3ab1f', 2);
    rr(c, -38, -88 + rebote, 22, 38, 6); pintar(c, '#1f4a80', 3);
  }

  const hombro = -76 + rebote;
  const manoB = celebra ? { x: -24, y: -124 + rebote } : { x: -10 + sw * 16, y: -54 + rebote };
  fideo(c, -10, hombro, manoB.x, manoB.y, -5); guante(c, manoB.x, manoB.y);   // brazo de atrás

  fideo(c, -5, -40 + rebote, pieB.x, pieB.y, 7); zapato(c, pieB.x, pieB.y);   // piernas
  fideo(c,  5, -40 + rebote, pieA.x, pieA.y, 7); zapato(c, pieA.x, pieA.y);

  dibujarTorso(c, p, 0, -62 + rebote);

  if (p.id === 'dormilona') {               // almohada bajo el brazo
    c.save(); c.translate(10, -70 + rebote); c.rotate(-0.25);
    rr(c, -4, -10, 32, 20, 9); pintar(c, '#ffffff', 3); c.restore();
  }
  if (p.id === 'fisio') {                   // cinta métrica al cuello
    [[-9, -84, -7, -52], [9, -84, 12, -56]].forEach(([a, b, d, e]) => {
      fideo(c, a, b + rebote, d, e + rebote, 2, 8, TINTA);
      fideo(c, a, b + rebote, d, e + rebote, 2, 4.5, '#e8c547');
    });
  }

  c.save(); c.translate(0, -104 + rebote);
  dibujarCabeza(c, p, { ojos: 'abiertos', mira: celebra ? 0 : 4, boca: celebra ? 'grito' : 'sonrisa' });
  c.restore();

  const manoA = celebra ? { x: 24, y: -124 + rebote } : { x: 14 - sw * 16, y: -54 + rebote };
  fideo(c, 10, hombro, manoA.x, manoA.y, 5);                                  // brazo de adelante
  if (p.id === 'trasnochado') {             // taza de café humeante
    rr(c, manoA.x - 2, manoA.y - 18, 14, 16, 3); pintar(c, CREMA, 2.5);
    c.beginPath(); c.arc(manoA.x + 12, manoA.y - 10, 4, -Math.PI / 2, Math.PI / 2); c.lineWidth = 2.5; c.stroke();
    for (let k = 0; k < 2; k++) {
      const vx = manoA.x + 3 + k * 6;
      c.beginPath(); c.moveTo(vx, manoA.y - 22);
      c.quadraticCurveTo(vx + 5, manoA.y - 28, vx + Math.sin(t * 6 + k) * 3, manoA.y - 34);
      c.lineWidth = 2; c.strokeStyle = 'rgba(29,23,20,.45)'; c.stroke();
    }
  }
  guante(c, manoA.x, manoA.y);

  c.restore();

  if (etiqueta) {                            // nombre del jugador sobre la cabeza
    const ty = y - 162 * s;
    c.font = '800 15px Nunito, system-ui, sans-serif';
    const ancho = c.measureText(etiqueta).width + 16;
    rr(c, x - ancho / 2, ty - 18, ancho, 24, 8); pintar(c, CREMA, 2.5);
    c.fillStyle = TINTA; c.textAlign = 'center'; c.fillText(etiqueta, x, ty - 1);
  }
}

// Personaje sentado llorando (GAME OVER). t = segundos desde que empezó.
function dibujarLlanto(c, p, x, y, s, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const crece = Math.min(1, t / 1.4);
  const temblor = reducido ? 0 : Math.sin(t * 22) * 1.3;

  ovalo(c, -92, 6, 8 + 24 * crece, 4 + 5 * crece, AGUA, 2);   // charcos de lágrimas
  ovalo(c,  92, 6, 8 + 24 * crece, 4 + 5 * crece, AGUA, 2);
  ovalo(c, 0, 4, 48, 8, 'rgba(29,23,20,.2)', 0);

  if (p.id === 'trasnochado') {             // café derramado
    ovalo(c, 64, 7, 22, 5, '#6b4226', 2);
    c.save(); c.translate(52, -4); c.rotate(1.35); rr(c, -7, -8, 14, 16, 3); pintar(c, CREMA, 2.5); c.restore();
  }
  if (p.id === 'cerebrito') { c.save(); c.translate(-58, 0); c.rotate(-0.1); rr(c, -16, -7, 32, 8, 2); pintar(c, '#3f9a4a', 2.5); c.restore(); }

  fideo(c, -9, -10, -32, 4, -4); zapato(c, -32, 4, -1);   // piernas estiradas
  fideo(c,  9, -10,  32, 4,  4); zapato(c,  32, 4,  1);

  dibujarTorso(c, p, 0, -34);

  const abraza = p.id === 'deportista' || p.id === 'dormilona';
  if (!abraza) {
    fideo(c, -14, -48, -32, -8, -5); guante(c, -32, -8);
    fideo(c,  14, -48,  32, -8,  5); guante(c,  32, -8);
  } else {
    if (p.id === 'deportista') {            // balón abrazado
      ovalo(c, 0, -26, 17, 17, '#ffffff', 3);
      c.beginPath();
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; c.lineTo(Math.cos(a) * 6, -26 + Math.sin(a) * 6); }
      c.closePath(); pintar(c, TINTA, 0);
    } else {                                 // almohada abrazada
      rr(c, -24, -42, 48, 28, 12); pintar(c, '#ffffff', 3);
    }
    fideo(c, -14, -50, -8, -26, -8); guante(c, -8, -26);
    fideo(c,  14, -50,  8, -26,  8); guante(c,  8, -26);
  }

  if (p.id === 'fisio') {                   // enredado en su cinta métrica
    const cinta = (ancho, color) => {
      c.beginPath(); c.moveTo(-34, -18);
      c.bezierCurveTo(-10, -66, 30, -12, 20, -52);
      c.bezierCurveTo(10, -82, -32, -40, -10, -10);
      c.bezierCurveTo(10, 12, 30, -10, 38, 4);
      c.lineWidth = ancho; c.strokeStyle = color; c.lineCap = 'round'; c.stroke();
    };
    cinta(8, TINTA); cinta(4.5, '#e8c547');
  }

  c.save(); c.translate(temblor, -86);
  dibujarCabeza(c, p, { ojos: 'cerrados', mira: 0, boca: 'llanto' });
  c.restore();

  if (p.id === 'cerebrito') {               // libros que le cayeron encima
    c.save(); c.translate(temblor, -112); c.rotate(-0.12);
    rr(c, -20, -4, 40, 9, 2); pintar(c, '#c8362b', 2.5);
    rr(c, -15, -12, 34, 8, 2); pintar(c, '#2f6db5', 2.5);
    rr(c, -18, -19, 30, 7, 2); pintar(c, '#e3ab1f', 2.5);
    c.restore();
  }

  // lágrimas a chorro: gotas que siguen una parábola desde cada ojo
  [-1, 1].forEach(lado => {
    for (let k = 0; k < 7; k++) {
      const u = ((t * 1.4 + k / 7) % 1);
      const gx = temblor + lado * (12 + u * 80);
      const gy = -90 - 40 * u + 132 * u * u;
      ovalo(c, gx, gy, 3.5, 4.5, AGUA, 1.5);
    }
  });
  c.restore();
}

// ---------- ESCENARIO: PASILLO DE LA UNIVERSIDAD ----------
// Se dibuja una sola vez en un lienzo aparte y luego se copia en cada cuadro.
function crearPasillo() {
  const cv = document.createElement('canvas');
  cv.width = W * ESC; cv.height = H * ESC;
  const c = cv.getContext('2d'); c.scale(ESC, ESC);
  const linea = (x1, y1, x2, y2, g = 3, col = TINTA) => {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = g; c.strokeStyle = col; c.stroke();
  };

  c.fillStyle = '#e9d4a8'; c.fillRect(0, 0, W, 290);                 // pared
  c.fillStyle = 'rgba(138,90,51,.07)';
  for (let x = 0; x < W; x += 44) c.fillRect(x, 26, 22, 204);
  c.fillStyle = '#c9a877'; c.fillRect(0, 0, W, 26); linea(0, 26, W, 26); // techo

  c.fillStyle = '#a9774a'; c.fillRect(0, 230, W, 60);                // zócalo
  linea(0, 230, W, 230);
  for (let x = 40; x < W; x += 80) linea(x, 236, x, 284, 2, 'rgba(29,23,20,.45)');

  // puertas de salón
  [{ x: 160, n: 'SALÓN 101' }, { x: 480, n: 'SALÓN 102' }, { x: 790, n: 'SALÓN 103' }].forEach(({ x, n }) => {
    rr(c, x - 38, 96, 76, 196, 4); pintar(c, '#7a4b2a', 4);
    rr(c, x - 24, 112, 48, 46, 3); pintar(c, '#bcd8d2', 3);
    linea(x, 112, x, 158, 2); linea(x - 24, 135, x + 24, 135, 2);
    rr(c, x - 24, 174, 48, 92, 3); pintar(c, null, 2);
    ovalo(c, x + 27, 200, 4, 4, '#e0b84a', 2);
    rr(c, x - 46, 62, 92, 26, 5); pintar(c, CREMA, 3);
    texto(c, n, x, 82, 16, TINTA);
  });

  // carteleras de corcho con papelitos
  const carteleras = [
    { x: 320, papeles: [{ dx: -32, dy: 112, w: 50, h: 40, r: -0.08, t: ['PARCIAL', 'LUNES'] },
                        { dx: 26,  dy: 106, w: 50, h: 58, r: 0.06,  t: ['NO', 'CORRER', 'EN EL', 'PASILLO'] }] },
    { x: 640, papeles: [{ dx: -28, dy: 108, w: 56, h: 44, r: 0.05,  t: ['EXPO:', 'EL ENSAYO'] },
                        { dx: 30,  dy: 112, w: 50, h: 50, r: -0.07, t: ['SE BUSCA', 'GRUPO', 'DE', 'TRABAJO'] }] },
  ];
  carteleras.forEach(({ x, papeles }) => {
    rr(c, x - 66, 86, 132, 108, 6); pintar(c, '#c58c50', 4);
    rr(c, x - 58, 94, 116, 92, 3); pintar(c, null, 1.5);
    papeles.forEach(pp => {
      c.save(); c.translate(x + pp.dx, pp.dy); c.rotate(pp.r);
      c.fillStyle = CREMA; c.fillRect(-pp.w / 2, 0, pp.w, pp.h);
      c.lineWidth = 1.5; c.strokeStyle = TINTA; c.strokeRect(-pp.w / 2, 0, pp.w, pp.h);
      pp.t.forEach((l, k) => texto(c, l, 0, 14 + k * 11, 10, TINTA));
      ovalo(c, 0, 3, 3, 3, '#c8362b', 1.2);
      c.restore();
    });
  });

  // reloj de pared
  ovalo(c, 50, 150, 24, 24, CREMA, 4);
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    linea(50 + Math.cos(a) * 17, 150 + Math.sin(a) * 17, 50 + Math.cos(a) * 20, 150 + Math.sin(a) * 20, 2);
  }
  linea(50, 150, 50, 136, 3); linea(50, 150, 61, 155, 3);

  // lámparas con su luz
  [320, 640].forEach(x => {
    c.fillStyle = 'rgba(255,240,180,.28)';
    c.beginPath(); c.moveTo(x - 18, 40); c.lineTo(x + 18, 40); c.lineTo(x + 96, 230); c.lineTo(x - 96, 230); c.closePath(); c.fill();
    rr(c, x - 24, 26, 48, 14, 4); pintar(c, '#f4e3a1', 3);
  });

  // piso de baldosas
  for (let fila = 0; fila < 5; fila++) {
    for (let col = 0; col < W / 48 + 1; col++) {
      c.fillStyle = (fila + col) % 2 ? '#d9c39a' : '#c49a68';
      c.fillRect(col * 48, 290 + fila * 50, 48, 50);
    }
  }
  c.setLineDash([14, 10]);
  for (let k = 1; k < 5; k++) linea(0, 290 + k * 50, W, 290 + k * 50, 2, 'rgba(29,23,20,.35)');
  c.setLineDash([]);
  linea(0, 290, W, 290, 4);

  // línea de salida
  c.fillStyle = CREMA; c.fillRect(SALIDA_X - 3, 290, 6, 250);
  c.save(); c.translate(SALIDA_X - 18, 470); c.rotate(-Math.PI / 2);
  texto(c, 'SALIDA', 0, 0, 16, 'rgba(29,23,20,.65)'); c.restore();

  // números de carril
  for (let i = 0; i < 5; i++) {
    ovalo(c, 40, carrilY(i) - 18, 12, 12, CREMA, 3);
    texto(c, String(i + 1), 40, carrilY(i) - 12, 15, TINTA);
  }

  // meta: franja a cuadros y letrero colgado
  for (let y = 290; y < 540; y += 10) {
    for (let k = 0; k < 2; k++) {
      c.fillStyle = ((y / 10) + k) % 2 ? TINTA : CREMA;
      c.fillRect(META_X - 10 + k * 10, y, 10, 10);
    }
  }
  linea(META_X - 30, 26, META_X - 30, 188, 2); linea(META_X + 30, 26, META_X + 30, 188, 2);
  rr(c, META_X - 46, 186, 92, 38, 6); pintar(c, '#c8362b', 4);
  texto(c, 'META', META_X, 214, 24, CREMA);
  return cv;
}

// Efecto de película vieja: viñeta, grano y rayones
let vineta = null;
function efectoPelicula(c) {
  if (!vineta) {
    vineta = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.9);
    vineta.addColorStop(0, 'rgba(29,23,20,0)');
    vineta.addColorStop(1, 'rgba(29,23,20,.42)');
  }
  c.fillStyle = vineta; c.fillRect(0, 0, W, H);
  if (reducido) return;
  c.fillStyle = 'rgba(29,23,20,.13)';
  for (let k = 0; k < 90; k++) c.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6);
  if (Math.random() < 0.06) {
    const x = Math.random() * W;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 3, H); c.lineWidth = 1; c.strokeStyle = 'rgba(29,23,20,.2)'; c.stroke();
  }
}


// Miniatura de la cabeza de un personaje (para listas y botones)
function miniatura(p, tam = 52) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = tam * 2;
  cv.style.width = cv.style.height = tam + 'px';
  const c = cv.getContext('2d');
  c.scale(tam * 2 / 64, tam * 2 / 64);
  c.translate(34, 38); c.scale(0.82, 0.82);
  if (p) dibujarCabeza(c, p, { mira: 3 });
  else { ovalo(c, 0, 0, 24, 24, '#d8cbb0', 3); texto(c, '?', 0, 10, 26, TINTA); }
  return cv;
}
