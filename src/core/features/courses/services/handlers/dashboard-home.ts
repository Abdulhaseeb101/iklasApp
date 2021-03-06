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

import { Injectable } from '@angular/core';
import { CoreBlockDelegate } from '@features/block/services/block-delegate';
import { CoreMainMenuHomeHandler, CoreMainMenuHomeHandlerToDisplay } from '@features/mainmenu/services/home-delegate';
import { makeSingleton } from '@singletons';
import { CoreCoursesDashboard } from '../dashboard';

/**
 * Handler to add dashboard into home page.
 */
@Injectable({ providedIn: 'root' })
export class CoreDashboardHomeHandlerService implements CoreMainMenuHomeHandler {

    static readonly PAGE_NAME = 'dashboard';

    name = 'CoreCoursesDashboard';
    priority = 1200;

    /**
     * Check if the handler is enabled on a site level.
     *
     * @return Whether or not the handler is enabled on a site level.
     */
    isEnabled(): Promise<boolean> {
        return this.isEnabledForSite();
    }

    /**
     * Check if the handler is enabled on a certain site.
     *
     * @param siteId Site ID. If not defined, current site.
     * @return Whether or not the handler is enabled on a site level.
     */
    async isEnabledForSite(siteId?: string): Promise<boolean> {
        const promises: Promise<void>[] = [];
        let blocksEnabled = false;
        let dashboardAvailable = false;
        let dashboardEnabled = false;

        // Check if blocks and 3.6 dashboard is enabled.
        promises.push(CoreBlockDelegate.areBlocksDisabled(siteId).then((disabled) => {
            blocksEnabled = !disabled;

            return;
        }));

        promises.push(CoreCoursesDashboard.isDisabled(siteId).then((disabled) => {
            dashboardEnabled = !disabled;

            return;
        }));

        promises.push(CoreCoursesDashboard.isAvailable(siteId).then((available) => {
            dashboardAvailable = available;

            return;
        }));

        await Promise.all(promises);

        if (dashboardAvailable && dashboardEnabled && blocksEnabled) {
            const blocks = await CoreCoursesDashboard.getDashboardBlocks(undefined, siteId);

            return CoreBlockDelegate.hasSupportedBlock(blocks.mainBlocks) || CoreBlockDelegate.hasSupportedBlock(blocks.sideBlocks);
        }

        // Dashboard is enabled but not available, we will fake blocks.
        return dashboardEnabled && blocksEnabled;
    }

    /**
     * Returns the data needed to render the handler.
     *
     * @return Data needed to render the handler.
     */
    getDisplayData(): CoreMainMenuHomeHandlerToDisplay {
        return {
            title: 'core.courses.mymoodle',
            page: CoreDashboardHomeHandlerService.PAGE_NAME,
            class: 'core-courses-dashboard-handler',
            icon: 'fas-tachometer-alt',
        };
    }

}

export const CoreDashboardHomeHandler = makeSingleton(CoreDashboardHomeHandlerService);
