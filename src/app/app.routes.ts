import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Games } from './games/games';
import { Home } from './home/home';
import { Store } from './store/store';
import { Register } from './register/register';
import { MainMenu } from './main-menu/main-menu';
import { Settings } from './settings/settings';
import { Dixit } from './dixit/dixit';
import { DixitStella } from './dixit-stella/dixit-stella';
import { Login } from './login/login';
import { Profile } from './profile/profile';
import { StarTest } from './test/star/star-test';
import { Auth } from './services/auth';

function buildActiveGameUrlTree(router: Router, activeGameId: string) {
  return router.createUrlTree(['/dixit', activeGameId]);
}

export const redirectLoggedInHomeGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureInitialized();
  const activeGameId = auth.activeGameId();

  if (activeGameId) {
    return buildActiveGameUrlTree(router, activeGameId);
  }

  if (!auth.isLoggedIn()) {
    return true;
  }

  return router.createUrlTree(['/games']);
};

export const activeGameLobbyGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureInitialized();
  const activeGameId = auth.activeGameId();

  if (!activeGameId) {
    return true;
  }

  return buildActiveGameUrlTree(router, activeGameId);
};

export const routes: Routes = [
    {
        path: '',
        title: 'App Home Page',
        component: Home,
        canActivate: [redirectLoggedInHomeGuard],
    },
    {
        path: 'games',
        title: 'Games List',
        component: Games,
        canActivate: [activeGameLobbyGuard],
    },
    {
        path: 'games/:id',
        title: 'Waiting Menu',
        component: MainMenu,
        canActivate: [activeGameLobbyGuard],
    },
    {
        path: 'store',
        title: 'Store',
        component: Store,
    },
    {
        path: 'settings',
        title: 'Settings',
        component: Settings,
    },
    {
        path: 'dixit/:id',
        title: 'Dixit',
        component: Dixit,
    },
    {
        path: 'dixit-stella/:id',
        title: 'Dixit Stella',
        component: DixitStella,
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
