import { Injectable, inject } from '@angular/core';
import { PlayerStore } from './player-store';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private readonly playerStore = inject(PlayerStore);
  isLoggedInUser = false;
  username = '';

  constructor() {
    // Checking for existing authentication tokens or session data can be done here
  }

  LogIn(username: string, password: string): boolean {
    // Implement your authentication logic here
    this.isLoggedInUser = username === 'admin' && password === 'password';
    this.username = this.isLoggedInUser ? username : '';

    if (this.isLoggedInUser) {
      void this.playerStore.loadPlayer(this.username);
    } else {
      this.playerStore.clearPlayer();
    }

    return this.isLoggedInUser;
  }

  isLoggedIn(): boolean {
    // Implement your logic to check if the user is logged in
    return this.isLoggedInUser;
  }
}
