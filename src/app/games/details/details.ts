import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-details',
  standalone: true,
  imports: [RouterModule],
  template: `
    <p>
      details works! {{ id }}
    </p>
  `,
  styles: ``,
})
export class Details {
  id=0;
  constructor(private router: Router) {
    const urlSegments = this.router.url.split('/');
    this.id = Number(urlSegments[urlSegments.length - 1]);
  }
}
