import { __awaiter, __decorate } from "tslib";
import { environment } from './../../environments/environment';
import { Injectable } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
let ApiService = class ApiService {
    constructor(http, filesaver) {
        this.http = http;
        this.filesaver = filesaver;
        this.hasSaved = new BehaviorSubject(false);
        this.rootEndpoint = environment.endpoint;
    }
    /** Get Apple Developer token from server */
    getAppleToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = `${this.rootEndpoint}/devtoken`;
            const res = yield this.http.get(endpoint).toPromise();
            if (res.success) {
                return res.token;
            }
            else {
                return null;
            }
        });
    }
    /**
     * Register Apple presave
     * @param token Apple Music User token
     */
    registerApplePresave(token) {
        return __awaiter(this, void 0, void 0, function* () {
            const dataId = localStorage.getItem('dataID');
            const endpoint = `${this.rootEndpoint}/apple`;
            try {
                const res = yield this.http.post(endpoint, { token, dataId }).toPromise();
                if (res.success) {
                    this.hasSaved.next(true);
                }
                else {
                    throw new Error('Failed to register Apple Music presave');
                }
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    /** Create unique ID to retrieve rendered tickets from server */
    createDataID() {
        const uuid = uuidv4();
        localStorage.setItem('dataID', uuid);
        return uuid;
    }
    /**
     * Register ticket data on server and generate tickets
     * @param fromName UGC: 'From' name
     * @param toName UGC: 'To' name
     * @param message UGC: 'Message'
     * @param id ID to link to back-end
     */
    registerData(fromName, toName, message, id) {
        return __awaiter(this, void 0, void 0, function* () {
            const endpoint = `${this.rootEndpoint}/register`;
            try {
                const res = yield this.http.post(endpoint, {
                    fromName,
                    toName,
                    message,
                    id
                }).toPromise();
                if (res.success) {
                }
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    /**
     * Download ticket
     * - Get file URLs from Google Cloud Storage by unique data ID
     */
    getPictures(dataId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (dataId === null) {
                throw Error('No valid data ID found');
            }
            const endpoint = `${this.rootEndpoint}/pictures`;
            try {
                const res = yield this.http.get(endpoint, {
                    params: {
                        id: dataId
                    }
                }).toPromise();
                return res.urls;
            }
            catch (error) {
                console.error(error);
            }
        });
    }
    /** Download ticket files to devices from passed URLs */
    downloadPictures(verticalPictureURL, horizontalPictureURL) {
        return __awaiter(this, void 0, void 0, function* () {
            const blobPromises = [];
            const verticalRes = this.http.get(verticalPictureURL, {
                responseType: 'arraybuffer',
                headers: new HttpHeaders({
                    'Content-Type': 'image/jpeg'
                }),
            }).toPromise();
            const horizontalRes = this.http.get(horizontalPictureURL, {
                responseType: 'arraybuffer',
                headers: new HttpHeaders({
                    'Content-Type': 'image/jpeg'
                }),
            }).toPromise();
            blobPromises.push(verticalRes);
            blobPromises.push(horizontalRes);
            const [verticalBlob, horizontalBlob] = yield Promise.all(blobPromises);
            this.downloadFile(horizontalBlob, 'DROELOE 16x9');
            this.downloadFile(verticalBlob, 'DROELOE 9x16');
        });
    }
    /**
     * Subscribe user to Klaviyo newsletter
     * - Sends data ID to backend, which uses the previously retrieved Spotify email to subscribe
     */
    subscribeToNewsletter(dataId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (dataId === null) {
                throw Error('No valid data ID found');
            }
            const endpoint = `${this.rootEndpoint}/newsletter`;
            try {
                const res = yield this.http.post(endpoint, {
                    dataId
                }).toPromise();
                if (!res.success) {
                    throw Error(`Something went wrong. Not able to subscribe to newsletter. Message from server: ${res.message}`);
                }
            }
            catch (error) {
                throw Error(error);
            }
        });
    }
    /**
     * Turn blob into file and download to device
     * @param data Blob data to turn into file
     * @param filename Desired output file name
     */
    downloadFile(data, filename) {
        const blob = new Blob([data], { type: 'image/jpeg' });
        this.filesaver.save(blob, `${filename}.jpg`);
    }
};
ApiService = __decorate([
    Injectable({
        providedIn: 'root'
    })
], ApiService);
export { ApiService };
//# sourceMappingURL=api.service.js.map