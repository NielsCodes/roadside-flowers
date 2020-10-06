import {
  trigger,
  transition,
  style,
  animate,
  query,
  group
} from '@angular/animations';

const optional = { optional: true };
export const stepAnimation =
  trigger('stepAnimation', [

    // STEP 2 --> STEP 3
    // - Change background
    // - Fade in form
    transition('step2 => step3', [

      query(':enter', [
        style({ opacity: 0 }),
      ], optional),

      query(':leave', [
        style({ opacity: 1 })
      ], optional),

      query('#content-form', [
        style({ opacity: 0 })
      ], optional),

      group([
        query(':leave', [ animate('1s ease', style({ opacity: 0 }))], optional),
        query(':enter', [ animate('1s ease', style({ opacity: 1 })) ], optional),
        query(':enter #content-form', [ animate('1s ease', style({ opacity: 1 })) ], optional)
      ])

    ]),

    // STEP 3 --> STEP 4
    // - Fade out form
    // - Fade in overlay
    transition('step3 => step4', [

      query('#form-input-container', [
        style({ opacity: 1 })
      ], optional),

      query('#presave-container', [
        style({ opacity: 0 })
      ], optional),

      group([
        query('#form-input-container', [ animate('.3s ease', style({ opacity: 0 })) ], optional),
        query('#presave-container', [ animate('.3s ease', style({ opacity: 1 })) ], optional)
      ])

    ]),

    // FALLBACK
    transition('* <=> *', [

      query(':enter', [
        style({ opacity: 0 }),
      ], optional),

      query(':leave', [
        style({ opacity: 1 })
      ], optional),

      group([
        query(':leave', [ animate('1s ease', style({ opacity: 0 }))], optional),
        query(':enter', [ animate('1s ease', style({ opacity: 1 })) ], optional),
      ])

    ]),

  ]);

export const policyAnimation =
  trigger('policyAnimation', [

    transition(':enter', [
      style({ opacity: 0 }),
      animate('.5s ease', style({ opacity: 1 }))
    ]),

    transition(':leave', [
      style({ opacity: 1 }),
      animate('.5s ease', style({ opacity: 0 }))
    ]),

  ]);
