'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  thumbnailLink?: string;
}

export default function Home() {
  const GOOGLE_API_KEY = "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w";
  const FOLDER_ID = "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG";
  const PROXY_BASE = "https://animetoon-proxy.thinkingnew.workers.dev";

  const [episodes, setEpisodes] = useState<DriveFile[]>([]);
  const [filteredEpisodes, setFilteredEpisodes] = useState<DriveFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeVideo, setActiveVideo] = useState<{ title: string; id: string } | null>(null);

  // Player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Gestures (Volume & Brightness)
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [gestureType, setGestureType] = useState<'volume' | 'brightness' | null>(null);
  const [gestureValue, setGestureValue] = useState<number>(100);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const startVal = useRef<number>(0);

  // Audio & Subtitle Modal
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [selectedSubtitle, setSelectedSubtitle] = useState(0);

  const audioTracks = [
    { id: -1, label: 'Disable track' },
    { id: 0, label: 'Track 1 - (Telugu / Main)' },
    { id: 1, label: 'Track 2 - (Hindi / Dub)' },
    { id: 2, label: 'Track 3 - (English / Dub)' },
    { id: 3, label: 'Track 4 - (Japanese / Original)' },
  ];

  const subTracks = [
    { id: -1, label: 'Disable track' },
    { id: 0, label: 'Track 1 - (English Subtitles)' },
    { id: 1, label: 'Track 2 - (Hindi Subtitles)' },
  ];

  useEffect(() => {
    async function fetchDriveVideos() {
      try {
        setLoading(true);
        const endpoint = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&key=${GOOGLE_API_KEY}`;
        const res = await fetch(endpoint);
        const data = await res.json();

        if (data.error) {
          setError(`Drive API Error: ${data.error.message}`);
          setLoading(false);
          return;
        }

        const videoFiles: DriveFile[] = (data.files || []).filter((f: DriveFile) =>
          (f.mimeType && f.mimeType.includes("video")) ||
          f.name.match(/\.(mp4|mkv|webm|avi|mov)$/i)
        );

        setEpisodes(videoFiles);
        setFilteredEpisodes(videoFiles);
      } catch (err: any) {
        setError('Failed to connect to Google Drive.');
      } finally {
        setLoading(false);
      }
    }

    fetchDriveVideos();
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredEpisodes(episodes);
    } else {
      setFilteredEpisodes(
        episodes.filter((ep) =>
          ep.name.toLowerCase().includes(query.toLowerCase())
        )
      );
    }
  };

  // Video Time & Control Handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatCountdown = (curr: number, dur: number) => {
    if (isNaN(dur) || isNaN(curr)) return '-0:00';
    const rem = dur - curr;
    return `-${formatTime(rem)}`;
  };

  // Touch Swipe Gesture for Volume (Left side) and Brightness (Right side)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const width = window.innerWidth;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;

    if (touch.clientX < width / 2) {
      setGestureType('volume');
      startVal.current = volume;
    } else {
      setGestureType('brightness');
      startVal.current = brightness;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!gestureType || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaY = touchStartY.current - touch.clientY;
    const sensitivity = 0.005;

    let newVal = Math.min(Math.max(startVal.current + deltaY * sensitivity, 0), 1);

    if (gestureType === 'volume') {
      setVolume(newVal);
      if (videoRef.current) videoRef.current.volume = newVal;
      setGestureValue(Math.round(newVal * 100));
    } else {
      newVal = Math.max(newVal, 0.2); // minimum 20% brightness
      setBrightness(newVal);
      setGestureValue(Math.round(newVal * 100));
    }
  };

  const handleTouchEnd = () => {
    setTimeout(() => setGestureType(null), 800);
  };

  const streamUrl = activeVideo ? `${PROXY_BASE}/?id=${activeVideo.id}` : '';

  return (
    <main style={styles.main}>
      {/* Top Navbar */}
      <header style={styles.header}>
        <div style={styles.logo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span style={{ color: '#f47521' }}>▶</span> ANIMETOON
        </div>
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search episodes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </header>

      {/* Hero Banner */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>AnimeToon Player</h1>
          <p style={styles.heroDesc}>
            Swipe gestures, multi-track audio switching, and HD cloud streaming.
          </p>
          {episodes.length > 0 && (
            <button
              style={styles.playBtn}
              onClick={() =>
                setActiveVideo({
                  title: episodes[0].name.replace(/\.[^/.]+$/, ''),
                  id: episodes[0].id,
                })
              }
            >
              ▶ Watch Latest Episode
            </button>
          )}
        </div>
      </section>

      {/* Episode Header */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionBar}></span>
        <h2 style={styles.sectionTitle}>Episodes</h2>
      </div>

      {loading && <p style={styles.statusText}>Loading anime library...</p>}
      {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}
      {!loading && !error && filteredEpisodes.length === 0 && (
        <p style={styles.statusText}>No video files found.</p>
      )}

      {/* Video Grid */}
      <div style={styles.grid}>
        {filteredEpisodes.map((file) => {
          const titleClean = file.name.replace(/\.[^/.]+$/, '');
          const thumbnail = file.thumbnailLink
            ? file.thumbnailLink.replace('=s220', '=s600')
            : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';

          return (
            <div
              key={file.id}
              style={styles.card}
              onClick={() => {
                setActiveVideo({ title: titleClean, id: file.id });
                setIsPlaying(true);
                setShowControls(true);
              }}
            >
              <div style={styles.cardImgWrapper}>
                <img
                  src={thumbnail}
                  alt={file.name}
                  style={styles.cardImg}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';
                  }}
                />
                <div style={styles.cardHoverOverlay}>
                  <div style={styles.playCircle}>▶</div>
                </div>
              </div>
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle} title={titleClean}>
                  {titleClean}
                </div>
                <div style={styles.cardMeta}>
                  <span>Multi-Audio</span>
                  <span style={{ color: '#f47521', fontWeight: 600 }}>Play</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fullscreen Video Player Modal */}
      {activeVideo && (
        <div style={styles.playerBackdrop}>
          <div
            style={styles.playerBox}
            onClick={resetControlsTimer}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <video
              ref={videoRef}
              src={streamUrl}
              autoPlay
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              style={{
                ...styles.videoStream,
                filter: `brightness(${brightness})`,
              }}
            />

            {/* Left Gesture OSD (Volume) */}
            {gestureType === 'volume' && (
              <div style={styles.osdLeft}>
                <span style={styles.osdPercent}>{gestureValue}%</span>
                <div style={styles.osdBarContainer}>
                  <div style={{ ...styles.osdBarFill, height: `${gestureValue}%` }} />
                </div>
                <span style={styles.osdLabel}>Volume</span>
                <span style={{ fontSize: '1.2rem' }}>🔊</span>
              </div>
            )}

            {/* Right Gesture OSD (Brightness) */}
            {gestureType === 'brightness' && (
              <div style={styles.osdRight}>
                <span style={styles.osdPercent}>{gestureValue}%</span>
                <div style={styles.osdBarContainer}>
                  <div style={{ ...styles.osdBarFill, height: `${gestureValue}%` }} />
                </div>
                <span style={styles.osdLabel}>Brightness</span>
                <span style={{ fontSize: '1.2rem' }}>☀️</span>
              </div>
            )}

            {/* Player Overlay Controls */}
            {showControls && (
              <div style={styles.controlsOverlay}>
                {/* Top Title Bar */}
                <div style={styles.topControlBar}>
                  <button style={styles.backBtn} onClick={() => setActiveVideo(null)}>
                    ✕
                  </button>
                  <div style={styles.topVideoTitle}>{activeVideo.title}</div>
                  <div style={{ width: '32px' }}></div>
                </div>

                {/* Center Play/Pause Circle */}
                <div style={styles.centerControl} onClick={togglePlay}>
                  <button style={styles.centerPlayBtn}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                </div>

                {/* Bottom Control Bar */}
                <div style={styles.bottomControlBar}>
                  {/* Seek Bar */}
                  <div style={styles.timeSeekRow}>
                    <span style={styles.timeText}>{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      style={styles.rangeInput}
                    />
                    <span style={styles.timeText}>{formatCountdown(currentTime, duration)}</span>
                  </div>

                  {/* Actions Row */}
                  <div style={styles.actionsRow}>
                    <button
                      style={styles.iconBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTrackModal(true);
                      }}
                      title="Audio & Subtitles"
                    >
                      💬
                    </button>
                    <button
                      style={styles.iconBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (videoRef.current) {
                          if (document.fullscreenElement) {
                            document.exitFullscreen();
                          } else {
                            videoRef.current.requestFullscreen();
                          }
                        }
                      }}
                      title="Fullscreen"
                    >
                      ⛶
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Audio & Subtitles Bottom Sheet Modal (Screenshots 3 layout) */}
            {showTrackModal && (
              <div
                style={styles.sheetBackdrop}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTrackModal(false);
                }}
              >
                <div style={styles.sheetContent} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.sheetHeader}>
                    <div style={styles.sheetColTitle}>Audio ▾</div>
                    <div style={styles.sheetColTitle}>Subtitles ▾</div>
                  </div>

                  <div style={styles.sheetColumns}>
                    {/* Audio Column */}
                    <div style={styles.sheetColumn}>
                      {audioTracks.map((trk) => (
                        <div
                          key={trk.id}
                          style={{
                            ...styles.trackRow,
                            color: selectedAudio === trk.id ? '#ffffff' : '#888888',
                            fontWeight: selectedAudio === trk.id ? 700 : 400,
                          }}
                          onClick={() => {
                            setSelectedAudio(trk.id);
                            const v = videoRef.current as any;
                            if (v && v.audioTracks && v.audioTracks.length > 0 && trk.id >= 0) {
                              for (let i = 0; i < v.audioTracks.length; i++) {
                                v.audioTracks[i].enabled = (i === trk.id);
                              }
                            }
                          }}
                        >
                          <span style={styles.checkSlot}>
                            {selectedAudio === trk.id ? '✓' : ''}
                          </span>
                          <span>{trk.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Subtitles Column */}
                    <div style={styles.sheetColumn}>
                      {subTracks.map((sub) => (
                        <div
                          key={sub.id}
                          style={{
                            ...styles.trackRow,
                            color: selectedSubtitle === sub.id ? '#ffffff' : '#888888',
                            fontWeight: selectedSubtitle === sub.id ? 700 : 400,
                          }}
                          onClick={() => setSelectedSubtitle(sub.id)}
                        >
                          <span style={styles.checkSlot}>
                            {selectedSubtitle === sub.id ? '✓' : ''}
                          </span>
                          <span>{sub.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Styling (Mobile-First Crunchyroll / VLC Aesthetic)
const styles: { [key: string]: React.CSSProperties } = {
  main: {
    backgroundColor: '#000000',
    color: '#ffffff',
    minHeight: '100vh',
    paddingBottom: '60px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: '#000000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #1c1c1c',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 800,
    letterSpacing: '1.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  searchBox: {
    backgroundColor: '#141414',
    border: '1px solid #282828',
    borderRadius: '20px',
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    outline: 'none',
    fontSize: '0.85rem',
    width: '130px',
  },
  hero: {
    position: 'relative',
    height: '300px',
    background:
      "linear-gradient(to top, #000000 10%, rgba(0,0,0,0.5) 70%, transparent 100%), url('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200') center/cover",
    display: 'flex',
    alignItems: 'flex-end',
    padding: '24px 20px',
  },
  heroContent: {
    maxWidth: '520px',
  },
  heroTitle: {
    fontSize: '1.8rem',
    fontWeight: 800,
    marginBottom: '6px',
  },
  heroDesc: {
    color: '#a0a0a0',
    fontSize: '0.9rem',
    marginBottom: '14px',
    lineHeight: 1.4,
  },
  playBtn: {
    backgroundColor: '#f47521',
    color: '#000',
    border: 'none',
    padding: '10px 22px',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '24px 20px 14px',
  },
  sectionBar: {
    width: '4px',
    height: '20px',
    backgroundColor: '#f47521',
    borderRadius: '2px',
  },
  sectionTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    margin: 0,
  },
  statusText: {
    padding: '20px',
    color: '#888888',
    fontSize: '0.95rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '16px',
    padding: '0 20px',
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #1c1c1c',
    cursor: 'pointer',
  },
  cardImgWrapper: {
    position: 'relative',
    width: '100%',
    height: '220px',
    backgroundColor: '#181818',
  },
  cardImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  cardHoverOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'rgba(244, 117, 33, 0.9)',
    color: '#000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '1rem',
    fontWeight: 'bold',
    paddingLeft: '3px',
  },
  cardInfo: {
    padding: '10px',
  },
  cardTitle: {
    fontSize: '0.88rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '6px',
  },
  cardMeta: {
    fontSize: '0.75rem',
    color: '#777777',
    display: 'flex',
    justifyContent: 'space-between',
  },
  // Video Player Overlay
  playerBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000000',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerBox: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
  },
  videoStream: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  controlsOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px 20px',
  },
  topControlBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  topVideoTitle: {
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    textAlign: 'center',
    maxWidth: '70%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  centerControl: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlayBtn: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    border: '2px solid rgba(255, 255, 255, 0.8)',
    color: '#ffffff',
    fontSize: '1.6rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bottomControlBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  timeSeekRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  timeText: {
    fontSize: '0.8rem',
    color: '#ffffff',
    minWidth: '40px',
    fontVariantNumeric: 'tabular-nums',
  },
  rangeInput: {
    flex: 1,
    accentColor: '#f47521',
    cursor: 'pointer',
  },
  actionsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '16px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.3rem',
    cursor: 'pointer',
  },
  // OSD Left & Right Sliders
  osdLeft: {
    position: 'absolute',
    left: '24px',
    top: '35%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
  },
  osdRight: {
    position: 'absolute',
    right: '24px',
    top: '35%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    pointerEvents: 'none',
  },
  osdPercent: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  osdBarContainer: {
    width: '6px',
    height: '90px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: '3px',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column-reverse',
    overflow: 'hidden',
  },
  osdBarFill: {
    width: '100%',
    backgroundColor: '#f47521',
  },
  osdLabel: {
    fontSize: '0.75rem',
    color: '#ffffff',
    fontWeight: 600,
  },
  // Audio & Subtitle Bottom Sheet Modal
  sheetBackdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 100,
  },
  sheetContent: {
    width: '100%',
    backgroundColor: '#121212',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '20px',
    maxHeight: '65vh',
    overflowY: 'auto',
    borderTop: '1px solid #282828',
  },
  sheetHeader: {
    display: 'flex',
    borderBottom: '1px solid #222222',
    paddingBottom: '12px',
    marginBottom: '14px',
  },
  sheetColTitle: {
    flex: 1,
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  sheetColumns: {
    display: 'flex',
    gap: '20px',
  },
  sheetColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  trackRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.88rem',
    cursor: 'pointer',
  },
  checkSlot: {
    width: '16px',
    color: '#f47521',
    fontWeight: 900,
  },
};
