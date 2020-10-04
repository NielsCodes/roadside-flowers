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

    ])

  ]
})
export class CallbackComponent implements OnInit{

  private pageURL = 'https://presave.droeloe.com';
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
    if (window.innerHeight > window.innerWidth) {
      this.isVertical = true;
    } else {
      this.isVertical = false;
    }
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private afs: AngularFirestore,
    private http: HttpClient,
    private clipboard: Clipboard,
    private api: ApiService,
    private cookie: CookieService,
    private analytics: AngularFireAnalytics,
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
        if (this.cookie.trackingActive) {
          fbq('trackCustom', 'presave', { platform: 'messenger' });
          this.analytics.logEvent('presave', { platform: 'messenger' });
        }
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
            this.updateLoadingState();
            if (this.cookie.trackingActive) {
              fbq('trackCustom', 'presave', { platform: 'apple' });
              this.analytics.logEvent('presave', { platform: 'apple' });
            }
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

              if (this.cookie.trackingActive) {
                fbq('trackCustom', 'presave', { platform: 'spotify' });
                this.analytics.logEvent('presave', { platform: 'spotify' });
              }

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
      console.log('Foo')

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
      this.loadingState = 'loaded';

      if (this.dataId === undefined) {
        this.dataId = localStorage.getItem('dataID');
      }

      this.urls = await this.api.getPictures(this.dataId);
      this.stage = 'download';

    }

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
    fbq('trackCustom', 'presaveShare', { platform: 'facebook' });
    this.analytics.logEvent('presaveShare', { platform: 'facebook' });
  }

  // Share on Twitter
  onShareToTwitter(): void {

    const windowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';
    const url = `${this.rootEndpoint}/auth/twitter?dataId=${this.dataId}`;

    fbq('trackCustom', 'presaveShare', { platform: 'twitter' });
    this.analytics.logEvent('presaveShare', { platform: 'twitter' });

    if (this.popupReference === null || this.popupReference === undefined || this.popupReference.closed) {
      this.popupReference = window.open(url, 'Share to Twitter', windowFeatures);
    } else {
      this.popupReference = window.open(url, 'Share to Twitter', windowFeatures);
      this.popupReference.focus();
    }

  }

  // Open share menu on mobile devices
  onMobileShare(): void {

    this.nav.share({
      title: '🌺',
      url: this.pageURL
    });

    fbq('trackCustom', 'presaveShare', { platform: 'mobile' });
    this.analytics.logEvent('presaveShare', { platform: 'mobile' });

  }

  async onDownload() {
    this.fallbackActive = true;
    await this.api.downloadPictures(this.urls.vertical, this.urls.horizontal);
    this.stage = 'share';
    fbq('trackCustom', 'ticketDownload');
    this.analytics.logEvent('ticketDownload');
  }

  async onNewsletterConsent() {
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

  test() {
    console.log('Test function called');
  }

}
