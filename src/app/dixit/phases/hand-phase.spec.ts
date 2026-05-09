import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DixitHandPhase } from './hand-phase';

describe('DixitHandPhase', () => {
  let fixture: ComponentFixture<DixitHandPhase>;
  let component: DixitHandPhase;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DixitHandPhase],
    }).compileComponents();

    fixture = TestBed.createComponent(DixitHandPhase);
    component = fixture.componentInstance;
  });

  it('opens the clue panel automatically for the storyteller at the start of the round', () => {
    fixture.componentRef.setInput('isCurrentPlayerStoryteller', true);
    fixture.componentRef.setInput('currentClue', '');

    fixture.detectChanges();

    expect(component.isActionPanelOpen).toBeTrue();
    expect(fixture.nativeElement.textContent as string).toContain('Ver tablero');
  });

  it('opens the clue panel automatically when the clue arrives', () => {
    fixture.componentRef.setInput('isCurrentPlayerStoryteller', false);
    fixture.componentRef.setInput('currentClue', '');
    fixture.detectChanges();

    component.isActionPanelOpen = false;
    fixture.componentRef.setInput('currentClue', 'Una pista real');
    fixture.detectChanges();

    expect(component.isActionPanelOpen).toBeTrue();
    expect(fixture.nativeElement.textContent as string).toContain('Una pista real');
  });
});
