import { Component } from '@angular/core';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [],
  template: `
  <section class="menu-layout">
    <article class="panel my-cards">
      <header class="panel-header">
        <h2>Mis Cartas:</h2>
        <span class="badge">{{ collectedCards }}/{{ totalCards }}</span>
      </header>

      <div class="cards-scroll">
        @for (collection of collections; track collection.name) {
          <section>
            <header class="collection-header">
              <h3 class="collection-title">{{ collection.name }}</h3>
              <span class="badge small">{{ collection.collected }}/{{ collection.total }}</span>
            </header>

            <div class="cards-grid">
              @for (card of collection.cards; track card.id) {
                <article class="card-tile">
                  <img [src]="card.imageUrl" [alt]="'Carta ' + card.id" loading="lazy" />
                  @if (card.locked) {
                    <div class="locked-overlay" aria-label="Carta bloqueada">🔒</div>
                  }
                  <span class="card-id">#{{ card.id }}</span>
                </article>
              }
            </div>
          </section>
        }
      </div>
    </article>

    <article class="panel community-card">
      <h2>Carta de la Comunidad:</h2>
      <figure class="community-figure">
        <img [src]="currentCommunityCard.imageUrl" [alt]="currentCommunityCard.title" />
      </figure>
      <h3 class="community-title">{{ currentCommunityCard.title }}</h3>
      <div class="community-actions">
        <button type="button" class="round-btn" (click)="previousCommunityCard()" aria-label="Carta anterior">↑</button>
        <button type="button" class="round-btn" (click)="nextCommunityCard()" aria-label="Carta siguiente">↓</button>
        <span class="badge dark">{{ currentCommunityCard.id }}</span>
        <div class="stars" aria-label="Valorar carta">
          @for (star of [1, 2, 3, 4, 5]; track star) {
            <button
              type="button"
              class="star"
              [class.active]="star <= currentRating"
              (click)="setRating(star)"
              [attr.aria-label]="'Puntuar con ' + star + ' estrellas'">
              ★
            </button>
          }
        </div>
      </div>
    </article>

    <section class="right-column">
      <article class="panel room-panel">
        <header class="panel-header">
          <h2>Sala actual:</h2>
          <span class="badge">{{ playersInRoom }}/{{ roomCapacity }}</span>
        </header>
        <div class="room-scroll">
          @for (slot of roomSlots; track slot.slotId) {
            <div class="room-slot">
              <span class="slot-name">{{ slot.name }}</span>
              <span class="slot-state">{{ slot.state }}</span>
            </div>
          }
        </div>
      </article>

      <label class="select-label">
        Seleccion Mapa
        <select class="choice-select">
        @for (map of maps; track map) {
          <option>{{ map }}</option>
        }
        </select>
      </label>

      <label class="select-label">
        Seleccion Mazo
        <select class="choice-select">
        @for (deck of decks; track deck) {
          <option>{{ deck }}</option>
        }
        </select>
      </label>

      <button type="button" class="queue-btn">Buscar partida</button>
    </section>
  </section>
  `,
  styles: `
    :host {
      display: block;
      height: calc(100dvh - 72px);
      padding: 16px 20px 18px;
      box-sizing: border-box;
      overflow: hidden;
      --main-panel-height: calc(100dvh - 120px);
    }

    .menu-layout {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(300px, 430px) minmax(260px, 1fr);
      gap: 20px;
      align-items: start;
      height: 100%;
    }

    .panel {
      background: rgba(236, 234, 236, 0.92);
      border-radius: 10px;
      padding: 16px;
      box-sizing: border-box;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    h2 {
      margin: 0;
      font-size: clamp(1.4rem, 2vw, 2rem);
      font-weight: 500;
      color: #141414;
    }

    .badge {
      background: #101014;
      color: #f7f7f7;
      border-radius: 4px;
      font-weight: 700;
      font-size: 1.7rem;
      line-height: 1;
      padding: 6px 10px;
      white-space: nowrap;
    }

    .badge.small {
      font-size: 1rem;
      padding: 4px 8px;
    }

    .badge.dark {
      border-radius: 2px;
      font-size: 1.45rem;
    }

    .my-cards {
      height: var(--main-panel-height);
      display: flex;
      flex-direction: column;
    }

    .cards-scroll {
      overflow-y: auto;
      padding-right: 8px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .collection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 700;
    }

    .collection-title {
      color: #000 !important;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .card-tile {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      aspect-ratio: 3 / 4;
      background: #243428;
    }

    .locked-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 22, 19, 0.66);
      color: #f0dd9f;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.7rem;
      backdrop-filter: blur(1px);
    }

    .card-tile img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .card-id {
      position: absolute;
      left: 8px;
      bottom: 7px;
      background: rgba(15, 17, 20, 0.76);
      color: #fff;
      font-size: 0.75rem;
      border-radius: 5px;
      padding: 2px 6px;
    }

    .community-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
      height: var(--main-panel-height);
      background: linear-gradient(180deg, rgba(236, 231, 229, 0.94), rgba(220, 213, 209, 0.93));
      box-shadow: 0 0 22px rgba(214, 104, 70, 0.5);
    }

    .community-figure {
      margin: 0;
      border-radius: 22px;
      overflow: hidden;
      flex: 1;
      min-height: 0;
      background: #1e2226;
    }

    .community-figure img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .community-title {
      margin: 0;
      font-size: clamp(1.5rem, 2.2vw, 2.2rem);
      font-weight: 500;
    }

    .community-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .round-btn {
      width: 48px;
      height: 48px;
      border-radius: 999px;
      border: none;
      background: #13151a;
      color: #fff;
      font-size: 1.5rem;
      cursor: pointer;
    }

    .stars {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }

    .star {
      border: none;
      background: transparent;
      font-size: 2rem;
      line-height: 1;
      color: #a7a0b5;
      cursor: pointer;
      padding: 0;
    }

    .star.active {
      color: #1a1b20;
    }

    .right-column {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding-top: 2px;
    }

    .room-panel {
      height: 300px;
      display: flex;
      flex-direction: column;
    }

    .room-scroll {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-right: 6px;
    }

    .room-slot {
      display: flex;
      align-items: center;
      gap: 8px;
      border-radius: 8px;
      background: #b0b0b2;
      padding: 10px 10px;
      color: #0f1114;
      font-size: 1rem;
    }

    .slot-name {
      font-weight: 700;
    }

    .slot-state {
      margin-left: auto;
      font-size: 0.95rem;
    }

    .select-label {
      font-size: 0.95rem;
      color: #dde8cf;
      margin-top: 2px;
    }

    .choice-select {
      width: 100%;
      border: 1.5px solid rgba(24, 58, 52, 0.8);
      border-radius: 14px;
      background:
        linear-gradient(180deg, rgba(210, 237, 214, 0.94), rgba(185, 222, 196, 0.92));
      color: #16312d;
      font-size: 1.45rem;
      line-height: 1.15;
      font-weight: 600;
      padding: 12px 44px 12px 14px;
      box-sizing: border-box;
      appearance: none;
      box-shadow: 0 6px 14px rgba(8, 28, 28, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5);
      background-image:
        linear-gradient(45deg, transparent 50%, #244a43 50%),
        linear-gradient(135deg, #244a43 50%, transparent 50%),
        linear-gradient(180deg, rgba(210, 237, 214, 0.94), rgba(185, 222, 196, 0.92));
      background-position:
        calc(100% - 20px) calc(50% - 4px),
        calc(100% - 14px) calc(50% - 4px),
        0 0;
      background-size: 6px 6px, 6px 6px, 100% 100%;
      background-repeat: no-repeat;
    }

    .queue-btn {
      margin: 10px auto 0;
      border: 2px solid rgba(31, 55, 62, 0.45);
      border-radius: 16px;
      background: rgba(204, 232, 199, 0.9);
      color: #1a2629;
      font-size: 2rem;
      line-height: 1.1;
      padding: 12px 18px;
      cursor: pointer;
    }

    @media (max-width: 1250px) {
      :host {
        height: auto;
        min-height: calc(100dvh - 72px);
        overflow: visible;
      }

      .menu-layout {
        grid-template-columns: 1fr 1fr;
        height: auto;
      }

      .right-column {
        grid-column: span 2;
      }

      .my-cards {
        height: 540px;
      }

      .community-card {
        height: 540px;
      }
    }

    @media (max-width: 860px) {
      :host {
        padding: 14px 14px 18px;
      }

      .menu-layout {
        grid-template-columns: 1fr;
      }

      .right-column {
        grid-column: auto;
      }

      .my-cards {
        height: 460px;
      }

      .community-card {
        height: 460px;
      }

      .cards-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .choice-select {
        font-size: 1.35rem;
      }

      .queue-btn {
        font-size: 1.5rem;
      }
    }
  `,
})
export class MainMenu {
  totalCards = 256;
  collectedCards = 64;
  roomCapacity = 8;
  playersInRoom = 3;
  currentRating = 3;
  currentCardIndex = 0;

  maps = ['Costa Sumergida', 'Bosque Inverso', 'Ciudad Onirica'];
  decks = ['Surrealista', 'Sketch', 'Dream-Core'];

  roomSlots = [
    { slotId: 1, name: 'hachelpez', state: 'listo' },
    { slotId: 2, name: 'Azzal-e', state: 'en menu' },
    { slotId: 3, name: 'Natur4', state: 'eligiendo' },
    { slotId: 4, name: 'slot libre', state: 'abierto' },
    { slotId: 5, name: 'slot libre', state: 'abierto' },
    { slotId: 6, name: 'slot libre', state: 'abierto' },
    { slotId: 7, name: 'slot libre', state: 'abierto' },
    { slotId: 8, name: 'slot libre', state: 'abierto' },
  ];

  collections = [
    {
      name: 'Coleccion Surrealista',
      collected: 12,
      total: 16,
      cards: [
        { id: 101, imageUrl: 'https://picsum.photos/seed/atr-card-101/240/330', locked: true },
        { id: 102, imageUrl: 'https://picsum.photos/seed/atr-card-102/240/330', locked: false },
        { id: 103, imageUrl: 'https://picsum.photos/seed/atr-card-103/240/330', locked: false },
        { id: 104, imageUrl: 'https://picsum.photos/seed/atr-card-104/240/330', locked: true },
        { id: 105, imageUrl: 'https://picsum.photos/seed/atr-card-105/240/330', locked: false },
        { id: 106, imageUrl: 'https://picsum.photos/seed/atr-card-106/240/330', locked: false },
        { id: 107, imageUrl: 'https://picsum.photos/seed/atr-card-107/240/330', locked: true },
        { id: 108, imageUrl: 'https://picsum.photos/seed/atr-card-108/240/330', locked: false },
      ],
    },
    {
      name: 'Coleccion Sketch',
      collected: 8,
      total: 16,
      cards: [
        { id: 201, imageUrl: 'https://picsum.photos/seed/atr-card-201/240/330', locked: false },
        { id: 202, imageUrl: 'https://picsum.photos/seed/atr-card-202/240/330', locked: true },
        { id: 203, imageUrl: 'https://picsum.photos/seed/atr-card-203/240/330', locked: false },
        { id: 204, imageUrl: 'https://picsum.photos/seed/atr-card-204/240/330', locked: true },
        { id: 205, imageUrl: 'https://picsum.photos/seed/atr-card-205/240/330', locked: false },
        { id: 206, imageUrl: 'https://picsum.photos/seed/atr-card-206/240/330', locked: false },
        { id: 207, imageUrl: 'https://picsum.photos/seed/atr-card-207/240/330', locked: false },
        { id: 208, imageUrl: 'https://picsum.photos/seed/atr-card-208/240/330', locked: true },
      ],
    },
    {
      name: 'Coleccion Dream-Core',
      collected: 5,
      total: 16,
      cards: [
        { id: 301, imageUrl: 'https://picsum.photos/seed/atr-card-301/240/330', locked: false },
        { id: 302, imageUrl: 'https://picsum.photos/seed/atr-card-302/240/330', locked: false },
        { id: 303, imageUrl: 'https://picsum.photos/seed/atr-card-303/240/330', locked: true },
        { id: 304, imageUrl: 'https://picsum.photos/seed/atr-card-304/240/330', locked: false },
        { id: 305, imageUrl: 'https://picsum.photos/seed/atr-card-305/240/330', locked: true },
        { id: 306, imageUrl: 'https://picsum.photos/seed/atr-card-306/240/330', locked: false },
        { id: 307, imageUrl: 'https://picsum.photos/seed/atr-card-307/240/330', locked: false },
        { id: 308, imageUrl: 'https://picsum.photos/seed/atr-card-308/240/330', locked: true },
      ],
    },
  ];

  communityCards = [
    { id: 458, title: 'Donde nacen las sombras', imageUrl: 'https://picsum.photos/seed/atr-community-458/520/700' },
    { id: 459, title: 'Sueño fractal en rojo', imageUrl: 'https://picsum.photos/seed/atr-community-459/520/700' },
    { id: 460, title: 'La puerta que respira', imageUrl: 'https://picsum.photos/seed/atr-community-460/520/700' },
    { id: 461, title: 'Jardin de cristal roto', imageUrl: 'https://picsum.photos/seed/atr-community-461/520/700' },
  ];

  get currentCommunityCard() {
    return this.communityCards[this.currentCardIndex];
  }

  previousCommunityCard(): void {
    this.currentCardIndex = (this.currentCardIndex - 1 + this.communityCards.length) % this.communityCards.length;
  }

  nextCommunityCard(): void {
    this.currentCardIndex = (this.currentCardIndex + 1) % this.communityCards.length;
  }

  setRating(rating: number): void {
    this.currentRating = rating;
  }
}
