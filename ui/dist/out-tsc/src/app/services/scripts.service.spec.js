import { TestBed } from '@angular/core/testing';
import { ScriptsService } from './scripts.service';
describe('ScriptsService', () => {
    let service;
    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ScriptsService);
    });
    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
//# sourceMappingURL=scripts.service.spec.js.map