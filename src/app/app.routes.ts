import { Routes } from '@angular/router';
import { App } from './app';
import { Games } from './games/games';
import { Home } from './home/home';
import { Details } from './games/details/details';
import { Store } from './store/store';
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
        path: 'settings',
        title: 'Settings',
        component: Settings,
    },
];
