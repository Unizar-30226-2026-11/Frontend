import { Component, inject } from '@angular/core';
import { NavigationBar } from './navigation-bar/navigation-bar';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationBar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);
  private readonly hiddenNavbarRoutes = new Set(['/register', '/login']);

  shouldShowNavigation(): boolean {
    const currentPath = this.router.url.split('?')[0].split('#')[0] || '/';
    if (currentPath === '/') {
      return false;
    }

    return !this.hiddenNavbarRoutes.has(currentPath);
  }
}
