import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DecksCard } from './decks-card';

describe('DecksCard', () => {
  let component: DecksCard;
  let fixture: ComponentFixture<DecksCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecksCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DecksCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
