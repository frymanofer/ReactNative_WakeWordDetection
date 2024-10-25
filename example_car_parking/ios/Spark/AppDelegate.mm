#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Foundation/Foundation.h> // For NSUserActivity

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"Spark";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  // Setup Siri Shortcuts
  [self setupSiriShortcut];

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

- (BOOL)application:(UIApplication *)application
    continueUserActivity:(NSUserActivity *)userActivity
    restorationHandler:(void (^)(NSArray * _Nullable))restorationHandler {

    if ([userActivity.activityType isEqualToString:@"com.pango.openApp"] || [userActivity.activityType isEqualToString:@"com.spark.openApp"]) {
        // Handle the shortcut to open Pango or Spark
        NSLog(@"App launched via Siri with activity type: %@", userActivity.activityType);
        // You can add code here to navigate to a specific view or perform an action
    }

    return YES;
}

// Add the Siri Shortcut setup method
- (void)setupSiriShortcut
{
  // Shortcut for "Open Pango"
  NSUserActivity *tangoActivity = [[NSUserActivity alloc] initWithActivityType:@"com.tango.openApp"];
  tangoActivity.title = @"Open Tango";
  tangoActivity.eligibleForSearch = YES;
  tangoActivity.eligibleForPrediction = YES;
  tangoActivity.persistentIdentifier = @"com.tango.openApp";
  self.userActivity = tangoActivity;
  [tangoActivity becomeCurrent];

  NSUserActivity *pangoActivity = [[NSUserActivity alloc] initWithActivityType:@"com.pango.openApp"];
  pangoActivity.title = @"Open Pango";
  pangoActivity.eligibleForSearch = YES;
  pangoActivity.eligibleForPrediction = YES;
  pangoActivity.persistentIdentifier = @"com.pango.openApp";
  self.userActivity = pangoActivity;
  [pangoActivity becomeCurrent];
  
  // Shortcut for "Open Spark"
  NSUserActivity *sparkActivity = [[NSUserActivity alloc] initWithActivityType:@"com.spark.openApp"];
  sparkActivity.title = @"Open Spark";
  sparkActivity.eligibleForSearch = YES;
  sparkActivity.eligibleForPrediction = YES;
  sparkActivity.persistentIdentifier = @"com.spark.openApp";
  self.userActivity = sparkActivity;
  [sparkActivity becomeCurrent];
}

@end
