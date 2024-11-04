import { useState, useEffect } from 'react';
import Voice from '@react-native-voice/voice';

//const useVoiceRecognition = (language = 'he-IL') => {

const useVoiceRecognition = (language = 'en-US') => {
  const [recognizedText, setRecognizedText] = useState('');
  var recognizedTextBuff = '';
  const [vrIsListening, setIsListening] = useState(false);

  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechResults = (event) => {
      console.log("onSpeechResults(): ", event.value[0])
      console.log("onSpeechResults(): recognizedText == ", recognizedText)
      console.log("onSpeechResults(): recognizedTextBuff == ", recognizedTextBuff)
      setRecognizedText(event.value[0]);
      recognizedTextBuff = event.value[0];
      console.log("onSpeechResults(): recognizedText == ", recognizedText)
      console.log("onSpeechResults(): recognizedTextBuff == ", recognizedTextBuff)
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const vrClearBuffer = async () => {
    try {
      await vrStopListening();
      recognizedTextBuff = '';
      setRecognizedText('');
    } catch (error) {
      console.error('Error starting Voice:', error);
    }
  };

  const vrStartListening = async () => {
    try {
      await Voice.start(language);
    } catch (error) {
      console.error('Error starting Voice:', error);
    }
  };

  const getTextDetected = () => {
    return recognizedTextBuff;
  };

  const vrStopListening = async () => {
    try {
      await Voice.stop();
    } catch (error) {
      console.error('Error stopping Voice:', error);
    }
  };

  return { recognizedText, getTextDetected, vrClearBuffer, vrIsListening, vrStartListening, vrStopListening };
};

export default useVoiceRecognition;
