import { ComponentFixture, TestBed } from '@angular/core/testing';

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

    decksPullSpy = jasmine.createSpyObj<DecksPull>('DecksPull', ['getStoreCatalog', 'buyDeck']);
    decksPullSpy.getStoreCatalog.and.resolveTo({
      items: [
        {
          id: 'item_wildcard_001',
          type: 'card',
          name: 'Comodin de ataque',
          price: 300,
          image: '/assets/Tablero.png',
          owned: false,
        },
      ],
      inventory: {
        inventory: {
          inventory: [],
        },
      },
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
    decksPullSpy.buyDeck.and.resolveTo({
      itemId: 'item_wildcard_001',
      message: "Has comprado 'Comodin de ataque' exitosamente.",
      remainingCoins: 500,
    });

    await component.buyDeck('item_wildcard_001');
    fixture.detectChanges();

    expect(component.purchaseMessage()).toBe("Has comprado 'Comodin de ataque' exitosamente.");
    expect(component.purchaseError()).toBeNull();
    expect(component.decks()[0].owned).toBeTrue();
    expect(playerStoreMock.updateBalance).toHaveBeenCalledWith(500);
    expect(fixture.nativeElement.textContent).toContain(
      "Has comprado 'Comodin de ataque' exitosamente."
    );
  });

  it('shows purchase error feedback when the API rejects the transaction', async () => {
    decksPullSpy.buyDeck.and.rejectWith(new Error('Saldo insuficiente.'));

    await component.buyDeck('item_wildcard_001');
    fixture.detectChanges();

    expect(component.purchaseMessage()).toBeNull();
    expect(component.purchaseError()).toBe('Saldo insuficiente.');
    expect(component.decks()[0].owned).toBeFalse();
    expect(playerStoreMock.updateBalance).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Saldo insuficiente.');
  });
});
