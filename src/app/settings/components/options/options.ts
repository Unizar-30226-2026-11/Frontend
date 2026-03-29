import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SettingsPreferencesStore } from '../../../services/settings-preferences-store';
import { Auth } from '../../../services/auth';

@Component({
  selector: 'app-options',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="configuracion-layout">
      <div class="configuracion-container">
        <h1>Configuración:</h1>

        <div class="contenido-scroll">
          <div class="grupo-control">
            <label>Sonido</label>
            <div class="caja-control">
              <input type="range" min="0" max="100" [(ngModel)]="volumenSonido" class="slider-rango">
            </div>
          </div>

          <div class="grupo-control">
            <label>Música</label>
            <div class="caja-control">
              <input type="range" min="0" max="100" [(ngModel)]="volumenMusica" class="slider-rango">
            </div>
          </div>

          <div class="grupo-control">
            <label>Notificaciones</label>
            <div class="caja-control caja-toggle">
              <span class="etiqueta-estado" [class.inactivo]="!notificacionesActivas">Desactivadas</span>

              <label class="switch">
                <input type="checkbox" [(ngModel)]="notificacionesActivas">
                <span class="slider-toggle redondo"></span>
              </label>

              <span class="etiqueta-estado" [class.activo]="notificacionesActivas">Activadas</span>
            </div>
          </div>

          <div class="grupo-control">
            <label>Mostrar estado online</label>
            <div class="caja-control caja-toggle">
              <span class="etiqueta-estado" [class.inactivo]="!estadoOnlineActivo">Desactivado</span>

              <label class="switch">
                <input type="checkbox" [(ngModel)]="estadoOnlineActivo">
                <span class="slider-toggle redondo"></span>
              </label>

              <span class="etiqueta-estado" [class.activo]="estadoOnlineActivo">Activado</span>
            </div>
          </div>
        </div>
      </div>

      <div class="acciones-configuracion">
        @if (saveMessage(); as message) {
          <p class="estado-guardado">{{ message }}</p>
        }
        <button type="button" class="btn-config btn-secundario" (click)="restablecerValores()">
          Restablecer configuraciones por defecto
        </button>
        <button type="button" class="btn-config btn-primario" (click)="guardarCambios()">
          Guardar cambios
        </button>
        <button type="button" class="btn-config btn-cerrar-sesion" (click)="cerrarSesion()">
          Cerrar sesión
        </button>
      </div>
    </section>
  `,
  styleUrls: ['./options.css'],
})
export class Options {
  private readonly settingsStore = inject(SettingsPreferencesStore);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  saveMessage = signal<string | null>(null);

  volumenSonido = this.settingsStore.settings().soundVolume;
  volumenMusica = this.settingsStore.settings().musicVolume;
  notificacionesActivas = this.settingsStore.settings().notificationsEnabled;
  estadoOnlineActivo = this.settingsStore.settings().showOnlineStatus;

  restablecerValores(): void {
    this.volumenSonido = 100;
    this.volumenMusica = 100;
    this.notificacionesActivas = false;
    this.estadoOnlineActivo = false;
    this.saveMessage.set(null);
  }

  guardarCambios(): void {
    this.settingsStore.save({
      soundVolume: this.volumenSonido,
      musicVolume: this.volumenMusica,
      notificationsEnabled: this.notificacionesActivas,
      showOnlineStatus: this.estadoOnlineActivo,
    });
    this.saveMessage.set('Configuracion guardada localmente');
  }

  cerrarSesion(): void {
    this.auth.logOut();
    void this.router.navigate(['/login']);
  }
}
