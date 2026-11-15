import { APP_LANGUAGES } from './appflow';
import { narrationFor } from './narration';

describe('localized narration', () => {
  it('has complete startup narration for every offered language', () => {
    for (const { id } of APP_LANGUAGES) {
      const narration = narrationFor(id);

      expect(narration.wakeWordDetected('DaVoice')).toBeTruthy();
      expect(narration.modeSelection).toBeTruthy();
      expect(narration.cloningChoices(false)).toBeTruthy();
      expect(narration.cloningChoices(true)).toBeTruthy();
      expect(narration.introduction('Eleni')).toHaveLength(3);
      expect(narration.selectedVoice('Eleni')).toBeTruthy();
      expect(narration.speakerVerificationSetup).toBeTruthy();
      expect(narration.speakerVerificationSkipped).toBeTruthy();
      expect(narration.speakerVerificationReady).toBeTruthy();
      expect(narration.sayWakeWord('DaVoice')).toBeTruthy();
      expect(narration.cloneCreated('Eleni')).toBeTruthy();
    }
  });
});
