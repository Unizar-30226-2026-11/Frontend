import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import type { LobbyEngine } from '../../../interfaces/game';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="game-card">
      <div
        class="lobby-mode-banner"
        [class.lobby-mode-banner-classic]="!isStellaLobby"
        [class.lobby-mode-banner-stella]="isStellaLobby"
        [attr.aria-label]="modeLabel"
      >
        @if (isStellaLobby) {
          <span class="lobby-backdrop-mark stella-star-one" aria-hidden="true">*</span>
          <span class="lobby-backdrop-mark stella-star-two" aria-hidden="true">*</span>
          <span class="lobby-backdrop-mark stella-star-three" aria-hidden="true">*</span>
          <span class="stella-horizon" aria-hidden="true"></span>
        } @else {
          <span class="classic-dawn-band classic-dawn-band-top" aria-hidden="true"></span>
          <span class="classic-dawn-band classic-dawn-band-bottom" aria-hidden="true"></span>
          <span class="classic-sun" aria-hidden="true"></span>
        }
        <span class="lobby-mode-title">{{ modeLabel }}</span>
      </div>
      <div class="game-title">
        <h2>{{ gameTitle }}</h2>
      </div>
      <div class="game-description">
        <p>{{ gameDescription }}</p>
      </div>
      <div>
        <a class="details-link" [routerLink]="['/games', gameId]">Ver mas</a>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .game-card {
      background: linear-gradient(180deg, #101218 0%, #0c0f15 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 18px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      color: #e6e7eb;
      transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .game-card:hover {
      transform: translateY(-4px);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    }

    .lobby-mode-banner {
      position: relative;
      width: 100%;
      height: 150px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid rgba(252, 238, 181, 0.18);
    }

    .lobby-mode-banner-classic {
      background-color: #e9b45b;
    }

    .lobby-mode-banner-stella {
      background-color: #101833;
    }

    .lobby-mode-title {
      color: #fceeb5;
      font-family: 'FuenteTitulo', 'FuenteDilana', serif;
      font-size: 42px;
      line-height: 1;
      text-shadow: 0 2px 5px rgba(0, 0, 0, 0.55);
      z-index: 3;
    }

    .lobby-backdrop-mark {
      position: absolute;
      color: rgba(252, 238, 181, 0.9);
      font-size: 22px;
      z-index: 1;
    }

    .stella-star-one {
      top: 18px;
      left: 44px;
    }

    .stella-star-two {
      top: 42px;
      right: 54px;
      font-size: 18px;
    }

    .stella-star-three {
      bottom: 38px;
      left: 118px;
      font-size: 15px;
    }

    .stella-horizon {
      position: absolute;
      left: -30px;
      right: -30px;
      bottom: -42px;
      height: 92px;
      background-color: #2b315d;
      transform: rotate(-3deg);
      opacity: 0.85;
    }

    .classic-sun {
      position: absolute;
      width: 84px;
      height: 84px;
      border-radius: 42px;
      background-color: #fceeb5;
      bottom: 22px;
      right: 44px;
      opacity: 0.9;
    }

    .classic-dawn-band {
      position: absolute;
      left: -20px;
      right: -20px;
      height: 58px;
      transform: rotate(-4deg);
    }

    .classic-dawn-band-top {
      top: 0;
      background-color: #8bb9b0;
      opacity: 0.45;
    }

    .classic-dawn-band-bottom {
      bottom: -18px;
      background-color: #d96f47;
      opacity: 0.35;
    }

    .game-title {
      padding: 16px 18px 6px;
    }

    .game-title h2 {
      margin: 0;
      font-size: 1.1rem;
      line-height: 1.25;
      letter-spacing: 0.01em;
    }

    .game-description {
      padding: 0 18px 18px;
      color: rgba(230, 231, 235, 0.8);
      flex: 1;
    }

    .game-description p {
      margin: 0;
      font-size: 0.95rem;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .details-link {
      margin-left: 10px;
      margin-bottom: 18px;
      display: inline-block;
      color: #8ab4f8;
      text-decoration: none;
      font-weight: 500;
      transition: color 0.2s;
      border-radius: 6px;
      padding: 6px 12px;
    }
    @media (max-width: 600px) {
      .game-title h2 {
        font-size: 1rem;
      }
    }
  `,
})
export class GameCard {
  @Input() gameTitle = '';
  @Input() gameImage = '';
  @Input() gameDescription = '';
  @Input() gameId = '';
  @Input() gameEngine: LobbyEngine | string = 'Classic';

  get isStellaLobby(): boolean {
    return this.gameEngine.trim().toUpperCase() === 'STELLA';
  }

  get modeLabel(): string {
    return this.isStellaLobby ? 'STELLA' : 'DIXIT';
  }
}
