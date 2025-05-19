#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
//#import "porcuSafe-Swift.h" // Replace with your actual project name
#import <KeyWordDetection/KeyWordDetection-Swift.h>

@interface KeyWordRNBridge : RCTEventEmitter <RCTBridgeModule, KeywordDetectionRNDelegate>
// @interface KeyWordRNBridge : NSObject <RCTBridgeModule, KeywordDetectionRNDelegate>
//@interface KeyWordRNBridge : RCTEventEmitter <RCTBridgeModule>
+ (void)sendEventWithName:(NSString *)name body:(id)body;
@end

/*

@interface KeyWordRNBridge : RCTEventEmitter <RCTBridgeModule>
+ (instancetype)sharedInstance;
- (void)KeywordDetectionDidDetectEvent:(NSDictionary *)eventInfo;
@end
*/
