'use client';

import React, { useState, useEffect } from 'react';

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

  return (
    <main style={styles.main}>
      {/* Top Header */}
      <header style={styles.header}>
        <div style={styles.logo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span style={styles.playIcon}>▶</span> ANIMETOON
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

      {/* Hero Spotlight */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>AnimeToon Stream</h1>
          <p style={styles.heroDesc}>
            Instant high-definition streaming directly from your cloud archive.
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

      {loading && <p style={styles.statusText}>Loading anime episodes...</p>}
      {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}
      {!loading && !error && filteredEpisodes.length === 0 && (
        <p style={styles.statusText}>No video files found in this folder.</p>
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
              onClick={() => setActiveVideo({ title: titleClean, id: file.id })}
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
                  <span>Full HD</span>
                  <span style={{ color: '#f47521', fontWeight: 600 }}>Stream</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Native Stream Player Modal */}
      {activeVideo && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalWrapper}>
            <button style={styles.closeBtn} onClick={() => setActiveVideo(null)}>
              ✕
            </button>
            <div style={styles.playerContainer}>
              <video
                key={activeVideo.id}
                src={`${PROXY_BASE}/?id=${activeVideo.id}`}
                controls
                autoPlay
                playsInline
                preload="auto"
                style={styles.videoElement}
              >
                Your browser does not support playing this video format.
              </video>
            </div>
            <div style={styles.nowPlayingText}>
              Playing: <span style={{ color: '#fff' }}>{activeVideo.title}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Crunchyroll-Style Dark & Orange Theme
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
    color: '#f47521',
    letterSpacing: '1.5px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  playIcon: {
    fontSize: '1.1rem',
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
    height: '320px',
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
    transition: 'transform 0.15s ease',
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
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
  },
  modalWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '920px',
  },
  playerContainer: {
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#000000',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #222222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoElement: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
    outline: 'none',
  },
  closeBtn: {
    position: 'absolute',
    top: '-40px',
    right: '0',
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.8rem',
    cursor: 'pointer',
    lineHeight: 1,
  },
  nowPlayingText: {
    marginTop: '12px',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#f47521',
  },
};
