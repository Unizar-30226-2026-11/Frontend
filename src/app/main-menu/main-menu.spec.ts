import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { MainMenu } from './main-menu';
import { CardCollection, CollectionCard, CollectionsPull } from '../services/collections-pull';
import { CardPull } from '../services/card-pull';

describe('MainMenu', () => {
  let component: MainMenu;
  let fixture: ComponentFixture<MainMenu>;
  let routerSpy: jasmine.SpyObj<Router>;
  let collectionsPullSpy: jasmine.SpyObj<CollectionsPull>;
  let cardPullSpy: jasmine.SpyObj<CardPull>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    collectionsPullSpy = jasmine.createSpyObj<CollectionsPull>('CollectionsPull', [
      'getCollections',
      'getCollectionCards',
    ]);
    collectionsPullSpy.getCollections.and.resolveTo(createCollectionsFixture());
    collectionsPullSpy.getCollectionCards.and.resolveTo(createCollectionCardsFixture());
    cardPullSpy = jasmine.createSpyObj<CardPull>('CardPull', ['getCards']);
    cardPullSpy.getCards.and.resolveTo(createOwnedCardsFixture());

    await TestBed.configureTestingModule({
      imports: [MainMenu],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: CollectionsPull, useValue: collectionsPullSpy },
        { provide: CardPull, useValue: cardPullSpy },
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

  it('loads only collections on init and keeps them collapsed', () => {
    expect(collectionsPullSpy.getCollections).toHaveBeenCalledTimes(1);
    expect(cardPullSpy.getCards).toHaveBeenCalledTimes(1);
    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledTimes(2);
    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledWith('col_set1');
    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledWith('col_set2');
    expect(component.collections.length).toBe(2);
    expect(component.collections.every((collection) => !collection.expanded)).toBeTrue();
    expect(component.totalCards).toBe(12);
    expect(component.collectedCards).toBe(2);
  });

  it('reuses precached cards when a collection is expanded', async () => {
    await component.toggleCollection('col_set1');

    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledTimes(2);
    expect(component.collections[0].expanded).toBeTrue();
    expect(component.collections[0].cardsLoaded).toBeTrue();
    expect(component.collections[0].cards.length).toBe(2);
    expect(component.collections[0].collected).toBe(1);
    expect(component.collections[0].cards[0].locked).toBeFalse();
    expect(component.collections[0].cards[1].locked).toBeTrue();

    await component.toggleCollection('col_set1');
    await component.toggleCollection('col_set1');

    expect(collectionsPullSpy.getCollectionCards).toHaveBeenCalledTimes(2);
    expect(component.collections[0].expanded).toBeTrue();
  });

  it('computes collection counters from real collection cards before opening the dropdown', async () => {
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

    const freshFixture = TestBed.createComponent(MainMenu);
    const freshComponent = freshFixture.componentInstance;
    freshFixture.detectChanges();
    await freshFixture.whenStable();

    expect(freshComponent.collections[0].collected).toBe(1);
    expect(freshComponent.collections[1].collected).toBe(0);
  });

  it('navigates to games from the primary action', () => {
    component.goToGames();

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/games']);
  });

  it('navigates to the store from the secondary action', () => {
    component.goToStore();

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/store']);
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
