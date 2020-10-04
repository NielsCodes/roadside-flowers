import { stepAnimation, policyAnimation } from './home.animations';
import { CookieService } from './../services/cookie.service';
import { environment } from './../../environments/environment';
import { ApiService } from './../services/api.service';
import { ScriptsService } from './../services/scripts.service';
import { Component, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { trigger, transition, style, animate } from '@angular/animations';

declare var MusicKit: any;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
  animations: [
    policyAnimation,
    stepAnimation,
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

    this.isMobile = this.isMobileOrTablet();

    if (this.isMobile || this.windowWidth < 600) {
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
    private cookieService: CookieService
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

    const isMobile = this.isMobileOrTablet();

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
    const clientID = 'e927df0934d7411181641fbd99a56f3c';
    const redirectURL = environment.redirect;
    const scope = 'user-library-modify user-read-private user-follow-modify user-read-email';
    const state = `spotify_${this.dataId}`;

    // tslint:disable-next-line: max-line-length
    const loginUrl = `${rootUrl}?client_id=${clientID}&response_type=code&redirect_uri=${redirectURL}&scope=${encodeURIComponent(scope)}&state=${state}`;
    window.location.href = loginUrl;

  }

  onAppleLogin() {

    const hasSaved = localStorage.getItem('appleSave');

    if (hasSaved === 'true') {

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

  private isMobileOrTablet() {
    let check = false;
    // @ts-ignore
    ((a) => { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) { check = true; } })(navigator.userAgent || navigator.vendor || window.opera);
    return check;
  }

  onSpotifyListen() {
    // TODO: Change to new link
    window.location.href = 'https://open.spotify.com/track/0cR04cbujsPTTyKUazySY0';
  }

  onAppleListen() {
    // TODO: Change to new link
    window.location.href = 'https://music.apple.com/us/album/open-blinds-single/1521225746';
  }

  onStart() {
    this.stage = 'data';
    this.cookieService.setConsent();
  }

  onShowPolicy() {
    this.showPolicy = true;
  }

  onHidePolicy() {
    this.showPolicy = false;
  }

  onContinue() {

    let nextStage = this.stage;

    console.log(`Second background loaded: ${this.preloadedImages.backgroundImg2.complete}`);

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
