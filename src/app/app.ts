import { Component, effect, inject } from '@angular/core';
import { NavigationBar } from './components/navigation-bar/navigation-bar';
import { Router, RouterOutlet } from '@angular/router';
import { Auth } from './services/auth';
import { DixitRealtime } from './services/dixit-realtime';
import { isApiRequestErrorStatus } from './interfaces/api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationBar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly realtime = inject(DixitRealtime);
  private readonly hiddenNavbarRoutes = new Set(['/register', '/login']);

  constructor() {
    void this.bootstrapRecoveredGameSession();

    effect((onCleanup) => {
      const toast = this.realtime.toast();
      if (!toast) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        if (this.realtime.toast()?.id === toast.id) {
          this.realtime.clearToast();
        }
      }, 4000);

      onCleanup(() => window.clearTimeout(timeoutId));
    });
  }

  shouldShowNavigation(): boolean {
    const currentPath = this.currentPath();
    if (currentPath === '/') {
      return false;
    }

    if (
      currentPath.startsWith('/game/') ||
      currentPath.startsWith('/dixit/') ||
      currentPath.startsWith('/test/dixit') ||
      currentPath.startsWith('/test/stella') ||
      currentPath.startsWith('/test/unif') ||
      currentPath.startsWith('/dixit-stella/') ||
      currentPath === '/stella-test'
    ) {
      return false;
    }

    return !this.hiddenNavbarRoutes.has(currentPath);
  }

  shouldShowActiveGameBanner(): boolean {
    if (!this.auth.activeGameId()) {
      return false;
    }

    return (
      this.currentPath() !== '/' &&
      !this.currentPath().startsWith('/game/') &&
      !this.currentPath().startsWith('/dixit/') &&
      !this.currentPath().startsWith('/test/dixit') &&
      !this.currentPath().startsWith('/test/stella') &&
      !this.currentPath().startsWith('/test/unif') &&
      !this.currentPath().startsWith('/dixit-stella/')
    );
  }

  activeGameBannerMessage(): string {
    return this.realtime.activeGameNotice() || 'Tienes una partida activa.';
  }

  activeToastMessage(): string {
    return this.realtime.toast()?.message ?? '';
  }

  goToActiveGame(): void {
    const activeGameRoute = this.auth.activeGameRoute();
    if (!activeGameRoute) {
      return;
    }

    void this.router.navigateByUrl(activeGameRoute);
  }

  private currentPath(): string {
    return this.router.url.split('?')[0].split('#')[0] || '/';
  }

  private shouldKeepCurrentRouteWithActiveGame(currentPath: string): boolean {
    return currentPath === '/menu' || currentPath === '/games';
  }

  private async bootstrapRecoveredGameSession(): Promise<void> {
    const session = await this.auth.ensureInitialized();
    const activeGameId = session?.activeGameId;
    if (!activeGameId) {
      return;
    }

    try {
      await this.realtime.restoreActiveGameConnection(activeGameId);
    } catch (error) {
      console.error('[App] No se pudo recuperar la partida activa:', error);
      if (isApiRequestErrorStatus(error, 404)) {
        if (this.auth.activeGameId() === activeGameId) {
          this.auth.setActiveGameId(null);
        }

        const activeGameRoute =
          this.auth.activeGameRoute() ?? `/game/${encodeURIComponent(activeGameId)}`;
        if (this.currentPath() === activeGameRoute) {
          await this.router.navigateByUrl('/games');
        }
        return;
      }
    }

    const activeGameRoute =
      this.auth.activeGameRoute() ?? `/game/${encodeURIComponent(activeGameId)}`;
    const currentPath = this.currentPath();
    if (
      currentPath !== activeGameRoute &&
      !this.shouldKeepCurrentRouteWithActiveGame(currentPath)
    ) {
      await this.router.navigateByUrl(activeGameRoute);
    }
  }
}
