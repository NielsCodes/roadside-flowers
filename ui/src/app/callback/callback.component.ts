import { environment } from './../../environments/environment';
import { CookieService } from './../services/cookie.service';
import { ApiService } from './../services/api.service';
import { PresaveResponse } from './../../models/config.model';
import { Component, OnInit, HostListener } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/firestore';
import {
  trigger,
  state,
  style,
  transition,
  animate
} from '@angular/animations';
import { HttpClient } from '@angular/common/http';
import { Clipboard } from '@angular/cdk/clipboard';
import { AngularFireAnalytics } from '@angular/fire/analytics';
import { detect } from 'detect-browser';

const detectBrowser = detect();

declare const fbq: any;

@Component({
  selector: 'app-callback',
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.sass'],
  animations: [
    trigger('loadingState', [

      transition(':leave', [
        style({ opacity: 1 }),
        animate('.5s ease', style({ opacity: 0 }))
      ]),

    ]),

    trigger('shareState', [
      state('inactive', style({
        opacity: 0,
        pointerEvents: 'none'
      })),

      state('active', style({
        opacity: 1,
        pointerEvents: 'initial'
      })),

      transition('inactive => active', animate('250ms ease-in'))
    ]),

    trigger('snackbarState', [

      transition(':enter', [
        style({
          transform: 'scale(0.8)',
          opacity: 0
        }),
        animate('.5s ease-out')
      ]),

      transition(':leave', [
        animate('.2s ease-out', style({
          transform: 'scale(0.8)',
          opacity: 0
        })),
      ]),

    ]),

    trigger('pictureAnimation', [

      transition(':leave', [
        style({
          opacity: 1
        }),
        animate('2s ease', style({ opacity: 0 }))
      ])

    ])

  ]
})
export class CallbackComponent implements OnInit{

  private pageURL = 'https://roadsideflowers.niels.codes';
  private presaveSuccessful = false;
  reward: string;
  loadingState = 'loading';
  shareState = 'inactive';
  referrer: string;
  windowHeight: number;
  windowWidth: number;
  dataId: string;
  isVertical: boolean;
  fallbackActive = false;
  subscribedToNewsletter = false;
  isSubscribing = false;
  snackbarTxt = '';
  snackbarActive = false;
  snackbarTimeout;
  sharedToTwitter = false;
  private rootEndpoint = environment.endpoint;
  private popupReference;

  stage: string;
  urls: {vertical: string, horizontal: string};
  nav: any = window.navigator;

  canShare = false;

  @HostListener('window:resize', ['$event'])
  onResize(event?){
    this.windowHeight = window.innerHeight;
    this.windowWidth = window.innerWidth;

    if (this.windowWidth < 600) {
      this.isVertical = true;
    } else {
      if ((window.innerHeight > window.innerWidth)) {
        this.isVertical = true;
      } else {
        this.isVertical = false;
      }
    }
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private clipboard: Clipboard,
    private api: ApiService,
    private cookieService: CookieService,
  ) {
    this.onResize();
    // Redirect to home when navigation does not come from Messenger save or Spotify login
    this.route.queryParamMap.subscribe(params => {

      // Route back to homepage if error parameter is present. This means a Spotify login attempt was cancelled
      if (params.has('error')) {
        this.router.navigate(['/']);
      }

      if (!(params.has('code') && params.has('state')) && !params.has('ref')) {
        this.router.navigate(['/']);
      }

      const ref = params.get('ref');
      const code = params.get('code');
      const URLState = params.get('state');

      if (ref === 'messenger') {
        this.referrer = 'messenger';
        this.presaveSuccessful = true;
        this.updateLoadingState();
      } else if (ref === 'apple') {
        this.referrer = 'apple';
        this.dataId = params.get('dataId');

        if (params.has('status')) {
          this.presaveSuccessful = true;
          this.updateLoadingState();
        } else {

          this.api.hasSaved.subscribe( (appleState: boolean) => {
            this.presaveSuccessful = appleState;
            localStorage.setItem('appleSave', 'true');
            localStorage.setItem('appleCampaign', 'RF');
            this.updateLoadingState();
          });

        }


      } else if (code !== null && URLState.includes('spotify_')) {

        this.referrer = 'spotify';
        const uuidRegex = /[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}/;
        this.dataId = URLState.match(uuidRegex)[0];

        this.http.post(`${this.rootEndpoint}/spotify`, { auth_code: code, dataId: this.dataId }).toPromise()

          .then((res: PresaveResponse) => {

            if (res.success) {
              this.presaveSuccessful = true;
              this.updateLoadingState();
            } else {
              this.router.navigate(['/']);
            }

          })
          .catch(err => {
            console.error(err);
            this.router.navigate(['/']);
          });

      } else {
        this.router.navigate(['/']);
      }

    });

    // Check if platform supports Web share API
    if (this.nav.share) {

      if (detectBrowser.os !== 'Mac OS' && detectBrowser.name !== 'safari') {
        this.canShare = true;
      }

    }

  }

  // Redirect back to home if loading state has not changed after 10 seconds
  ngOnInit(): void {
    setTimeout(() => {
      if (this.loadingState === 'loading') {
        console.error('Something went wrong...');
        this.router.navigate(['']);
      }
    }, 10000);
  }

  async updateLoadingState() {

    if (this.presaveSuccessful) {

      if (this.dataId === undefined) {
        this.dataId = localStorage.getItem('dataID');
      }

      this.urls = await this.api.getPictures(this.dataId);
      this.loadingState = 'loaded';
      this.startIntro();

    }

  }

  /**
   * Start animation sequence
   *
   * - Shows ticket for 2 seconds
   * - Hides ticket and shows controls
   */
  startIntro() {
    this.stage = 'picture';
    setTimeout(() => {
      this.stage = 'controls';
    }, 3000);
  }

  // Copy link to clipboard
  onCopyToClipboard(): void {
    this.clipboard.copy(this.pageURL);
    this.showSnackbar('Copied to clipboard!');
  }

  // Share on Facebook
  onShareToFacebook(): void {
    const facebookBaseURL = 'https://www.facebook.com/sharer/sharer.php?u=';
    const shareURL = encodeURI(`${facebookBaseURL}${this.pageURL}`);
    window.open(shareURL, 'Share to Facebook', 'left=0,top=0,height=500,width=500');
  }

  // Share on Twitter
  onShareToTwitter(): void {

    // Return if the user has already shared to Twitter
    if (this.sharedToTwitter) {
      return;
    }

    const windowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';
    const url = `${this.rootEndpoint}/twitter/auth?dataId=${this.dataId}`;

    if (this.popupReference === null || this.popupReference === undefined || this.popupReference.closed) {
      this.popupReference = window.open(url, 'Share to Twitter', windowFeatures);
    } else {
      this.popupReference = window.open(url, 'Share to Twitter', windowFeatures);
      this.popupReference.focus();
    }

    const handleMessage = (event) => {
      console.log(event);
      if (event.origin !== environment.endpoint) {
        console.error('Invalid message origin');
        return;
      }

      if (event.data.success) {
        window.removeEventListener('message', handleMessage);
        this.showSnackbar('Shared to Twitter');
        this.sharedToTwitter = true;
      }

    };

    window.addEventListener('message', handleMessage);

  }

  // Open share menu on mobile devices
  onMobileShare(): void {
    this.nav.share({
      title: '🌺',
      url: this.pageURL
    });
  }

  async onDownload() {
    this.fallbackActive = true;
    await this.api.downloadPictures(this.urls.vertical, this.urls.horizontal);
  }

  async onNewsletterConsent() {
    // Return if the user has already subscribed to the newsletter
    if (this.subscribedToNewsletter) {
      return;
    }

    this.isSubscribing = true;
    try {
      await this.api.subscribeToNewsletter(this.dataId);
      this.subscribedToNewsletter = true;
      this.showSnackbar('Subscribed to the newsletter');
    } catch (error) {
      console.error(error);
    }
    this.isSubscribing = false;
  }

  /**
   * Show snackbar popup
   * @param message Message to show in the snackbar
   */
  private showSnackbar(message: string) {

    if (this.snackbarActive) {
      this.snackbarActive = false;
      clearTimeout(this.snackbarTimeout);
      setTimeout(() => {
        this.showSnackbar(message);
      }, 500);
      return;
    }

    this.snackbarTxt = message;
    this.snackbarActive = true;
    this.snackbarTimeout = setTimeout(() => {
      this.snackbarActive = false;
    }, 5000);
  }

}
