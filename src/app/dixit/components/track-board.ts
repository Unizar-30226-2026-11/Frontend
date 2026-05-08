import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';

type TrackCellTone =
  | 'normal'
  | 'goal'
  | 'finish'
  | 'wildcard';

export type TrackBoardSpecialCellKind =
  | 'odd'
  | 'even'
  | 'bonus'
  | 'shuffle'
  | 'duel'
  | 'equilibrium';

export interface TrackBoardSpecialCell {
  index: number;
  kind: TrackBoardSpecialCellKind;
  badge: string;
  label: string;
}

interface TrackCell {
  index: number;
  x: number;
  y: number;
  tone: TrackCellTone;
  badge?: string;
  ariaLabel: string;
  specialKind?: TrackBoardSpecialCellKind;
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
  transitionDurationMs: number;
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './track-board.html',
  styleUrl: './track-board.css',
})
export class DixitTrackBoard implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
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
  private readonly manualMoveDurationMs = 240;
  private readonly externalMoveStepDurationMs = 460;
  private readonly externalMoveStepIntervalMs = 520;

  boardCells: TrackCell[] = [];
  internalTokens: InternalTrackToken[] = [];
  selectedTokenId = '';

  @Input() title = 'Tablero';
  @Input() subtitle = '';
  @Input() tokens: TrackBoardToken[] = [];
  @Input() boardImageUrl = '';
  @Input() showControls = true;
  @Input() interactive = true;
  @Input() cellPath: TrackPoint[] | null = null;
  @Input() wildcardCells: number[] = [];
  @Input() specialCells: readonly TrackBoardSpecialCell[] = [];

  @Output() readonly tokensChanged = new EventEmitter<TrackBoardToken[]>();

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['cellPath'] ||
      changes['wildcardCells'] ||
      changes['specialCells'] ||
      this.boardCells.length === 0
    ) {
      this.boardCells = this.buildBoardCells();
    }

    if (changes['tokens'] || changes['cellPath']) {
      this.syncTokensFromInputs(this.tokens);
      if (!this.internalTokens.some((token) => token.id === this.selectedTokenId)) {
        this.selectedTokenId = this.internalTokens[0]?.id ?? '';
      }
    }

    this.cdr.markForCheck();
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
    this.cdr.markForCheck();
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

  get resolvedBoardImageUrl(): string {
    return this.boardImageUrl.trim();
  }

  private animateTokenMove(tokenId: string, steps: number): void {
    if (steps <= 0 || this.boardCells.length === 0) {
      return;
    }

    this.movingTokenIds.add(tokenId);
    this.cdr.markForCheck();
    let pendingSteps = steps;

    const walk = (): void => {
      this.internalTokens = this.internalTokens.map((entry) => {
        if (entry.id !== tokenId) {
          return entry;
        }

        return {
          ...entry,
          position: (entry.position + 1) % this.boardCells.length,
          transitionDurationMs: this.manualMoveDurationMs,
        };
      });

      pendingSteps -= 1;
      if (pendingSteps > 0) {
        const timer = setTimeout(walk, 260);
        this.moveTimers.push(timer);
        this.cdr.markForCheck();
        return;
      }

      this.movingTokenIds.delete(tokenId);
      this.emitTokensChanged();
      this.cdr.markForCheck();
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

  private syncTokensFromInputs(tokens: TrackBoardToken[]): void {
    const nextTokens = tokens.map((token) => {
      const tokenImage = token.image && token.image.trim().length > 0
        ? token.image
        : this.buildTokenImage(token.color, token.name.charAt(0).toUpperCase());

      return {
        ...token,
        position: this.normalizePosition(token.position),
        image: tokenImage,
        transitionDurationMs: this.manualMoveDurationMs,
      };
    });

    if (this.internalTokens.length === 0 || this.boardCells.length === 0) {
      this.internalTokens = nextTokens;
      return;
    }

    const currentTokenIds = new Set(this.internalTokens.map((token) => token.id));
    const nextTokenIds = new Set(nextTokens.map((token) => token.id));
    const sameTokenSet =
      currentTokenIds.size === nextTokenIds.size &&
      Array.from(currentTokenIds).every((tokenId) => nextTokenIds.has(tokenId));

    if (!sameTokenSet) {
      this.internalTokens = nextTokens;
      return;
    }

    const currentPositions = new Map(
      this.internalTokens.map((token) => [token.id, token.position])
    );
    this.internalTokens = nextTokens.map((token) => ({
      ...token,
      position: currentPositions.get(token.id) ?? token.position,
    }));

    for (const token of nextTokens) {
      const currentPosition = currentPositions.get(token.id);
      if (
        typeof currentPosition !== 'number' ||
        currentPosition === token.position ||
        this.movingTokenIds.has(token.id)
      ) {
        continue;
      }

      this.animateTokenToPosition(token.id, token.position, false);
    }
  }

  private animateTokenToPosition(
    tokenId: string,
    targetPosition: number,
    emitChanges: boolean
  ): void {
    if (this.boardCells.length === 0) {
      return;
    }

    const token = this.internalTokens.find((entry) => entry.id === tokenId);
    if (!token || token.position === targetPosition) {
      return;
    }

    this.movingTokenIds.add(tokenId);
    this.cdr.markForCheck();

    const walk = (): void => {
      const activeToken = this.internalTokens.find((entry) => entry.id === tokenId);
      if (!activeToken) {
        this.movingTokenIds.delete(tokenId);
        return;
      }

      if (activeToken.position === targetPosition) {
        this.movingTokenIds.delete(tokenId);
        if (emitChanges) {
          this.emitTokensChanged();
        }
        this.cdr.markForCheck();
        return;
      }

      this.internalTokens = this.internalTokens.map((entry) => {
        if (entry.id !== tokenId) {
          return entry;
        }

        return {
          ...entry,
          position: (entry.position + 1) % this.boardCells.length,
          transitionDurationMs: this.externalMoveStepDurationMs,
        };
      });
      this.cdr.markForCheck();

      const timer = setTimeout(walk, this.externalMoveStepIntervalMs);
      this.moveTimers.push(timer);
    };

    walk();
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
    const specialCellsByIndex = new Map(this.specialCells.map((cell) => [cell.index, cell]));

    return path.map((point, index) => {
      const tone = this.resolveCellTone(index, path.length - 1);
      const specialCell = specialCellsByIndex.get(index);

      return {
        index,
        x: 6.5 + (point.col / maxCol) * 87,
        y: 10 + (point.row / maxRow) * 79,
        tone,
        badge: specialCell?.badge ?? this.resolveCellBadge(index, path.length - 1),
        ariaLabel: this.resolveCellAriaLabel(index, tone, path.length - 1, specialCell),
        specialKind: specialCell?.kind,
      };
    });
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
    points.push({ col: 5, row: 2 });

    return points;
  }

  private resolveCellTone(index: number, finishIndex: number): TrackCellTone {
    if (index === finishIndex) {
      return 'finish';
    }
    if (index === 0) {
      return 'goal';
    }
    if (this.wildcardCells.includes(index)) {
      return 'wildcard';
    }
    return 'normal';
  }

  private resolveCellBadge(index: number, finishIndex: number): string | undefined {
    if (index === finishIndex) {
      return 'FIN';
    }
    if (this.wildcardCells.includes(index)) {
      return '*';
    }

    return undefined;
  }

  private resolveCellAriaLabel(
    index: number,
    tone: TrackCellTone,
    finishIndex: number,
    specialCell?: TrackBoardSpecialCell
  ): string {
    const visibleNumber = index;

    if (index === finishIndex) {
      return `Casilla ${visibleNumber}, final`;
    }
    if (specialCell) {
      return `Casilla ${visibleNumber}, ${specialCell.label}`;
    }
    if (tone === 'wildcard') {
      return `Casilla ${visibleNumber}, comodin`;
    }

    return `Casilla ${visibleNumber}`;
  }
}
