import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from '@angular/core';

type TrackCellTone =
  | 'normal'
  | 'gold'
  | 'pink'
  | 'blue'
  | 'goal'
  | 'wildcard'
  | 'event-back'
  | 'event-forward';

interface TrackCell {
  index: number;
  x: number;
  y: number;
  tone: TrackCellTone;
  badge?: string;
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
            [class.wildcard]="cell.tone === 'wildcard'"
            [class.event-back]="cell.tone === 'event-back'"
            [class.event-forward]="cell.tone === 'event-forward'"
            [style.left.%]="cell.x"
            [style.top.%]="cell.y"
          >
            <span class="cell-number">{{ cell.index + 1 }}</span>
            @if (cell.badge) {
              <span class="cell-badge" aria-hidden="true">{{ cell.badge }}</span>
            }
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

    .cell-number,
    .cell-badge {
      position: relative;
      z-index: 2;
    }

    .cell-badge {
      position: absolute;
      inset: auto auto 3px 50%;
      transform: translateX(-50%);
      font-size: clamp(13px, 1vw, 16px);
      font-weight: 900;
      line-height: 1;
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
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

    .track-cell.wildcard {
      --cell-base: #ffe58f;
      --cell-base-2: #f4a6ff;
      --cell-border: rgba(126, 45, 133, 0.78);
      --cell-inset: rgba(255, 252, 236, 0.82);
      color: #51136a;
      border-width: 2px;
      border-radius: 16px;
      transform: translate(-50%, -50%) rotate(45deg);
      box-shadow:
        0 0 0 2px rgba(255, 232, 166, 0.45),
        0 0 22px rgba(224, 117, 255, 0.48),
        0 10px 18px rgba(62, 19, 97, 0.28),
        inset 0 1px 0 var(--cell-inset),
        inset 0 -3px 8px rgba(43, 18, 61, 0.16);
      animation: wildcard-pulse 1.8s ease-in-out infinite;
    }

    .track-cell.wildcard .cell-number,
    .track-cell.wildcard .cell-badge {
      transform: rotate(-45deg);
    }

    .track-cell.wildcard::before {
      inset: 5px;
      border-width: 2px;
      border-color: rgba(95, 22, 112, 0.34);
    }

    .track-cell.wildcard::after {
      content: '';
      position: absolute;
      inset: 9px;
      border-radius: 10px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.48), rgba(255, 255, 255, 0) 70%);
      opacity: 0.7;
      pointer-events: none;
    }

    @keyframes wildcard-pulse {
      0%,
      100% {
        box-shadow:
          0 0 0 2px rgba(255, 232, 166, 0.45),
          0 0 18px rgba(224, 117, 255, 0.38),
          0 10px 18px rgba(62, 19, 97, 0.28),
          inset 0 1px 0 var(--cell-inset),
          inset 0 -3px 8px rgba(43, 18, 61, 0.16);
      }

      50% {
        box-shadow:
          0 0 0 3px rgba(255, 232, 166, 0.62),
          0 0 28px rgba(224, 117, 255, 0.62),
          0 12px 24px rgba(62, 19, 97, 0.34),
          inset 0 1px 0 var(--cell-inset),
          inset 0 -3px 8px rgba(43, 18, 61, 0.16);
      }
    }

    .track-cell.event-back {
      --cell-base: #ffe4cf;
      --cell-base-2: #f0a06d;
      --cell-border: rgba(150, 74, 33, 0.78);
      --cell-inset: rgba(255, 247, 238, 0.82);
      color: #662712;
      border-width: 2px;
      border-radius: 18px 10px 18px 10px;
      box-shadow:
        0 0 0 2px rgba(255, 224, 205, 0.34),
        0 12px 20px rgba(91, 34, 13, 0.24),
        inset 0 1px 0 var(--cell-inset),
        inset 0 -3px 10px rgba(99, 35, 21, 0.14);
    }

    .track-cell.event-forward {
      --cell-base: #dbf4de;
      --cell-base-2: #86cea0;
      --cell-border: rgba(35, 107, 61, 0.78);
      --cell-inset: rgba(244, 255, 247, 0.84);
      color: #184c2b;
      border-width: 2px;
      border-radius: 10px 18px 10px 18px;
      box-shadow:
        0 0 0 2px rgba(220, 247, 227, 0.34),
        0 12px 20px rgba(18, 79, 39, 0.2),
        inset 0 1px 0 var(--cell-inset),
        inset 0 -3px 10px rgba(23, 79, 40, 0.14);
    }

    .track-cell.event-back::before,
    .track-cell.event-forward::before {
      inset: 3px;
      border-width: 2px;
      border-style: dashed;
    }

    .track-cell.event-back::after,
    .track-cell.event-forward::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 50%;
      width: 18px;
      height: 18px;
      transform: translate(-50%, -38%);
      pointer-events: none;
      opacity: 0.28;
    }

    .track-cell.event-back::after {
      background:
        linear-gradient(135deg, transparent 46%, rgba(102, 39, 18, 0.95) 47% 53%, transparent 54%),
        linear-gradient(225deg, transparent 46%, rgba(102, 39, 18, 0.95) 47% 53%, transparent 54%);
      clip-path: polygon(0 50%, 55% 0, 55% 28%, 100% 28%, 100% 72%, 55% 72%, 55% 100%);
    }

    .track-cell.event-forward::after {
      background:
        linear-gradient(135deg, transparent 46%, rgba(24, 76, 43, 0.95) 47% 53%, transparent 54%),
        linear-gradient(225deg, transparent 46%, rgba(24, 76, 43, 0.95) 47% 53%, transparent 54%);
      clip-path: polygon(45% 0, 100% 50%, 45% 100%, 45% 72%, 0 72%, 0 28%, 45% 28%);
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
  @Input() wildcardCells: number[] = [];
  @Input() eventBackCells: number[] = [];
  @Input() eventForwardCells: number[] = [];

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
      badge: this.resolveCellBadge(index),
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
    if (this.wildcardCells.includes(index)) {
      return 'wildcard';
    }
    if (this.eventBackCells.includes(index)) {
      return 'event-back';
    }
    if (this.eventForwardCells.includes(index)) {
      return 'event-forward';
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

  private resolveCellBadge(index: number): string | undefined {
    if (this.wildcardCells.includes(index)) {
      return '*';
    }
    if (this.eventBackCells.includes(index)) {
      return '<<';
    }
    if (this.eventForwardCells.includes(index)) {
      return '>>';
    }

    return undefined;
  }
}
