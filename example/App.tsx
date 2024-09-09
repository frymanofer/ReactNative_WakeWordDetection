/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';

import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

import type {PropsWithChildren} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  Platform,
  useColorScheme,
  View,
} from 'react-native';

import {
  Colors,
  DebugInstructions,
  Header,
  LearnMoreLinks,
  ReloadInstructions,
} from 'react-native/Libraries/NewAppScreen';

//import { useModel } from "./useModel";
//const { loadModel, startListening, stopListening } = useModel();

const detectionCallback = async (keywordIndex: any) => {
  console.log("detectionCallback detectionCallback detectionCallback!!!!!!!!!!!!!!!!!!");
  KeyWordRNBridge?.stopKeywordDetection();
};

const AudioPermissionComponent = async () => {
  const permission = Platform.OS === 'ios' ? PERMISSIONS.IOS.MICROPHONE : PERMISSIONS.ANDROID.RECORD_AUDIO;
  await request(permission);
  const status = await check(permission);
  if (status !== RESULTS.GRANTED) {
      await request(permission);
  }
}

type SectionProps = PropsWithChildren<{
  title: string;
}>;

function Section({children, title}: SectionProps): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <View style={styles.sectionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          {
            color: isDarkMode ? Colors.white : Colors.black,
          },
        ]}>
        {title}
      </Text>
      <Text
        style={[
          styles.sectionDescription,
          {
            color: isDarkMode ? Colors.light : Colors.dark,
          },
        ]}>
        {children}
      </Text>
    </View>
  );
}

import KeyWordRNBridge from "./rnkeywordspotter/KeyWordRNBridge";
type DetectionCallback = (event: any) => void;


function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };
  useEffect(() => {
    const initializeKeywordDetection = async () => {
      try {
        // Wait for audio permission to be granted
        await AudioPermissionComponent();

        // Initialize keyword detection after permission is granted
        KeyWordRNBridge.initKeywordDetection("need_help_now.onnx", 0.9999, 2);
        await KeyWordRNBridge.setKeywordDetectionLicense(
          "MTcyODkzOTYwMDAwMA==-XPLwWg6m4aFC9YMJZu0d0rKIh2AsExYixyeCpiVQmpE=",
      );
      KeyWordRNBridge.onKeywordDetectionEvent((event) => {
        console.log("KeywordDetection event detected:", event);
        detectionCallback(event);
     });
      KeyWordRNBridge?.stopKeywordDetection();
      KeyWordRNBridge.startKeywordDetection();

      } catch (error) {
        console.error('Error during keyword detection initialization:', error);
      }
    };

    initializeKeywordDetection();  // Call the async function inside useEffect
    // Call your native bridge function
  //KeyWordRNBridge.initKeywordDetection("bla", 0.9999, 2);
  //loadModel();
}, []);  // Empty dependency array ensures it runs once when the component mounts


  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <Header />
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
          }}>
          <Section title="Step One">
            Edit <Text style={styles.highlight}>App.tsx</Text> to change this
            screen and then come back to see your edits.
            Here is change #1
          </Section>
          <Section title="See Your Changes">
            <ReloadInstructions />
          </Section>
          <Section title="Debug">
            <DebugInstructions />
          </Section>
          <Section title="Learn More">
            Read the docs to discover what to do next:
          </Section>
          <LearnMoreLinks />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
