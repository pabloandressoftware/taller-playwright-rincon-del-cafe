import { test, expect } from './fixtures/login.js';
import { FavoritosPage } from './pages/FavoritosPage.js';

test.describe('HU-08 · Favoritos', () => {
  let favoritos;

  test.beforeEach(async ({ paginaLogueada: page }) => {
    favoritos = new FavoritosPage(page);
    await favoritos.abrir();
  });

  test.describe('Quitar un favorito', () => {
    // Caso que detecta el bug inyectado: quitar B borra A (el primero)
    test('CP-01 quitar el del medio conserva los demás', async () => {
      for (const p of ['A', 'B', 'C']) await favoritos.agregar(p);
      await favoritos.quitar('B');
      await expect(favoritos.item('B')).toHaveCount(0);
      await expect(favoritos.item('A')).toHaveCount(1);
      await expect(favoritos.item('C')).toHaveCount(1);
      await expect(favoritos.total).toHaveText('2');
    });

    test('CP-02 quitar el primero conserva los demás', async () => {
      for (const p of ['A', 'B', 'C']) await favoritos.agregar(p);
      await favoritos.quitar('A');
      await expect(favoritos.item('A')).toHaveCount(0);
      await expect(favoritos.item('B')).toHaveCount(1);
      await expect(favoritos.item('C')).toHaveCount(1);
    });

    test('CP-03 quitar el último conserva los demás', async () => {
      for (const p of ['A', 'B', 'C']) await favoritos.agregar(p);
      await favoritos.quitar('C');
      await expect(favoritos.item('C')).toHaveCount(0);
      await expect(favoritos.item('A')).toHaveCount(1);
      await expect(favoritos.item('B')).toHaveCount(1);
    });

    test('CP-04 quitar el único favorito deja la lista vacía', async () => {
      await favoritos.agregar('A');
      await favoritos.quitar('A');
      await expect(favoritos.items).toHaveCount(0);
      await expect(favoritos.estado).toHaveText('vacío');
    });
  });

  test.describe('Máximo 20 favoritos', () => {
    test('CP-05 se puede agregar el favorito número 20', async () => {
      await favoritos.agregarPorApi(19);
      await favoritos.agregar('Favorito20');
      await expect(favoritos.total).toHaveText('20');
      await expect(favoritos.mensaje).toHaveText('Favorito agregado');
    });

    test('CP-06 el favorito 21 se rechaza con mensaje', async () => {
      await favoritos.agregarPorApi(20);
      await favoritos.agregar('Favorito21');
      await expect(favoritos.mensaje).toHaveText('Máximo 20 favoritos');
      await expect(favoritos.total).toHaveText('20');
      await expect(favoritos.item('Favorito21')).toHaveCount(0);
    });

    test('CP-07 con 20 favoritos, quitar uno permite agregar otro', async () => {
      await favoritos.agregarPorApi(20);
      await favoritos.quitar('P20');
      await favoritos.agregar('Nuevo');
      await expect(favoritos.item('Nuevo')).toHaveCount(1);
      await expect(favoritos.total).toHaveText('20');
    });
  });

  test.describe('Prioridad', () => {
    for (const prioridad of ['alta', 'media', 'baja']) {
      test(`CP-08 se acepta la prioridad ${prioridad}`, async () => {
        await favoritos.agregar('Café', prioridad);
        await expect(favoritos.item('Café')).toContainText(`(${prioridad})`);
      });
    }

    test('CP-09 una prioridad fuera de alta/media/baja se rechaza', async ({ paginaLogueada: page }) => {
      // La interfaz solo ofrece 3 opciones, así que se prueba por API
      const res = await page.request.post('/api/favoritos', {
        data: { producto: 'X', nota: '', prioridad: 'urgente' },
      });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe('La prioridad debe ser alta, media o baja');
    });
  });
});
