import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Dixit } from './dixit';

describe('Dixit', () => {
  let component: Dixit;
  let fixture: ComponentFixture<Dixit>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dixit]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Dixit);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
