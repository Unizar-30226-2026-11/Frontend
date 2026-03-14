import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { MainMenu } from './main-menu';
import { Game } from '../interfaces/game';
import {
  CardCollectionWithCards,
  CollectionsPull,
} from '../services/collections-pull';
import { GamesPull } from '../services/games-pull';

describe('MainMenu', () => {
  let component: MainMenu;
  let fixture: ComponentFixture<MainMenu>;
  let collectionsPullSpy: jasmine.SpyObj<CollectionsPull>;
  let gamesPullSpy: jasmine.SpyObj<GamesPull>;

  beforeEach(async () => {
    collectionsPullSpy = jasmine.createSpyObj<CollectionsPull>('CollectionsPull', [
      'getCollectionsWithCards',
    ]);
    collectionsPullSpy.getCollectionsWithCards.and.resolveTo(createCollectionsFixture());
    gamesPullSpy = jasmine.createSpyObj<GamesPull>('GamesPull', ['getGameDetails']);
    gamesPullSpy.getGameDetails.and.resolveTo(createLobbyFixture());

    await TestBed.configureTestingModule({
      imports: [MainMenu],
      providers: [
        { provide: CollectionsPull, useValue: collectionsPullSpy },
        { provide: GamesPull, useValue: gamesPullSpy },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'A1B2' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainMenu);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads collections on init', () => {
    expect(collectionsPullSpy.getCollectionsWithCards).toHaveBeenCalledTimes(1);
    expect(component.collections.length).toBe(2);
    expect(component.collectedCards).toBe(3);
    expect(component.totalCards).toBe(12);
  });

  it('loads lobby players from the route id', () => {
    expect(gamesPullSpy.getGameDetails).toHaveBeenCalledOnceWith('A1B2');
    expect(component.playersInRoom).toBe(2);
    expect(component.roomCapacity).toBe(4);
    expect(component.roomSlots).toEqual([
      { slotId: 1, name: 'u_111', state: 'anfitrion' },
      { slotId: 2, name: 'u_222', state: 'jugador' },
      { slotId: 3, name: 'slot libre', state: 'abierto' },
      { slotId: 4, name: 'slot libre', state: 'abierto' },
    ]);
  });
});

function createCollectionsFixture(): CardCollectionWithCards[] {
  return [
    {
      id: 'col_set1',
      name: 'Set Inicial',
      description: 'Coleccion base',
      releaseDate: '2026-03-12',
      totalCards: 10,
      cards: [
        {
          idCard: 'col_set1_card_001',
          idCollection: 'col_set1',
          rarity: 'Rara',
          title: 'Dragon de Fuego',
        },
        {
          idCard: 'col_set1_card_002',
          idCollection: 'col_set1',
          rarity: 'Comun',
          title: 'Guardian del Lago',
        },
      ],
    },
    {
      id: 'col_set2',
      name: 'Set Avanzado',
      description: 'Coleccion avanzada',
      releaseDate: '2026-03-13',
      totalCards: 2,
      cards: [
        {
          idCard: 'col_set2_card_001',
          idCollection: 'col_set2',
          rarity: 'Epica',
          title: 'Espectro Lunar',
        },
      ],
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
  };
}
