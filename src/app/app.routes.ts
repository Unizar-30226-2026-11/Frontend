import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Games } from './games/games';
import { Home } from './home/home';
import { Store } from './store/store';
import { Register } from './register/register';
import { MainMenu } from './main-menu/main-menu';
import { Settings } from './settings/settings';
import { Dixit } from './dixit/dixit';
import { Login } from './login/login';
import { Profile } from './profile/profile';
import { Auth } from './services/auth';

export const redirectLoggedInHomeGuard: CanActivateFn = () => {
  const auth = inject(Auth);

  if (!auth.isLoggedIn()) {
    return true;
  }

  return inject(Router).createUrlTree(['/games']);
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
    },
    {
        path: 'games/:id',
        title: 'Waiting Menu',
        component: MainMenu,
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
        path: '**',
        redirectTo: '',
    },
];
