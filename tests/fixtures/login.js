import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.js';
import { estudiante1 } from '../data/usuarios.js';

// El inicio de sesión no es parte de la HU: lo resuelve el fixture.
export const test = base.extend({
  paginaLogueada: async ({ page, request }, use) => {
    await request.post('/api/reiniciar');
    const login = new LoginPage(page);
    await login.abrir();
    await login.iniciarSesion(estudiante1);
    await use(page);
  },
});

export { expect } from '@playwright/test';
