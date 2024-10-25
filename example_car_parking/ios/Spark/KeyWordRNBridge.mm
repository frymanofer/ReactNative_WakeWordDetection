#import "KeyWordRNBridge.h"
#import <React/RCTBridge.h>
#import <React/RCTLog.h>
#import <React/RCTEventEmitter.h>
//#import "KeyWordsDetection.h" // Import your KeyWordsDetection library header

// Ensure the protocol is correctly imported or declared
// Assuming the protocol is named 'KeywordDetectionRNDelegate'
@interface KeyWordsDetectionWrapper : NSObject <KeywordDetectionRNDelegate>

@property (nonatomic, strong) KeyWordsDetection *keyWordsDetection;
@property (nonatomic, strong) NSString *instanceId;
@property (nonatomic, weak) KeyWordRNBridge *bridge;

- (instancetype)initWithInstanceId:(NSString *)instanceId
                         modelName:(NSString *)modelName
                         threshold:(float)threshold
                         bufferCnt:(NSInteger)bufferCnt
                            bridge:(KeyWordRNBridge *)bridge
                             error:(NSError **)error;

@end

@implementation KeyWordsDetectionWrapper

- (instancetype)initWithInstanceId:(NSString *)instanceId
                         modelName:(NSString *)modelName
                         threshold:(float)threshold
                         bufferCnt:(NSInteger)bufferCnt
                            bridge:(KeyWordRNBridge *)bridge
                             error:(NSError **)error
{
    if (self = [super init]) {
        _instanceId = instanceId;
        _bridge = bridge;
        _keyWordsDetection = [[KeyWordsDetection alloc] initWithModelPath:modelName threshold:threshold bufferCnt:bufferCnt error:error];
        if (*error) {
            return nil;
        }
        _keyWordsDetection.delegate = self;
    }
    return self;
}

// Implement the delegate method
- (void)KeywordDetectionDidDetectEvent:(NSDictionary *)eventInfo {
    NSMutableDictionary *mutableEventInfo = [eventInfo mutableCopy];
    mutableEventInfo[@"instanceId"] = self.instanceId;
    [_bridge sendEventWithName:@"onKeywordDetectionEvent" body:mutableEventInfo];
}

@end

@interface KeyWordRNBridge () <RCTBridgeModule>

@property (nonatomic, strong) NSMutableDictionary *instances;

@end

@implementation KeyWordRNBridge

RCT_EXPORT_MODULE();

- (instancetype)init {
    if (self = [super init]) {
        _instances = [NSMutableDictionary new];
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onKeywordDetectionEvent"];
}

RCT_EXPORT_METHOD(createInstance:(NSString *)instanceId modelName:(NSString *)modelName threshold:(float)threshold bufferCnt:(NSInteger)bufferCnt resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    if (self.instances[instanceId]) {
        reject(@"InstanceExists", [NSString stringWithFormat:@"Instance already exists with ID: %@", instanceId], nil);
        return;
    }

    NSError *error = nil;
    KeyWordsDetectionWrapper *wrapper = [[KeyWordsDetectionWrapper alloc] initWithInstanceId:instanceId modelName:modelName threshold:threshold bufferCnt:bufferCnt bridge:self error:&error];
    if (error) {
        reject(@"CreateError", [NSString stringWithFormat:@"Failed to create instance: %@", error.localizedDescription], nil);
    } else {
        self.instances[instanceId] = wrapper;
        resolve([NSString stringWithFormat:@"Instance created with ID: %@", instanceId]);
    }
}

RCT_EXPORT_METHOD(setKeywordDetectionLicense:(NSString *)instanceId licenseKey:(NSString *)licenseKey resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    KeyWordsDetection *instance = wrapper.keyWordsDetection;
    BOOL isLicensed = NO;
    if (instance) {
        isLicensed = [instance setLicenseWithLicenseKey:licenseKey];
        NSLog(@"License is valid?: %@", isLicensed ? @"YES" : @"NO");
        resolve(@(isLicensed)); // Wrap BOOL in NSNumber
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

RCT_EXPORT_METHOD(replaceKeywordDetectionModel:(NSString *)instanceId modelName:(NSString *)modelName threshold:(float)threshold bufferCnt:(NSInteger)bufferCnt resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    KeyWordsDetection *instance = wrapper.keyWordsDetection;
    if (instance) {
        NSError *error = nil;
        [instance replaceKeywordDetectionModelWithModelPath:modelName threshold:threshold bufferCnt:bufferCnt error:&error];
        if (error) {
            reject(@"ReplaceError", [NSString stringWithFormat:@"Failed to replace model: %@", error.localizedDescription], nil);
        } else {
            resolve([NSString stringWithFormat:@"Instance ID: %@ changed model to %@", instanceId, modelName]);
        }
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

RCT_EXPORT_METHOD(startKeywordDetection:(NSString *)instanceId threshold:(float)threshold resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    KeyWordsDetection *instance = wrapper.keyWordsDetection;
    if (instance) {
        NSError *error = nil;
        [instance startListeningAndReturnError:&error];
        if (error) {
            reject(@"StartError", [NSString stringWithFormat:@"Failed to start detection: %@", error.localizedDescription], nil);
        } else {
            resolve([NSString stringWithFormat:@"Started detection for instance: %@", instanceId]);
        }
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

RCT_EXPORT_METHOD(stopKeywordDetection:(NSString *)instanceId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    KeyWordsDetection *instance = wrapper.keyWordsDetection;
    if (instance) {
        [instance stopListening];
        resolve([NSString stringWithFormat:@"Stopped detection for instance: %@", instanceId]);
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

RCT_EXPORT_METHOD(destroyInstance:(NSString *)instanceId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    if (wrapper) {
        [wrapper.keyWordsDetection stopListening];
        [self.instances removeObjectForKey:instanceId];
        resolve([NSString stringWithFormat:@"Destroyed instance: %@", instanceId]);
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

// Keeping all APIs even if not called in JS yet

RCT_EXPORT_METHOD(getKeywordDetectionModel:(NSString *)instanceId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    KeyWordsDetection *instance = wrapper.keyWordsDetection;
    if (instance) {
        NSString *modelName = [instance getKeywordDetectionModel];
        resolve(modelName);
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

RCT_EXPORT_METHOD(getRecordingWav:(NSString *)instanceId resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
    KeyWordsDetectionWrapper *wrapper = self.instances[instanceId];
    KeyWordsDetection *instance = wrapper.keyWordsDetection;
    if (instance) {
        NSString *recWavPath = [instance getRecordingWav];
        resolve(recWavPath);
    } else {
        reject(@"InstanceNotFound", [NSString stringWithFormat:@"No instance found with ID: %@", instanceId], nil);
    }
}

// You can add more methods here as needed, ensuring they use the instanceId

@end
