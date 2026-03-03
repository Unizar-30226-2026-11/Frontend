import { Routes } from '@angular/router';
import { App } from './app';
import { Games } from './games/games';
import { Home } from './home/home';
import { Details } from './details/details';
import { Store } from './store/store';
import { Register } from './register/register';
import { MainMenu } from './main-menu/main-menu';
import { Settings } from './settings/settings';
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
        title: 'Game Details',
        component: Details,
    },
    {
        path: 'store',
        title: 'Store',
        component: Store,
    },
    {
        path: 'main-menu',
        title: 'Main Menu',
        component: MainMenu,
    },
    {
        path: 'settings',
        title: 'Settings',
        component: Settings,
    },
    {
    path: 'register',
    title: 'Register',
    component: Register,
  },
];
