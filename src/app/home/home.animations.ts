import { trigger, transition, style, animate } from '@angular/animations';

export const stepAnimation =
  trigger('stepAnimation', [

    transition(':enter', [
      style({ opacity: 0 }),
      animate('.5s ease', style({ opacity: 1 }))
    ]),

    transition(':leave', [
      style({ opacity: 1 }),
      animate('.5s ease', style({ opacity: 0 }))
    ]),

  ]);
