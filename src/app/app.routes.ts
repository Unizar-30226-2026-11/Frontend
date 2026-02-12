import { Routes } from '@angular/router';
import { App } from './app';
import { GamesView } from './games-view/games-view';
import { Home } from './home/home';
import { Details } from './details/details';
import { Store } from './store/store';
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
];
