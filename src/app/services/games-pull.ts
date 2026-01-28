import { Injectable, PromiseResourceOptions } from '@angular/core';
import { Game } from '../interfaces/game';
@Injectable({
  providedIn: 'root',
})
export class GamesPull {
  
  getGames(page: number, pageSize: number): Promise<Game[]> {
  return fetch('https://jsonplaceholder.typicode.com/posts')
    .then((response) => response.json())
    .then((data) => {
      return data.slice((page - 1) * pageSize, page * pageSize).map((item: any) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        image: `https://picsum.photos/200/300?random=${item.id}`,
      }));
    });
  }



}
