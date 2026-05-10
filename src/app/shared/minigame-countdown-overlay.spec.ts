import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MinigameCountdownOverlay } from './minigame-countdown-overlay';

describe('MinigameCountdownOverlay', () => {
  let fixture: ComponentFixture<MinigameCountdownOverlay>;
  let component: MinigameCountdownOverlay;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MinigameCountdownOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(MinigameCountdownOverlay);
    component = fixture.componentInstance;
  });

  it('updates the visible countdown every second and emits finished at the end', async () => {
    const finishedSpy = jasmine.createSpy('finished');
    component.finished.subscribe(finishedSpy);
    fixture.componentRef.setInput('seconds', 3);
    fixture.componentRef.setInput('resetKey', 'seed-1');

    fixture.detectChanges();

    let countdownNumber = fixture.nativeElement.querySelector('.countdown-number') as HTMLElement | null;
    expect(countdownNumber?.textContent?.trim()).toBe('3');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    fixture.detectChanges();

    countdownNumber = fixture.nativeElement.querySelector('.countdown-number') as HTMLElement | null;
    expect(countdownNumber?.textContent?.trim()).toBe('2');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    fixture.detectChanges();

    countdownNumber = fixture.nativeElement.querySelector('.countdown-number') as HTMLElement | null;
    expect(countdownNumber?.textContent?.trim()).toBe('1');

    await new Promise((resolve) => setTimeout(resolve, 1100));
    fixture.detectChanges();

    expect(finishedSpy).toHaveBeenCalledTimes(1);
  });
});
