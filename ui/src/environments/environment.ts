// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  /** API endpoint for authentication purposes */
  endpoint: 'http://localhost:8080',
  /** Redirect URL for Spotify authentication */
  redirect: 'http://localhost:4200/callback'
};
