import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';

type TrackCellTone = 'normal' | 'gold' | 'pink' | 'blue' | 'goal';

interface TrackCell {
  index: number;
  x: number;
  y: number;
  tone: TrackCellTone;
}

interface TrackPoint {
  col: number;
  row: number;
}

interface TokenAnchor {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

interface InternalTrackToken extends TrackBoardToken {
  image: string;
}

export interface TrackBoardToken {
  id: string;
  name: string;
  color: string;
  position: number;
  image?: string;
}

@Component({
  selector: 'app-dixit-track-board',
  standalone: true,
  template: `
    <article class="board-panel">
      <header class="board-header">
        <h2>{{ title }}</h2>
        @if (subtitle) {
          <p>{{ subtitle }}</p>
        }
      </header>

      <div class="track-board">
        @for (cell of boardCells; track cell.index) {
          <div
            class="track-cell"
            [class.goal]="cell.tone === 'goal'"
            [class.gold]="cell.tone === 'gold'"
            [class.pink]="cell.tone === 'pink'"
            [class.blue]="cell.tone === 'blue'"
            [style.left.%]="cell.x"
            [style.top.%]="cell.y"
          >
            {{ cell.index + 1 }}
          </div>
        }

        @for (token of internalTokens; track token.id) {
          @let anchor = getTokenAnchor(token);
          <button
            type="button"
            class="token-piece"
            [class.active]="selectedTokenId === token.id"
            [class.moving]="isTokenMoving(token.id)"
            [style.left.%]="anchor.x"
            [style.top.%]="anchor.y"
            [style.--offset-x.px]="anchor.offsetX"
            [style.--offset-y.px]="anchor.offsetY"
            (click)="onTokenSelected(token.id)"
          >
            <img draggable="false" [src]="token.image" [alt]="'Ficha ' + token.name" />
          </button>
        }

        <div class="board-overlay-slot">
          <ng-content select="[board-overlay]"></ng-content>
        </div>
      </div>

      @if (showControls) {
        <div class="board-controls">
          <div class="token-selector">
            @for (token of internalTokens; track token.id) {
              <button
                type="button"
                [class.active]="selectedTokenId === token.id"
                (click)="onTokenSelected(token.id)"
              >
                <span class="dot" [style.background]="token.color"></span>
                {{ token.name }}
              </button>
            }
          </div>

          <div class="move-actions">
            <button
              type="button"
              (click)="moveSelectedToken(1)"
              [disabled]="!interactive || isAnyTokenMoving()"
            >
              +1
            </button>
            <button
              type="button"
              (click)="moveSelectedToken(3)"
              [disabled]="!interactive || isAnyTokenMoving()"
            >
              +3
            </button>
            <button
              type="button"
              (click)="rollAndMoveSelected()"
              [disabled]="!interactive || isAnyTokenMoving()"
            >
              Dado
            </button>
            <button
              type="button"
              (click)="simulateRound()"
              [disabled]="!interactive || isAnyTokenMoving()"
            >
              Simular ronda
            </button>
          </div>
        </div>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .board-panel {
      width: 100%;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 14px;
      padding: 16px;
      box-sizing: border-box;
    }

    h2 {
      margin-top: 0;
      margin-bottom: 10px;
    }

    .board-header p {
      margin: 0 0 10px;
      opacity: 0.9;
    }

    .track-board {
      position: relative;
      width: 100%;
      aspect-ratio: 15 / 6;
      border-radius: 14px;
      overflow: hidden;
      background:
        radial-gradient(circle at 20% 20%, rgba(179, 231, 212, 0.32) 0%, rgba(0, 0, 0, 0) 44%),
        radial-gradient(circle at 82% 72%, rgba(71, 126, 210, 0.28) 0%, rgba(0, 0, 0, 0) 42%),
        linear-gradient(125deg, rgba(19, 80, 88, 0.9), rgba(14, 31, 62, 0.95));
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .board-overlay-slot {
      position: absolute;
      inset: 0;
      z-index: 5;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(14px, 2vw, 28px);
      box-sizing: border-box;
    }

    .track-cell {
      --cell-base: #f7f8fb;
      --cell-base-2: #e9edf4;
      --cell-border: rgba(56, 63, 78, 0.5);
      --cell-inset: rgba(255, 255, 255, 0.55);
      position: absolute;
      width: clamp(36px, 4.3vw, 54px);
      aspect-ratio: 1;
      transform: translate(-50%, -50%);
      isolation: isolate;
      overflow: hidden;
      border-radius: 12px;
      background:
        linear-gradient(145deg, var(--cell-base), var(--cell-base-2)),
        repeating-linear-gradient(
          45deg,
          rgba(255, 255, 255, 0.14) 0 6px,
          rgba(0, 0, 0, 0.04) 6px 12px
        );
      color: #1a1f30;
      border: 1px solid var(--cell-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "FuenteDilana", sans-serif;
      font-weight: 700;
      font-size: clamp(11px, 1vw, 14px);
      letter-spacing: 0.2px;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
      box-shadow:
        0 8px 14px rgba(0, 0, 0, 0.24),
        inset 0 1px 0 var(--cell-inset),
        inset 0 -3px 8px rgba(20, 24, 35, 0.15);
      user-select: none;
      transition:
        transform 180ms ease,
        filter 180ms ease,
        box-shadow 180ms ease;
    }

    .track-cell::before {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 8px;
      border: 1px solid rgba(35, 44, 60, 0.2);
      pointer-events: none;
      z-index: 1;
    }

    .track-cell:hover {
      transform: translate(-50%, -50%) scale(1.02);
      filter: brightness(1.03);
    }

    .track-cell.goal {
      --cell-base: #f3e6a0;
      --cell-base-2: #dcc168;
      --cell-border: rgba(102, 79, 15, 0.58);
      --cell-inset: rgba(255, 250, 216, 0.62);
    }

    .track-cell.gold {
      --cell-base: #f6d8b4;
      --cell-base-2: #ebb67f;
      --cell-border: rgba(130, 76, 28, 0.52);
      --cell-inset: rgba(255, 236, 214, 0.62);
    }

    .track-cell.pink {
      --cell-base: #f0c3ea;
      --cell-base-2: #dd9fd5;
      --cell-border: rgba(114, 51, 104, 0.52);
      --cell-inset: rgba(255, 228, 250, 0.62);
    }

    .track-cell.blue {
      --cell-base: #c2cbed;
      --cell-base-2: #97a6da;
      --cell-border: rgba(58, 70, 126, 0.56);
      --cell-inset: rgba(228, 236, 255, 0.62);
    }

    .token-piece {
      position: absolute;
      width: clamp(20px, 2.3vw, 30px);
      height: clamp(20px, 2.3vw, 30px);
      border: 0;
      border-radius: 999px;
      background: transparent;
      padding: 0;
      cursor: pointer;
      transform: translate(-50%, -50%) translate(var(--offset-x, 0px), var(--offset-y, 0px));
      transition:
        left 300ms cubic-bezier(0.22, 1, 0.36, 1),
        top 300ms cubic-bezier(0.22, 1, 0.36, 1),
        transform 180ms ease,
        filter 180ms ease;
      z-index: 4;
    }

    .token-piece img {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.92);
      box-shadow: 0 2px 9px rgba(0, 0, 0, 0.34);
    }

    .token-piece.active {
      z-index: 6;
      transform: translate(-50%, -50%) translate(var(--offset-x, 0px), var(--offset-y, 0px))
        scale(1.1);
      filter: brightness(1.05);
    }

    .token-piece.moving {
      z-index: 7;
    }

    .board-controls {
      margin-top: 10px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }

    .token-selector,
    .move-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    button {
      border: 0;
      border-radius: 999px;
      padding: 9px 14px;
      cursor: pointer;
      font-weight: 600;
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .token-selector button {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: rgba(255, 255, 255, 0.17);
      color: #fff;
    }

    .token-selector button.active {
      background: rgba(255, 255, 255, 0.94);
      color: #1b2430;
    }

    .dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      display: inline-block;
    }

    @media (max-width: 700px) {
      .board-controls {
        align-items: flex-start;
        flex-direction: column;
      }
    }
  `,
})
export class DixitTrackBoard implements OnChanges, OnDestroy {
  private readonly stackOffsets = [
    { x: 0, y: 0 },
    { x: 12, y: 0 },
    { x: -12, y: 0 },
    { x: 0, y: 12 },
    { x: 0, y: -12 },
    { x: 12, y: 12 },
  ];
  private readonly moveTimers: ReturnType<typeof setTimeout>[] = [];
  private readonly movingTokenIds = new Set<string>();

  boardCells: TrackCell[] = [];
  internalTokens: InternalTrackToken[] = [];
  selectedTokenId = '';

  @Input() title = 'Tablero';
  @Input() subtitle = '';
  @Input() tokens: TrackBoardToken[] = [];
  @Input() showControls = true;
  @Input() interactive = true;
  @Input() cellPath: TrackPoint[] | null = null;

  @Output() readonly tokensChanged = new EventEmitter<TrackBoardToken[]>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cellPath'] || this.boardCells.length === 0) {
      this.boardCells = this.buildBoardCells();
    }

    if (changes['tokens'] || changes['cellPath']) {
      this.internalTokens = this.buildInternalTokens(this.tokens);
      if (!this.internalTokens.some((token) => token.id === this.selectedTokenId)) {
        this.selectedTokenId = this.internalTokens[0]?.id ?? '';
      }
    }
  }

  ngOnDestroy(): void {
    for (const timer of this.moveTimers) {
      clearTimeout(timer);
    }
    this.moveTimers.length = 0;
    this.movingTokenIds.clear();
  }

  onTokenSelected(tokenId: string): void {
    if (!this.interactive) {
      return;
    }
    this.selectedTokenId = tokenId;
  }

  moveSelectedToken(steps: number): void {
    const selectedId = this.selectedTokenId;
    if (!selectedId || steps <= 0 || this.movingTokenIds.has(selectedId)) {
      return;
    }
    this.animateTokenMove(selectedId, steps);
  }

  rollAndMoveSelected(): void {
    const steps = Math.floor(Math.random() * 6) + 1;
    this.moveSelectedToken(steps);
  }

  simulateRound(): void {
    if (this.isAnyTokenMoving()) {
      return;
    }

    for (let index = 0; index < this.internalTokens.length; index += 1) {
      const token = this.internalTokens[index];
      const steps = Math.floor(Math.random() * 6) + 1;
      const timer = setTimeout(() => this.animateTokenMove(token.id, steps), index * 260);
      this.moveTimers.push(timer);
    }
  }

  getTokenAnchor(token: InternalTrackToken): TokenAnchor {
    const cell = this.boardCells[token.position] ?? this.boardCells[0];
    const sameCellTokens = this.internalTokens
      .filter((entry) => entry.position === token.position)
      .sort((left, right) => left.id.localeCompare(right.id));
    const stackIndex = sameCellTokens.findIndex((entry) => entry.id === token.id);
    const offset = this.stackOffsets[stackIndex % this.stackOffsets.length];

    return {
      x: cell.x,
      y: cell.y,
      offsetX: offset?.x ?? 0,
      offsetY: offset?.y ?? 0,
    };
  }

  isTokenMoving(tokenId: string): boolean {
    return this.movingTokenIds.has(tokenId);
  }

  isAnyTokenMoving(): boolean {
    return this.movingTokenIds.size > 0;
  }

  private animateTokenMove(tokenId: string, steps: number): void {
    if (steps <= 0 || this.boardCells.length === 0) {
      return;
    }

    this.movingTokenIds.add(tokenId);
    let pendingSteps = steps;

    const walk = (): void => {
      this.internalTokens = this.internalTokens.map((entry) => {
        if (entry.id !== tokenId) {
          return entry;
        }

        return {
          ...entry,
          position: (entry.position + 1) % this.boardCells.length,
        };
      });

      pendingSteps -= 1;
      if (pendingSteps > 0) {
        const timer = setTimeout(walk, 260);
        this.moveTimers.push(timer);
        return;
      }

      this.movingTokenIds.delete(tokenId);
      this.emitTokensChanged();
    };

    walk();
  }

  private emitTokensChanged(): void {
    this.tokensChanged.emit(
      this.internalTokens.map((token) => ({
        id: token.id,
        name: token.name,
        color: token.color,
        position: token.position,
        image: token.image,
      }))
    );
  }

  private buildInternalTokens(tokens: TrackBoardToken[]): InternalTrackToken[] {
    return tokens.map((token) => {
      const tokenImage = token.image && token.image.trim().length > 0
        ? token.image
        : this.buildTokenImage(token.color, token.name.charAt(0).toUpperCase());

      return {
        ...token,
        position: this.normalizePosition(token.position),
        image: tokenImage,
      };
    });
  }

  private normalizePosition(position: number): number {
    if (this.boardCells.length === 0) {
      return 0;
    }
    if (position < 0) {
      return 0;
    }
    if (position >= this.boardCells.length) {
      return position % this.boardCells.length;
    }
    return position;
  }

  private buildTokenImage(color: string, label: string): string {
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
        <circle cx='32' cy='32' r='28' fill='${color}' stroke='white' stroke-width='4' />
        <text x='32' y='39' text-anchor='middle' fill='white' font-size='24'
          font-family='Arial, sans-serif' font-weight='700'>${label}</text>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private buildBoardCells(): TrackCell[] {
    const path = this.cellPath && this.cellPath.length > 0 ? this.cellPath : this.buildDefaultCellPath();
    const maxCol = Math.max(...path.map((point) => point.col), 1);
    const maxRow = Math.max(...path.map((point) => point.row), 1);

    return path.map((point, index) => ({
      index,
      x: 5 + (point.col / maxCol) * 90,
      y: 8 + (point.row / maxRow) * 84,
      tone: this.resolveCellTone(index),
    }));
  }

  private buildDefaultCellPath(): TrackPoint[] {
    const points: TrackPoint[] = [];

    for (let col = 0; col <= 14; col += 1) {
      points.push({ col, row: 5 });
    }
    for (let row = 4; row >= 0; row -= 1) {
      points.push({ col: 14, row });
    }
    for (let col = 13; col >= 0; col -= 1) {
      points.push({ col, row: 0 });
    }
    for (let row = 1; row <= 3; row += 1) {
      points.push({ col: 0, row });
    }

    points.push({ col: 1, row: 3 });
    points.push({ col: 2, row: 3 });
    points.push({ col: 3, row: 3 });
    points.push({ col: 4, row: 3 });
    points.push({ col: 4, row: 2 });
    points.push({ col: 3, row: 2 });

    return points;
  }

  private resolveCellTone(index: number): TrackCellTone {
    if (index === 0) {
      return 'goal';
    }
    if (index % 10 === 3) {
      return 'pink';
    }
    if (index % 7 === 0) {
      return 'gold';
    }
    if (index % 5 === 0) {
      return 'blue';
    }
    return 'normal';
  }
}
