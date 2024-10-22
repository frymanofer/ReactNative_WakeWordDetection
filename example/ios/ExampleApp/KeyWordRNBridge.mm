#import "KeyWordRNBridge.h"
#import <React/RCTBridge.h>
#import <React/RCTLog.h>
#import <React/RCTEventEmitter.h>
// #import <ExpoModulesCore-Swift.h>
//#import <porcuSafe-Swift.h>

@implementation KeyWordRNBridge

//NSString *licenseKey = @"MTcyNTEzODAwMDAwMA==-wXgQkH4ffgX3g3Tvn7YJZ/kVoTa5Mndi8xpoTqtdXfA=";

RCT_EXPORT_MODULE();

+ (instancetype)sharedInstance {
    static KeyWordRNBridge *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[self alloc] init];
    });
    return sharedInstance;
}

RCT_EXPORT_METHOD(initKeywordDetection:(NSString *)modelName threshold:(float)threshold bufferCnt:(NSInteger)bufferCnt resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    @try {
        if ([GlobalVariables shared].keyWordsDetectionInstance == nil) {
            [GlobalVariables shared].modelName = modelName;
            [GlobalVariables shared].threshold = threshold;
            [GlobalVariables shared].bufferCnt = bufferCnt;
            
            KeyWordsDetection *keyWordsDetection = [[KeyWordsDetection alloc] initWithModelPath:modelName threshold:threshold bufferCnt:bufferCnt error:nil];
            [GlobalVariables shared].keyWordsDetectionInstance = keyWordsDetection;
            keyWordsDetection.delegate = self;
            resolve(@"KeyWordsDetection initialized");
        } else {
            resolve(@"KeyWordsDetection already initialized");
        }
    }
    @catch (NSException *exception) {
        reject(@"init_error", @"Failed to initialize KeyWordsDetection", nil);
    }
}

RCT_EXPORT_METHOD(replaceKeywordDetectionModel:(NSString *)modelName threshold:(float)threshold bufferCnt:(NSInteger)bufferCnt resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    if ([GlobalVariables shared].keyWordsDetectionInstance == nil) {
        [self initKeywordDetection:modelName threshold:threshold bufferCnt:bufferCnt resolver:resolve rejecter:reject];
        resolve(@"KeyWordsDetection replaceKeywordDetectionModel called initialized");
    }
    else {
        KeyWordsDetection *keyWordsDetection = [GlobalVariables shared].keyWordsDetectionInstance;
        NSError *error = nil;
        if (keyWordsDetection) {
            [keyWordsDetection replaceKeywordDetectionModelWithModelPath:modelName threshold:threshold bufferCnt:bufferCnt error:nil];
        } else {
            //RCTLogError(@"KeywordDetection not initialized");
        }
        resolve(@"KeyWordsDetection replaceKeywordDetectionModel");
    }
}

RCT_EXPORT_METHOD(getKeywordDetectionModel: resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetection *keyWordsDetection = [GlobalVariables shared].keyWordsDetectionInstance;
    NSString *modelName = @"";
    if (keyWordsDetection) {
        modelName = [keyWordsDetection getKeywordDetectionModel];
    }
    resolve(modelName);
}

RCT_EXPORT_METHOD(getRecordingWav:(NSString *)bla resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
//RCT_EXPORT_METHOD(getRecordingWav: resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetection *keyWordsDetection = [GlobalVariables shared].keyWordsDetectionInstance;
    NSString *recWavPath = @"";
    if (keyWordsDetection) {
        recWavPath = [keyWordsDetection getRecordingWav];
    }
    resolve(recWavPath);
}

RCT_EXPORT_METHOD(setKeywordDetectionLicense:(NSString *)licenseKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetection *keyWordsDetection = [GlobalVariables shared].keyWordsDetectionInstance;
    BOOL isLicensed = NO;
    if (keyWordsDetection) {
        isLicensed = [keyWordsDetection setLicenseWithLicenseKey:licenseKey];
        NSLog(@"License is valid?: %@", isLicensed ? @"YES" : @"NO");
    }
    resolve(@(isLicensed)); // Wrapping the BOOL in an NSNumber
}

RCT_EXPORT_METHOD(startKeywordDetection)
{
    KeyWordsDetection *keyWordsDetection = [GlobalVariables shared].keyWordsDetectionInstance;
    NSError *error = nil;
    if (keyWordsDetection) {
        [keyWordsDetection startListeningAndReturnError:&error];
    } else {
        //RCTLogError(@"KeywordDetection not initialized");
    }
}

RCT_EXPORT_METHOD(stopKeywordDetection)
{
    KeyWordsDetection *keyWordsDetection = [GlobalVariables shared].keyWordsDetectionInstance;
    if (keyWordsDetection) {
        [keyWordsDetection stopListening];
    } else {
        //RCTLogError(@"initialized");
    }
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onKeywordDetectionEvent"];
}

// This method will be called when the KeywordDetectionClass detects an event
- (void)KeywordDetectionDidDetectEvent:(NSDictionary *)eventInfo {
    [self sendEventWithName:@"onKeywordDetectionEvent" body:eventInfo];
}

@end
