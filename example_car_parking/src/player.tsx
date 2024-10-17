import TrackPlayer from 'react-native-track-player';
import { Capability } from 'react-native-track-player';
import { Platform } from 'react-native'

export async function setupTrackPlayer() {
  console.log("setupTrackPlayer()");
  await TrackPlayer.setupPlayer();
  console.log("setupTrackPlayer() 1 ", Capability.Pause);
  
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,       // Play capability
      Capability.Pause,      // Pause capability
      Capability.Stop,       // Stop capability
      Capability.SkipToNext, // Next track capability
      Capability.SkipToPrevious, // Previous track capability
    ],
    compactCapabilities: [Capability.Play, Capability.Pause],  // Compact capabilities for notifications
  });
  console.log("End setupTrackPlayer()");
}

export async function playTrackPlayer_1() {
  console.log("playTrackPlayer_1()");
  const track = {
    id: 'local-track1',
    title: 'Sample WAV',
    artist: 'Artist Name',
    url: 'android.resource://com.spark/raw/carparkoptions',
  };
  console.log("playTrackPlayer_1.add()");

  await TrackPlayer.add([track]);
  console.log("playTrackPlayer_1.play()");
  TrackPlayer.play();
  console.log("End playTrackPlayer_1()");
}

export async function playTrackPlayer() {
  console.log("playTrackPlayer()");
  const track = {
    id: 'local-track',
    title: 'Sample WAV',
    artist: 'Artist Name',
    url: Platform.OS === 'ios' ? './assets/carparkoptions.mp3' : 'android.resource://com.spark/raw/carparkoptions',
  };
  console.log("TrackPlayer.add()");
  await TrackPlayer.setRate(0.5);
  await TrackPlayer.setVolume(1);

  await TrackPlayer.add([track]);
  console.log("TrackPlayer.play()");
  await TrackPlayer.play();
  console.log("TrackPlayer.stop()");
  await TrackPlayer.stop()
 // await TrackPlayer.remove('local-track');  // Removes the track at index 0
  console.log("End playTrackPlayer()");
}
