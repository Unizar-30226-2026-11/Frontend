import { Injectable, output } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  isLoggedInUser=false;
  constructor() {
    // Checking for existing authentication tokens or session data can be done here
  }
  LogIn(username: string, password: string): boolean {
    // Implement your authentication logic here
    this.isLoggedInUser = username === 'admin' && password === 'password'
    return this.isLoggedInUser;
  }

  isLoggedIn(): boolean {
    // Implement your logic to check if the user is logged in
    return this.isLoggedInUser;
  }
}
