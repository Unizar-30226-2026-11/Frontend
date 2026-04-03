import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';

import { DixitStella } from './dixit-stella';
import { Game } from '../interfaces/game';
import { WordCard } from '../interfaces/word-card';
import { DeckCard } from '../services/card-pull';
import { GamesPull } from '../services/games-pull';
import { StellaCardPull } from '../services/stella-card-pull';
import { WordCardPull } from '../services/word-card-pull';

describe('DixitStella', () => {
  let component: DixitStella;
  let fixture: ComponentFixture<DixitStella>;
  let stellaCardPullSpy: jasmine.SpyObj<StellaCardPull>;
  let wordCardPullSpy: jasmine.SpyObj<WordCardPull>;
  let gamesPullSpy: jasmine.SpyObj<GamesPull>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    stellaCardPullSpy = jasmine.createSpyObj<StellaCardPull>('StellaCardPull', ['getCards']);
    wordCardPullSpy = jasmine.createSpyObj<WordCardPull>('WordCardPull', ['getCards']);
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', ['getGameDetails']);
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    stellaCardPullSpy.getCards.and.resolveTo(createCardsFixture(36));
    wordCardPullSpy.getCards.and.resolveTo(createWordCardsFixture());
    gamesPullSpy.getGameDetails.and.resolveTo(createLobbyFixture());
    routerSpy.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [DixitStella],
      providers: [
        { provide: StellaCardPull, useValue: stellaCardPullSpy },
        { provide: WordCardPull, useValue: wordCardPullSpy },
        { provide: GamesPull, useValue: gamesPullSpy },
        { provide: Router, useValue: routerSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'STELLA1' }),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DixitStella);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('creates the Stella table with a 15-card board', () => {
    expect(component).toBeTruthy();
    expect(component.boardCards.length).toBe(15);
    expect(component.getBoardCardsForRow(0).length).toBe(5);
    expect(component.getBoardCardsForRow(1).length).toBe(5);
    expect(component.getBoardCardsForRow(2).length).toBe(5);
  });

  it('ignores the eleventh selected card', () => {
    const firstTenCodes = getCodes(component, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const eleventhCode = component.boardCards[10].code;

    for (const code of firstTenCodes) {
      component.onBoardCardClicked(code);
    }
    component.onBoardCardClicked(eleventhCode);

    expect(component.currentPlayer.selection.length).toBe(10);
    expect(component.currentPlayer.selection).not.toContain(eleventhCode);
  });

  it('submits the local selection without blocking and moves to announce', () => {
    component.onBoardCardClicked(component.boardCards[0].code);
    component.onBoardCardClicked(component.boardCards[1].code);
    component.onBoardCardClicked(component.boardCards[2].code);

    component.submitSelection();

    expect(component.phase).toBe('announce');
    expect(component.players.every((player) => player.submitted)).toBeTrue();
  });

  it('marks a unique leader as dark during announce', () => {
    component.setSelectionForPlayer(component.players[0].id, getCodes(component, [0, 1, 2, 3, 4]));
    component.setSelectionForPlayer(component.players[1].id, getCodes(component, [0, 1]));
    component.setSelectionForPlayer(component.players[2].id, getCodes(component, [2, 3]));
    component.setSelectionForPlayer(component.players[3].id, getCodes(component, [4, 5]));

    component.startAnnouncePhase();

    expect(component.phase).toBe('announce');
    expect(component.players[0].lanternState).toBe('DARK');
    expect(component.players[1].lanternState).toBe('LIGHT');
  });

  it('makes the explorer fall when nobody else selected the revealed card', () => {
    const uniqueCode = component.boardCards[0].code;
    const sharedCode = component.boardCards[1].code;
    component.firstExplorerIndex = 0;

    component.setSelectionForPlayer(component.players[0].id, [uniqueCode, sharedCode]);
    component.setSelectionForPlayer(component.players[1].id, [sharedCode]);
    component.setSelectionForPlayer(component.players[2].id, [component.boardCards[2].code]);
    component.setSelectionForPlayer(component.players[3].id, [component.boardCards[3].code]);

    component.startAnnouncePhase();
    component.startRevealPhase();
    component.resolveExplorerTurn(uniqueCode);

    expect(component.players[0].hasFallen).toBeTrue();
    expect(component.latestRevealLog?.outcome).toBe('fall');
  });

  it('applies darkness penalty only when the dark player falls', () => {
    const sharedCode = component.boardCards[0].code;
    const fallCode = component.boardCards[1].code;
    component.firstExplorerIndex = 0;

    component.setSelectionForPlayer(component.players[0].id, [sharedCode, fallCode, component.boardCards[2].code]);
    component.setSelectionForPlayer(component.players[1].id, [sharedCode]);
    component.setSelectionForPlayer(component.players[2].id, [component.boardCards[3].code]);
    component.setSelectionForPlayer(component.players[3].id, [component.boardCards[4].code]);

    component.startAnnouncePhase();
    component.startRevealPhase();
    component.resolveExplorerTurn(sharedCode);
    component.activeExplorerId = component.players[0].id;
    component.resolveExplorerTurn(fallCode);

    while (component.phase === 'reveal') {
      component.resolveExplorerTurn();
    }

    expect(component.phase).toBe('scoring');
    const darkPlayer = component.players[0];
    const summaryRow = component.scoringSummary.find((row) => row.playerId === darkPlayer.id);

    expect(darkPlayer.lanternState).toBe('DARK');
    expect(darkPlayer.hasFallen).toBeTrue();
    expect(summaryRow?.roundPoints).toBe(3);
    expect(summaryRow?.penalty).toBe(1);
    expect(summaryRow?.netPoints).toBe(2);
  });

  it('replaces one board row and rotates the first explorer after scoring', () => {
    component.firstExplorerIndex = 0;
    const previousFirstExplorerId = component.players[component.firstExplorerIndex].id;
    const originalRows = [
      component.getBoardCardsForRow(0).map((card) => card.code),
      component.getBoardCardsForRow(1).map((card) => card.code),
      component.getBoardCardsForRow(2).map((card) => card.code),
    ];

    for (let index = 0; index < component.players.length; index += 1) {
      component.setSelectionForPlayer(component.players[index].id, [component.boardCards[index].code]);
    }

    component.startAnnouncePhase();
    component.startRevealPhase();
    component.resolveExplorerTurn(component.players[0].selection[0]);

    while (component.phase === 'reveal') {
      component.resolveExplorerTurn();
    }

    component.advanceAfterScoring();

    expect(component.roundNumber).toBe(2);
    expect(component.players[component.firstExplorerIndex].id).not.toBe(previousFirstExplorerId);
    expect(component.getBoardCardsForRow(0).map((card) => card.code)).not.toEqual(originalRows[0]);
    expect(component.getBoardCardsForRow(1).map((card) => card.code)).toEqual(originalRows[1]);
    expect(component.getBoardCardsForRow(2).map((card) => card.code)).toEqual(originalRows[2]);
  });
});

function createCardsFixture(count: number): DeckCard[] {
  return Array.from({ length: count }, (_, index) => {
    const cardNumber = String(index + 1).padStart(2, '0');

    return {
      code: `ST${cardNumber}`,
      image: `https://picsum.photos/seed/test-${cardNumber}/480/720`,
      value: `Card ${cardNumber}`,
      suit: 'Dream',
    };
  });
}

function createWordCardsFixture(): WordCard[] {
  return [
    { id: 'W01', terms: ['Aurora', 'Espejo'] },
    { id: 'W02', terms: ['Silencio', 'Bosque'] },
    { id: 'W03', terms: ['Mascara', 'Eco'] },
    { id: 'W04', terms: ['Vertigo', 'Constelacion'] },
  ];
}

function createLobbyFixture(): Game {
  return {
    id: 'STELLA1',
    title: 'Sala Stella',
    description: 'Stella - 4/4 jugadores - Esperando jugadores - Publica',
    image: '/assets/Tablero.png',
    hostId: 'u_111',
    players: ['u_111', 'u_222', 'u_333', 'u_444'],
    playerCount: 4,
    maxPlayers: 4,
    engine: 'Stella',
    status: 'waiting',
    isPrivate: false,
  };
}

function getCodes(component: DixitStella, indexes: number[]): string[] {
  return indexes.map((index) => component.boardCards[index].code);
}
