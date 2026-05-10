import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Games } from './games/games';
import { Home } from './home/home';
import { Store } from './store/store';
import { StorePack } from './store/store-pack/store-pack';
import { Register } from './register/register';
import { MainMenu } from './main-menu/main-menu';
import { DeckBuilder } from './deck-builder/deck-builder';
import { LobbyMenu } from './lobby-menu/lobby-menu';
import { Settings } from './settings/settings';
import { Login } from './login/login';
import { Profile } from './profile/profile';
import { DixitTestShell } from './test/dixit/dixit-test-shell';
import { StellaTestShell } from './test/stella/stella-test-shell';
import { StarTest } from './test/star/star-test';
import { Auth } from './services/auth';
import { GameShell } from './game-shell/game-shell';

function buildActiveGameUrlTree(router: Router, auth: Auth) {
  const activeGameRoute = auth.activeGameRoute();
  return activeGameRoute ? router.parseUrl(activeGameRoute) : true;
}

export const redirectLoggedInHomeGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureInitialized();
  const activeGameId = auth.activeGameId();

  if (activeGameId) {
    return router.createUrlTree(['/games']);
  }

  if (!auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/menu']);
};

export const activeGameLobbyGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const allowedUrl = state.url.split('?')[0].split('#')[0] ?? '';
  await auth.ensureInitialized();
  const activeGameId = auth.activeGameId();

  if (!activeGameId) {
    return true;
  }

  if (allowedUrl === '/menu' || allowedUrl === '/games') {
    return true;
  }

  return buildActiveGameUrlTree(router, auth);
};

export const requireAuthGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureInitialized();

  if (auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

export const routes: Routes = [
    {
        path: '',
        title: 'App Home Page',
        component: Home,
        canActivate: [redirectLoggedInHomeGuard],
    },
    {
        path: 'menu',
        title: 'Main Menu',
        component: MainMenu,
        canActivate: [requireAuthGuard, activeGameLobbyGuard],
    },
    {
        path: 'games',
        title: 'Games List',
        component: Games,
        canActivate: [requireAuthGuard, activeGameLobbyGuard],
    },
    {
        path: 'games/:id',
        title: 'Waiting Menu',
        component: LobbyMenu,
        canActivate: [requireAuthGuard, activeGameLobbyGuard],
    },
    {
        path: 'deck-builder',
        title: 'Deck Builder',
        component: DeckBuilder,
        canActivate: [requireAuthGuard, activeGameLobbyGuard],
    },
    {
        path: 'store',
        title: 'Store',
        component: Store,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'store/packs/:id',
        title: 'Store Pack',
        component: StorePack,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'settings',
        title: 'Settings',
        component: Settings,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'game/:id',
        title: 'Game',
        component: GameShell,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'dixit/:id',
        pathMatch: 'full',
        redirectTo: 'game/:id',
    },
    {
        path: 'dixit-stella/:id',
        pathMatch: 'full',
        redirectTo: 'game/:id',
    },
    {
        path: 'stella-test',
        pathMatch: 'full',
        redirectTo: 'test/stella/TEST-STELLA',
    },
    {
        path: 'register',
        title: 'Register',
        component: Register,
        canActivate: [redirectLoggedInHomeGuard],
    },
    {
        path: 'login',
        title: 'Login',
        component: Login,
        canActivate: [redirectLoggedInHomeGuard],
    },
    {
        path: 'profile',
        title: 'Profile',
        component: Profile,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'test/dixit',
        pathMatch: 'full',
        redirectTo: 'test/dixit/TEST-DIXIT',
    },
    {
        path: 'test/dixit/:id',
        title: 'Dixit Test',
        component: DixitTestShell,
    },
    {
        path: 'test/stella',
        pathMatch: 'full',
        redirectTo: 'test/stella/TEST-STELLA',
    },
    {
        path: 'test/stella/:id',
        title: 'Stella Test',
        component: StellaTestShell,
    },
    {
        path: 'test/unif',
        pathMatch: 'full',
        redirectTo: 'test/unif/TEST-UNIF',
    },
    {
        path: 'test/star',
        title: 'Test Star',
        // Ruta aislada para depurar el flujo visual de la estrella fugaz
        // sin depender de una partida realtime activa.
        component: StarTest,
    },
    {
        path: '**',
        redirectTo: '',
    },
];
