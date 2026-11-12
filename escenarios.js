/* =========================================================
   CORREDOR UNIVERSITARIO · escenarios.js
   Los 6 lugares de la universidad, uno por ronda.
   Cada escenario = pared (distinta en cada uno) + piso y pista
   (iguales en todos, solo cambian los colores).
   ========================================================= */

const ESCENARIOS = [
  { id: 'pasillo',    nombre: 'El pasillo' },
  { id: 'salon',      nombre: 'El salón de clase' },
  { id: 'cafeteria',  nombre: 'La cafetería' },
  { id: 'banos',      nombre: 'Los baños' },
  { id: 'biblioteca', nombre: 'La biblioteca' },
  { id: 'coliseo',    nombre: 'El coliseo' },
];

const PISOS = {
  pasillo:    { tipo: 'baldosa',  a: '#d9c39a', b: '#c49a68', techo: '#c9a877' },
  salon:      { tipo: 'madera',   a: '#c8955c', b: '#a87543', techo: '#c9c19a' },
  cafeteria:  { tipo: 'baldosa',  a: '#efd9b6', b: '#c96b55', techo: '#d9b98e' },
  banos:      { tipo: 'baldosa',  a: '#c4c4bb', b: '#a3a39a', techo: '#b8ccbf' },
  biblioteca: { tipo: 'alfombra', a: '#8e3b34', b: '#7a2f2a', techo: '#b39a74' },
  coliseo:    { tipo: 'cancha',   a: '#d9a865', b: '#c08a4b', techo: '#24232b' },
};

// Números "al azar" pero siempre iguales (para que los libros o el público no cambien solos)
function azar(semilla) {
  return function () {
    semilla = semilla + 0x6D2B79F5 | 0;
    let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function linea(c, x1, y1, x2, y2, g = 3, col = TINTA) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = g; c.strokeStyle = col; c.lineCap = 'round'; c.stroke();
}
function textoNormal(c, t, x, y, tam, color, peso = 800, alinear = 'center') {
  c.font = `${peso} ${tam}px Nunito, system-ui, sans-serif`; c.textAlign = alinear; c.fillStyle = color; c.fillText(t, x, y);
}

// Se dibuja una sola vez en un lienzo aparte y luego se copia en cada cuadro.
function crearEscenario(id, conPista = true) {   // sin pista = para el podio
  const cv = document.createElement('canvas');
  cv.width = W * ESC; cv.height = H * ESC;
  const c = cv.getContext('2d'); c.scale(ESC, ESC);
  PAREDES[id](c);
  const piso = PISOS[id];
  c.fillStyle = piso.techo; c.fillRect(0, 0, W, 26); linea(c, 0, 26, W, 26);
  dibujarPisoYPista(c, piso, conPista);
  if (id === 'banos') {                    // charcos en el piso del baño
    ovalo(c, 330, 372, 46, 9, 'rgba(143,193,222,.55)', 1.5);
    ovalo(c, 640, 468, 60, 10, 'rgba(143,193,222,.55)', 1.5);
    ovalo(c, 200, 515, 34, 7, 'rgba(143,193,222,.55)', 1.5);
  }
  return cv;
}

function dibujarPisoYPista(c, piso, conPista = true) {
  c.fillStyle = piso.a; c.fillRect(0, 290, W, 250);
  if (piso.tipo === 'baldosa') {
    for (let fila = 0; fila < 5; fila++) {
      for (let col = 0; col < W / 48 + 1; col++) {
        if ((fila + col) % 2) continue;
        c.fillStyle = piso.b; c.fillRect(col * 48, 290 + fila * 50, 48, 50);
      }
    }
  } else if (piso.tipo === 'madera' || piso.tipo === 'cancha') {
    for (let y = 290, fila = 0; y < 540; y += 25, fila++) {
      linea(c, 0, y, W, y, 1.5, piso.b);
      for (let x = (fila % 2) * 60; x < W; x += 120) linea(c, x, y, x, y + 25, 1.5, piso.b);
    }
    if (piso.tipo === 'cancha') {           // líneas pintadas de la cancha
      linea(c, 0, 302, W, 302, 4, 'rgba(251,243,223,.8)');
      c.beginPath(); c.arc(W / 2, 415, 70, 0, Math.PI * 2);
      c.lineWidth = 4; c.strokeStyle = 'rgba(251,243,223,.6)'; c.stroke();
    }
  } else if (piso.tipo === 'alfombra') {
    c.fillStyle = piso.b;
    for (let y = 300; y < 540; y += 36) {
      for (let x = (y / 36 % 2) * 18; x < W; x += 36) {
        c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x + 7, y); c.lineTo(x, y + 7); c.lineTo(x - 7, y); c.closePath(); c.fill();
      }
    }
  }
  linea(c, 0, 290, W, 290, 4);
  if (!conPista) return;
  c.setLineDash([14, 10]);
  for (let k = 1; k < 5; k++) linea(c, 0, 290 + k * 50, W, 290 + k * 50, 2, 'rgba(29,23,20,.35)');
  c.setLineDash([]);

  // salida
  c.fillStyle = CREMA; c.fillRect(SALIDA_X - 3, 290, 6, 250);
  c.save(); c.translate(SALIDA_X - 18, 470); c.rotate(-Math.PI / 2);
  c.font = '16px "Luckiest Guy", Impact, sans-serif'; c.textAlign = 'center';
  c.lineWidth = 3; c.strokeStyle = TINTA; c.strokeText('SALIDA', 0, 0);
  c.fillStyle = CREMA; c.fillText('SALIDA', 0, 0);
  c.restore();

  // números de carril
  for (let i = 0; i < 5; i++) {
    ovalo(c, 40, carrilY(i) - 18, 12, 12, CREMA, 3);
    texto(c, String(i + 1), 40, carrilY(i) - 12, 15, TINTA);
  }

  // meta
  for (let y = 290; y < 540; y += 10) {
    for (let k = 0; k < 2; k++) {
      c.fillStyle = ((y / 10) + k) % 2 ? TINTA : CREMA;
      c.fillRect(META_X - 10 + k * 10, y, 10, 10);
    }
  }
  linea(c, META_X - 30, 26, META_X - 30, 188, 2); linea(c, META_X + 30, 26, META_X + 30, 188, 2);
  rr(c, META_X - 46, 186, 92, 38, 6); pintar(c, '#c8362b', 4);
  texto(c, 'META', META_X, 214, 24, CREMA);
}

// ---------- LAS PAREDES ----------
const PAREDES = {

  pasillo(c) {
    c.fillStyle = '#e9d4a8'; c.fillRect(0, 0, W, 290);
    c.fillStyle = 'rgba(138,90,51,.07)';
    for (let x = 0; x < W; x += 44) c.fillRect(x, 26, 22, 204);
    c.fillStyle = '#a9774a'; c.fillRect(0, 230, W, 60);
    linea(c, 0, 230, W, 230);
    for (let x = 40; x < W; x += 80) linea(c, x, 236, x, 284, 2, 'rgba(29,23,20,.45)');

    [{ x: 160, n: 'SALÓN 101' }, { x: 480, n: 'SALÓN 102' }, { x: 790, n: 'SALÓN 103' }].forEach(({ x, n }) => {
      rr(c, x - 38, 96, 76, 196, 4); pintar(c, '#7a4b2a', 4);
      rr(c, x - 24, 112, 48, 46, 3); pintar(c, '#bcd8d2', 3);
      linea(c, x, 112, x, 158, 2); linea(c, x - 24, 135, x + 24, 135, 2);
      rr(c, x - 24, 174, 48, 92, 3); pintar(c, null, 2);
      ovalo(c, x + 27, 200, 4, 4, '#e0b84a', 2);
      rr(c, x - 46, 62, 92, 26, 5); pintar(c, CREMA, 3);
      texto(c, n, x, 82, 16, TINTA);
    });

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

    dibujarReloj(c, 50, 150);
    [320, 640].forEach(x => {
      c.fillStyle = 'rgba(255,240,180,.28)';
      c.beginPath(); c.moveTo(x - 18, 40); c.lineTo(x + 18, 40); c.lineTo(x + 96, 230); c.lineTo(x - 96, 230); c.closePath(); c.fill();
      rr(c, x - 24, 26, 48, 14, 4); pintar(c, '#f4e3a1', 3);
    });
  },

  salon(c) {
    c.fillStyle = '#dfe0bd'; c.fillRect(0, 0, W, 290);
    c.fillStyle = '#8e6a43'; c.fillRect(0, 238, W, 52); linea(c, 0, 238, W, 238);

    // ventana con sol y nubes
    rr(c, 36, 62, 156, 134, 4); pintar(c, '#a9d3e6', 4);
    ovalo(c, 152, 98, 17, 17, '#f4d35e', 2.5);
    ovalo(c, 78, 150, 20, 10, '#ffffff', 2); ovalo(c, 98, 143, 16, 11, '#ffffff', 2);
    linea(c, 114, 62, 114, 196, 4); linea(c, 36, 129, 192, 129, 4);

    // tablero con la clase del ensayo
    rr(c, 246, 50, 428, 168, 6); pintar(c, '#7a4b2a', 4);
    rr(c, 258, 60, 404, 146, 3); pintar(c, '#2f4a3a', 3);
    texto(c, 'EL ENSAYO', 460, 100, 32, '#f1ecd8');
    linea(c, 370, 110, 550, 110, 2, 'rgba(241,236,216,.7)');
    textoNormal(c, 'Introducción  →  Desarrollo  →  Conclusión', 460, 140, 16, '#f1ecd8');
    textoNormal(c, 'Tarea: repasar los 9 tipos de ensayo', 460, 170, 14, 'rgba(241,236,216,.8)', 600);
    c.beginPath();                          // estrellita de tiza
    for (let k = 0; k < 10; k++) { const r = k % 2 ? 4 : 10, a = -Math.PI / 2 + k * Math.PI / 5; c.lineTo(620 + Math.cos(a) * r, 92 + Math.sin(a) * r); }
    c.closePath(); c.lineWidth = 2; c.strokeStyle = '#f1ecd8'; c.stroke();
    rr(c, 258, 210, 404, 8, 2); pintar(c, '#7a4b2a', 2);
    rr(c, 300, 202, 30, 8, 2); pintar(c, '#d8cbb0', 1.5);

    // escritorio del profe con manzana y libros
    rr(c, 690, 178, 128, 14, 3); pintar(c, '#9b6a3d', 3);
    rr(c, 700, 192, 18, 98, 2); pintar(c, '#7a4b2a', 3);
    rr(c, 790, 192, 18, 98, 2); pintar(c, '#7a4b2a', 3);
    rr(c, 704, 164, 40, 14, 2); pintar(c, '#2f6db5', 2.5);
    ovalo(c, 790, 170, 8, 8, '#c8362b', 2); linea(c, 790, 162, 792, 156, 2);

    // pupitre bajo la ventana
    rr(c, 70, 232, 90, 10, 2); pintar(c, '#c58c50', 3);
    linea(c, 80, 242, 80, 290, 4); linea(c, 150, 242, 150, 290, 4);
  },

  cafeteria(c) {
    c.fillStyle = '#f2dcb4'; c.fillRect(0, 0, W, 290);
    for (let x = 0; x < W; x += 24) {
      for (let y = 196; y < 290; y += 24) {
        c.fillStyle = ((x + y) / 24) % 2 ? '#e9c9a0' : '#f6e4c6';
        c.fillRect(x, y, 24, 24);
      }
    }
    linea(c, 0, 196, W, 196, 2);

    // tablero del menú (precios en pesos)
    rr(c, 250, 38, 320, 104, 6); pintar(c, '#2b2522', 4);
    texto(c, 'MENÚ', 410, 70, 26, CREMA);
    [['Tinto', '$1.500'], ['Empanada', '$2.500'], ['Jugo natural', '$3.000']].forEach(([n, p], k) => {
      textoNormal(c, n, 280, 96 + k * 18, 15, CREMA, 600, 'left');
      textoNormal(c, p, 540, 96 + k * 18, 15, '#e3ab1f', 800, 'right');
    });

    // mostrador
    rr(c, 150, 170, 520, 120, 4); pintar(c, '#b5523b', 4);
    for (let x = 190; x < 670; x += 40) linea(c, x, 180, x, 284, 3, 'rgba(251,243,223,.35)');
    rr(c, 140, 158, 540, 14, 3); pintar(c, '#e9e3d3', 3);
    // termo de tinto
    rr(c, 200, 112, 34, 46, 7); pintar(c, '#c8362b', 3);
    rr(c, 208, 104, 18, 10, 3); pintar(c, TINTA, 0);
    ovalo(c, 262, 152, 10, 6, CREMA, 2.5); ovalo(c, 288, 152, 10, 6, CREMA, 2.5);
    // canasta de empanadas
    c.beginPath(); c.moveTo(380, 140); c.quadraticCurveTo(420, 166, 460, 140); c.closePath(); pintar(c, '#9b6a3d', 3);
    [[396, 136], [420, 132], [444, 136]].forEach(([x, y]) => {
      c.beginPath(); c.arc(x, y, 12, Math.PI, 0); c.closePath(); pintar(c, '#d99a3c', 2.5);
    });
    // jarra de jugo
    rr(c, 560, 110, 34, 48, 5); pintar(c, '#f0a33a', 3);
    rr(c, 556, 108, 42, 10, 3); pintar(c, '#ffffff', 2.5);

    // mesa y silla
    ovalo(c, 760, 232, 50, 10, '#9b6a3d', 3); linea(c, 760, 242, 760, 290, 5);
    rr(c, 700, 210, 14, 80, 3); pintar(c, '#c8362b', 3);

    [100, 760].forEach(x => {               // lámparas colgantes
      linea(c, x, 26, x, 60, 2);
      c.beginPath(); c.moveTo(x - 22, 78); c.lineTo(x - 10, 60); c.lineTo(x + 10, 60); c.lineTo(x + 22, 78); c.closePath();
      pintar(c, '#3f9a4a', 3);
    });
  },

  banos(c) {
    c.fillStyle = '#cfe3d6'; c.fillRect(0, 0, W, 290);
    c.lineWidth = 1; c.strokeStyle = '#9bb5a5';
    for (let x = 0; x <= W; x += 24) { c.beginPath(); c.moveTo(x, 26); c.lineTo(x, 290); c.stroke(); }
    for (let y = 26; y <= 290; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const r = azar(7);
    for (let k = 0; k < 16; k++) ovalo(c, r() * W, 40 + r() * 230, 8 + r() * 22, 5 + r() * 10, 'rgba(120,95,50,.16)', 0);
    const grieta = (x, y, pasos) => {
      c.beginPath(); c.moveTo(x, y);
      for (let k = 0; k < pasos; k++) { x += (r() - 0.3) * 18; y += 8 + r() * 10; c.lineTo(x, y); }
      c.lineWidth = 1.6; c.strokeStyle = 'rgba(29,23,20,.55)'; c.stroke();
    };
    grieta(470, 30, 8); grieta(30, 60, 6); grieta(800, 40, 7);

    // cubículos
    [110, 220, 330].forEach((x, k) => {
      if (k === 1) {                         // puerta entreabierta
        rr(c, x - 50, 64, 100, 206, 3); pintar(c, '#2c3a3e', 4);
        ovalo(c, x + 10, 250, 22, 16, '#f4f4ee', 3);
        c.beginPath(); c.moveTo(x - 50, 64); c.lineTo(x - 10, 74); c.lineTo(x - 10, 262); c.lineTo(x - 50, 270); c.closePath();
        pintar(c, '#6f8f9a', 4);
      } else {
        rr(c, x - 50, 64, 100, 206, 3); pintar(c, '#6f8f9a', 4);
        ovalo(c, x + 38, 170, 4, 4, '#bfc7c9', 2);
      }
    });
    c.save(); c.translate(110, 96); c.rotate(-0.06);
    c.fillStyle = CREMA; c.fillRect(-34, 0, 68, 38); c.lineWidth = 1.5; c.strokeStyle = TINTA; c.strokeRect(-34, 0, 68, 38);
    texto(c, 'FUERA DE', 0, 16, 11, '#c8362b'); texto(c, 'SERVICIO', 0, 30, 11, '#c8362b');
    linea(c, -30, -2, -20, 6, 4, 'rgba(230,220,190,.9)'); linea(c, 20, 6, 30, -2, 4, 'rgba(230,220,190,.9)');
    c.restore();

    // grafitis (graciosos pero limpios)
    const grafiti = (lineas, x, y, rot, color, tam = 13) => {
      c.save(); c.translate(x, y); c.rotate(rot);
      lineas.forEach((l, k) => textoNormal(c, l, 0, k * (tam + 3), tam, color, 800));
      c.restore();
    };
    grafiti(['¿Alguien', 'entendió el', 'parcial?'], 112, 180, -0.08, '#1d1714');
    grafiti(['Se busca', 'papel', 'higiénico'], 330, 120, 0.07, '#c8362b', 14);
    grafiti(['Aquí estuvo', 'el de 3er', 'semestre'], 440, 70, 0.05, '#2f4fa0', 12);
    grafiti(['Ánimo, ya', 'casi es viernes'], 620, 214, -0.04, '#2f4fa0', 12);
    c.beginPath();                            // corazón con iniciales
    c.moveTo(440, 204); c.bezierCurveTo(400, 178, 420, 150, 440, 170); c.bezierCurveTo(460, 150, 480, 178, 440, 204);
    c.lineWidth = 2.5; c.strokeStyle = '#c8362b'; c.stroke();
    textoNormal(c, 'A + M', 440, 186, 11, '#c8362b');

    // espejo roto y lavamanos
    rr(c, 520, 56, 240, 96, 4); pintar(c, '#bcd8e0', 4);
    linea(c, 540, 140, 580, 70, 6, 'rgba(255,255,255,.5)'); linea(c, 600, 140, 630, 90, 4, 'rgba(255,255,255,.5)');
    c.beginPath(); c.moveTo(690, 60); c.lineTo(676, 88); c.lineTo(696, 104); c.lineTo(680, 148);
    c.moveTo(676, 88); c.lineTo(652, 96); c.moveTo(696, 104); c.lineTo(724, 116);
    c.lineWidth = 2; c.strokeStyle = TINTA; c.stroke();
    [580, 710].forEach(x => {
      rr(c, x - 8, 186, 16, 104, 2); pintar(c, '#e6e6dd', 3);
      rr(c, x - 36, 168, 72, 18, 7); pintar(c, '#f4f4ee', 3);
      linea(c, x, 168, x, 154, 4); linea(c, x, 154, x + 12, 154, 4);
      ovalo(c, x + 12, 162, 2.5, 3.5, AGUA, 1.2);
    });
    // rollo de papel tirado
    ovalo(c, 410, 280, 12, 9, '#ffffff', 2.5); ovalo(c, 410, 280, 4, 3, '#d8cbb0', 1.5);
    c.beginPath(); c.moveTo(420, 286); c.quadraticCurveTo(450, 292, 470, 284); c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.stroke();
  },

  biblioteca(c) {
    c.fillStyle = '#d8c3a0'; c.fillRect(0, 0, W, 290);
    const r = azar(21);
    const colores = ['#c8362b', '#2f6db5', '#3f9a4a', '#e3ab1f', '#7b4fa8', '#7d522e', '#2b2522', '#d9a865'];
    [[20, 330], [370, 680]].forEach(([x0, x1]) => {
      rr(c, x0, 38, x1 - x0, 252, 4); pintar(c, '#6d4426', 4);
      for (let fila = 0; fila < 4; fila++) {
        const y = 48 + fila * 60;
        c.fillStyle = '#4e2f1a'; c.fillRect(x0 + 10, y, x1 - x0 - 20, 50);
        let x = x0 + 12;
        while (x < x1 - 24) {
          const w = 8 + r() * 10, h = 30 + r() * 18;
          if (r() < 0.08) {                   // un libro inclinado
            c.save(); c.translate(x + w, y + 50); c.rotate(-0.35);
            rr(c, -w, -h, w, h, 1); pintar(c, colores[Math.floor(r() * colores.length)], 1.5); c.restore();
            x += w + 10;
          } else {
            rr(c, x, y + 50 - h, w, h, 1); pintar(c, colores[Math.floor(r() * colores.length)], 1.5);
            x += w + 1;
          }
        }
        linea(c, x0 + 6, y + 50, x1 - 6, y + 50, 5, '#6d4426');
      }
    });
    // escalera apoyada
    linea(c, 300, 60, 352, 290, 5, '#9b6a3d'); linea(c, 330, 60, 382, 290, 5, '#9b6a3d');
    for (let k = 1; k < 8; k++) { const t = k / 8; linea(c, 300 + 52 * t, 60 + 230 * t, 330 + 52 * t, 60 + 230 * t, 4, '#9b6a3d'); }

    // letrero de silencio
    rr(c, 712, 64, 118, 52, 6); pintar(c, CREMA, 3);
    texto(c, 'SILENCIO', 771, 90, 20, '#c8362b');
    textoNormal(c, 'shhh…', 771, 108, 13, TINTA, 600);
    // mostrador con lámpara verde
    rr(c, 700, 196, 120, 94, 4); pintar(c, '#8a5a33', 4);
    linea(c, 760, 196, 760, 176, 3);
    c.beginPath(); c.moveTo(736, 178); c.quadraticCurveTo(760, 158, 784, 178); c.closePath(); pintar(c, '#3f9a4a', 3);
    rr(c, 710, 184, 22, 12, 2); pintar(c, '#e3ab1f', 2);
  },

  coliseo(c) {
    c.fillStyle = '#3b3a45'; c.fillRect(0, 0, W, 290);
    for (let k = 0; k < 5; k++) {           // gradas
      const y = 64 + k * 36;
      c.fillStyle = k % 2 ? '#6b6878' : '#5d5a6b'; c.fillRect(0, y, W, 36);
      linea(c, 0, y, W, y, 2, 'rgba(0,0,0,.45)');
    }
    // reflectores
    [140, 480, 820].forEach(x => {
      const g = c.createRadialGradient(x, 42, 4, x, 42, 70);
      g.addColorStop(0, 'rgba(255,246,200,.8)'); g.addColorStop(1, 'rgba(255,246,200,0)');
      c.fillStyle = g; c.fillRect(x - 70, 26, 140, 90);
      ovalo(c, x, 42, 18, 9, '#fff6c8', 3);
    });
    // valla publicitaria
    c.fillStyle = '#c8362b'; c.fillRect(0, 240, W, 50); linea(c, 0, 240, W, 240); linea(c, 0, 290, W, 290);
    [['¡VAMOS UNI!', 140], ['GRAN FINAL', 470], ['CORREDOR UNIVERSITARIO', 760]].forEach(([t, x]) => texto(c, t, x, 274, 22, CREMA));
    [300, 620].forEach(x => linea(c, x, 240, x, 290, 3));
  },
};

function dibujarReloj(c, x, y) {
  ovalo(c, x, y, 24, 24, CREMA, 4);
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    linea(c, x + Math.cos(a) * 17, y + Math.sin(a) * 17, x + Math.cos(a) * 20, y + Math.sin(a) * 20, 2);
  }
  linea(c, x, y, x, y - 14, 3); linea(c, x, y, x + 11, y + 5, 3);
}

// ---------- DETALLES ANIMADOS (se dibujan en cada cuadro) ----------
const PUBLICO = (() => {
  const r = azar(99), gente = [];
  const ropa = ['#c8362b', '#2f6db5', '#3f9a4a', '#e3ab1f', '#7b4fa8', '#fbf3df'];
  const pieles = ['#f6d3ad', '#d9a37a', '#a8714a', '#7a4b2a'];
  for (let fila = 0; fila < 5; fila++) {
    for (let x = 12 + (fila % 2) * 11; x < W; x += 22) {
      if (Math.abs(x - META_X) < 56) continue;   // deja ver el letrero de META
      gente.push({ x, y: 96 + fila * 36, ropa: ropa[Math.floor(r() * ropa.length)], piel: pieles[Math.floor(r() * pieles.length)], f: r() * 6 });
    }
  }
  return gente;
})();

function animarEscenario(c, id, t, emocion = 1) {
  if (id === 'coliseo') {
    PUBLICO.forEach(g => {
      const salto = -Math.abs(Math.sin(t * 6 + g.f)) * 4 * emocion;
      c.beginPath(); c.arc(g.x, g.y + salto, 9, Math.PI, 0); c.closePath(); pintar(c, g.ropa, 1.5);
      ovalo(c, g.x, g.y - 12 + salto, 6.5, 6.5, g.piel, 1.5);
    });
  } else if (id === 'banos') {              // la mosca
    const mx = 480 + Math.cos(t * 1.7) * 150 + Math.sin(t * 5) * 18;
    const my = 150 + Math.sin(t * 2.6) * 60;
    const ala = Math.abs(Math.sin(t * 40)) * 4 + 2;
    ovalo(c, mx - 3, my - 4, 4, ala, 'rgba(255,255,255,.75)', 1);
    ovalo(c, mx + 3, my - 4, 4, ala, 'rgba(255,255,255,.75)', 1);
    ovalo(c, mx, my, 4, 3, TINTA, 0);
  } else if (id === 'cafeteria') {          // vapor del tinto
    for (let k = 0; k < 3; k++) {
      const x = 210 + k * 8;
      c.beginPath(); c.moveTo(x, 100);
      c.quadraticCurveTo(x + 6, 90, x + Math.sin(t * 4 + k) * 4, 78);
      c.lineWidth = 2; c.strokeStyle = 'rgba(29,23,20,.35)'; c.stroke();
    }
  }
}
