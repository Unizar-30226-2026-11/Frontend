import { Component } from '@angular/core';
<<<<<<< HEAD
import { Options } from './components/options/options';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [Options],
  template: `
    <!-- <navbar></nabvar> -->

    <app-options></app-options>
  `,
  styles: `
    app-options {
      display: block;
      padding-top: 60px;
    }
  `,
})
export class Settings {

}
=======

@Component({
  selector: 'app-settings',
  standalone: true,
  template: ``,
})
export class Settings {}
>>>>>>> Menus-Regis
