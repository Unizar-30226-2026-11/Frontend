import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { LobbyMenu } from './lobby-menu';
import { Game } from '../interfaces/game';
import { CardCollection, CollectionCard, CollectionsPull } from '../services/collections-pull';
import { Auth } from '../services/auth';
import { DecksPull } from '../services/decks-pull';
import { DixitRealtime } from '../services/dixit-realtime';
import { GamesPull } from '../services/games-pull';
import { CardPull } from '../services/card-pull';

describe('LobbyMenu', () => {
  let component: LobbyMenu;
  let fixture: ComponentFixture<LobbyMenu>;
  let collectionsPullSpy: jasmine.SpyObj<CollectionsPull>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;
  let decksPullSpy: jasmine.SpyObj<DecksPull>;
  let gamesPullSpy: jasmine.SpyObj<GamesPull>;
  let realtimeSpy: jasmine.SpyObj<DixitRealtime>;
  let routerSpy: jasmine.SpyObj<Router>;
  let authStub: {
    isLoggedIn: jasmine.Spy<() => boolean>;
    session: jasmine.Spy<() => { user: { id: string } } | null>;
  };

  beforeEach(async () => {
    collectionsPullSpy = jasmine.createSpyObj<CollectionsPull>('CollectionsPull', [
      'getCollections',
      'getCollectionCards',
    ]);
    collectionsPullSpy.getCollections.and.resolveTo(createCollectionsFixture());
    collectionsPullSpy.getCollectionCards.and.resolveTo(createCollectionCardsFixture());
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(createOwnedCardsFixture());
    decksPullSpy = jasmine.createSpyObj<DecksPull>('DecksPull', ['getUserDecks', 'updateUserDeck']);
    decksPullSpy.getUserDecks.and.resolveTo(createUserDecksFixture());
    decksPullSpy.updateUserDeck.and.callFake(async (deckId: string, payload: { name: string; cardIds: string[] }) => ({
      id: deckId,
      name: payload.name,
      cardIds: [...payload.cardIds],
    }));
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', [
      'getGameDetails',
      'startLobby',
    ]);
    gamesPullSpy.getGameDetails.and.resolveTo(createLobbyFixture());
    gamesPullSpy.startLobby.and.resolveTo({
      message: 'Partida iniciada',
      lobbyCode: 'A1B2',
      status: 'starting',
      route: '/game/A1B2',
    });
    realtimeSpy = jasmine.createSpyObj<DixitRealtime>('DixitRealtime', [
      'ensureLobbyConnection',
      'joinLobby',
      'leaveLobby',
      'startLobby',
      'lobbyState',
      'activeLobbyCode',
      'lastError',
      'gameStarted',
      'connectionStatus',
    ]);
    realtimeSpy.ensureLobbyConnection.and.resolveTo();
    realtimeSpy.joinLobby.and.resolveTo();
    realtimeSpy.lobbyState.and.returnValue(null);
    realtimeSpy.activeLobbyCode.and.returnValue('');
    realtimeSpy.lastError.and.returnValue('');
    realtimeSpy.gameStarted.and.returnValue(null);
    realtimeSpy.connectionStatus.and.returnValue('idle');
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    routerSpy.navigateByUrl.and.resolveTo(true);
    authStub = {
      isLoggedIn: jasmine.createSpy().and.returnValue(true),
      session: jasmine.createSpy().and.returnValue({ user: { id: 'u_111' } }),
    };

    await TestBed.configureTestingModule({
      imports: [LobbyMenu],
      providers: [
        { provide: CollectionsPull, useValue: collectionsPullSpy },
        { provide: CardPull, useValue: cardPullSpy },
        { provide: DecksPull, useValue: decksPullSpy },
        { provide: GamesPull, useValue: gamesPullSpy },
        { provide: DixitRealtime, useValue: realtimeSpy },
        { provide: Router, useValue: routerSpy },
        { provide: Auth, useValue: authStub },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'A1B2' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LobbyMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads collections on init', () => {
    expect(collectionsPullSpy.getCollections).toHaveBeenCalledTimes(1);
    expect(cardPullSpy.getCards).toHaveBeenCalledTimes(1);
    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledTimes(2);
    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledWith('col_set1');
    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledWith('col_set2');
    expect(component.collections.length).toBe(2);
    expect(component.collections.every((collection) => !collection.expanded)).toBeTrue();
    expect(component.collectedCards).toBe(2);
    expect(component.totalCards).toBe(12);
  });

  it('reuses precached collection cards after expanding it', async () => {
    await component.toggleCollection('col_set1');

    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledTimes(2);
    expect(component.collections[0].expanded).toBeTrue();
    expect(component.collections[0].cardsLoaded).toBeTrue();
    expect(component.collections[0].cards.length).toBe(2);
    expect(component.collections[0].collected).toBe(1);
    expect(component.collections[0].cards[0].locked).toBeFalse();
    expect(component.collections[0].cards[1].locked).toBeTrue();
  });

  it('shows the correct collection counters before opening a dropdown', async () => {
    cardPullSpy.getCards.and.resolveTo([
      {
        code: 'owned-card-alpha',
        image: '/assets/card-1.png',
        value: 'Dragon de Fuego',
        suit: 'DIXIT',
      },
    ]);
    collectionsPullSpy.getCollectionCards.and.callFake(async (collectionId: string) =>
      collectionId === 'col_set1'
        ? [
            {
              idCard: 'owned-card-alpha',
              idCollection: 'col_set1',
              rarity: 'Rara',
              title: 'Dragon de Fuego',
              imageUrl: '/assets/card-1.png',
            },
          ]
        : []
    );

    const freshFixture = TestBed.createComponent(LobbyMenu);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();
    await freshFixture.whenStable();

    expect(freshComponent.collections[0].collected).toBe(1);
    expect(freshComponent.collections[1].collected).toBe(0);
  });

  it('loads lobby players from the route id', () => {
    expect(gamesPullSpy.getGameDetails).toHaveBeenCalledOnceWith('A1B2', {
      forceRefresh: true,
    });
    expect(realtimeSpy.ensureLobbyConnection).toHaveBeenCalledOnceWith('A1B2');
    expect(realtimeSpy.joinLobby).not.toHaveBeenCalled();
    expect(decksPullSpy.getUserDecks).toHaveBeenCalledOnceWith({ forceRefresh: true });
    expect(component.playersInRoom).toBe(2);
    expect(component.roomCapacity).toBe(4);
    expect(component.roomSlots).toEqual([
      { slotId: 1, name: 'u_111', state: 'anfitrion' },
      { slotId: 2, name: 'u_222', state: 'jugador' },
      { slotId: 3, name: 'slot libre', state: 'abierto' },
      { slotId: 4, name: 'slot libre', state: 'abierto' },
    ]);
  });

  it('renders the lobby as soon as the REST details arrive without waiting for realtime recovery', async () => {
    let resolveRealtimeConnection = (): void => {};
    realtimeSpy.ensureLobbyConnection.and.returnValue(
      new Promise<void>((resolve) => {
        resolveRealtimeConnection = resolve;
      })
    );

    const freshFixture = TestBed.createComponent(LobbyMenu);
    const freshComponent = freshFixture.componentInstance;
    await freshComponent['loadLobby']('A1B2');

    expect(freshComponent.roomLoading).toBeFalse();
    expect(freshComponent.playersInRoom).toBe(2);
    expect(freshComponent.roomSlots.length).toBe(4);
    expect(freshComponent.joinLobbyLoading).toBeTrue();

    resolveRealtimeConnection();
    await Promise.resolve();
  });

  it('shows the host action when the authenticated player owns the lobby', () => {
    expect(component.isHost).toBeTrue();
    expect(component.primaryActionButtonText).toBe('Empezar partida');
    expect(component.shouldShowJoinOverlay).toBeTrue();
  });

  it('does not restore realtime when the authenticated user is not in the lobby', async () => {
    authStub.session.and.returnValue({ user: { id: 'u_999' } });
    gamesPullSpy.getGameDetails.calls.reset();
    realtimeSpy.ensureLobbyConnection.calls.reset();

    const freshFixture = TestBed.createComponent(LobbyMenu);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();
    await freshFixture.whenStable();

    expect(gamesPullSpy.getGameDetails).toHaveBeenCalledOnceWith('A1B2', {
      forceRefresh: true,
    });
    expect(realtimeSpy.ensureLobbyConnection).not.toHaveBeenCalled();
    expect(freshComponent.shouldShowJoinOverlay).toBeTrue();
  });

  it('shows the ready action for non-host players', () => {
    authStub.session.and.returnValue({ user: { id: 'u_222' } });

    expect(component.isHost).toBeFalse();
    expect(component.primaryActionButtonText).toBe('Listo');
  });

  it('joins the lobby only when the user requests it', async () => {
    await component.joinCurrentLobby();

    expect(realtimeSpy.joinLobby).toHaveBeenCalledOnceWith('A1B2');
  });

  it('leaves the lobby and returns to the lobby list', async () => {
    await component.leaveCurrentLobby();

    expect(realtimeSpy.leaveLobby).toHaveBeenCalledTimes(1);
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/games');
  });

  it('shows join errors only in the overlay when the explicit join action fails', async () => {
    realtimeSpy.joinLobby.and.rejectWith(new Error('Timeout realtime'));

    await component.joinCurrentLobby();

    expect(component.joinOverlayError).toBe('Timeout realtime');
    expect(component.primaryActionError).toBe('');
  });

  it('starts the lobby when the host presses the main action after joining', async () => {
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');

    await component.onPrimaryAction();

    expect(realtimeSpy.startLobby).toHaveBeenCalledOnceWith(true);
    expect(component.primaryActionMessage).toContain('Solicitud de inicio enviada');
    expect(component.primaryActionButtonText).toBe('Empezar partida');
  });

  it('updates the selected deck through the lobby api', async () => {
    await component.onDeckSelected({
      target: { value: 'deck_2' },
    } as unknown as Event);

    expect(decksPullSpy.updateUserDeck).toHaveBeenCalledOnceWith('deck_2', {
      name: 'Mazo Secundario',
      cardIds: ['c_4', 'c_5', 'c_6'],
    });
    expect(component.selectedDeckId).toBe('deck_2');
  });

  it('sends useDynamicPool as false when the host disables it before starting', async () => {
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');

    component.onDynamicPoolChanged({
      target: { value: 'false' },
    } as unknown as Event);

    await component.onPrimaryAction();

    expect(realtimeSpy.startLobby).toHaveBeenCalledOnceWith(false);
  });

  it('normalizes the minimum players placeholder error when starting the lobby', async () => {
    realtimeSpy.connectionStatus.and.returnValue('connected');
    realtimeSpy.activeLobbyCode.and.returnValue('A1B2');
    realtimeSpy.startLobby.and.callFake(() => {
      throw new Error('Se requieren al menos ${LOBBY_MIN_PLAYERS} jugadores para iniciar.');
    });

    await component.onPrimaryAction();

    expect(component.primaryActionError).toBe(
      'Se requieren al menos 3 jugadores para iniciar.'
    );
  });

  it('prefers the explicit started game engine when deciding the destination board', () => {
    expect(
      component['resolveStartedGameEngine']({
        lobbyCode: 'A1B2',
        engine: 'Stella',
        state: {
          currentRound: {
            storytellerId: 'u_111',
          },
        },
        receivedAt: Date.now(),
      })
    ).toBe('Stella');
  });
});

function createCollectionsFixture(): CardCollection[] {
  return [
    {
      id: 'col_set1',
      name: 'Set Inicial',
      description: 'Coleccion base',
      releaseDate: '2026-03-12',
      totalCards: 10,
    },
    {
      id: 'col_set2',
      name: 'Set Avanzado',
      description: 'Coleccion avanzada',
      releaseDate: '2026-03-13',
      totalCards: 2,
    },
  ];
}

function createCollectionCardsFixture(): CollectionCard[] {
  return [
    {
      idCard: 'col_set1_card_001',
      idCollection: 'col_set1',
      rarity: 'Rara',
      title: 'Dragon de Fuego',
      imageUrl: '/assets/card-1.png',
    },
    {
      idCard: 'col_set1_card_002',
      idCollection: 'col_set1',
      rarity: 'Comun',
      title: 'Guardian del Lago',
      imageUrl: '/assets/card-2.png',
    },
  ];
}

function createOwnedCardsFixture() {
  return [
    {
      code: 'col_set1_card_001',
      image: '/assets/card-1.png',
      value: 'Dragon de Fuego',
      suit: 'DIXIT',
    },
    {
      code: 'col_set2_card_003',
      image: '/assets/card-3.png',
      value: 'Espectro Lunar',
      suit: 'DIXIT',
    },
  ];
}

function createUserDecksFixture() {
  return [
    {
      id: 'deck_1',
      name: 'Mazo Principal',
      cardIds: ['c_1', 'c_2', 'c_3'],
    },
    {
      id: 'deck_2',
      name: 'Mazo Secundario',
      cardIds: ['c_4', 'c_5', 'c_6'],
    },
  ];
}

function createLobbyFixture(): Game {
  return {
    id: 'A1B2',
    title: 'Sala de Novatos',
    description: 'Classic - 2/4 jugadores - Esperando jugadores - Publica',
    image: '/assets/Tablero.png',
    hostId: 'u_111',
    players: ['u_111', 'u_222'],
    playerCount: 2,
    maxPlayers: 4,
    engine: 'Classic',
    status: 'waiting',
    isPrivate: false,
    selectedDeckId: 'deck_1',
  };
}
