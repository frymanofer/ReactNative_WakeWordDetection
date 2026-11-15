#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@interface ReactNativeDelegate : RCTDefaultReactNativeFactoryDelegate
@end

@implementation ReactNativeDelegate

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

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  ReactNativeDelegate *delegate = [ReactNativeDelegate new];
  delegate.dependencyProvider = [RCTAppDependencyProvider new];

  self.reactNativeDelegate = delegate;
  self.reactNativeFactory = [[RCTReactNativeFactory alloc] initWithDelegate:delegate];
  self.launchOptions = launchOptions;

  // The UIWindow is created in SceneDelegate (scene:willConnectToSession:options:).
  return YES;
}

@end
