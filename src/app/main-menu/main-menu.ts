import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MenuShowcase } from '../menu-showcase/menu-showcase';
import { MenuShowcaseState } from '../menu-showcase/menu-showcase-base';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [MenuShowcase],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.css',
})
export class MainMenu extends MenuShowcaseState {
  private readonly router = inject(Router);

  constructor() {
    super();
    void this.loadShowcaseData();
  }

  goToGames(): void {
    void this.router.navigate(['/games']);
  }

  goToStore(): void {
    void this.router.navigate(['/store']);
  }

  goToDeckBuilder(): void {
    void this.router.navigate(['/deck-builder']);
  }
}
