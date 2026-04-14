import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Auth } from '../services/auth';
import { PlayerStore } from '../services/player-store';
import { DecksPull } from '../services/decks-pull';
import { Store } from './store';

interface MockPlayer {
  id: string;
  legacyUserId: number;
  username: string;
  email: string;
  experienceLevel: number;
  progressLevel: number;
  state: string;
  personalState: string;
  balance: number;
}

describe('Store', () => {
  let component: Store;
  let fixture: ComponentFixture<Store>;
  let decksPullSpy: jasmine.SpyObj<DecksPull>;
  let playerStoreMock: {
    loading: () => boolean;
    error: () => string | null;
    player: () => MockPlayer | null;
    loadPlayer: jasmine.Spy;
    canAfford: jasmine.Spy;
    updateBalance: jasmine.Spy;
    spendCoins: jasmine.Spy;
  };
  let player: MockPlayer;

  beforeEach(async () => {
    player = {
      id: 'u_1',
      legacyUserId: 1,
      username: 'tester',
      email: 'tester@example.com',
      experienceLevel: 8,
      progressLevel: 20,
      state: 'online',
      personalState: 'ready',
      balance: 800,
    };

    decksPullSpy = jasmine.createSpyObj<DecksPull>('DecksPull', ['getStoreCatalog', 'buyItem']);
    decksPullSpy.getStoreCatalog.and.resolveTo({
      singleCards: [
        {
          id: 'c_48',
          type: 'singleCard',
          name: 'Carta 4-12',
          price: 300,
          image: '/assets/Tablero.png',
          subtitle: 'legendary',
        },
      ],
      cardPackOffer: {
        id: 'pack_daily',
        type: 'cardPack',
        name: 'Sobre Diario',
        price: 1350,
        image: '/assets/Tablero.png',
        description: '5 cartas con 25% de descuento',
        subtitle: '5 cartas',
        cards: [],
      },
      collectionOffer: null,
      boardOffer: null,
      expiresAt: '2026-04-15T00:00:00.000Z',
    });

    playerStoreMock = {
      loading: () => false,
      error: () => null,
      player: () => player,
      loadPlayer: jasmine.createSpy('loadPlayer').and.resolveTo(),
      canAfford: jasmine.createSpy('canAfford').and.callFake(
        (amount: number) => player !== null && player.balance >= amount
      ),
      updateBalance: jasmine.createSpy('updateBalance').and.callFake((nextBalance: number) => {
        if (player) {
          player = { ...player, balance: nextBalance };
        }
      }),
      spendCoins: jasmine.createSpy('spendCoins'),
    };

    await TestBed.configureTestingModule({
      imports: [Store],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            isLoggedIn: () => true,
          },
        },
        { provide: PlayerStore, useValue: playerStoreMock },
        { provide: DecksPull, useValue: decksPullSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Store);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows purchase success feedback and updates the balance', async () => {
    decksPullSpy.buyItem.and.resolveTo({
      itemId: 'c_48',
      message: "Has comprado 'Carta 4-12' exitosamente.",
      remainingCoins: 500,
    });

    await component.buyItem('c_48');
    fixture.detectChanges();

    expect(component.purchaseMessage()).toBe("Has comprado 'Carta 4-12' exitosamente.");
    expect(component.purchaseError()).toBeNull();
    expect(playerStoreMock.updateBalance).toHaveBeenCalledWith(500);
    expect(fixture.nativeElement.textContent).toContain("Has comprado 'Carta 4-12' exitosamente.");
  });

  it('shows purchase error feedback when the API rejects the transaction', async () => {
    decksPullSpy.buyItem.and.rejectWith(new Error('Saldo insuficiente.'));

    await component.buyItem('c_48');
    fixture.detectChanges();

    expect(component.purchaseMessage()).toBeNull();
    expect(component.purchaseError()).toBe('Saldo insuficiente.');
    expect(playerStoreMock.updateBalance).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Saldo insuficiente.');
  });
});
