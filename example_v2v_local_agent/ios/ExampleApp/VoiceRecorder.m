// The voice sample for voice cloning (Speech.createVoiceClone).
// JS: NativeModules.VoiceRecorder.
//
// Records the microphone to a 16-bit mono WAV file:
// start(path) -> path; status() -> {recording, seconds, peak 0..1};
// stop() -> {path, seconds}; cancel() deletes the file.
//
// pickAudioFile() -> {path, name} (a copy in the app's caches) or nil when the
// user cancels: the system file picker, audio files only.
//
// The audio session the DaVoice libraries set up (play and record) is kept;
// it is changed only when it cannot record.

#import <AVFoundation/AVFoundation.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTUtils.h>

@interface VoiceRecorder : NSObject <RCTBridgeModule, UIDocumentPickerDelegate>
@property (nonatomic, strong, nullable) AVAudioRecorder *recorder;
@property (nonatomic, copy, nullable) RCTPromiseResolveBlock pickResolve;
@property (nonatomic, copy, nullable) RCTPromiseRejectBlock pickReject;
@end

@implementation VoiceRecorder

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

RCT_EXPORT_METHOD(start:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.recorder.isRecording) {
    reject(@"BUSY", @"Already recording.", nil);
    return;
  }
  AVAudioSession *session = [AVAudioSession sharedInstance];
  if (session.recordPermission != AVAudioSessionRecordPermissionGranted) {
    reject(@"NO_PERMISSION", @"Microphone permission is not granted.", nil);
    return;
  }
  NSError *error = nil;
  NSString *category = session.category;
  if (![category isEqualToString:AVAudioSessionCategoryPlayAndRecord] &&
      ![category isEqualToString:AVAudioSessionCategoryRecord]) {
    [session setCategory:AVAudioSessionCategoryPlayAndRecord
             withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker
                   error:&error];
  }
  [session setActive:YES error:nil];

  NSString *filePath = [path hasPrefix:@"file://"] ? [path substringFromIndex:7] : path;
  [[NSFileManager defaultManager] createDirectoryAtPath:[filePath stringByDeletingLastPathComponent]
                            withIntermediateDirectories:YES attributes:nil error:nil];
  NSDictionary *settings = @{
    AVFormatIDKey: @(kAudioFormatLinearPCM),
    AVSampleRateKey: @44100,
    AVNumberOfChannelsKey: @1,
    AVLinearPCMBitDepthKey: @16,
    AVLinearPCMIsFloatKey: @NO,
    AVLinearPCMIsBigEndianKey: @NO,
  };
  error = nil;
  AVAudioRecorder *recorder = [[AVAudioRecorder alloc] initWithURL:[NSURL fileURLWithPath:filePath]
                                                          settings:settings
                                                             error:&error];
  if (recorder == nil) {
    reject(@"RECORD_FAILED", error.localizedDescription ?: @"Could not create the recorder.", error);
    return;
  }
  recorder.meteringEnabled = YES;
  if (![recorder prepareToRecord] || ![recorder record]) {
    reject(@"MIC_UNAVAILABLE", @"The microphone could not be opened.", nil);
    return;
  }
  self.recorder = recorder;
  resolve(filePath);
}

RCT_EXPORT_METHOD(status:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVAudioRecorder *recorder = self.recorder;
  double peak = 0;
  if (recorder.isRecording) {
    [recorder updateMeters];
    peak = pow(10.0, [recorder peakPowerForChannel:0] / 20.0);
  }
  resolve(@{
    @"recording": @(recorder.isRecording),
    @"seconds": @(recorder.currentTime),
    @"peak": @(MIN(1.0, MAX(0.0, peak))),
  });
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVAudioRecorder *recorder = self.recorder;
  if (recorder == nil) {
    reject(@"NOT_RECORDING", @"Nothing is being recorded.", nil);
    return;
  }
  NSTimeInterval seconds = recorder.currentTime;
  [recorder stop];
  self.recorder = nil;
  resolve(@{ @"path": recorder.url.path, @"seconds": @(seconds) });
}

RCT_EXPORT_METHOD(cancel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVAudioRecorder *recorder = self.recorder;
  self.recorder = nil;
  if (recorder != nil) {
    [recorder stop];
    [recorder deleteRecording];
  }
  resolve(nil);
}

RCT_EXPORT_METHOD(pickAudioFile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  if (self.pickResolve != nil) {
    reject(@"BUSY", @"The file picker is already open.", nil);
    return;
  }
  UIViewController *presenter = RCTPresentedViewController();
  if (presenter == nil) {
    reject(@"NO_PRESENTER", @"The file picker could not be shown.", nil);
    return;
  }
  UIDocumentPickerViewController *picker =
      [[UIDocumentPickerViewController alloc] initForOpeningContentTypes:@[UTTypeAudio] asCopy:YES];
  picker.delegate = self;
  picker.allowsMultipleSelection = NO;
  self.pickResolve = resolve;
  self.pickReject = reject;
  [presenter presentViewController:picker animated:YES completion:nil];
}

- (void)documentPicker:(UIDocumentPickerViewController *)controller didPickDocumentsAtURLs:(NSArray<NSURL *> *)urls
{
  RCTPromiseResolveBlock resolve = self.pickResolve;
  RCTPromiseRejectBlock reject = self.pickReject;
  self.pickResolve = nil;
  self.pickReject = nil;
  NSURL *picked = urls.firstObject;
  if (resolve == nil) return;
  if (picked == nil) {
    resolve([NSNull null]);
    return;
  }
  NSFileManager *files = [NSFileManager defaultManager];
  NSString *caches = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject;
  NSString *folder = [caches stringByAppendingPathComponent:@"voice_clone_upload"];
  [files removeItemAtPath:folder error:nil];
  [files createDirectoryAtPath:folder withIntermediateDirectories:YES attributes:nil error:nil];
  NSString *name = picked.lastPathComponent ?: @"voice_sample";
  NSString *target = [folder stringByAppendingPathComponent:name];
  NSError *error = nil;
  if (![files copyItemAtURL:picked toURL:[NSURL fileURLWithPath:target] error:&error]) {
    reject(@"PICK_FAILED", error.localizedDescription ?: @"The file could not be read.", error);
    return;
  }
  resolve(@{ @"path": target, @"name": name });
}

- (void)documentPickerWasCancelled:(UIDocumentPickerViewController *)controller
{
  RCTPromiseResolveBlock resolve = self.pickResolve;
  self.pickResolve = nil;
  self.pickReject = nil;
  if (resolve != nil) resolve([NSNull null]);
}

@end
