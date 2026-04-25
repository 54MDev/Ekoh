import { useEffect, useRef, useState } from "react";

const PLAYLIST = [
  { src: "/music/Lobby Jamboree.mp3", title: "Lobby Jamboree" },
  { src: "/music/Plastic Bananas.mp3", title: "Plastic Bananas" },
  { src: "/music/Lobby Jamboree (1).mp3", title: "Lobby Jamboree (alt)" },
  { src: "/music/Plastic Bananas (1).mp3", title: "Plastic Bananas (alt)" },
];

const DEFAULT_VOLUME = 0.35;

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const current = PLAYLIST[trackIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  // When the track changes (manual skip or auto-advance), keep playing if we
  // were already playing.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch(() => setPlaying(false));
    }
  }, [trackIndex, playing]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  };

  const skip = () => {
    setTrackIndex((i) => (i + 1) % PLAYLIST.length);
  };

  const onEnded = () => {
    setTrackIndex((i) => (i + 1) % PLAYLIST.length);
  };

  return (
    <div className="music-player">
      <audio
        ref={audioRef}
        src={encodeURI(current.src)}
        onEnded={onEnded}
        preload="auto"
      />
      <button
        className="music-btn"
        onClick={togglePlay}
        aria-label={playing ? "Pause music" : "Play music"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        className="music-btn"
        onClick={skip}
        aria-label="Skip to next track"
      >
        ⏭
      </button>
      <span className="music-title" title={current.title}>
        ♪ {current.title}
      </span>
      <input
        className="music-volume"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        aria-label="Music volume"
      />
    </div>
  );
}
