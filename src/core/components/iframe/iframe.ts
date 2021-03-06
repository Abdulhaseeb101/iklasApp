// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
    Component, Input, Output, ViewChild, ElementRef, EventEmitter, OnChanges, SimpleChange, OnDestroy,
} from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

import { CoreFile } from '@services/file';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreUrlUtils } from '@services/utils/url';
import { CoreIframeUtils } from '@services/utils/iframe';
import { CoreUtils } from '@services/utils/utils';
import { DomSanitizer, StatusBar } from '@singletons';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreScreen, CoreScreenOrientation } from '@services/screen';

@Component({
    selector: 'core-iframe',
    templateUrl: 'core-iframe.html',
    styleUrls: ['iframe.scss'],
})
export class CoreIframeComponent implements OnChanges, OnDestroy {

    static loadingTimeout = 15000;

    @ViewChild('iframe') iframe?: ElementRef;
    @Input() src?: string;
    @Input() iframeWidth?: string;
    @Input() iframeHeight?: string;
    @Input() allowFullscreen?: boolean | string;
    @Input() showFullscreenOnToolbar?: boolean | string;
    @Input() autoFullscreenOnRotate?: boolean | string;
    @Output() loaded: EventEmitter<HTMLIFrameElement> = new EventEmitter<HTMLIFrameElement>();

    loading?: boolean;
    safeUrl?: SafeResourceUrl;
    displayHelp = false;
    fullscreen = false;

    initialized = false;

    protected style?: HTMLStyleElement;
    protected orientationObs?: CoreEventObserver;

    constructor() {
        this.loaded = new EventEmitter<HTMLIFrameElement>();
    }

    /**
     * Init the data.
     */
    protected init(): void {
        if (this.initialized) {
            return;
        }

        const iframe: HTMLIFrameElement | undefined = this.iframe?.nativeElement;
        if (!iframe) {
            return;
        }

        this.initialized = true;

        this.iframeWidth = (this.iframeWidth && CoreDomUtils.formatPixelsSize(this.iframeWidth)) || '100%';
        this.iframeHeight = (this.iframeHeight && CoreDomUtils.formatPixelsSize(this.iframeHeight)) || '100%';
        this.allowFullscreen = CoreUtils.isTrueOrOne(this.allowFullscreen);
        this.showFullscreenOnToolbar = CoreUtils.isTrueOrOne(this.showFullscreenOnToolbar);
        this.autoFullscreenOnRotate = CoreUtils.isTrueOrOne(this.autoFullscreenOnRotate);

        if (this.showFullscreenOnToolbar || this.autoFullscreenOnRotate) {
            const shadow =
                iframe.closest('.ion-page')?.querySelector('ion-header ion-toolbar')?.shadowRoot;
            if (shadow) {
                this.style = document.createElement('style');
                shadow.appendChild(this.style);
            }

            if (this.autoFullscreenOnRotate) {
                this.toggleFullscreen(CoreScreen.isLandscape);

                this.orientationObs = CoreEvents.on(CoreEvents.ORIENTATION_CHANGE, (data) => {
                    this.toggleFullscreen(data.orientation == CoreScreenOrientation.LANDSCAPE);
                });
            }
        }

        // Show loading only with external URLs.
        this.loading = !this.src || !CoreUrlUtils.isLocalFileUrl(this.src);

        CoreIframeUtils.treatFrame(iframe, false);

        iframe.addEventListener('load', () => {
            this.loading = false;
            this.loaded.emit(iframe); // Notify iframe was loaded.
        });

        iframe.addEventListener('error', () => {
            this.loading = false;
            CoreDomUtils.showErrorModal('core.errorloadingcontent', true);
        });

        if (this.loading) {
            setTimeout(() => {
                this.loading = false;
            }, CoreIframeComponent.loadingTimeout);
        }
    }

    /**
     * Detect changes on input properties.
     */
    async ngOnChanges(changes: {[name: string]: SimpleChange }): Promise<void> {
        if (changes.src) {
            const url = CoreUrlUtils.getYoutubeEmbedUrl(changes.src.currentValue) || changes.src.currentValue;
            this.displayHelp = CoreIframeUtils.shouldDisplayHelpForUrl(url);

            await CoreIframeUtils.fixIframeCookies(url);

            this.safeUrl = DomSanitizer.bypassSecurityTrustResourceUrl(CoreFile.convertFileSrc(url));

            // Now that the URL has been set, initialize the iframe. Wait for the iframe to the added to the DOM.
            setTimeout(() => {
                this.init();
            });
        }
    }

    /**
     * Open help modal for iframes.
     */
    openIframeHelpModal(): void {
        CoreIframeUtils.openIframeHelpModal();
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.toggleFullscreen(false);
        this.orientationObs?.off();
    }

    /**
     * Toggle fullscreen mode.
     */
    toggleFullscreen(enable?: boolean): void {
        if (enable !== undefined) {
            this.fullscreen = enable;
        } else {
            this.fullscreen = !this.fullscreen;
        }

        this.fullscreen ? StatusBar.hide() : StatusBar.show();

        if (this.style) {
            // Done this way because of the shadow DOM.
            this.style.textContent = this.fullscreen
                ? '@media screen and (orientation: landscape) {\
                    .toolbar-container { flex-direction: column-reverse !important; height: 100%; } }'
                : '';
        }

        document.body.classList.toggle('core-iframe-fullscreen', this.fullscreen);
    }

}
