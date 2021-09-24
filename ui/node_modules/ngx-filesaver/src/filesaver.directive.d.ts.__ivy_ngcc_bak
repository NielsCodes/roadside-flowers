import { ElementRef, EventEmitter } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FileSaverOptions } from 'file-saver';
import { FileSaverService } from './filesaver.service';
export declare class FileSaverDirective {
    private el;
    private fss;
    private httpClient;
    method: string;
    http: Observable<HttpResponse<Blob>>;
    query: any;
    header: any;
    url: string;
    fileName: string;
    fsOptions: FileSaverOptions;
    readonly success: EventEmitter<HttpResponse<Blob>>;
    readonly error: EventEmitter<any>;
    constructor(el: ElementRef<HTMLButtonElement>, fss: FileSaverService, httpClient: HttpClient);
    private getName;
    _click(): void;
    private setDisabled;
}
