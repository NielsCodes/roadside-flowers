import { __awaiter, __decorate } from "tslib";
import { environment } from './../../environments/environment';
import { Component, HostListener } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { detect } from 'detect-browser';
const detectBrowser = detect();
let CallbackComponent = class CallbackComponent {
    constructor(route, router, afs, http, clipboard, api, cookieService, analytics) {
        this.route = route;
        this.router = router;
        this.afs = afs;
        this.http = http;
        this.clipboard = clipboard;
        this.api = api;
        this.cookieService = cookieService;
        this.analytics = analytics;
        this.pageURL = 'https://presave.droeloe.com';
        this.presaveSuccessful = false;
        this.loadingState = 'loading';
        this.shareState = 'inactive';
        this.fallbackActive = false;
        this.subscribedToNewsletter = false;
        this.isSubscribing = false;
        this.snackbarTxt = '';
        this.snackbarActive = false;
        this.sharedToTwitter = false;
        this.rootEndpoint = environment.endpoint;
        this.nav = window.navigator;
        this.canShare = false;
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
                if (this.cookieService.trackingActive) {
                    fbq('trackCustom', 'presave', { platform: 'messenger' });
                    this.analytics.logEvent('presave', { platform: 'messenger' });
                }
                this.updateLoadingState();
            }
            else if (ref === 'apple') {
                this.referrer = 'apple';
                this.dataId = params.get('dataId');
                if (params.has('status')) {
                    this.presaveSuccessful = true;
                    this.updateLoadingState();
                }
                else {
                    this.api.hasSaved.subscribe((appleState) => {
                        this.presaveSuccessful = appleState;
                        localStorage.setItem('appleSave', 'true');
                        localStorage.setItem('appleCampaign', 'RF');
                        this.updateLoadingState();
                        if (this.cookieService.trackingActive) {
                            fbq('trackCustom', 'presave', { platform: 'apple' });
                            this.analytics.logEvent('presave', { platform: 'apple' });
                        }
                    });
                }
            }
            else if (code !== null && URLState.includes('spotify_')) {
                this.referrer = 'spotify';
                const uuidRegex = /[A-Za-z0-9]{8}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{12}/;
                this.dataId = URLState.match(uuidRegex)[0];
                this.http.post(`${this.rootEndpoint}/spotify`, { auth_code: code, dataId: this.dataId }).toPromise()
                    .then((res) => {
                    if (res.success) {
                        this.presaveSuccessful = true;
                        this.updateLoadingState();
                        if (this.cookieService.trackingActive) {
                            fbq('trackCustom', 'presave', { platform: 'spotify' });
                            this.analytics.logEvent('presave', { platform: 'spotify' });
                        }
                    }
                    else {
                        this.router.navigate(['/']);
                    }
                })
                    .catch(err => {
                    console.error(err);
                    this.router.navigate(['/']);
                });
            }
            else {
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
    onResize(event) {
        this.windowHeight = window.innerHeight;
        this.windowWidth = window.innerWidth;
        if (this.isMobileOrTablet() || this.windowWidth < 600) {
            this.isVertical = true;
        }
        else {
            if ((window.innerHeight > window.innerWidth)) {
                this.isVertical = true;
            }
            else {
                this.isVertical = false;
            }
        }
    }
    // Redirect back to home if loading state has not changed after 10 seconds
    ngOnInit() {
        setTimeout(() => {
            if (this.loadingState === 'loading') {
                console.error('Something went wrong...');
                this.router.navigate(['']);
            }
        }, 10000);
    }
    updateLoadingState() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.presaveSuccessful) {
                if (this.dataId === undefined) {
                    this.dataId = localStorage.getItem('dataID');
                }
                this.urls = yield this.api.getPictures(this.dataId);
                this.loadingState = 'loaded';
                this.startIntro();
            }
        });
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
    onCopyToClipboard() {
        this.clipboard.copy(this.pageURL);
        this.showSnackbar('Copied to clipboard!');
    }
    // Share on Facebook
    onShareToFacebook() {
        const facebookBaseURL = 'https://www.facebook.com/sharer/sharer.php?u=';
        const shareURL = encodeURI(`${facebookBaseURL}${this.pageURL}`);
        window.open(shareURL, 'Share to Facebook', 'left=0,top=0,height=500,width=500');
        fbq('trackCustom', 'presaveShare', { platform: 'facebook' });
        this.analytics.logEvent('presaveShare', { platform: 'facebook' });
    }
    // Share on Twitter
    onShareToTwitter() {
        // Return if the user has already shared to Twitter
        if (this.sharedToTwitter) {
            return;
        }
        const windowFeatures = 'toolbar=no, menubar=no, width=600, height=700, top=100, left=100';
        const url = `${this.rootEndpoint}/auth/twitter?dataId=${this.dataId}`;
        if (this.popupReference === null || this.popupReference === undefined || this.popupReference.closed) {
            this.popupReference = window.open(url, 'Share to Twitter', windowFeatures);
        }
        else {
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
                fbq('trackCustom', 'presaveShare', { platform: 'twitter' });
                this.analytics.logEvent('presaveShare', { platform: 'twitter' });
            }
        };
        window.addEventListener('message', handleMessage);
    }
    // Open share menu on mobile devices
    onMobileShare() {
        this.nav.share({
            title: '🌺',
            url: this.pageURL
        });
        fbq('trackCustom', 'presaveShare', { platform: 'mobile' });
        this.analytics.logEvent('presaveShare', { platform: 'mobile' });
    }
    onDownload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.fallbackActive = true;
            yield this.api.downloadPictures(this.urls.vertical, this.urls.horizontal);
            fbq('trackCustom', 'ticketDownload');
            this.analytics.logEvent('ticketDownload');
        });
    }
    onNewsletterConsent() {
        return __awaiter(this, void 0, void 0, function* () {
            // Return if the user has already subscribed to the newsletter
            if (this.subscribedToNewsletter) {
                return;
            }
            this.isSubscribing = true;
            try {
                yield this.api.subscribeToNewsletter(this.dataId);
                this.subscribedToNewsletter = true;
                this.showSnackbar('Subscribed to the newsletter');
            }
            catch (error) {
                console.error(error);
            }
            this.isSubscribing = false;
        });
    }
    /**
     * Show snackbar popup
     * @param message Message to show in the snackbar
     */
    showSnackbar(message) {
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
    isMobileOrTablet() {
        let check = false;
        // @ts-ignore
        ((a) => { if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) {
            check = true;
        } })(navigator.userAgent || navigator.vendor || window.opera);
        return check;
    }
};
__decorate([
    HostListener('window:resize', ['$event'])
], CallbackComponent.prototype, "onResize", null);
CallbackComponent = __decorate([
    Component({
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
], CallbackComponent);
export { CallbackComponent };
//# sourceMappingURL=callback.component.js.map