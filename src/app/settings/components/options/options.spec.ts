import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '../../../services/auth';
import { BoardsPull } from '../../../services/boards-pull';
import { CardPull } from '../../../services/card-pull';
import { PlayerStore } from '../../../services/player-store';
import { Options } from './options';

describe('Options', () => {
  let component: Options;
  let fixture: ComponentFixture<Options>;
  let authSpy: jasmine.SpyObj<Auth>;
  let playerStoreSpy: jasmine.SpyObj<PlayerStore> & {
    player: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
  };
  let routerSpy: jasmine.SpyObj<Router>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;
  let boardsPullSpy: jasmine.SpyObj<BoardsPull>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<Auth>('Auth', ['logOut', 'isLoggedIn']);
    authSpy.isLoggedIn.and.returnValue(true);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);

    playerStoreSpy = Object.assign(
      jasmine.createSpyObj<PlayerStore>('PlayerStore', [
        'clearPlayer',
        'loadPlayer',
        'deleteAccount',
      ]),
      {
        player: signal({
          id: 'player-1',
          legacyUserId: 7,
          username: 'tester',
          email: 'tester@example.com',
          experienceLevel: 1,
          progressLevel: 25,
          state: 'CONNECTED' as const,
          personalState: 'CONNECTED',
          balance: 100,
        }),
        loading: signal(false),
        error: signal<string | null>(null),
      }
    );
    playerStoreSpy.loadPlayer.and.resolveTo();
    playerStoreSpy.deleteAccount.and.resolveTo('Cuenta eliminada correctamente');

    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo([
      { code: 'card-1', image: '', value: 'A', suit: 'DIXIT' },
      { code: 'card-2', image: '', value: 'B', suit: 'DIXIT' },
    ]);

    boardsPullSpy = jasmine.createSpyObj<BoardsPull>('BoardsPull', ['getUserBoards']);
    boardsPullSpy.getUserBoards.and.resolveTo([
      { id: 'board-1', image: '' },
      { id: 'board-2', image: '' },
      { id: 'board-3', image: '' },
    ]);

    await TestBed.configureTestingModule({
      imports: [Options],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authSpy },
        { provide: PlayerStore, useValue: playerStoreSpy },
        { provide: CardPull, useValue: cardPullSpy },
        { provide: BoardsPull, useValue: boardsPullSpy },
      ],
    }).compileComponents();
  });

  async function createComponent(): Promise<void> {
    fixture = TestBed.createComponent(Options);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('should create', async () => {
    await createComponent();

    expect(component).toBeTruthy();
  });

  it('loads cards and boards counters on init', async () => {
    await createComponent();

    expect(cardPullSpy.getCards).toHaveBeenCalled();
    expect(boardsPullSpy.getUserBoards).toHaveBeenCalled();
    expect(component.cardsCount()).toBe(2);
    expect(component.boardsCount()).toBe(3);
  });

  it('clears the player store before logging out', async () => {
    await createComponent();

    component.cerrarSesion();

    expect(playerStoreSpy.clearPlayer).toHaveBeenCalledBefore(authSpy.logOut);
    expect(authSpy.logOut).toHaveBeenCalledOnceWith();
    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/login']);
  });

  it('deletes the account after confirmation', async () => {
    await createComponent();
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      await component.eliminarCuenta();

      expect(playerStoreSpy.deleteAccount).toHaveBeenCalledOnceWith();
      expect(authSpy.logOut).toHaveBeenCalled();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    } finally {
      window.confirm = originalConfirm;
    }
  });
});
