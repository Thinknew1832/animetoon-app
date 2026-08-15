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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Swipe Gesture States
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [activeGesture, setActiveGesture] = useState<'volume' | 'brightness' | null>(null);
  const [gesturePercent, setGesturePercent] = useState<number>(100);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const startLevel = useRef<number>(0);

  // Audio / Subtitle Sheet
  const [showTrackSheet, setShowTrackSheet] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState(0);
  const [selectedSub, setSelectedSub] = useState(0);

  const audioTracks = [
    { id: -1, label: 'Disable track' },
    { id: 0, label: 'Track 1 - (Main / Default)' },
    { id: 1, label: 'Track 2 - (Telugu Dub)' },
    { id: 2, label: 'Track 3 - (Hindi Dub)' },
    { id: 3, label: 'Track 4 - (English Dub)' },
    { id: 4, label: 'Track 5 - (Japanese Dub)' },
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

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatCountdown = (curr: number, dur: number) => {
    if (isNaN(dur) || isNaN(curr)) return '-0:00';
    const rem = Math.max(0, dur - curr);
    return `-${formatTime(rem)}`;
  };

  // Smooth Gesture Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const screenWidth = window.innerWidth;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;

    if (touch.clientX < screenWidth / 2) {
      setActiveGesture('volume');
      startLevel.current = volume;
    } else {
      setActiveGesture('brightness');
      startLevel.current = brightness;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeGesture || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaY = touchStartY.current - touch.clientY;
    const change = deltaY / 220; // smoothness factor

    if (activeGesture === 'volume') {
      const newVol = Math.min(Math.max(startLevel.current + change, 0), 1);
      setVolume(newVol);
      if (videoRef.current) videoRef.current.volume = newVol;
      setGesturePercent(Math.round(newVol * 100));
    } else {
      const newBri = Math.min(Math.max(startLevel.current + change, 0.2), 1);
      setBrightness(newBri);
      setGesturePercent(Math.round(newBri * 100));
    }
  };

  const handleTouchEnd = () => {
    setTimeout(() => setActiveGesture(null), 800);
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
            Dual & Multi-audio fast cloud streaming directly in high definition.
          </p>
          {episodes.length > 0 && (
            <button
              style={styles.playBtn}
              onClick={() => {
                setActiveVideo({
                  title: episodes[0].name.replace(/\.[^/.]+$/, ''),
                  id: episodes[0].id,
                });
                setIsPlaying(true);
                setShowControls(true);
              }}
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

      {loading && <p style={styles.statusText}>Loading anime files...</p>}
      {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}
      {!loading && !error && filteredEpisodes.length === 0 && (
        <p style={styles.statusText}>No videos found in this folder.</p>
      )}

      {/* Grid */}
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
                  <span style={{ color: '#f47521', fontWeight: 600 }}>Stream</span>
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
            ref={containerRef}
            style={styles.playerContainer}
            onClick={resetControlsTimer}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Native Video without interfering default controls */}
            <video
              ref={videoRef}
              src={streamUrl}
              autoPlay
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onEnded={() => setIsPlaying(false)}
              style={{
                ...styles.videoElement,
                filter: `brightness(${brightness})`,
              }}
            />

            {/* Left Gesture Indicator (Volume) */}
            {activeGesture === 'volume' && (
              <div style={styles.osdBoxLeft}>
                <span style={styles.osdPercent}>{gesturePercent}%</span>
                <div style={styles.osdTrack}>
                  <div style={{ ...styles.osdFill, height: `${gesturePercent}%` }} />
                </div>
                <span style={styles.osdLabel}>Volume</span>
              </div>
            )}

            {/* Right Gesture Indicator (Brightness) */}
            {activeGesture === 'brightness' && (
              <div style={styles.osdBoxRight}>
                <span style={styles.osdPercent}>{gesturePercent}%</span>
                <div style={styles.osdTrack}>
                  <div style={{ ...styles.osdFill, height: `${gesturePercent}%` }} />
                </div>
                <span style={styles.osdLabel}>Brightness</span>
              </div>
            )}

            {/* Touch Overlay Controls */}
            {showControls && (
              <div style={styles.controlsLayer}>
                {/* Top Title Bar */}
                <div style={styles.topBar}>
                  <button
                    style={styles.closeBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveVideo(null);
                    }}
                  >
                    ✕
                  </button>
                  <div style={styles.titleText}>{activeVideo.title}</div>
                  <div style={{ width: 36 }}></div>
                </div>

                {/* Center Play/Pause Button */}
                <div style={styles.centerBox}>
                  <button
                    style={styles.centerPlayBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                </div>

                {/* Bottom Bar */}
                <div style={styles.bottomBar}>
                  {/* Progress Slider */}
                  <div style={styles.progressRow}>
                    <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={handleSeek}
                      style={styles.progressBar}
                    />
                    <span style={styles.timeLabel}>{formatCountdown(currentTime, duration)}</span>
                  </div>

                  {/* Actions & Track Sheet Toggle */}
                  <div style={styles.controlButtonsRow}>
                    <button
                      style={styles.sheetTriggerBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTrackSheet(true);
                      }}
                    >
                      💬 Audio & Subtitles
                    </button>

                    <button
                      style={styles.fullscreenBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (containerRef.current) {
                          if (document.fullscreenElement) {
                            document.exitFullscreen();
                          } else {
                            containerRef.current.requestFullscreen();
                          }
                        }
                      }}
                    >
                      ⛶
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Audio & Subtitle Modal Sheet */}
            {showTrackSheet && (
              <div
                style={styles.sheetOverlay}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowTrackSheet(false);
                }}
              >
                <div style={styles.sheetModal} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.sheetTopRow}>
                    <div style={styles.sheetTitle}>Audio ▾</div>
                    <div style={styles.sheetTitle}>Subtitles ▾</div>
                  </div>

                  <div style={styles.sheetTrackListWrapper}>
                    {/* Audio Track Selector */}
                    <div style={styles.sheetColumn}>
                      {audioTracks.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            ...styles.trackItem,
                            color: selectedAudio === item.id ? '#ffffff' : '#888888',
                            fontWeight: selectedAudio === item.id ? 700 : 400,
                          }}
                          onClick={() => setSelectedAudio(item.id)}
                        >
                          <span style={styles.checkMark}>
                            {selectedAudio === item.id ? '✓' : ''}
                          </span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Subtitle Track Selector */}
                    <div style={styles.sheetColumn}>
                      {subTracks.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            ...styles.trackItem,
                            color: selectedSub === item.id ? '#ffffff' : '#888888',
                            fontWeight: selectedSub === item.id ? 700 : 400,
                          }}
                          onClick={() => setSelectedSub(item.id)}
                        >
                          <span style={styles.checkMark}>
                            {selectedSub === item.id ? '✓' : ''}
                          </span>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Fast External Multi-Audio Switcher */}
                  <div style={styles.fallbackPlayerRow}>
                    <span style={styles.fallbackLabel}>Play Full Multi-Audio (Telugu/Hindi/Eng):</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={styles.appSwitchBtnVidhub}
                        onClick={() => {
                          window.location.href = `vidhub://play?url=${encodeURIComponent(streamUrl)}`;
                        }}
                      >
                        🚀 VidHub App
                      </button>
                      <button
                        style={styles.appSwitchBtnVlc}
                        onClick={() => {
                          window.location.href = `vlc://${streamUrl}`;
                        }}
                      >
                        ⚡ VLC Player
                      </button>
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

// Crunchyroll-Style Dark Layout CSS
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
  playerBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000000',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
  },
  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  controlsLayer: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '20px 24px',
    zIndex: 10,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.6rem',
    cursor: 'pointer',
    padding: '4px',
  },
  titleText: {
    color: '#ffffff',
    fontSize: '0.95rem',
    fontWeight: 600,
    maxWidth: '75%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  centerBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPlayBtn: {
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    border: '2px solid rgba(255, 255, 255, 0.9)',
    color: '#ffffff',
    fontSize: '1.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bottomBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  progressRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  timeLabel: {
    fontSize: '0.8rem',
    color: '#ffffff',
    fontVariantNumeric: 'tabular-nums',
  },
  progressBar: {
    flex: 1,
    accentColor: '#f47521',
    cursor: 'pointer',
  },
  controlButtonsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTriggerBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  fullscreenBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.4rem',
    cursor: 'pointer',
  },
  // OSD Gesture Indicators
  osdBoxLeft: {
    position: 'absolute',
    left: '28px',
    top: '30%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none',
    zIndex: 20,
  },
  osdBoxRight: {
    position: 'absolute',
    right: '28px',
    top: '30%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    pointerEvents: 'none',
    zIndex: 20,
  },
  osdPercent: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  osdTrack: {
    width: '6px',
    height: '110px',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: '3px',
    display: 'flex',
    flexDirection: 'column-reverse',
    overflow: 'hidden',
  },
  osdFill: {
    width: '100%',
    backgroundColor: '#f47521',
  },
  osdLabel: {
    fontSize: '0.75rem',
    color: '#ffffff',
    fontWeight: 600,
  },
  // Bottom Sheet Modal
  sheetOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 100,
  },
  sheetModal: {
    width: '100%',
    backgroundColor: '#111111',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '20px',
    maxHeight: '75vh',
    borderTop: '1px solid #242424',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sheetTopRow: {
    display: 'flex',
    borderBottom: '1px solid #222222',
    paddingBottom: '10px',
  },
  sheetTitle: {
    flex: 1,
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#ffffff',
  },
  sheetTrackListWrapper: {
    display: 'flex',
    gap: '16px',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  sheetColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  trackItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  checkMark: {
    width: '16px',
    color: '#f47521',
    fontWeight: 900,
  },
  fallbackPlayerRow: {
    borderTop: '1px solid #222222',
    paddingTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  fallbackLabel: {
    fontSize: '0.78rem',
    color: '#aaaaaa',
  },
  appSwitchBtnVidhub: {
    backgroundColor: '#f47521',
    color: '#000000',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  appSwitchBtnVlc: {
    backgroundColor: '#ff8800',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
