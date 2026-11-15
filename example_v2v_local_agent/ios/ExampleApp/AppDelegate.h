#import <React-RCTAppDelegate/RCTDefaultReactNativeFactoryDelegate.h>
#import <React-RCTAppDelegate/RCTReactNativeFactory.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// The app delegate only sets up React Native. The window itself is created by
/// SceneDelegate, because iOS 27 requires the UIScene lifecycle.
@interface AppDelegate : UIResponder <UIApplicationDelegate>

/// Under the UIScene lifecycle UIKit ignores this property, but React Native 0.82
/// helpers (RCTLogBoxView, RCTDeviceInfo, RCTProfile) still read
/// `UIApplication.delegate.window`, so SceneDelegate assigns its window here.
@property (nonatomic, strong, nullable) UIWindow *window;
@property (nonatomic, strong, nullable) RCTReactNativeFactory *reactNativeFactory;
@property (nonatomic, strong, nullable) RCTDefaultReactNativeFactoryDelegate *reactNativeDelegate;
@property (nonatomic, copy, nullable) NSDictionary *launchOptions;

@end

NS_ASSUME_NONNULL_END
