import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GamesView } from './games-view';

describe('GamesView', () => {
  let component: GamesView;
  let fixture: ComponentFixture<GamesView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GamesView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GamesView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
