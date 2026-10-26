export class FavoritosPage {
  constructor(page) {
    this.page = page;
    this.producto = page.getByLabel('Producto');
    this.nota = page.getByLabel('Nota');
    this.prioridad = page.getByLabel('Prioridad');
    this.agregarBtn = page.getByRole('button', { name: 'Agregar favorito' });
    this.mensaje = page.getByRole('status');
    this.total = page.getByTestId('total-favoritos');
    this.estado = page.getByTestId('estado-favoritos');
    this.items = page.locator('#lista-favoritos li');
  }

  async abrir() {
    await this.page.getByRole('button', { name: 'Favoritos', exact: true }).click();
    await this.estado.waitFor();
  }

  async agregar(producto, prioridad = 'media') {
    await this.producto.fill(producto);
    await this.prioridad.selectOption(prioridad);
    await this.agregarBtn.click();
  }

  // Llena rápido la lista por API (comparte la sesión de la página)
  async agregarPorApi(cantidad) {
    for (let i = 1; i <= cantidad; i++) {
      await this.page.request.post('/api/favoritos', {
        data: { producto: `P${i}`, nota: '', prioridad: 'media' },
      });
    }
    await this.abrir();
  }

  item(producto) {
    // El texto del item empieza con "<producto> (<prioridad>)"
    return this.items.filter({ hasText: new RegExp(`^\\s*${producto} \\(`) });
  }

  async quitar(producto) {
    await this.item(producto).getByRole('button', { name: 'Quitar' }).click();
  }
}
