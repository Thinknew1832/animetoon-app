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

const LIST_CATEGORIES = [
  { key: 'plan', label: '1. Plan to watch' },
  { key: 'watching', label: '2. Watching' },
  { key: 'onhold', label: '3. On hold' },
  { key: 'dropped', label: '4. Dropped' },
  { key: 'completed', label: '5. Completed' },
];

export default function Home() {
  const GOOGLE_API_KEY = "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w";
  const ROOT_FOLDER_ID = "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG";
  const PROXY_BASE = "https://animetoon-proxy.thinkingnew.workers.dev";

  // Tab & Navigation State
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [viewAllZone, setViewAllZone] = useState<ZoneGroup | null>(null);
  const [selectedListCategory, setSelectedListCategory] = useState<string | null>(null);

  // Data states
  const [zones, setZones] = useState<ZoneGroup[]>([]);
  const [allAnimes, setAllAnimes] = useState<AnimeItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  // Hero Carousel State
  const [heroIndex, setHeroIndex] = useState(0);
  const touchHeroStartX = useRef<number>(0);
  const touchHeroEndX = useRef<number>(0);

  // My Lists Storage
  const [savedUserLists, setSavedUserLists] = useState<{ [key: string]: { categoryKey: string; anime: AnimeItem; date: string } }>({});
  const [showListModal, setShowListModal] = useState(false);

  // Details & Season Select Navigation
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [showSeasonsPage, setShowSeasonsPage] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Video Player state
  const [activeEpisode, setActiveEpisode] = useState<{ title: string; id: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);

  // Swipe Gestures
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState(1);
  const [activeGesture, setActiveGesture] = useState<'volume' | 'brightness' | null>(null);
  const [gesturePercent, setGesturePercent] = useState<number>(100);
  const touchStartY = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const startLevel = useRef<number>(0);

  const seasonsCache = useRef<{ [key: string]: SeasonItem[] }>({});

  // 1. Unified Back Navigation Stack Listener
  const activeEpisodeRef = useRef(activeEpisode);
  const showSeasonsPageRef = useRef(showSeasonsPage);
  const showListModalRef = useRef(showListModal);
  const selectedAnimeRef = useRef(selectedAnime);
  const viewAllZoneRef = useRef(viewAllZone);
  const selectedListCategoryRef = useRef(selectedListCategory);
  const currentTabRef = useRef(currentTab);

  useEffect(() => {
    activeEpisodeRef.current = activeEpisode;
    showSeasonsPageRef.current = showSeasonsPage;
    showListModalRef.current = showListModal;
    selectedAnimeRef.current = selectedAnime;
    viewAllZoneRef.current = viewAllZone;
    selectedListCategoryRef.current = selectedListCategory;
    currentTabRef.current = currentTab;
  }, [activeEpisode, showSeasonsPage, showListModal, selectedAnime, viewAllZone, selectedListCategory, currentTab]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', '#000000');

    if (!window.history.state) {
      window.history.replaceState({ depth: 0, view: 'root' }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      // Step backwards layer-by-layer without reloading root
      if (activeEpisodeRef.current) {
        setActiveEpisode(null);
        return;
      }
      if (showSeasonsPageRef.current) {
        setShowSeasonsPage(false);
        return;
      }
      if (showListModalRef.current) {
        setShowListModal(false);
        return;
      }
      if (selectedAnimeRef.current) {
        setSelectedAnime(null);
        return;
      }
      if (viewAllZoneRef.current) {
        setViewAllZone(null);
        return;
      }
      if (selectedListCategoryRef.current) {
        setSelectedListCategory(null);
        return;
      }
      if (currentTabRef.current !== 'home') {
        setCurrentTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushStep = (viewName: string) => {
    window.history.pushState({ view: viewName }, '');
  };

  const handleBack = () => {
    window.history.back();
  };

  // 2. Persistent Storage for My Lists
  useEffect(() => {
    try {
      const stored = localStorage.getItem('animetoon_user_lists');
      if (stored) setSavedUserLists(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const toggleAnimeListCategory = (anime: AnimeItem, categoryKey: string) => {
    const existing = savedUserLists[anime.id];
    let updated = { ...savedUserLists };

    if (existing && existing.categoryKey === categoryKey) {
      delete updated[anime.id];
    } else {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      updated[anime.id] = { categoryKey, anime, date: today };
    }

    setSavedUserLists(updated);
    localStorage.setItem('animetoon_user_lists', JSON.stringify(updated));
    handleBack();
  };

  const removeAnimeFromListExplicitly = (animeId: string) => {
    const updated = { ...savedUserLists };
    delete updated[animeId];
    setSavedUserLists(updated);
    localStorage.setItem('animetoon_user_lists', JSON.stringify(updated));
    handleBack();
  };

  // 3. Fast Parallel Catalog Fetch with Dual Caching
  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      const cachedData = sessionStorage.getItem('animetoon_catalog_cache');
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (parsed.zones && parsed.zones.length > 0) {
            setZones(parsed.zones);
            setAllAnimes(parsed.allAnimes);
            setInitialLoading(false);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      try {
        setInitialLoading(true);
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${ROOT_FOLDER_ID}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(id,name)&orderBy=name&key=${GOOGLE_API_KEY}`
        );
        const zoneData = await res.json();
        if (zoneData.error) throw new Error(zoneData.error.message);

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

                    const t1 = imgFiles.find((f) => f.name.toLowerCase().includes('thumbnail1'));
                    const t2 = imgFiles.find((f) => f.name.toLowerCase().includes('thumbnail2'));

                    const thumb1Url = t1?.thumbnailLink ? t1.thumbnailLink.replace(/=s\d+/, '=s1000') : item.thumbnailLink?.replace(/=s\d+/, '=s1000');
                    const thumb2Url = t2?.thumbnailLink ? t2.thumbnailLink.replace(/=s\d+/, '=s1400') : thumb1Url;

                    return {
                      id: item.id,
                      name: item.name,
                      zoneId: z.id,
                      zoneName: z.name,
                      thumbnail1: thumb1Url,
                      thumbnail2: thumb2Url,
                    };
                  } catch {
                    return {
                      id: item.id,
                      name: item.name,
                      zoneId: z.id,
                      zoneName: z.name,
                      thumbnail1: item.thumbnailLink?.replace(/=s\d+/, '=s1000'),
                      thumbnail2: item.thumbnailLink?.replace(/=s\d+/, '=s1400'),
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
        const accumulated = validZones.flatMap((z) => z.animes);

        if (isMounted) {
          setZones(validZones);
          setAllAnimes(accumulated);
          sessionStorage.setItem('animetoon_catalog_cache', JSON.stringify({ zones: validZones, allAnimes: accumulated }));
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to connect to Google Drive.');
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  // 4. Hero Carousel
  const heroAnimes = allAnimes.slice(0, 6);
  useEffect(() => {
    if (heroAnimes.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroAnimes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [heroAnimes.length]);

  const handleHeroTouchStart = (e: React.TouchEvent) => {
    touchHeroStartX.current = e.touches[0].clientX;
  };

  const handleHeroTouchMove = (e: React.TouchEvent) => {
    touchHeroEndX.current = e.touches[0].clientX;
  };

  const handleHeroTouchEnd = () => {
    const diff = touchHeroStartX.current - touchHeroEndX.current;
    if (diff > 50) {
      setHeroIndex((prev) => (prev + 1) % heroAnimes.length);
    } else if (diff < -50) {
      setHeroIndex((prev) => (prev - 1 + heroAnimes.length) % heroAnimes.length);
    }
  };

  // 5. Open Anime Details with Natural Sorting
  const openAnimeDetails = async (anime: AnimeItem) => {
    pushStep('detail');
    setSelectedAnime(anime);
    setShowSeasonsPage(false);
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
              `https://www.googleapis.com/drive/v3/files?q='${s.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&orderBy=name&key=${GOOGLE_API_KEY}`
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
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const selectSeason = (index: number) => {
    setSelectedSeasonIndex(index);
    handleBack();
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

  const getAnimesInCategory = (categoryKey: string) => {
    return Object.values(savedUserLists)
      .filter((item) => item.categoryKey === categoryKey)
      .map((item) => item.anime);
  };

  const currentHero = heroAnimes[heroIndex] || allAnimes[0];

  return (
    <main style={styles.main}>
      {/* Center Screen Loader */}
      {initialLoading && (
        <div style={styles.centerLoaderBox}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Loading Anime Library...</p>
        </div>
      )}

      {/* ────────────────── 1. MAIN TABS ────────────────── */}
      {!initialLoading && !selectedAnime && !viewAllZone && !selectedListCategory && (
        <div style={{ paddingBottom: '85px' }}>
          {/* TAB 1: HOME PAGE */}
          {currentTab === 'home' && (
            <>
              <header style={styles.pureTransparentHeader}>
                <div style={styles.homeLogo}>
                  <svg width="34" height="34" viewBox="0 0 100 100" fill="none" style={styles.logoShadow}>
                    <path
                      d="M50 5C25.147 5 5 25.147 5 50C5 74.853 25.147 95 50 95C74.853 95 95 74.853 95 50C95 38.3 90.5 27.5 83 19.5C80 28 72 34 62.5 34C50.626 34 41 24.374 41 12.5C41 9.8 41.5 7.3 42.5 5C50 5 50 5 50 5Z"
                      fill="#f47521"
                    />
                    <circle cx="68" cy="62" r="16" fill="#f47521" />
                  </svg>
                </div>
                <div style={styles.headerIcons}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={styles.iconShadow}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
              </header>

              {currentHero && (
                <section
                  onTouchStart={handleHeroTouchStart}
                  onTouchMove={handleHeroTouchMove}
                  onTouchEnd={handleHeroTouchEnd}
                  style={{
                    ...styles.heroBanner,
                    backgroundImage: `linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 75%, #000000 100%), url('${currentHero.thumbnail2 || currentHero.thumbnail1}')`,
                  }}
                >
                  <div style={styles.heroContent}>
                    <h1 style={styles.heroTitle}>{currentHero.name}</h1>
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
                        onClick={() => openAnimeDetails(currentHero)}
                      >
                        ▶ Start Watching E1
                      </button>
                      <button
                        style={styles.bookmarkBtn}
                        onClick={() => {
                          pushStep('modal');
                          setSelectedAnime(currentHero);
                          setShowListModal(true);
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill={savedUserLists[currentHero.id] ? '#f47521' : 'none'} stroke="#f47521" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </button>
                    </div>

                    <div style={styles.carouselIndicators}>
                      {heroAnimes.map((_, i) => (
                        <span
                          key={i}
                          onClick={() => setHeroIndex(i)}
                          style={{
                            ...styles.dot,
                            backgroundColor: i === heroIndex ? '#f47521' : 'rgba(255, 255, 255, 0.3)',
                            width: i === heroIndex ? '26px' : '8px',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}

              {zones.map((zone) => (
                <section key={zone.id} style={styles.zoneSection}>
                  <div style={styles.zoneHeader}>
                    <h3 style={styles.zoneTitle}>{zone.name}</h3>
                    {zone.animes.length > 3 && (
                      <button
                        style={styles.viewAllBtn}
                        onClick={() => {
                          pushStep('viewall');
                          setViewAllZone(zone);
                        }}
                      >
                        View All ➔
                      </button>
                    )}
                  </div>

                  <div style={styles.animeGrid}>
                    {zone.animes.slice(0, 3).map((anime) => (
                      <div
                        key={anime.id}
                        style={styles.animeCard}
                        onClick={() => openAnimeDetails(anime)}
                      >
                        <div style={styles.posterContainer}>
                          <img
                            src={anime.thumbnail1 || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'}
                            alt={anime.name}
                            style={styles.animePoster}
                          />
                        </div>
                        <div style={styles.cardBottomMeta}>
                          <div style={styles.animeCardTitle} title={anime.name}>
                            {anime.name}
                          </div>
                          <div style={styles.cardSubTextRow}>
                            <span style={styles.dubSubTag}>Dub | Sub</span>
                            <span style={styles.menuDots}>⋮</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}

          {/* TAB 2: MY LISTS */}
          {currentTab === 'mylists' && (
            <div style={styles.myListsContainer}>
              <header style={styles.pageTopBar}>
                <h2 style={styles.pageTitle}>My Lists</h2>
              </header>

              <div style={styles.myListsCardList}>
                {LIST_CATEGORIES.map((cat) => {
                  const itemsInCat = Object.values(savedUserLists).filter((i) => i.categoryKey === cat.key);
                  const lastUpdated = itemsInCat.length > 0 ? itemsInCat[itemsInCat.length - 1].date : 'Never';

                  return (
                    <div
                      key={cat.key}
                      style={styles.myListCategoryCard}
                      onClick={() => {
                        pushStep('category');
                        setSelectedListCategory(cat.key);
                      }}
                    >
                      <div>
                        <div style={styles.catCardTitle}>{cat.label}</div>
                        <div style={styles.catCardSubtitle}>
                          {itemsInCat.length} Items • Updated on {lastUpdated}
                        </div>
                      </div>
                      <span style={styles.catCardMenu}>⋮</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: BROWSE ALL */}
          {currentTab === 'browse' && (
            <div style={styles.browseContainer}>
              <header style={styles.pageTopBar}>
                <h2 style={styles.pageTitle}>Browse All Anime</h2>
                <span style={styles.browseCount}>({allAnimes.length} Titles)</span>
              </header>

              <div style={styles.animeGrid}>
                {allAnimes.map((anime) => (
                  <div
                    key={anime.id}
                    style={styles.animeCard}
                    onClick={() => openAnimeDetails(anime)}
                  >
                    <div style={styles.posterContainer}>
                      <img
                        src={anime.thumbnail1 || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'}
                        alt={anime.name}
                        style={styles.animePoster}
                      />
                    </div>
                    <div style={styles.cardBottomMeta}>
                      <div style={styles.animeCardTitle} title={anime.name}>
                        {anime.name}
                      </div>
                      <div style={styles.cardSubTextRow}>
                        <span style={styles.dubSubTag}>Dub | Sub</span>
                        <span style={styles.menuDots}>⋮</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── 2. VIEW ALL ZONE SCREEN ────────────────── */}
      {viewAllZone && !selectedAnime && (
        <div style={styles.viewAllPage}>
          <header style={styles.subPageHeader}>
            <button style={styles.subPageBackBtn} onClick={handleBack}>
              ←
            </button>
            <h2 style={styles.subPageTitle}>{viewAllZone.name}</h2>
          </header>

          <div style={styles.animeGrid}>
            {viewAllZone.animes.map((anime) => (
              <div
                key={anime.id}
                style={styles.animeCard}
                onClick={() => openAnimeDetails(anime)}
              >
                <div style={styles.posterContainer}>
                  <img
                    src={anime.thumbnail1 || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'}
                    alt={anime.name}
                    style={styles.animePoster}
                  />
                </div>
                <div style={styles.cardBottomMeta}>
                  <div style={styles.animeCardTitle} title={anime.name}>
                    {anime.name}
                  </div>
                  <div style={styles.cardSubTextRow}>
                    <span style={styles.dubSubTag}>Dub | Sub</span>
                    <span style={styles.menuDots}>⋮</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ────────────────── 3. MY LISTS CATEGORY SCREEN ────────────────── */}
      {selectedListCategory && !selectedAnime && (
        <div style={styles.viewAllPage}>
          <header style={styles.subPageHeader}>
            <button style={styles.subPageBackBtn} onClick={handleBack}>
              ←
            </button>
            <h2 style={styles.subPageTitle}>
              {LIST_CATEGORIES.find((c) => c.key === selectedListCategory)?.label}
            </h2>
          </header>

          {getAnimesInCategory(selectedListCategory).length === 0 ? (
            <p style={styles.statusText}>No anime added to this list yet.</p>
          ) : (
            <div style={styles.animeGrid}>
              {getAnimesInCategory(selectedListCategory).map((anime) => (
                <div
                  key={anime.id}
                  style={styles.animeCard}
                  onClick={() => openAnimeDetails(anime)}
                >
                  <div style={styles.posterContainer}>
                    <img
                      src={anime.thumbnail1 || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500'}
                      alt={anime.name}
                      style={styles.animePoster}
                    />
                  </div>
                  <div style={styles.cardBottomMeta}>
                    <div style={styles.animeCardTitle} title={anime.name}>
                      {anime.name}
                    </div>
                    <div style={styles.cardSubTextRow}>
                      <span style={styles.dubSubTag}>Dub | Sub</span>
                      <span style={styles.menuDots}>⋮</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ────────────────── 4. ANIME DETAIL SCREEN ────────────────── */}
      {selectedAnime && !showSeasonsPage && (
        <div style={styles.detailPage}>
          <div
            style={{
              ...styles.detailHero,
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 40%, #000000 95%), url('${selectedAnime.thumbnail2 || selectedAnime.thumbnail1}')`,
            }}
          >
            <div style={styles.detailTopBar}>
              <button style={styles.roundBackBtn} onClick={handleBack}>
                ✕
              </button>
              <div style={styles.headerIcons}>
                <span style={{ fontSize: '1.4rem', cursor: 'pointer' }}>⋮</span>
              </div>
            </div>
          </div>

          <div style={styles.detailContent}>
            <div style={styles.awardBadge}>🔥 Most Popular Anime</div>
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
              <div
                style={styles.actionBtn}
                onClick={() => {
                  pushStep('modal');
                  setShowListModal(true);
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>
                  {savedUserLists[selectedAnime.id] ? '✓' : '＋'}
                </span>
                <span>
                  {savedUserLists[selectedAnime.id]
                    ? LIST_CATEGORIES.find((c) => c.key === savedUserLists[selectedAnime.id].categoryKey)?.label.split(' ')[1] || 'In List'
                    : 'My List'}
                </span>
              </div>
            </div>

            <p style={styles.synopsisText}>
              Stream all episodes with crystal clear audio. Enjoy high performance multi-audio playback directly synced with your cloud library.
            </p>
            <span style={styles.moreDetailsText}>More Details</span>

            <div style={styles.tabsRow}>
              <span style={styles.tabActive}>Episodes</span>
            </div>

            {/* Season Selector Bar */}
            {seasons.length > 0 && (
              <div
                style={styles.seasonBarWrapper}
                onClick={() => {
                  pushStep('seasons_page');
                  setShowSeasonsPage(true);
                }}
              >
                <div style={styles.seasonBarTitleRow}>
                  <span style={styles.seasonDropdownArrow}>▾</span>
                  <span style={styles.seasonBarTitle}>
                    {seasons[selectedSeasonIndex]?.name || 'SEASON 1'}
                  </span>
                </div>
                <span style={styles.seasonBarMenuDots}>⋮</span>
              </div>
            )}

            {loadingDetails && (
              <div style={{ padding: '30px 0', textAlign: 'center' }}>
                <div style={styles.loadingSpinner} />
              </div>
            )}

            <div style={styles.episodeList}>
              {seasons[selectedSeasonIndex]?.episodes.map((ep, idx) => {
                const epTitle = ep.name.replace(/\.[^/.]+$/, '');
                const epThumb = ep.thumbnailLink
                  ? ep.thumbnailLink.replace(/=s\d+/, '=s500')
                  : selectedAnime.thumbnail1;

                return (
                  <div
                    key={ep.id}
                    style={styles.episodeCard}
                    onClick={() => {
                      pushStep('player');
                      setActiveEpisode({ title: epTitle, id: ep.id });
                      setIsPlaying(true);
                    }}
                  >
                    <div style={styles.epThumbWrapper}>
                      <img src={epThumb} alt={ep.name} style={styles.epImage} />
                      <span style={styles.durationBadge}>24m</span>
                    </div>

                    <div style={styles.epInfo}>
                      <div style={styles.epNumberTitle}>
                        {idx + 1}. {epTitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {seasons.length > 0 && seasons[selectedSeasonIndex]?.episodes.length > 0 && (
            <div style={styles.stickyBottomBar}>
              <button
                style={styles.stickyPlayBtn}
                onClick={() => {
                  const ep = seasons[selectedSeasonIndex]?.episodes[0];
                  if (ep) {
                    pushStep('player');
                    setActiveEpisode({ title: ep.name.replace(/\.[^/.]+$/, ''), id: ep.id });
                  }
                }}
              >
                ▶ Continue E1
              </button>
              <button
                style={styles.stickyBookmarkBtn}
                onClick={() => {
                  pushStep('modal');
                  setShowListModal(true);
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={savedUserLists[selectedAnime.id] ? '#f47521' : 'none'} stroke="#f47521" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ────────────────── 5. SEASONS FULL PAGE / SHEET VIEW ────────────────── */}
      {selectedAnime && showSeasonsPage && (
        <div style={styles.seasonsFullPage}>
          <header style={styles.seasonsPageHeader}>
            <button style={styles.seasonsPageCloseBtn} onClick={handleBack}>
              ✕
            </button>
            <h2 style={styles.seasonsPageHeaderTitle}>Seasons</h2>
          </header>

          <div style={styles.seasonsItemList}>
            {seasons.map((s, idx) => {
              const isCurrent = idx === selectedSeasonIndex;
              return (
                <div
                  key={s.id}
                  style={styles.seasonItemRow}
                  onClick={() => selectSeason(idx)}
                >
                  <span
                    style={{
                      ...styles.seasonItemName,
                      color: isCurrent ? '#f47521' : '#ffffff',
                      fontWeight: isCurrent ? 700 : 500,
                    }}
                  >
                    {s.name}
                  </span>
                  <span style={styles.seasonItemCount}>
                    {s.episodes.length} Episodes
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ────────────────── 6. ADD / REMOVE MY LIST MODAL ────────────────── */}
      {showListModal && selectedAnime && (
        <div style={styles.modalOverlay} onClick={handleBack}>
          <div style={styles.listModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.listModalHeader}>
              <h3 style={styles.listModalTitle}>Save to My Lists</h3>
              <button style={styles.closeBtnText} onClick={handleBack}>
                ✕
              </button>
            </div>
            <div style={styles.listOptionsContainer}>
              {LIST_CATEGORIES.map((cat) => {
                const isSelected = savedUserLists[selectedAnime.id]?.categoryKey === cat.key;
                return (
                  <div
                    key={cat.key}
                    style={{
                      ...styles.listOptionRow,
                      backgroundColor: isSelected ? 'rgba(244, 117, 33, 0.15)' : '#1a1a1a',
                      borderColor: isSelected ? '#f47521' : '#282828',
                    }}
                    onClick={() => toggleAnimeListCategory(selectedAnime, cat.key)}
                  >
                    <span style={{ fontWeight: isSelected ? 700 : 500, color: isSelected ? '#f47521' : '#ffffff' }}>
                      {cat.label}
                    </span>
                    {isSelected && <span style={{ color: '#f47521', fontWeight: 900 }}>✓</span>}
                  </div>
                );
              })}

              {savedUserLists[selectedAnime.id] && (
                <button
                  style={styles.removeListBtn}
                  onClick={() => removeAnimeFromListExplicitly(selectedAnime.id)}
                >
                  🗑️ Remove from My Lists
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── 7. FULLSCREEN VIDEO PLAYER ────────────────── */}
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

            {showControls && (
              <div style={styles.playerControls}>
                <div style={styles.playerTopBar}>
                  <button style={styles.closePlayerBtn} onClick={handleBack}>
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

      {/* ────────────────── 8. BOTTOM NAVIGATION BAR ────────────────── */}
      {!selectedAnime && !activeEpisode && (
        <nav style={styles.bottomNav}>
          <div
            style={{
              ...styles.navItem,
              color: currentTab === 'home' ? '#f47521' : '#ffffff',
            }}
            onClick={() => {
              setCurrentTab('home');
              setViewAllZone(null);
              setSelectedListCategory(null);
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Home</span>
          </div>

          <div
            style={{
              ...styles.navItem,
              color: currentTab === 'mylists' ? '#f47521' : '#ffffff',
            }}
            onClick={() => {
              setCurrentTab('mylists');
              setViewAllZone(null);
              setSelectedListCategory(null);
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span>My Lists</span>
          </div>

          <div
            style={{
              ...styles.navItem,
              color: currentTab === 'browse' ? '#f47521' : '#ffffff',
            }}
            onClick={() => {
              setCurrentTab('browse');
              setViewAllZone(null);
              setSelectedListCategory(null);
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Browse</span>
          </div>
        </nav>
      )}
    </main>
  );
}

// ────────────────── OLED PURE BLACK STYLES ──────────────────
const styles: { [key: string]: React.CSSProperties } = {
  main: {
    backgroundColor: '#000000',
    color: '#ffffff',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    paddingTop: 'env(safe-area-inset-top, 0px)',
  },
  centerLoaderBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    gap: '16px',
  },
  loadingSpinner: {
    width: '42px',
    height: '42px',
    border: '3.5px solid rgba(255, 255, 255, 0.15)',
    borderTopColor: '#f47521',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.9rem',
    color: '#aaaaaa',
    fontWeight: 600,
  },
  pureTransparentHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    background: 'transparent',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 18px',
  },
  homeLogo: {
    display: 'flex',
    alignItems: 'center',
  },
  logoShadow: {
    filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.8))',
  },
  iconShadow: {
    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))',
    cursor: 'pointer',
  },
  headerIcons: {
    display: 'flex',
    alignItems: 'center',
    color: '#ffffff',
  },
  heroBanner: {
    position: 'relative',
    height: '520px',
    backgroundSize: 'cover',
    backgroundPosition: 'center top',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '24px 16px',
    transition: 'background-image 0.4s ease-in-out',
  },
  heroContent: {
    maxWidth: '550px',
  },
  heroTitle: {
    fontSize: '2rem',
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px',
    lineHeight: 1.1,
  },
  tagRow: {
    fontSize: '0.8rem',
    color: '#cccccc',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '10px',
  },
  ageBadge: {
    backgroundColor: '#2b2b2b',
    color: '#e0e0e0',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  heroDesc: {
    fontSize: '0.86rem',
    color: '#b0b0b0',
    lineHeight: 1.45,
    marginBottom: '18px',
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
    borderRadius: '26px',
    padding: '13px 20px',
    fontSize: '0.98rem',
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '0.2px',
  },
  bookmarkBtn: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1.5px solid rgba(255, 255, 255, 0.25)',
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
    height: '4px',
    borderRadius: '2px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  zoneSection: {
    padding: '20px 14px 0',
  },
  zoneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  zoneTitle: {
    fontSize: '1.15rem',
    fontWeight: 800,
    margin: 0,
    letterSpacing: '0.2px',
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
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '10px',
    alignItems: 'start',
    width: '100%',
  },
  animeCard: {
    display: 'flex',
    flexDirection: 'column',
    cursor: 'pointer',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  posterContainer: {
    width: '100%',
    aspectRatio: '2 / 3',
    maxHeight: '170px',
    borderRadius: '4px',
    overflow: 'hidden',
    backgroundColor: '#161616',
    border: '1px solid #1f1f1f',
  },
  animePoster: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  cardBottomMeta: {
    marginTop: '6px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    width: '100%',
  },
  animeCardTitle: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.25,
    width: '100%',
  },
  cardSubTextRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  dubSubTag: {
    fontSize: '0.7rem',
    color: '#777777',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  menuDots: {
    fontSize: '0.85rem',
    color: '#666666',
    flexShrink: 0,
  },
  myListsContainer: {
    padding: '20px 16px',
  },
  pageTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
  },
  pageTitle: {
    fontSize: '1.4rem',
    fontWeight: 800,
    margin: 0,
  },
  myListsCardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  myListCategoryCard: {
    backgroundColor: '#121216',
    border: '1px solid #1f1f26',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  catCardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: '4px',
  },
  catCardSubtitle: {
    fontSize: '0.8rem',
    color: '#777788',
  },
  catCardMenu: {
    fontSize: '1.2rem',
    color: '#888888',
  },
  browseContainer: {
    padding: '20px 14px',
  },
  browseCount: {
    fontSize: '0.85rem',
    color: '#888888',
  },
  viewAllPage: {
    padding: '20px 14px 80px',
  },
  subPageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '20px',
  },
  subPageBackBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.6rem',
    cursor: 'pointer',
  },
  subPageTitle: {
    fontSize: '1.3rem',
    fontWeight: 800,
    margin: 0,
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
    padding: '10px 0',
    zIndex: 99,
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
  },
  listModalContent: {
    width: '100%',
    backgroundColor: '#121214',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '20px',
    borderTop: '1px solid #282828',
  },
  listModalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  listModalTitle: {
    fontSize: '1.1rem',
    fontWeight: 800,
    margin: 0,
  },
  closeBtnText: {
    background: 'none',
    border: 'none',
    color: '#888888',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  listOptionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  listOptionRow: {
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  removeListBtn: {
    marginTop: '6px',
    padding: '14px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    border: '1px solid rgba(255, 59, 48, 0.3)',
    color: '#ff3b30',
    fontSize: '0.9rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  detailPage: {
    backgroundColor: '#000000',
    minHeight: '100vh',
    paddingBottom: '90px',
  },
  detailHero: {
    position: 'relative',
    height: '300px',
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
    marginTop: '-24px',
  },
  awardBadge: {
    fontSize: '0.75rem',
    color: '#f47521',
    fontWeight: 700,
    marginBottom: '6px',
  },
  detailTitle: {
    fontSize: '1.65rem',
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
  seasonBarWrapper: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0',
    borderBottom: '1px solid #141414',
    marginBottom: '14px',
    cursor: 'pointer',
  },
  seasonBarTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  seasonDropdownArrow: {
    fontSize: '1rem',
    color: '#ffffff',
  },
  seasonBarTitle: {
    fontSize: '1.05rem',
    fontWeight: 900,
    color: '#ffffff',
    letterSpacing: '0.5px',
  },
  seasonBarMenuDots: {
    fontSize: '1.2rem',
    color: '#888888',
  },
  seasonsFullPage: {
    position: 'fixed',
    inset: 0,
    backgroundColor: '#000000',
    zIndex: 200,
    display: 'flex',
    flexDirection: 'column',
    padding: '18px 20px',
    overflowY: 'auto',
  },
  seasonsPageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    marginBottom: '28px',
  },
  seasonsPageCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.6rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  seasonsPageHeaderTitle: {
    fontSize: '1.25rem',
    fontWeight: 800,
    margin: 0,
  },
  seasonsItemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  seasonItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    padding: '4px 0',
  },
  seasonItemName: {
    fontSize: '1rem',
    letterSpacing: '0.2px',
  },
  seasonItemCount: {
    fontSize: '0.85rem',
    color: '#777777',
  },
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
