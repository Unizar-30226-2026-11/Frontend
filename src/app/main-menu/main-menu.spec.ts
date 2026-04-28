import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { MainMenu } from './main-menu';
import { CollectionsPull } from '../services/collections-pull';

describe('MainMenu', () => {
  let component: MainMenu;
  let fixture: ComponentFixture<MainMenu>;
  let routerSpy: jasmine.SpyObj<Router>;
  let collectionsPullSpy: jasmine.SpyObj<CollectionsPull>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);
    routerSpy.navigate.and.resolveTo(true);
    collectionsPullSpy = jasmine.createSpyObj<CollectionsPull>('CollectionsPull', [
      'getCollectionsWithCards',
    ]);
    collectionsPullSpy.getCollectionsWithCards.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [MainMenu],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: CollectionsPull, useValue: collectionsPullSpy },
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

  it('navigates to games from the primary action', () => {
    component.goToGames();

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/games']);
  });

  it('navigates to the store from the secondary action', () => {
    component.goToStore();

    expect(routerSpy.navigate).toHaveBeenCalledOnceWith(['/store']);
  });
});
