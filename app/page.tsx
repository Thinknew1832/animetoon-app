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

export default function Home() {
  const GOOGLE_API_KEY = "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w";
  const ROOT_FOLDER_ID = "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG";
  const PROXY_BASE = "https://animetoon-proxy.thinkingnew.workers.dev";

  const [zones, setZones] = useState<ZoneGroup[]>([]);
  const [allAnimes, setAllAnimes] = useState<AnimeItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Active Video Modal
  const [activeEpisode, setActiveEpisode] = useState<{ title: string; id: string } | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

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

  const startPlayingEpisode = (ep: { title: string; id: string }) => {
    setActiveEpisode(ep);
    setUseIframeFallback(false);
  };

  const currentHero = allAnimes[0];

  return (
    <main style={styles.main}>
      {initialLoading && (
        <div style={styles.centerLoaderBox}>
          <div style={styles.loadingSpinner} />
          <p style={styles.loadingText}>Loading Anime Vault...</p>
        </div>
      )}

      {/* Main Grid Screen */}
      {!initialLoading && !selectedAnime && (
        <div style={{ paddingBottom: '40px' }}>
          {currentHero && (
            <section
              style={{
                ...styles.heroBanner,
                backgroundImage: `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 75%, #000000 100%), url('${currentHero.thumbnail2 || currentHero.thumbnail1}')`,
              }}
            >
              <div style={styles.heroContent}>
                <h1 style={styles.heroTitle}>{currentHero.name}</h1>
                <button style={styles.heroWatchBtn} onClick={() => openAnimeDetails(currentHero)}>
                  ▶ Start Watching
                </button>
              </div>
            </section>
          )}

          {error && <p style={{ padding: '20px', color: '#ff5555' }}>{error}</p>}

          {zones.map((zone) => (
            <section key={zone.id} style={styles.zoneSection}>
              <h3 style={styles.zoneTitle}>{zone.name}</h3>
              <div style={styles.animeGrid2Col}>
                {zone.animes.map((anime) => (
                  <div key={anime.id} style={styles.animeCard2Col} onClick={() => openAnimeDetails(anime)}>
                    <div style={styles.posterContainer2Col}>
                      <img src={anime.thumbnail1} alt={anime.name} style={styles.animePoster} />
                    </div>
                    <div style={styles.animeCardTitle2Col}>{anime.name}</div>
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
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{selectedAnime.name}</h2>
          </div>

          <div style={{ padding: '16px' }}>
            {loadingDetails && <div style={styles.loadingSpinner} />}
            <div style={styles.episodeList}>
              {seasons[selectedSeasonIndex]?.episodes.map((ep, idx) => (
                <div
                  key={ep.id}
                  style={styles.epCard}
                  onClick={() => startPlayingEpisode({ title: ep.name.replace(/\.[^/.]+$/, ''), id: ep.id })}
                >
                  <img src={getSafeImage(ep.id, ep.thumbnailLink)} alt={ep.name} style={styles.epThumb} />
                  <div style={styles.epTitle}>{idx + 1}. {ep.name.replace(/\.[^/.]+$/, '')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reliable Video Player Modal */}
      {activeEpisode && (
        <div style={styles.playerBackdrop}>
          <div style={styles.playerWrapper}>
            <button style={styles.closePlayerBtn} onClick={() => setActiveEpisode(null)}>
              ✕
            </button>

            {!useIframeFallback ? (
              <video
                key={activeEpisode.id}
                src={`${PROXY_BASE}/?id=${activeEpisode.id}`}
                controls
                autoPlay
                playsInline
                onError={() => setUseIframeFallback(true)}
                style={styles.videoPlayer}
              />
            ) : (
              <iframe
                src={`https://drive.google.com/file/d/${activeEpisode.id}/preview`}
                allow="autoplay; fullscreen"
                allowFullScreen
                style={styles.videoIframe}
              />
            )}

            <div style={styles.nowPlayingBar}>
              <span>Playing: <b>{activeEpisode.title}</b></span>
            </div>
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
  heroBanner: { height: '360px', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '20px' },
  heroContent: { maxWidth: '500px' },
  heroTitle: { fontSize: '1.8rem', fontWeight: 800, margin: '0 0 10px 0' },
  heroWatchBtn: { backgroundColor: '#f47521', color: '#000', border: 'none', borderRadius: '24px', padding: '10px 24px', fontSize: '0.95rem', fontWeight: 800, cursor: 'pointer' },
  zoneSection: { padding: '20px 16px 0' },
  zoneTitle: { fontSize: '1.15rem', fontWeight: 800, margin: '0 0 12px 0' },
  animeGrid2Col: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 12px' },
  animeCard2Col: { display: 'flex', flexDirection: 'column', cursor: 'pointer' },
  posterContainer2Col: { width: '100%', aspectRatio: '2 / 3', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#141414' },
  animePoster: { width: '100%', height: '100%', objectFit: 'cover' },
  animeCardTitle2Col: { marginTop: '6px', fontSize: '0.9rem', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  detailPage: { backgroundColor: '#000', minHeight: '100vh', paddingBottom: '40px' },
  detailHero: { height: '260px', backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px' },
  detailBackBtn: { background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', alignSelf: 'flex-start' },
  episodeList: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
  epCard: { display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', backgroundColor: '#0e0e0e', padding: '8px', borderRadius: '6px' },
  epThumb: { width: '110px', height: '65px', borderRadius: '4px', objectFit: 'cover', backgroundColor: '#181818', flexShrink: 0 },
  epTitle: { fontSize: '0.85rem', fontWeight: 600, color: '#fff' },
  playerBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' },
  playerWrapper: { position: 'relative', width: '100%', maxWidth: '900px', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' },
  closePlayerBtn: { position: 'absolute', top: '10px', right: '10px', zIndex: 10, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.2rem', cursor: 'pointer' },
  videoPlayer: { width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000', display: 'block' },
  videoIframe: { width: '100%', aspectRatio: '16 / 9', border: 'none', display: 'block' },
  nowPlayingBar: { padding: '12px 14px', backgroundColor: '#111', fontSize: '0.85rem', color: '#aaa' },
};
