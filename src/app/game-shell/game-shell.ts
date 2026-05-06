import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';

import { Dixit } from '../dixit/dixit';
import { DixitStella } from '../dixit-stella/dixit-stella';
import { Auth } from '../services/auth';
import { DixitRealtime } from '../services/dixit-realtime';

type GameShellEngine = 'Classic' | 'Stella';

@Component({
  selector: 'app-game-shell',
  standalone: true,
  imports: [CommonModule, Dixit, DixitStella],
  template: `
    @if (resolvedEngine() === 'Stella') {
      <app-dixit-stella />
    } @else {
      <app-dixit />
    }
  `,
})
export class GameShell {
  private readonly auth = inject(Auth);
  private readonly realtime = inject(DixitRealtime);

  readonly resolvedEngine = computed<GameShellEngine>(() => {
    const state = this.realtime.gameState()?.state;
    const mode = typeof state?.['mode'] === 'string' ? state['mode'].trim().toUpperCase() : '';

    if (mode === 'STELLA') {
      return 'Stella';
    }

    if (mode === 'STANDARD') {
      return 'Classic';
    }

    return this.auth.activeGameEngine() ?? 'Classic';
  });
}
