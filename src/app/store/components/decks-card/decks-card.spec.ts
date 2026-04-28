import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DecksCard } from './decks-card';

describe('DecksCard', () => {
  let component: DecksCard;
  let fixture: ComponentFixture<DecksCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecksCard],
      providers: [provideRouter([])],
    })
    .compileComponents();

    fixture = TestBed.createComponent(DecksCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the owned state and blocks the purchase action', () => {
    component.purchased = true;
    component.canBuy = true;
    component.deckImageSrc = '/assets/Tablero.png';
    component.deckName = 'Carta 4-12';
    spyOn(component.buy, 'emit');

    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.deck-button');
    button.click();

    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Ya lo tienes');
    expect(button.classList).toContain('deck-button--owned');
    expect(component.buy.emit).not.toHaveBeenCalled();
  });
});
