// Estado en memoria de la aplicación. Se carga desde data/seed.json
// y se restaura con reiniciar().

const seed = require('../data/seed.json');

let estado = structuredClone(seed);

module.exports = {
  get: () => estado,
  reiniciar: () => {
    estado = structuredClone(seed);
  },
};
