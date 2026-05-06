import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="home-screen">
      <div class="hero-panel">
        <h1>A Tale of Recognition</h1>

        <div class="actions">
          <button class="top-button" routerLink="/register">Registrarse</button>
          <button routerLink="/login">Iniciar Sesión</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .home-screen {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: var(--page-padding-y) var(--page-padding-x);
      box-sizing: border-box;
      background:
        linear-gradient(rgba(8, 20, 17, 0.26), rgba(8, 20, 17, 0.38)),
        url('/background.jpg') no-repeat center center / cover;
    }

    .hero-panel {
      width: min(92vw, 42rem);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: clamp(1.5rem, 3vh, 2.5rem);
      padding: clamp(1.5rem, 4vh, 3rem) clamp(1rem, 3vw, 2rem);
    }

    h1 {
      margin: 0;
      font-style: normal;
      font-synthesis: none;
      font-size: var(--title-size-hero);
      font-family: "FuenteDilana", sans-serif;
      color: black;
      -webkit-text-stroke: clamp(1px, 0.18vw, 2px) #e8d9a8;
      text-align: center;
      line-height: 0.95;
    }

    .actions {
      width: min(100%, 22rem);
      display: grid;
      gap: clamp(0.9rem, 2vh, 1.25rem);
    }

    button {
      display: block;
      width: 100%;
      margin: 0 auto;
      padding: var(--button-padding-y) var(--button-padding-x);
      font-size: clamp(1.35rem, 2.4vw, 2rem);
      font-family: "FuenteDilana", sans-serif;
      border-radius: var(--button-radius);
      border: 2px solid gray;
      background-color: #05816d;
      color: black;
      cursor: pointer;
    }

    button:hover {
      background-color: #0a9e8c;
    }
  `,
})
export class Home {
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly playerStore = inject(PlayerStore);
}
