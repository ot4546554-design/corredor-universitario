/* =========================================================
   CORREDOR UNIVERSITARIO · preguntas.js
   Las preguntas de la exposición sobre el ensayo.
   Para cambiar o agregar preguntas solo hay que editar este archivo.
   "correcta" es la posición de la opción buena, contando desde 0
   (0 = primera, 1 = segunda, 2 = tercera, 3 = cuarta).
   En el juego las opciones salen en desorden.
   ========================================================= */
const PREGUNTAS = [
  {
    texto: '¿Cuáles son las tres partes principales del ensayo?',
    opciones: ['Título, resumen y bibliografía', 'Introducción, desarrollo y conclusión', 'Inicio, nudo y desenlace', 'Hipótesis, método y resultados'],
    correcta: 1,
    explicacion: 'El ensayo se organiza en introducción, desarrollo y conclusión.',
  },
  {
    texto: '¿Cuántos tipos de ensayo mencionamos en la exposición?',
    opciones: ['Cinco', 'Siete', 'Nueve', 'Doce'],
    correcta: 2,
    explicacion: 'En la exposición vimos nueve tipos de ensayo.',
  },
  {
    texto: '¿Qué es un ensayo?',
    opciones: ['Un texto que analiza o reflexiona sobre un tema', 'Un relato de ficción con personajes', 'Un poema escrito en verso', 'Una lista de datos sin ninguna opinión'],
    correcta: 0,
    explicacion: 'Un ensayo es un texto en el que el autor analiza o reflexiona sobre un tema.',
  },
  {
    texto: '¿En qué parte se presenta el tema?',
    opciones: ['En el desarrollo', 'En la conclusión', 'En la bibliografía', 'En la introducción'],
    correcta: 3,
    explicacion: 'La introducción presenta el tema y anticipa de qué tratará el ensayo.',
  },
  {
    texto: '¿En qué parte se presentan los argumentos?',
    opciones: ['En la introducción', 'En el desarrollo', 'En la conclusión', 'En la bibliografía'],
    correcta: 1,
    explicacion: 'En el desarrollo se presentan y explican los argumentos.',
  },
  {
    texto: '¿Qué tipo de ensayo defiende una postura?',
    opciones: ['El expositivo', 'El descriptivo', 'El argumentativo', 'El narrativo'],
    correcta: 2,
    explicacion: 'El ensayo argumentativo defiende una postura con argumentos.',
  },
  {
    texto: '¿Qué tipo de ensayo explica un tema objetivamente?',
    opciones: ['El expositivo', 'El argumentativo', 'El narrativo', 'El literario'],
    correcta: 0,
    explicacion: 'El ensayo expositivo explica un tema de forma objetiva, sin tomar partido.',
  },
  {
    texto: '¿Para qué sirve la bibliografía?',
    opciones: ['Para resumir el ensayo', 'Para presentar el tema', 'Para dar la opinión del autor', 'Para indicar las fuentes consultadas'],
    correcta: 3,
    explicacion: 'La bibliografía indica las fuentes que se consultaron para escribir el ensayo.',
  },
];
