import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

@Component({
  standalone: true,
  template: '<p>home</p>',
})
class TestHome {}

@Component({
  standalone: true,
  template: '<p>store</p>',
})
class TestStore {}

@Component({
  standalone: true,
  template: '<p>dixit</p>',
})
class TestDixit {}

@Component({
  standalone: true,
  template: '<p>dixit stella</p>',
})
class TestDixitStella {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: TestHome },
          { path: 'store', component: TestStore },
          { path: 'dixit/:id', component: TestDixit },
          { path: 'dixit-stella/:id', component: TestDixitStella },
          { path: 'stella-test', component: TestDixitStella },
        ]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should hide the navigation bar on the home route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should render the navigation bar on app routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/store');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeTruthy();
  });

  it('should hide the navigation bar on dixit routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dixit/demo-room');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should hide the navigation bar on dixit stella routes', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/dixit-stella/demo-room');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });

  it('should hide the navigation bar on the stella test route', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/stella-test');
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navigation-bar')).toBeNull();
  });
});
