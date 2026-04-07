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
  templateUrl: './track-board.html',
  styleUrl: './track-board.css',
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
      x: 6.5 + (point.col / maxCol) * 87,
      y: 10 + (point.row / maxRow) * 79,
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
