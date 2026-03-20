import { Routes } from '@angular/router';
import { App } from './app';
import { Games } from './games/games';
import { Home } from './home/home';
import { Store } from './store/store';
import { Register } from './register/register';
import { MainMenu } from './main-menu/main-menu';
import { Settings } from './settings/settings';
import { Dixit } from './dixit/dixit';
import { Login } from './login/login';
import { Profile } from './profile/profile';

export const routes: Routes = [
    {
        path: '',
        title: 'App Home Page',
        component: Home,
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
    },
    {
        path: 'profile',
        title: 'Profile',
        component: Profile,
    },
];
