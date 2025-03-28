/*
Copyright 2024 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

#import "AdobeBridge.h"
#import <UIKit/UIKit.h>

@import AEPCore;
@import AEPLifecycle;
@import AEPSignal;
@import AEPIdentity;
@import AEPAssurance;
@import AEPCampaignClassic;
@import AEPEdge;
@import AEPEdgeBridge;
@import AEPEdgeConsent;
@import AEPEdgeIdentity;
@import AEPMessaging;
@import AEPOptimize;
@import AEPPlaces;
@import AEPTarget;
@import AEPUserProfile;
@import AEPServices;

@implementation AdobeBridge

+ (void)configure:(UIApplicationState)appState {
    [AEPMobileCore setLogLevel:AEPLogLevelDebug];

    NSArray *extensionsToRegister = @[
        AEPMobileIdentity.class, AEPMobileLifecycle.class,
        AEPMobileSignal.class, AEPMobileAssurance.class,
        AEPMobileCampaignClassic.class, AEPMobileEdge.class,
        AEPMobileEdgeBridge.class, AEPMobileEdgeConsent.class,
        AEPMobileEdgeIdentity.class, AEPMobileMessaging.class,
        AEPMobileOptimize.class, AEPMobilePlaces.class,
        AEPMobileTarget.class, AEPMobileUserProfile.class
    ];

    [AEPMobileCore registerExtensions:extensionsToRegister completion:^{
        [AEPMobileCore configureWithAppId:@"d4b7d80f6e21/6b1086c5b3d0/launch-065f91be4881-development"];

        if (appState != UIApplicationStateBackground) {
            [AEPMobileCore lifecycleStart:nil]; // Added for foreground handling
        }
    }];
}

+ (void)lifecycleStart
{
    [AEPMobileCore lifecycleStart:nil];
}

+ (void)lifecyclePause
{
    [AEPMobileCore lifecyclePause];
}

@end