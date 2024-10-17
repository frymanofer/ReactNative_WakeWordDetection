// src/service.js
import TrackPlayer from 'react-native-track-player';

export default async function() {
  TrackPlayer.addEventListener('remote-play', () => {
    TrackPlayer.play();
  });
  TrackPlayer.addEventListener('remote-pause', () => {
    TrackPlayer.pause();
  });
  TrackPlayer.addEventListener('remote-stop', () => {
    TrackPlayer.stop();
  });

  // Event listener for "remote-next" (optional: if you want to handle skipping to the next track)
  TrackPlayer.addEventListener('remote-next', () => {
    TrackPlayer.skipToNext();
  });

  // Event listener for "remote-previous" (optional: if you want to handle skipping to the previous track)
  TrackPlayer.addEventListener('remote-previous', () => {
    TrackPlayer.skipToPrevious();
  });

  // Add more events as needed (like seek, fast forward, rewind, etc.)*/
}
