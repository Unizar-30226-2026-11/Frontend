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
import { Dixit } from './dixit/dixit';
import { DixitStella } from './dixit-stella/dixit-stella';
import { Login } from './login/login';
import { Profile } from './profile/profile';
import { DixitTestShell } from './test/dixit/dixit-test-shell';
import { StarTest } from './test/star/star-test';
import { Auth } from './services/auth';

function buildActiveGameUrlTree(router: Router, auth: Auth) {
  const activeGameRoute = auth.activeGameRoute();
  return activeGameRoute ? router.parseUrl(activeGameRoute) : true;
}

export const redirectLoggedInHomeGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureInitialized();
  const activeGameId = auth.activeGameId();

  if (activeGameId) {
    return buildActiveGameUrlTree(router, auth);
  }

  if (!auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/menu']);
};

export const activeGameLobbyGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureInitialized();
  const activeGameId = auth.activeGameId();

  if (!activeGameId) {
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
        path: 'dixit/:id',
        title: 'Dixit',
        component: Dixit,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'dixit-stella/:id',
        title: 'Dixit Stella',
        component: DixitStella,
        canActivate: [requireAuthGuard],
    },
    {
        path: 'stella-test',
        title: 'Stella Test',
        component: DixitStella,
    },
    {
        path: 'register',
        title: 'Register',
        component: Register,
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
