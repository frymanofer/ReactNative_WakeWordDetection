#import "SceneDelegate.h"

#import "AppDelegate.h"

@implementation SceneDelegate

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }

  AppDelegate *appDelegate = (AppDelegate *)[UIApplication sharedApplication].delegate;
  if (![appDelegate isKindOfClass:[AppDelegate class]] || appDelegate.reactNativeFactory == nil) {
    return;
  }

  UIWindow *window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  self.window = window;
  appDelegate.window = window;

  [appDelegate.reactNativeFactory startReactNativeWithModuleName:@"ExampleApp"
                                                        inWindow:window
                                               initialProperties:@{}
                                                   launchOptions:appDelegate.launchOptions];
}

@end
