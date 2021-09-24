import { stepAnimation, policyAnimation, saveOptionAnimation } from './home.animations';
import { CookieService } from './../services/cookie.service';
import { environment } from './../../environments/environment';
import { ApiService } from './../services/api.service';
import { ScriptsService } from './../services/scripts.service';
import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';

declare var MusicKit: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
  animations: [
    policyAnimation,
    stepAnimation,
    saveOptionAnimation
  ]
})
export class HomeComponent {

  appleToken: string;
  music: any;
  isMobile: boolean;
  windowHeight: number;
  windowWidth: number;
  isVertical: boolean;
  preloadedImages = {
    backgroundImg: new Image(),
    backgroundImg2: new Image(),
    spotifyImg: new Image(),
    appleImg: new Image(),
  };

  formData = {
    from: '',
    to: '',
    message: ''
  };

  stage = '';
  showPolicy = false;

  private dataId: string;

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
    private scripts: ScriptsService,
    private api: ApiService,
    private router: Router,
    private cookieService: CookieService,
  ) {
    this.onResize();
    this.scripts.loadMusicKit().pipe(filter((status: boolean) => status === true)).subscribe((status: boolean) => {

      this.api.getAppleToken()
        .then((token) => {
          this.appleToken = token;
          MusicKit.configure({
            developerToken: this.appleToken,
            app: {
              name: 'bitbird presaves',
              build: '2.0.0'
            }
          });
          this.music = MusicKit.getInstance();
        });

    });

    // Preload images
    this.preloadedImages.backgroundImg.src = '../../assets/step1-min.jpg';
    this.preloadedImages.backgroundImg.onload = () => {
      this.stage = 'step1';
    };

    this.preloadedImages.backgroundImg2.src = '../../assets/step2-min.jpg';
    this.preloadedImages.spotifyImg.src = '../../assets/logos/messenger.png';
    this.preloadedImages.appleImg.src = '../../assets/logos/apple.png';

  }

  async submitForm() {

    const d = this.formData;
    this.dataId =  this.api.createDataID();

    this.stage = 'save';
    await this.api.registerData(d.from, d.to, d.message, this.dataId);

  }


  onSpotifyLogin() {

    const rootUrl = 'https://accounts.spotify.com/authorize';
    const clientID = '26f68dd9f50f4defbb31908146defed2';
    const redirectURL = environment.redirect;
    const scope = 'user-library-modify';
    const state = `spotify_${this.dataId}`;

    // tslint:disable-next-line: max-line-length
    const loginUrl = `${rootUrl}?client_id=${clientID}&response_type=code&redirect_uri=${redirectURL}&scope=${encodeURIComponent(scope)}&state=${state}`;
    window.location.href = loginUrl;

  }

  onAppleLogin() {

    const hasSaved = localStorage.getItem('appleSave');
    const campaign = localStorage.getItem('appleCampaign');

    if (hasSaved === 'true' && campaign === 'RF') {

      this.router.navigate(['/callback'], { queryParams: { ref: 'apple', status: '2', dataId: this.dataId } });

    } else {

      // If MusicScript has not loaded yet, load it before calling the login function
      if (this.scripts.mkHasLoaded.getValue() === false) {
        this.scripts.mkHasLoaded.pipe(filter((status: boolean) => status === true)).subscribe((status: boolean) => {
          this.loginWithApple();
        });
      } else {
        this.loginWithApple();
      }

    }


  }

  private loginWithApple() {
    this.music.authorize().then((token: string) => {
      this.api.registerApplePresave(token);
      this.router.navigate(['/callback'], { queryParams: { ref: 'apple', dataId: this.dataId } });
    });
  }

  onStart() {
    this.stage = 'data';
  }

  onShowPolicy() {
    this.showPolicy = true;
  }

  onHidePolicy() {
    this.showPolicy = false;
  }

  onContinue() {

    let nextStage = this.stage;

    if (this.stage === 'step1') {

      if (!this.preloadedImages.backgroundImg2.complete) {
        this.preloadedImages.backgroundImg2.src = '../../assets/step2-min.png';
        this.preloadedImages.backgroundImg2.onload = () => {
          this.startIntro();
        };
      } else {
        this.startIntro();
      }

    } else {
      switch (this.stage) {
        case 'step2':
          nextStage = 'step3';
          break;
        case 'step3':
          nextStage = 'step4';
          this.submitForm();
          break;
        default:
          break;
      }

      this.stage = nextStage;
    }

  }

  /** Start timer to proceed through the first steps */
  startIntro() {

    this.cookieService.setConsent();
    this.stage = 'step2';
    setTimeout(() => {
      this.stage = 'step3';
    }, 1000);

  }

  /** Remove double line breaks from text */
  stripNewlines(message: string): string {
    return message.replace(/[\n]{2,}/g, '\n');
  }

  onTextareaEnter(event: KeyboardEvent) {
    event.preventDefault();
  }

}
