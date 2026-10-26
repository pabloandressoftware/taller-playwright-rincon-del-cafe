export class LoginPage {
  constructor(page) {
    this.page = page;
    this.correo = page.getByLabel('Correo');
    this.contrasena = page.getByLabel('Contraseña');
    this.ingresarBtn = page.getByRole('button', { name: 'Iniciar sesión' });
  }

  async abrir() {
    await this.page.goto('/');
  }

  async iniciarSesion({ correo, contrasena }) {
    await this.correo.fill(correo);
    await this.contrasena.fill(contrasena);
    await this.ingresarBtn.click();
  }
}
