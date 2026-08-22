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

  const artContainerRef = useRef<HTMLDivElement | null>(null);
  const artInstanceRef = useRef<any>(null);

  // 1. Fetch Episodes from Google Drive
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

  // 2. Client-Side Demuxing Engine Initialization
  useEffect(() => {
    if (!activeVideo || !artContainerRef.current) return;
    let isMounted = true;

    const initPlayer = () => {
      if (!artContainerRef.current || !(window as any).Artplayer) return;

      if (artInstanceRef.current && typeof artInstanceRef.current.destroy === 'function') {
        artInstanceRef.current.destroy(false);
      }

      const streamUrl = `${PROXY_BASE}/?id=${activeVideo.id}`;

      const art = new (window as any).Artplayer({
        container: artContainerRef.current,
        url: streamUrl,
        title: activeVideo.title,
        autoplay: true,
        autoSize: true,
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        pip: true,
        fullscreen: true,
        fullscreenWeb: true,
        theme: '#f47521',
        controls: [
          {
            name: 'audio-selector',
            position: 'right',
            html: '🎧 Audio',
            tooltip: 'Switch Audio Track',
            selector: [
              { default: true, html: 'Track 1 (Default / Telugu)', value: 0 },
              { html: 'Track 2 (Hindi Dub)', value: 1 },
              { html: 'Track 3 (Japanese Original)', value: 2 },
              { html: 'Track 4 (English Dub)', value: 3 },
            ],
            onSelect: function (item: any) {
              const videoElement = art.video as any;
              if (videoElement.audioTracks && videoElement.audioTracks.length > 0) {
                for (let i = 0; i < videoElement.audioTracks.length; i++) {
                  videoElement.audioTracks[i].enabled = (i === item.value);
                }
              }
              return item.html;
            },
          },
        ],
      });

      // Scan audio tracks extracted by the browser demuxer
      art.on('video:loadedmetadata', () => {
        const videoElement = art.video as any;
        if (videoElement.audioTracks && videoElement.audioTracks.length > 1) {
          const trackList = [];
          for (let i = 0; i < videoElement.audioTracks.length; i++) {
            const trk = videoElement.audioTracks[i];
            trackList.push({
              default: i === 0,
              html: trk.label || `Track ${i + 1} (${trk.language || 'Multi'})`,
              value: i,
            });
          }
          art.controls.update({
            name: 'audio-selector',
            selector: trackList,
          });
        }
      });

      artInstanceRef.current = art;
    };

    // Dynamically load ArtPlayer library
    if (!(window as any).Artplayer) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.js';
      script.async = true;
      script.onload = () => { if (isMounted) initPlayer(); };
      document.body.appendChild(script);
    } else {
      initPlayer();
    }

    return () => {
      isMounted = false;
      if (artInstanceRef.current && typeof artInstanceRef.current.destroy === 'function') {
        artInstanceRef.current.destroy(false);
      }
    };
  }, [activeVideo]);

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

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <div style={styles.logo}>▶ ANIMETOON</div>
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </header>

      {/* Episode Grid */}
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
              onClick={() => setActiveVideo({ title: titleClean, id: file.id })}
            >
              <img src={thumbnail} alt={file.name} style={styles.cardImg} />
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle}>{titleClean}</div>
                <div style={styles.cardMeta}>
                  <span>Multi-Audio</span>
                  <span style={{ color: '#f47521', fontWeight: 600 }}>Stream</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* In-Browser Multi-Audio Engine Modal */}
      {activeVideo && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalWrapper}>
            <button style={styles.closeBtn} onClick={() => setActiveVideo(null)}>
              ✕
            </button>
            <div style={styles.playerContainer} ref={artContainerRef} />
            <div style={styles.nowPlayingText}>
              Playing: <span>{activeVideo.title}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: { backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh', paddingBottom: '60px', fontFamily: 'system-ui, sans-serif' },
  header: { position: 'sticky', top: 0, zIndex: 100, backgroundColor: '#000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1c1c1c' },
  logo: { fontSize: '1.25rem', fontWeight: 800, color: '#f47521', letterSpacing: '1.5px' },
  searchBox: { backgroundColor: '#141414', border: '1px solid #282828', borderRadius: '20px', padding: '6px 14px' },
  searchInput: { background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '0.85rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', padding: '20px' },
  card: { backgroundColor: '#111111', borderRadius: '6px', overflow: 'hidden', border: '1px solid #1c1c1c', cursor: 'pointer' },
  cardImg: { width: '100%', height: '220px', objectFit: 'cover', display: 'block' },
  cardInfo: { padding: '10px' },
  cardTitle: { fontSize: '0.88rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px' },
  cardMeta: { fontSize: '0.75rem', color: '#777777', display: 'flex', justifyContent: 'space-between' },
  modalBackdrop: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.95)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' },
  modalWrapper: { position: 'relative', width: '100%', maxWidth: '920px' },
  playerContainer: { width: '100%', aspectRatio: '16 / 9', backgroundColor: '#000000', borderRadius: '8px', overflow: 'hidden', border: '1px solid #222222' },
  closeBtn: { position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: '#ffffff', fontSize: '1.8rem', cursor: 'pointer' },
  nowPlayingText: { marginTop: '12px', fontSize: '0.95rem', fontWeight: 600, color: '#f47521' },
};
