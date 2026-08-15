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
  expanded?: boolean;
}

interface SeasonItem {
  id: string;
  name: string;
  episodes: DriveItem[];
}

export default function Home() {
  const GOOGLE_API_KEY = "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w";
  const ROOT_FOLDER_ID = "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG";
  const PROXY_BASE = "https://animetoon-proxy.thinkingnew.workers.dev";

  // Data states
  const [zones, setZones] = useState<ZoneGroup[]>([]);
  const [featuredAnime, setFeaturedAnime] = useState<AnimeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Navigation / Page views
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Video Player state
  const [activeEpisode, setActiveEpisode] = useState<{ title: string; id: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Swipe Gestures (Volume / Brightness)
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [activeGesture, setActiveGesture] = useState<'volume' | 'brightness' | null>(null);
  const [gesturePercent, setGesturePercent] = useState<number>(100);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const startLevel = useRef<number>(0);

  // 1. Fetch Main Zones and Anime Cards
  useEffect(() => {
    async function fetchCatalog() {
      try {
        setLoading(true);
        // 1. Get Zone folders
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${ROOT_FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&orderBy=name&key=${GOOGLE_API_KEY}`
        );
        const zoneData = await res.json();
        if (zoneData.error) throw new Error(zoneData.error.message);

        const zoneFolders: DriveItem[] = zoneData.files || [];
        const loadedZones: ZoneGroup[] = [];

        // 2. For each zone, fetch anime subfolders
        for (const z of zoneFolders) {
          const animeRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${z.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&key=${GOOGLE_API_KEY}`
          );
          const animeData = await animeRes.json();
          const files: DriveItem[] = animeData.files || [];

          const animeList: AnimeItem[] = [];

          for (const item of files) {
            if (item.mimeType === 'application/vnd.google-apps.folder') {
              // Fetch images inside this anime folder (thumbnail1 / thumbnail2)
              const imgRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q='${item.id}'+in+parents+and+mimeType+contains+'image/'+and+trashed=false&fields=files(id,name,thumbnailLink)&key=${GOOGLE_API_KEY}`
              );
              const imgData = await imgRes.json();
              const imgFiles: DriveItem[] = imgData.files || [];

              const t1 = imgFiles.find((f) => f.name.toLowerCase().includes('thumbnail1'));
              const t2 = imgFiles.find((f) => f.name.toLowerCase().includes('thumbnail2'));

              animeList.push({
                id: item.id,
                name: item.name,
                zoneId: z.id,
                zoneName: z.name,
                thumbnail1: t1 ? t1.thumbnailLink?.replace('=s220', '=s800') : item.thumbnailLink?.replace('=s220', '=s800'),
                thumbnail2: t2 ? t2.thumbnailLink?.replace('=s220', '=s1200') : t1 ? t1.thumbnailLink?.replace('=s220', '=s1200') : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200',
              });
            }
          }

          if (animeList.length > 0) {
            loadedZones.push({
              id: z.id,
              name: z.name,
              animes: animeList,
              expanded: false,
            });
          }
        }

        setZones(loadedZones);
        if (loadedZones.length > 0 && loadedZones[0].animes.length > 0) {
          setFeaturedAnime(loadedZones[0].animes[0]);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to connect to Google Drive.');
      } finally {
        setLoading(false);
      }
    }

    fetchCatalog();
  }, []);

  // 2. Fetch Seasons & Episodes when Anime is clicked
  const openAnimeDetails = async (anime: AnimeItem) => {
    setSelectedAnime(anime);
    setLoadingDetails(true);
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q='${anime.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&orderBy=name&key=${GOOGLE_API_KEY}`
      );
      const data = await res.json();
      const files: DriveItem[] = data.files || [];

      const seasonFolders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
      const directVideos = files.filter((f) => (f.mimeType && f.mimeType.includes('video')) || f.name.match(/\.(mp4|mkv|webm|avi)$/i));

      const loadedSeasons: SeasonItem[] = [];

      if (seasonFolders.length > 0) {
        for (const s of seasonFolders) {
          const epRes = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${s.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&orderBy=name&key=${GOOGLE_API_KEY}`
          );
          const epData = await epRes.json();
          const epFiles: DriveItem[] = (epData.files || []).filter(
            (f: DriveItem) => (f.mimeType && f.mimeType.includes('video')) || f.name.match(/\.(mp4|mkv|webm|avi)$/i)
          );
          loadedSeasons.push({
            id: s.id,
            name: s.name,
            episodes: epFiles,
          });
        }
      } else if (directVideos.length > 0) {
        loadedSeasons.push({
          id: anime.id,
          name: 'Season 1',
          episodes: directVideos,
        });
      }

      setSeasons(loadedSeasons);
      setSelectedSeasonIndex(0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleZoneExpand = (zoneId: string) => {
    setZones((prev) =>
      prev.map((z) => (z.id === zoneId ? { ...z, expanded: !z.expanded } : z))
    );
  };

  // Video Player Controls
  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3500);
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

  const formatCountdown = (curr: number, dur: number) => {
    if (isNaN(dur) || isNaN(curr)) return '-0:00';
    return `-${formatTime(Math.max(0, dur - curr))}`;
  };

  // Touch Swipe (Volume / Brightness)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;

    if (touch.clientX < window.innerWidth / 2) {
      setActiveGesture('volume');
      startLevel.current = volume;
    } else {
      setActiveGesture('brightness');
      startLevel.current = brightness;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeGesture || e.touches.length !== 1) return;
    const deltaY = touchStartY.current - e.touches[0].clientY;
    const change = deltaY / 200;

    if (activeGesture === 'volume') {
      const v = Math.min(Math.max(startLevel.current + change, 0), 1);
      setVolume(v);
      if (videoRef.current) videoRef.current.volume = v;
      setGesturePercent(Math.round(v * 100));
    } else {
      const b = Math.min(Math.max(startLevel.current + change, 0.2), 1);
      setBrightness(b);
      setGesturePercent(Math.round(b * 100));
    }
  };

  const currentStreamUrl = activeEpisode ? `${PROXY_BASE}/?id=${activeEpisode.id}` : '';

  return (
    <main style={styles.main}>
      {/* ────────────────── SCREEN 1: HOME PAGE ────────────────── */}
      {!selectedAnime && (
        <div style={{ paddingBottom: '70px' }}>
          {/* Top Bar */}
          <header style={styles.homeHeader}>
            <div style={styles.homeLogo}>
              <span style={styles.crSpiral}>🌀</span> ANIMETOON
            </div>
            <div style={styles.headerIcons}>
              <span style={styles.iconBtn}>📺</span>
              <span style={styles.iconBtn}>🔍</span>
            </div>
          </header>

          {/* Featured Hero Banner */}
          {featuredAnime && (
            <section
              style={{
                ...styles.heroBanner,
                backgroundImage: `linear-gradient(to top, #000000 10%, rgba(0,0,0,0.5) 60%, transparent 100%), url('${featuredAnime.thumbnail2}')`,
              }}
            >
              <div style={styles.heroContent}>
                <h1 style={styles.heroTitle}>{featuredAnime.name}</h1>
                <div style={styles.tagRow}>
                  <span style={styles.ageBadge}>A</span>
                  <span>• Dub | Sub • Action, Supernatural, Shonen</span>
                </div>
                <p style={styles.heroDesc}>
                  Stream every season and episode with high bitrate multi-audio cloud streaming.
                </p>

                <div style={styles.heroActionRow}>
                  <button
                    style={styles.heroWatchBtn}
                    onClick={() => openAnimeDetails(featuredAnime)}
                  >
                    ▶ Start Watching E1
                  </button>
                  <button style={styles.bookmarkBtn}>🔖</button>
                </div>

                <div style={styles.carouselIndicators}>
                  <span style={{ ...styles.dot, backgroundColor: '#f47521', width: '28px' }}></span>
                  <span style={styles.dot}></span>
                  <span style={styles.dot}></span>
                  <span style={styles.dot}></span>
                </div>
              </div>
            </section>
          )}

          {loading && <p style={styles.statusText}>Loading anime zones...</p>}
          {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}

          {/* Zone Rows */}
          {zones.map((zone) => {
            const displayedAnime = zone.expanded ? zone.animes : zone.animes.slice(0, 3);

            return (
              <section key={zone.id} style={styles.zoneSection}>
                <div style={styles.zoneHeader}>
                  <h3 style={styles.zoneTitle}>{zone.name}</h3>
                  {zone.animes.length > 3 && (
                    <button
                      style={styles.viewAllBtn}
                      onClick={() => toggleZoneExpand(zone.id)}
                    >
                      {zone.expanded ? 'Show Less' : 'View All ➔'}
                    </button>
                  )}
                </div>

                <div style={styles.animeGrid}>
                  {displayedAnime.map((anime) => (
                    <div
                      key={anime.id}
                      style={styles.animeCard}
                      onClick={() => openAnimeDetails(anime)}
                    >
                      <img
                        src={anime.thumbnail1 || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'}
                        alt={anime.name}
                        style={styles.animePoster}
                      />
                      <div style={styles.animeCardTitle}>{anime.name}</div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {/* Bottom Crunchyroll Nav */}
          <nav style={styles.bottomNav}>
            <div style={{ ...styles.navItem, color: '#f47521' }}>
              <span>🏠</span>
              <span>Home</span>
            </div>
            <div style={styles.navItem}>
              <span>🔖</span>
              <span>My Lists</span>
            </div>
            <div style={styles.navItem}>
              <span>▦</span>
              <span>Browse</span>
            </div>
            <div style={styles.navItem}>
              <span>✨</span>
              <span>Simulcasts</span>
            </div>
            <div style={styles.navItem}>
              <span>👤</span>
              <span>Account</span>
            </div>
          </nav>
        </div>
      )}

      {/* ────────────────── SCREEN 2 & 3: ANIME DETAIL & EPISODES ────────────────── */}
      {selectedAnime && (
        <div style={styles.detailPage}>
          {/* Top Hero Image with Thumbnail 2 */}
          <div
            style={{
              ...styles.detailHero,
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 40%, #000000 95%), url('${selectedAnime.thumbnail2}')`,
            }}
          >
            <div style={styles.detailTopBar}>
              <button style={styles.roundBackBtn} onClick={() => setSelectedAnime(null)}>
                ✕
              </button>
              <div style={styles.headerIcons}>
                <span style={styles.iconBtn}>📺</span>
                <span style={styles.iconBtn}>⋮</span>
              </div>
            </div>
          </div>

          {/* Series Info Header */}
          <div style={styles.detailContent}>
            <div style={styles.awardBadge}>🔥 2026 Most Popular Anime</div>
            <h1 style={styles.detailTitle}>{selectedAnime.name}</h1>

            <div style={styles.detailMetaRow}>
              <span style={styles.ageBadge}>U/A 16+</span>
              <span>• Dub | Sub • Action, Fantasy, Shonen</span>
            </div>

            <div style={styles.ratingRow}>
              <span style={{ color: '#ffffff' }}>★★★★★</span>
              <span>Average: <b>4.8</b> (450K) ▾</span>
            </div>

            <div style={styles.detailActionButtons}>
              <div style={styles.actionBtn}>
                <span style={{ fontSize: '1.2rem' }}>＋</span>
                <span>My List</span>
              </div>
              <div style={styles.actionBtn}>
                <span style={{ fontSize: '1.2rem' }}>↗</span>
                <span>Share</span>
              </div>
            </div>

            <p style={styles.synopsisText}>
              Stream all episodes with crystal clear audio. Enjoy high performance multi-audio playback directly synced with your cloud library.
            </p>
            <span style={styles.moreDetailsText}>More Details</span>

            {/* Tabs */}
            <div style={styles.tabsRow}>
              <span style={styles.tabActive}>Episodes</span>
              <span style={styles.tabInactive}>Featured Music</span>
              <span style={styles.tabInactive}>More Like This</span>
            </div>

            {/* Season Selector */}
            {seasons.length > 0 && (
              <div style={styles.seasonSelectorRow}>
                <select
                  value={selectedSeasonIndex}
                  onChange={(e) => setSelectedSeasonIndex(Number(e.target.value))}
                  style={styles.seasonSelectDropdown}
                >
                  {seasons.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      ▾ {s.name.toUpperCase()}
                    </option>
                  ))}
                </select>
                <div style={styles.downloadAllRow}>
                  <span>Download All</span>
                  <span>⬇</span>
                </div>
              </div>
            )}

            {loadingDetails && <p style={styles.statusText}>Loading season episodes...</p>}

            {/* Episode List (Picture 3 Layout) */}
            <div style={styles.episodeList}>
              {seasons[selectedSeasonIndex]?.episodes.map((ep, idx) => {
                const epTitle = ep.name.replace(/\.[^/.]+$/, '');
                const epThumb = ep.thumbnailLink
                  ? ep.thumbnailLink.replace('=s220', '=s500')
                  : selectedAnime.thumbnail1;

                return (
                  <div
                    key={ep.id}
                    style={styles.episodeCard}
                    onClick={() => {
                      setActiveEpisode({ title: epTitle, id: ep.id });
                      setIsPlaying(true);
                    }}
                  >
                    <div style={styles.epThumbWrapper}>
                      <img src={epThumb} alt={ep.name} style={styles.epImage} />
                      <span style={styles.premiumBadge}>👑 PREMIUM</span>
                      <span style={styles.durationBadge}>24m</span>
                    </div>

                    <div style={styles.epInfo}>
                      <div style={styles.epNumberTitle}>
                        {idx + 1}. {epTitle}
                      </div>
                    </div>

                    <div style={styles.epRightIcons}>
                      <span style={styles.epDownloadIcon}>⬇</span>
                      <span style={styles.epMenuIcon}>⋮</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sticky Bottom Watch Button */}
          {seasons.length > 0 && seasons[0].episodes.length > 0 && (
            <div style={styles.stickyBottomBar}>
              <button
                style={styles.stickyPlayBtn}
                onClick={() => {
                  const ep = seasons[selectedSeasonIndex]?.episodes[0];
                  if (ep) setActiveEpisode({ title: ep.name.replace(/\.[^/.]+$/, ''), id: ep.id });
                }}
              >
                ▶ Continue E1
              </button>
              <button style={styles.stickyBookmarkBtn}>🔖</button>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── SCREEN 4: FULLSCREEN VIDEO PLAYER ────────────────── */}
      {activeEpisode && (
        <div style={styles.playerBackdrop}>
          <div
            style={styles.playerContainer}
            onClick={resetControlsTimer}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => setTimeout(() => setActiveGesture(null), 800)}
          >
            <video
              ref={videoRef}
              src={currentStreamUrl}
              autoPlay
              playsInline
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setDuration(videoRef.current.duration || 0);
                }
              }}
              style={{
                ...styles.videoElement,
                filter: `brightness(${brightness})`,
              }}
            />

            {/* Gesture OSD */}
            {activeGesture && (
              <div style={activeGesture === 'volume' ? styles.osdLeft : styles.osdRight}>
                <span style={styles.osdPercent}>{gesturePercent}%</span>
                <div style={styles.osdTrack}>
                  <div style={{ ...styles.osdFill, height: `${gesturePercent}%` }} />
                </div>
                <span style={styles.osdLabel}>
                  {activeGesture === 'volume' ? 'Volume 🔊' : 'Brightness ☀️'}
                </span>
              </div>
            )}

            {/* Controls */}
            {showControls && (
              <div style={styles.playerControls}>
                <div style={styles.playerTopBar}>
                  <button style={styles.closePlayerBtn} onClick={() => setActiveEpisode(null)}>
                    ✕
                  </button>
                  <div style={styles.playerVideoTitle}>{activeEpisode.title}</div>
                  <div style={{ width: 32 }}></div>
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
                    <span style={styles.timeLabel}>{formatCountdown(currentTime, duration)}</span>
                  </div>

                  <div style={styles.externalMultiAudioRow}>
                    <span style={{ fontSize: '0.75rem', color: '#aaaaaa' }}>
                      Play all Telugu/Hindi tracks in 1-click:
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={styles.vidhubBtn}
                        onClick={() =>
                          (window.location.href = `vidhub://play?url=${encodeURIComponent(
                            currentStreamUrl
                          )}`)
                        }
                      >
                        🚀 VidHub
                      </button>
                      <button
                        style={styles.vlcBtn}
                        onClick={() => (window.location.href = `vlc://${currentStreamUrl}`)}
                      >
                        ⚡ VLC
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

// ────────────────── CRUNCHYROLL PIXEL-PERFECT STYLING ──────────────────
const styles: { [key: string]: React.CSSProperties } = {
  main: {
    backgroundColor: '#000000',
    color: '#ffffff',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  // Home Screen
  homeHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
  },
  homeLogo: {
    fontSize: '1.2rem',
    fontWeight: 900,
    color: '#f47521',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  crSpiral: {
    fontSize: '1.3rem',
  },
  headerIcons: {
    display: 'flex',
    gap: '16px',
  },
  iconBtn: {
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  heroBanner: {
    position: 'relative',
    height: '460px',
    backgroundSize: 'cover',
    backgroundPosition: 'center top',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '20px 16px',
  },
  heroContent: {
    maxWidth: '550px',
  },
  heroTitle: {
    fontSize: '1.8rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '6px',
  },
  tagRow: {
    fontSize: '0.8rem',
    color: '#cccccc',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  ageBadge: {
    backgroundColor: '#333333',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  heroDesc: {
    fontSize: '0.85rem',
    color: '#aaaaaa',
    lineHeight: 1.4,
    marginBottom: '16px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  heroActionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  heroWatchBtn: {
    flex: 1,
    backgroundColor: '#f47521',
    color: '#000000',
    border: 'none',
    borderRadius: '24px',
    padding: '12px 20px',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  bookmarkBtn: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    color: '#ffffff',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  carouselIndicators: {
    display: 'flex',
    gap: '6px',
  },
  dot: {
    width: '8px',
    height: '4px',
    borderRadius: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Zones & Grid
  zoneSection: {
    padding: '20px 16px 0',
  },
  zoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  zoneTitle: {
    fontSize: '1.15rem',
    fontWeight: 800,
    margin: 0,
  },
  viewAllBtn: {
    background: 'none',
    border: 'none',
    color: '#f47521',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  animeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  animeCard: {
    cursor: 'pointer',
  },
  animePoster: {
    width: '100%',
    aspectRatio: '2 / 3',
    objectFit: 'cover',
    borderRadius: '6px',
    backgroundColor: '#161616',
  },
  animeCardTitle: {
    marginTop: '6px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#dddddd',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  bottomNav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0a0a0a',
    borderTop: '1px solid #1a1a1a',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 0',
    zIndex: 99,
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    fontSize: '0.68rem',
    color: '#888888',
  },
  // Detail Page
  detailPage: {
    backgroundColor: '#000000',
    minHeight: '100vh',
    paddingBottom: '90px',
  },
  detailHero: {
    position: 'relative',
    height: '280px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '16px',
  },
  detailTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roundBackBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  detailContent: {
    padding: '0 16px',
    marginTop: '-20px',
  },
  awardBadge: {
    fontSize: '0.75rem',
    color: '#f47521',
    fontWeight: 700,
    marginBottom: '6px',
  },
  detailTitle: {
    fontSize: '1.6rem',
    fontWeight: 900,
    marginBottom: '6px',
  },
  detailMetaRow: {
    fontSize: '0.78rem',
    color: '#aaaaaa',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px',
  },
  ratingRow: {
    fontSize: '0.8rem',
    color: '#888888',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
  },
  detailActionButtons: {
    display: 'flex',
    gap: '32px',
    marginBottom: '16px',
  },
  actionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: '0.75rem',
    color: '#f47521',
    cursor: 'pointer',
  },
  synopsisText: {
    fontSize: '0.85rem',
    color: '#999999',
    lineHeight: 1.4,
    marginBottom: '4px',
  },
  moreDetailsText: {
    fontSize: '0.82rem',
    color: '#f47521',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabsRow: {
    display: 'flex',
    gap: '24px',
    borderBottom: '1px solid #1a1a1a',
    marginTop: '20px',
    marginBottom: '14px',
  },
  tabActive: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#ffffff',
    borderBottom: '3px solid #f47521',
    paddingBottom: '8px',
  },
  tabInactive: {
    fontSize: '0.9rem',
    color: '#666666',
    paddingBottom: '8px',
  },
  seasonSelectorRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  seasonSelectDropdown: {
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.95rem',
    fontWeight: 800,
    outline: 'none',
    cursor: 'pointer',
  },
  downloadAllRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.78rem',
    color: '#aaaaaa',
  },
  // Episodes List (Picture 3)
  episodeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  episodeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  epThumbWrapper: {
    position: 'relative',
    width: '130px',
    height: '75px',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: '#161616',
    flexShrink: 0,
  },
  epImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  premiumBadge: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: '#ffc107',
    fontSize: '0.55rem',
    fontWeight: 800,
    padding: '2px 4px',
    borderRadius: '2px',
  },
  durationBadge: {
    position: 'absolute',
    bottom: '4px',
    right: '4px',
    backgroundColor: 'rgba(0,0,0,0.75)',
    color: '#ffffff',
    fontSize: '0.62rem',
    padding: '1px 4px',
    borderRadius: '2px',
  },
  epInfo: {
    flex: 1,
  },
  epNumberTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#ffffff',
    lineHeight: 1.3,
  },
  epRightIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#888888',
    paddingRight: '6px',
  },
  epDownloadIcon: {
    fontSize: '1rem',
  },
  epMenuIcon: {
    fontSize: '1.1rem',
  },
  stickyBottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    padding: '12px 16px',
    display: 'flex',
    gap: '12px',
    borderTop: '1px solid #1c1c1c',
    zIndex: 90,
  },
  stickyPlayBtn: {
    flex: 1,
    backgroundColor: '#f47521',
    color: '#000000',
    border: 'none',
    borderRadius: '24px',
    padding: '12px',
    fontSize: '0.95rem',
    fontWeight: 800,
    cursor: 'pointer',
  },
  stickyBookmarkBtn: {
    width: '46px',
    height: '46px',
    borderRadius: '50%',
    backgroundColor: '#161616',
    border: '1px solid #333333',
    color: '#ffffff',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fullscreen Video Player
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
  playerControls: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '20px',
    zIndex: 10,
  },
  playerTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closePlayerBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.6rem',
    cursor: 'pointer',
  },
  playerVideoTitle: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#ffffff',
    maxWidth: '70%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  centerPlayBox: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerPlayCircle: {
    width: '68px',
    height: '68px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    border: '2px solid #ffffff',
    color: '#ffffff',
    fontSize: '1.8rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  playerBottomBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  seekRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  timeLabel: {
    fontSize: '0.8rem',
    color: '#ffffff',
    fontVariantNumeric: 'tabular-nums',
  },
  seekInput: {
    flex: 1,
    accentColor: '#f47521',
    cursor: 'pointer',
  },
  externalMultiAudioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '8px',
  },
  vidhubBtn: {
    backgroundColor: '#f47521',
    color: '#000000',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  vlcBtn: {
    backgroundColor: '#222222',
    color: '#ffffff',
    border: '1px solid #444',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  osdLeft: {
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
  osdRight: {
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
  statusText: {
    padding: '20px 16px',
    color: '#888888',
    fontSize: '0.9rem',
  },
};
