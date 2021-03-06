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

import { AddonBlockMyOverviewComponent } from '@addons/block/myoverview/components/myoverview/myoverview';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CoreBlockComponent } from '@features/block/components/block/block';
import { CoreCourseBlock } from '@features/course/services/course';
import { CoreCoursesDashboard, CoreCoursesDashboardProvider } from '@features/courses/services/dashboard';
import { IonRefresher } from '@ionic/angular';
import { CoreNavigator } from '@services/navigator';
import { CoreSites } from '@services/sites';
import { CoreUtils } from '@services/utils/utils';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreCourses } from '../../services/courses';

/**
 * Page that shows a my courses.
 */
@Component({
    selector: 'page-core-courses-my',
    templateUrl: 'my.html',
    styleUrls: ['my.scss'],
})
export class CoreCoursesMyCoursesPage implements OnInit, OnDestroy {

    @ViewChild(CoreBlockComponent) block!: CoreBlockComponent;

    searchEnabled = false;
    downloadCoursesEnabled = false;
    userId: number;
    loadedBlock?: Partial<CoreCourseBlock>;
    myOverviewBlock?: AddonBlockMyOverviewComponent;
    loaded = false;

    protected updateSiteObserver: CoreEventObserver;

    constructor() {
        // Refresh the enabled flags if site is updated.
        this.updateSiteObserver = CoreEvents.on(CoreEvents.SITE_UPDATED, () => {
            this.searchEnabled = !CoreCourses.isSearchCoursesDisabledInSite();
            this.downloadCoursesEnabled = !CoreCourses.isDownloadCoursesDisabledInSite();
        }, CoreSites.getCurrentSiteId());

        this.userId = CoreSites.getCurrentSiteUserId();
    }

    /**
     * @inheritdoc
     */
    ngOnInit(): void {
        this.searchEnabled = !CoreCourses.isSearchCoursesDisabledInSite();
        this.downloadCoursesEnabled = !CoreCourses.isDownloadCoursesDisabledInSite();

        this.loadContent();

    }

    /**
     * Load my overview block instance.
     */
    protected async loadContent(): Promise<void> {
        const available = await CoreCoursesDashboard.isAvailable();
        const disabled = await CoreCourses.isMyCoursesDisabled();

        if (available && !disabled) {
            try {
                const blocks = await CoreCoursesDashboard.getDashboardBlocksFromWS(CoreCoursesDashboardProvider.MY_PAGE_COURSES);

                this.loadedBlock = blocks.find((block) => block.name == 'myoverview');

                await CoreUtils.nextTicks(2);

                this.myOverviewBlock = this.block?.dynamicComponent?.instance as AddonBlockMyOverviewComponent;
            } catch {
                // Cannot get the blocks, just show the block if needed.
                this.loadFallbackBlock();
            }
        } else if (!available) {
            // WS not available, or my courses page not available. show fallback block.
            this.loadFallbackBlock();
        } else {
            // Disabled.
            this.loadedBlock = undefined;
        }

        this.loaded = true;
    }

    /**
     * Load fallback blocks.
     */
    protected loadFallbackBlock(): void {
        this.loadedBlock = {
            name: 'myoverview',
            visible: true,
        };
    }

    /**
     * Open page to manage courses storage.
     */
    manageCoursesStorage(): void {
        CoreNavigator.navigateToSitePath('/storage');
    }

    /**
     * Go to search courses.
     */
    async openSearch(): Promise<void> {
        CoreNavigator.navigateToSitePath('/list', { params : { mode: 'search' } });
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     */
    async refresh(refresher?: IonRefresher): Promise<void> {

        const promises: Promise<void>[] = [];

        promises.push(CoreCoursesDashboard.invalidateDashboardBlocks(CoreCoursesDashboardProvider.MY_PAGE_COURSES));

        // Invalidate the blocks.
        if (this.myOverviewBlock) {
            promises.push(CoreUtils.ignoreErrors(this.myOverviewBlock.doRefresh()));
        }

        Promise.all(promises).finally(() => {
            this.loadContent().finally(() => {
                refresher?.complete();
            });
        });
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.updateSiteObserver?.off();
    }

}
