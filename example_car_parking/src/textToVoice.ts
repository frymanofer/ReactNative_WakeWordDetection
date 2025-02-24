// textToVoice.ts
import Tts from 'react-native-tts';

const silentMode = false;
function Log(...args) {
  if (!silentMode)
    console.log(...args);
}

// Register listeners
Tts.addEventListener('tts-start', () => Log('TTS has started'));
Tts.addEventListener('tts-progress', (event) => Log('TTS progress:', event));
Tts.addEventListener('tts-finish', () => Log('TTS has finished'));
Tts.addEventListener('tts-cancel', () => Log('TTS has been canceled'));

// Be sure to remove listeners when no longer needed
const removeListeners = () => {
  Tts.removeEventListener('tts-start');
  Tts.removeEventListener('tts-progress');
  Tts.removeEventListener('tts-finish');
  Tts.removeEventListener('tts-cancel');
};

const voiceIdentifiers = [
  "com.apple.eloquence.en-US.Flo",
  "com.apple.speech.synthesis.voice.Bahh",
  "com.apple.speech.synthesis.voice.Albert",
  "com.apple.speech.synthesis.voice.Fred",
  "com.apple.speech.synthesis.voice.Hysterical",
  "com.apple.speech.synthesis.voice.Organ",
  "com.apple.speech.synthesis.voice.Cellos",
  "com.apple.speech.synthesis.voice.Zarvox",
  "com.apple.eloquence.en-US.Rocko",
  "com.apple.eloquence.en-US.Shelley",
  "com.apple.speech.synthesis.voice.Princess",
  "com.apple.eloquence.en-US.Grandma",
  "com.apple.eloquence.en-US.Eddy",
  "com.apple.speech.synthesis.voice.Bells",
  "com.apple.eloquence.en-US.Grandpa",
  "com.apple.speech.synthesis.voice.Trinoids",
  "com.apple.speech.synthesis.voice.Kathy",
  "com.apple.eloquence.en-US.Reed",
  "com.apple.speech.synthesis.voice.Boing",
  "com.apple.speech.synthesis.voice.Whisper",
  "com.apple.speech.synthesis.voice.Deranged",
  "com.apple.speech.synthesis.voice.GoodNews",
  "com.apple.ttsbundle.siri_Nicky_en-US_compact",
  "com.apple.speech.synthesis.voice.BadNews",
  "com.apple.ttsbundle.siri_Aaron_en-US_compact",
  "com.apple.speech.synthesis.voice.Bubbles",
  "com.apple.voice.compact.en-US.Samantha",
  "com.apple.eloquence.en-US.Sandy",
  "com.apple.speech.synthesis.voice.Junior",
  "com.apple.speech.synthesis.voice.Ralph"
];

class TextToVoiceService {
  private rate: number = 0.3;
  private pitch: number = 1.5;
  private language: string = 'en-US';
  private voice: string | null = null;

  constructor() {
    // Fetch available voices on initialization
    Tts.voices().then((availableVoices) => {
      
      if (availableVoices.length > 0) {
        availableVoices.forEach((voice) => {
          if (voice.id.match('en-US'))
            Log("Voice ID:", voice.id);
            Log("Voice Name:", voice.name);
            Log("Language:", voice.language);
          // Add any other actions you want to perform with each voice
            this.voice = voice.id;
        });
      }
    });
    //Tts.setIgnoreSilentSwitch("ignore");
  }

  // Set the rate of the speech
  setRate(rate: number) {
    this.rate = rate;
    Tts.setDefaultRate(rate);
  }

  // Set the pitch of the speech
  setPitch(pitch: number) {
    this.pitch = pitch;
    Tts.setDefaultPitch(pitch);
  }

  // Set the language of the speech
  setLanguage(language: string) {
    this.language = language;
    Tts.setDefaultLanguage(language);
  }

  // Set the language of the speech
  async playAllVoices() {
    for (const voice of voiceIdentifiers) {
      await Tts.stop();
      await Tts.speak(voice + 'Well come!, to Ess park, Hands Free Parking Service.', {
        iosVoiceId: voice,
        //iosVoiceId: 'com.apple.eloquence.en-GB.Rocko', //'com.apple.eloquence.en-GB.Sandy',
        rate: 0.5,
        pitch: 1.5,
      });
    }
  }

  // Set a specific voice
  setVoice(voiceId: string) {
    this.voice = voiceId;
    Tts.setDefaultVoice(voiceId);
  }

  // Start speaking the given text
  async speak(text: string) {
    if (!text) {
      console.warn('TextToVoiceService: No text provided');
      return;
    }

    await Tts.stop(); // Stop any ongoing speech
    await Tts.speak(text, {
      iosVoiceId: this.voice, // Specific for iOS, use setVoice for Android
      rate: this.rate,
      pitch: this.pitch,
    });
  }

  // Stop any ongoing speech
  stop() {
    Tts.stop();
  }

  // Get available voices
  async getAvailableVoices() {
    const voices = await Tts.voices();
    return voices;
  }
}

// Export a singleton instance of the service
export default new TextToVoiceService();
