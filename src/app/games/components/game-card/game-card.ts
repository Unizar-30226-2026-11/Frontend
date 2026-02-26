import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="game-card">
      <div class="game-image">
        <img [src]="gameImage" alt="{{ gameTitle }}" />
      </div>
      <div class="game-title">
        <h2>{{ gameTitle }}</h2>
      </div>
      <div class="game-description">
        <p>{{ gameDescription }}</p>
      </div>
      <div>  
        <a class="details-link" [routerLink]="['/games', this.gameId]">Ver mas</a>
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

    .game-image {
      position: relative;
      height: clamp(180px, 24vw, 240px);
      overflow: hidden;
      background: #101826;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .game-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
      filter: saturate(1.08) contrast(1.03);
    }

    .game-image::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(0, 0, 0, 0) 40%, rgba(0, 0, 0, 0.6) 100%);
      pointer-events: none;
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
  @Input() gameTitle: string = '';
  @Input() gameImage: string = '';
  @Input() gameDescription: string = '';
  @Input() gameId: number = 0;
  constructor() {}
}
