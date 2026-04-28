import { Routes } from '@angular/router';
import { App } from './app';
import { GamesView } from './games-view/games-view';
import { Home } from './home/home';

export const routes: Routes = [
    {
        path: '',
        title: 'App Home Page',
        component: Home,
    },
    {
        path: 'games',
        title: 'Games View',
        component: GamesView, 
    },
];
