import { environment } from './../../environments/environment';
import { AppleTokenResult } from './../../models/config.model';
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { FileSaverService } from 'ngx-filesaver';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  hasSaved: BehaviorSubject<boolean> = new BehaviorSubject(false);
  private rootEndpoint = environment.endpoint;

  constructor(
    private http: HttpClient,
    private filesaver: FileSaverService
  ) { }

  /** Get Apple Developer token from server */
  async getAppleToken() {

    const endpoint = `${this.rootEndpoint}/devtoken`;
    const res = await this.http.get<AppleTokenResult>(endpoint).toPromise();

    if (res.success) {
      return res.token;
    } else {
      return null;
    }

  }

  /**
   * Register Apple presave
   * @param token Apple Music User token
   */
  async registerApplePresave(token: string) {

    const dataId = localStorage.getItem('dataID');

    const endpoint = `${this.rootEndpoint}/apple`;
    try {
      const res = await this.http.post<{success: boolean, message: string}>(endpoint, { token, dataId }).toPromise();
      if (res.success) {
        this.hasSaved.next(true);
      } else {
        throw new Error('Failed to register Apple Music presave');
      }
    } catch (error) {
      console.error(error);
    }

  }

  /** Create unique ID to retrieve rendered tickets from server */
  createDataID(): string {
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
  async registerData(fromName: string, toName: string, message: string, id: string) {

    const endpoint = `${this.rootEndpoint}/register`;

    try {
      const res = await this.http.post<{success: boolean, message: string}>(endpoint, {
        fromName,
        toName,
        message,
        id
      }).toPromise();

      if (res.success) {
      }

    } catch (error) {
      console.error(error);
    }

  }

  /**
   * Download ticket
   * - Get file URLs from Google Cloud Storage by unique data ID
   */
  async getPictures(dataId: string) {

    if (dataId === null) {
      throw Error('No valid data ID found');
    }

    const endpoint = `${this.rootEndpoint}/pictures`;
    try {
      const res = await this.http.get<{success: boolean, urls: { vertical: string, horizontal: string}}>(endpoint, {
        params: {
          id: dataId
        }
      }).toPromise();

      return res.urls;

    } catch (error) {
      console.error(error);
    }

  }

  /** Download ticket files to devices from passed URLs */
  async downloadPictures(verticalPictureURL: string, horizontalPictureURL: string) {

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

    const [ verticalBlob, horizontalBlob ] = await Promise.all(blobPromises);
    this.downloadFile(horizontalBlob, 'DROELOE 16x9.jpg');
    this.downloadFile(verticalBlob, 'DROELOE 9x16.jpg');

  }

  /**
   * Turn blob into file and download to device
   * @param data Blob data to turn into file
   * @param filename Desired output file name
   */
  private downloadFile(data: string, filename: string) {
    const blob = new Blob([data], { type: 'image/jpeg' });
    this.filesaver.save(blob, `${filename}.jpg`);
  }

}
