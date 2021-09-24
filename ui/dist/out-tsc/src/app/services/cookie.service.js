import { __decorate } from "tslib";
import { BehaviorSubject } from 'rxjs';
import { Injectable } from '@angular/core';
let CookieService = class CookieService {
    constructor(analytics, scripts) {
        this.analytics = analytics;
        this.scripts = scripts;
        this.hasConsented = new BehaviorSubject(false);
        this.trackingActive = false;
        this.checkConsent();
    }
    checkConsent() {
        const local = localStorage.getItem('cookieConsent');
        if (local === 'true') {
            this.hasConsented.next(true);
            // If tracking has not been initialized yet
            if (!this.trackingActive) {
                this.setTracking();
            }
        }
        else {
            this.hasConsented.next(false);
        }
        return this.hasConsented;
    }
    setConsent() {
        // Set local storage item
        localStorage.setItem('cookieConsent', 'true');
        this.setTracking();
        this.checkConsent();
    }
    removeConsent() {
        localStorage.removeItem('cookieConsent');
        // Disable Firebase analytics
        this.analytics.setAnalyticsCollectionEnabled(false);
        // Remove FB Pixel
        this.scripts.removePixel();
        this.trackingActive = false;
        this.checkConsent();
    }
    setTracking() {
        // Enable Firebase analytics
        this.analytics.setAnalyticsCollectionEnabled(true);
        // Enable FB Pixel
        this.scripts.loadPixel();
        this.trackingActive = true;
    }
};
CookieService = __decorate([
    Injectable({
        providedIn: 'root'
    })
], CookieService);
export { CookieService };
//# sourceMappingURL=cookie.service.js.map