'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
}

interface AnimeItem {
  id: string;
  name: string;
  thumbnail1?: string;
  thumbnail2?: string;
  zoneId: string;
  zoneName: string;
}

interface ZoneGroup {
  id: string;
  name: string;
  animes: AnimeItem[];
}

interface SeasonItem {
  id: string;
  name: string;
  episodes: DriveItem[];
}

type TabType = 'home' | 'mylists' | 'browse';

export default function Home() {
  const GOOGLE_API_KEY = "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w";
  const ROOT_FOLDER_ID = "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG";
  const PROXY_BASE = "https://animetoon-proxy.thinkingnew.workers.dev";

  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [zones, setZones] = useState<ZoneGroup[]>([]);
  const [allAnimes, setAllAnimes] = useState<AnimeItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Player State
  const [activeEpisode, setActiveEpisode] = useState<{ title: string; id: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Audio Track State (Only Real Detected Tracks)
  const [detectedTracks, setDetectedTracks] = useState<{ id: number; label: string }[]>([]);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const [showAudioSheet, setShowAudioSheet] = useState(false);

  const seasonsCache = useRef<{ [key: string]: SeasonItem[] }>({});

  const getSafeImage = (fileId?: string, rawUrl?: string) => {
    if (fileId) return `${PROXY_BASE}/?id=${fileId}`;
    if (rawUrl) return rawUrl.replace(/=s\d+/, '=s1200');
    return 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600';
  };

  useEffect(() => {
    async function loadCatalog() {
      try {
        setInitialLoading(true);
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${ROOT_FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&orderBy=name&key=${GOOGLE_API_KEY}`
        );
        const zoneData = await res.json();
        const zoneFolders: DriveItem[] = zoneData.files || [];

        const zoneResults = await Promise.all(
          zoneFolders.map(async (z) => {
            try {
              const animeRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q='${z.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&key=${GOOGLE_API_KEY}`
              );
              const animeData = await animeRes.json();
              const files: DriveItem[] = animeData.files || [];
              const animeFolders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');

              const animeList: AnimeItem[] = await Promise.all(
                animeFolders.map(async (item) => {
                  try {
                    const imgRes = await fetch(
                      `https://www.googleapis.com/drive/v3/files?q='${item.id}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false&fields=files(id,name,thumbnailLink)&key=${GOOGLE_API_KEY}`
                    );
                    const imgData = await imgRes.json();
                    const imgFiles: DriveItem[] = imgData.files || [];
                    const t1 = imgFiles.find((f) => f.name.toLowerCase().includes('thumbnail1')) || imgFiles[0];
                    const t2 = imgFiles.find((f) => f.name.toLowerCase().includes('thumbnail2')) || t1;

                    return {
                      id: item.id,
                      name: item.name,
                      zoneId: z.id,
                      zoneName: z.name,
                      thumbnail1: t1 ? getSafeImage(t1.id, t1.thumbnailLink) : getSafeImage(undefined, item.thumbnailLink),
                      thumbnail2: t2 ? getSafeImage(t2.id, t2.thumbnailLink) : getSafeImage(undefined, item.thumbnailLink),
                    };
                  } catch {
                    return {
                      id: item.id,
                      name: item.name,
                      zoneId: z.id,
                      zoneName: z.name,
                      thumbnail1: getSafeImage(undefined, item.thumbnailLink),
                      thumbnail2: getSafeImage(undefined, item.thumbnailLink),
                    };
                  }
                })
              );
              return { id: z.id, name: z.name, animes: animeList };
            } catch {
              return { id: z.id, name: z.name, animes: [] };
            }
          })
        );

        const validZones = zoneResults.filter((z) => z.animes.length > 0);
        setZones(validZones);
        setAllAnimes(validZones.flatMap((z) => z.animes));
      } catch (err: any) {
        setError('Failed to connect to Google Drive catalog.');
      } finally {
        setInitialLoading(false);
      }
    }

    loadCatalog();
  }, []);

  const openAnimeDetails = async (anime: AnimeItem) => {
    setSelectedAnime(anime);
    setSelectedSeasonIndex(0);

    if (seasonsCache.current[anime.id]) {
      setSeasons(seasonsCache.current[anime.id]);
      return;
    }

    setLoadingDetails(true);
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${anime.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&orderBy=name&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      const files: DriveItem[] = data.files || [];

      const seasonFolders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
      const directVideos = files.filter((f) => (f.mimeType && f.mimeType.includes('video')) || f.name.match(/\.(mp4|mkv|webm|avi)$/i));

      let loadedSeasons: SeasonItem[] = [];

      if (seasonFolders.length > 0) {
        seasonFolders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        loadedSeasons = await Promise.all(
          seasonFolders.map(async (s) => {
            const epRes = await fetch(
              `https://www.googleapis.com/drive/v3/files?q='${s.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&key=${GOOGLE_API_KEY}`
            );
            const epData = await epRes.json();
            const epFiles: DriveItem[] = (epData.files || []).filter(
              (f: DriveItem) => (f.mimeType && f.mimeType.includes('video')) || f.name.match(/\.(mp4|mkv|webm|avi)$/i)
            );
            epFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            return { id: s.id, name: s.name, episodes: epFiles };
          })
        );
      } else if (directVideos.length > 0) {
        directVideos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        loadedSeasons = [{ id: anime.id, name: 'Season 1', episodes: directVideos }];
      }

      seasonsCache.current[anime.id] = loadedSeasons;
      setSeasons(loadedSeasons);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current as any;
    // Scan exclusively for real tracks exposed by the container
    if (video && video.audioTracks && video.audioTracks.length > 1) {
      const realTracks = [];
      for (let i = 0; i < video.audioTracks.length; i++) {
        const trk = video.audioTracks[i];
        realTracks.push({
          id: i,
          label: trk.label || `Track ${i + 1} (${trk.language || 'Audio'})`,
        });
      }
      setDetectedTracks(realTracks);
    } else {
      // Clear extra tracks if only single audio or unsupported
      setDetectedTracks([]);
    }
  };

  const selectRealTrack = (index: number) => {
    setActiveTrackIndex(index);
    const video = videoRef.current as any;
    if (video && video.audioTracks) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = (i === index);
      }
    }
    setShowAudioSheet(false);
  };

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowAudioSheet(false);
    }, 3500);
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

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentStreamUrl = activeEpisode ? `${PROXY_BASE}/?id=${activeEpisode.id}` : '';
  const currentHero = allAnimes[0];

  return (
    <main style={styles.main}>
      {initialLoading && (
        <div style={styles.centerLoaderBox}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Loading Anime Vault...</p>
        </div>
      )}

      {!initialLoading && !selectedAnime && (
        <div style={{ paddingBottom: '85px' }}>
          {currentHero && (
            <section
              style={{
                ...styles.heroBanner,
                backgroundImage: `linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 75%, #000000 100%), url('${currentHero.thumbnail2 || currentHero.thumbnail1}')`,
              }}
            >
              <div style={styles.heroContent}>
                <h1 style={styles.heroTitle}>{currentHero.name}</h1>
                <div style={styles.tagRow}>
                  <span style={styles.ageBadge}>A</span>
                  <span>• Multi-Audio • AnimeToon Archive</span>
                </div>
                <div style={styles.heroActionRow}>
                  <button style={styles.heroWatchBtn} onClick={() => openAnimeDetails(currentHero)}>
                    ▶ Start Watching
                  </button>
                </div>
              </div>
            </section>
          )}

          {error && <p style={{ padding: '20px', color: '#ff5555' }}>{error}</p>}

          {zones.map((zone) => (
            <section key={zone.id} style={styles.zoneSection}>
              <div style={styles.zoneHeader}>
                <h3 style={styles.zoneTitle}>{zone.name}</h3>
              </div>
              <div style={styles.animeGrid2Col}>
                {zone.animes.map((anime) => (
                  <div key={anime.id} style={styles.animeCard2Col} onClick={() => openAnimeDetails(anime)}>
                    <div style={styles.posterContainer2Col}>
                      <img src={anime.thumbnail1} alt={anime.name} style={styles.animePoster} />
                    </div>
                    <div style={styles.cardBottomMeta2Col}>
                      <div style={styles.animeCardTitle2Col}>{anime.name}</div>
                      <div style={styles.dubSubTag2Col}>Multi-Audio</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Detail Screen */}
      {selectedAnime && (
        <div style={styles.detailPage}>
          <div
            style={{
              ...styles.detailHero,
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, #000000 100%), url('${selectedAnime.thumbnail2 || selectedAnime.thumbnail1}')`,
            }}
          >
            <button style={styles.detailBackBtn} onClick={() => setSelectedAnime(null)}>✕</button>
            <div style={styles.detailTitleArea}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '1.4rem' }}>{selectedAnime.name}</h2>
              <span style={styles.ageBadge}>Multi-Audio</span>
            </div>
          </div>

          <div style={{ padding: '16px' }}>
            {loadingDetails && <div style={styles.loadingSpinner} />}

            <div style={styles.episodeList}>
              {seasons[selectedSeasonIndex]?.episodes.map((ep, idx) => (
                <div
                  key={ep.id}
                  style={styles.epCard}
                  onClick={() => {
                    setActiveEpisode({ title: ep.name.replace(/\.[^/.]+$/, ''), id: ep.id });
                    setIsPlaying(true);
                  }}
                >
                  <div style={styles.epThumbWrapper}>
                    <img src={getSafeImage(ep.id, ep.thumbnailLink)} alt={ep.name} style={styles.epImage} />
                    <span style={styles.epDuration}>24m</span>
                  </div>
                  <div style={styles.epInfo}>
                    <div style={styles.epTitle}>{idx + 1}. {ep.name.replace(/\.[^/.]+$/, '')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Player Modal */}
      {activeEpisode && (
        <div style={styles.playerBackdrop}>
          <div style={styles.playerContainer} onClick={resetControlsTimer}>
            <video
              ref={videoRef}
              src={currentStreamUrl}
              autoPlay
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setDuration(videoRef.current.duration || 0);
                }
              }}
              style={styles.videoElement}
            />

            {showControls && (
              <div style={styles.playerControls}>
                <div style={styles.playerTopBar}>
                  <button style={styles.closePlayerBtn} onClick={() => setActiveEpisode(null)}>✕</button>
                  <div style={styles.playerVideoTitle}>{activeEpisode.title}</div>
                  <button style={styles.audioSwitchBtn} onClick={(e) => { e.stopPropagation(); setShowAudioSheet(true); }}>
                    🎧 Audio
                  </button>
                </div>

                <div style={styles.centerPlayBox}>
                  <button style={styles.centerPlayCircle} onClick={togglePlay}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                </div>

                <div style={styles.playerBottomBar}>
                  <div style={styles.seekRow}>
                    <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (videoRef.current) videoRef.current.currentTime = val;
                      }}
                      style={styles.seekInput}
                    />
                    <span style={styles.timeLabel}>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Clean Audio Selector Modal Sheet */}
            {showAudioSheet && (
              <div style={styles.sheetOverlay} onClick={(e) => { e.stopPropagation(); setShowAudioSheet(false); }}>
                <div style={styles.sheetModal} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.sheetHeader}>
                    <span style={{ fontWeight: 700, fontSize: '1rem' }}>Audio Options 🎧</span>
                    <button style={styles.sheetClose} onClick={() => setShowAudioSheet(false)}>✕</button>
                  </div>

                  {/* If the browser detected real multiple tracks */}
                  {detectedTracks.length > 1 ? (
                    <div style={styles.detectedTrackList}>
                      {detectedTracks.map((t) => (
                        <div
                          key={t.id}
                          style={{
                            ...styles.trackRow,
                            color: activeTrackIndex === t.id ? '#f47521' : '#ffffff',
                          }}
                          onClick={() => selectRealTrack(t.id)}
                        >
                          <span>{t.label}</span>
                          {activeTrackIndex === t.id && <span>✓</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={styles.sheetNotice}>
                      Web browsers play <b>Track 1</b> by default[span_8](start_span)[span_8](end_span). To switch between all embedded Telugu, Hindi, English, and Japanese tracks with full hardware acceleration, launch in 1 tap[span_9](start_span)[span_9](end_span):
                    </p>
                  )}

                  <div style={styles.appSwitchRow}>
                    <button
                      style={styles.appBtnVidhub}
                      onClick={() => (window.location.href = `vidhub://play?url=${encodeURIComponent(currentStreamUrl)}`)}
                    >
                      🚀 Open Multi-Audio in VidHub[span_10](start_span)[span_10](end_span)
                    </button>
                    <button
                      style={styles.appBtnVlc}
                      onClick={() => (window.location.href = `vlc://${currentStreamUrl}`)}
                    >
                      ⚡ Open Multi-Audio in VLC[span_11](start_span)[span_11](end_span)
                    </button>
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

const styles: { [key: string]: React.CSSProperties } = {
  main: { backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  centerLoaderBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '16px' },
  loadingSpinner: { width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#f47521', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: '0.9rem', color: '#888' },
  heroBanner: { height: '380px', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px' },
  heroContent: { maxWidth: '500px' },
  heroTitle: { fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0' },
  tagRow: { fontSize: '0.8rem', color: '#ccc', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' },
  ageBadge: { backgroundColor: '#262626', color: '#eee', padding: '2px 6px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700 },
  heroActionRow: { display: 'flex', gap: '10px' },
  heroWatchBtn: { backgroundColor: '#f47521', color: '#000', border: 'none', borderRadius: '24px', padding: '10px 24px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer' },
  zoneSection: { padding: '20px 16px 0' },
  zoneHeader: { marginBottom: '12px' },
  zoneTitle: { fontSize: '1.15rem', fontWeight: 800, margin: 0 },
  animeGrid2Col: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 12px' },
  animeCard2Col: { display: 'flex', flexDirection: 'column', cursor: 'pointer' },
  posterContainer2Col: { width: '100%', aspectRatio: '2 / 3', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#141414' },
  animePoster: { width: '100%', height: '100%', objectFit: 'cover' },
  cardBottomMeta2Col: { marginTop: '6px' },
  animeCardTitle2Col: { fontSize: '0.9rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  dubSubTag2Col: { fontSize: '0.75rem', color: '#777' },
  detailPage: { backgroundColor: '#000', minHeight: '100vh', paddingBottom: '40px' },
  detailHero: { height: '300px', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px' },
  detailBackBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' },
  detailTitleArea: { display: 'flex', flexDirection: 'column', gap: '6px' },
  episodeList: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  epCard: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', backgroundColor: '#0e0e0e', padding: '8px', borderRadius: '6px' },
  epThumbWrapper: { position: 'relative', width: '110px', height: '65px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#181818', flexShrink: 0 },
  epImage: { width: '100%', height: '100%', objectFit: 'cover' },
  epDuration: { position: 'absolute', bottom: '3px', right: '3px', backgroundColor: 'rgba(0,0,0,0.8)', fontSize: '0.6rem', padding: '1px 4px', borderRadius: '2px' },
  epInfo: { flex: 1 },
  epTitle: { fontSize: '0.85rem', fontWeight: 600, color: '#fff' },
  playerBackdrop: { position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  playerContainer: { position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' },
  videoElement: { width: '100%', height: '100%', objectFit: 'contain' },
  playerControls: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', zIndex: 10 },
  playerTopBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closePlayerBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' },
  playerVideoTitle: { fontSize: '0.9rem', fontWeight: 700, maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  audioSwitchBtn: { backgroundColor: 'rgba(244,117,33,0.2)', border: '1px solid #f47521', color: '#f47521', padding: '5px 12px', borderRadius: '16px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' },
  centerPlayBox: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  centerPlayCircle: { width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.7)', border: '2px solid #fff', color: '#fff', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  playerBottomBar: { display: 'flex', flexDirection: 'column' },
  seekRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  timeLabel: { fontSize: '0.75rem', color: '#fff', fontVariantNumeric: 'tabular-nums' },
  seekInput: { flex: 1, accentColor: '#f47521', cursor: 'pointer' },
  sheetOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 100 },
  sheetModal: { width: '100%', backgroundColor: '#141416', borderTopLeftRadius: '16px', borderTopRightRadius: '16px', padding: '20px', borderTop: '1px solid #282828', display: 'flex', flexDirection: 'column', gap: '14px' },
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sheetClose: { background: 'none', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer' },
  detectedTrackList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  trackRow: { padding: '8px', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', borderRadius: '4px', backgroundColor: '#1c1c1f' },
  sheetNotice: { fontSize: '0.82rem', color: '#aaa', margin: 0, lineHeight: 1.45 },
  appSwitchRow: { display: 'flex', flexDirection: 'column', gap: '8px' },
  appBtnVidhub: { backgroundColor: '#f47521', color: '#000', border: 'none', borderRadius: '6px', padding: '10px', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', textAlign: 'center' },
  appBtnVlc: { backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '6px', padding: '10px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textAlign: 'center' },
};
