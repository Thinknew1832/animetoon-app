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
      {/* Top Navbar */}
      <header style={styles.header}>
        <div style={styles.logo} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ▶ AnimeToon
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
        <h1 style={styles.heroTitle}>AnimeToon Cloud</h1>
        <p style={styles.heroDesc}>
          High-speed anime streaming synced directly from your Google Drive library.
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
            ▶ Watch Latest
          </button>
        )}
      </section>

      {/* Available Episodes Section */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionBar}></span>
        <h2 style={styles.sectionTitle}>Available Episodes</h2>
      </div>

      {loading && <p style={styles.statusText}>Loading episodes from Google Drive...</p>}
      {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}
      {!loading && !error && filteredEpisodes.length === 0 && (
        <p style={styles.statusText}>No video files found in your Drive folder yet.</p>
      )}

      {/* Episode Grid */}
      <div style={styles.grid}>
        {filteredEpisodes.map((file) => {
          const titleClean = file.name.replace(/\.[^/.]+$/, '');
          const thumbnail = file.thumbnailLink
            ? file.thumbnailLink.replace('=s220', '=s500')
            : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';

          return (
            <div
              key={file.id}
              style={styles.card}
              onClick={() => setActiveVideo({ title: titleClean, id: file.id })}
            >
              <img
                src={thumbnail}
                alt={file.name}
                style={styles.cardImg}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';
                }}
              />
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle} title={titleClean}>
                  {titleClean}
                </div>
                <div style={styles.cardMeta}>
                  <span>Drive HD</span>
                  <span style={{ color: '#f47521', fontWeight: 600 }}>▶ Play</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Stream Modal */}
      {activeVideo && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalWrapper}>
            <button style={styles.closeBtn} onClick={() => setActiveVideo(null)}>
              ✕
            </button>
            <div style={styles.playerContainer}>
              <iframe
                src={`https://drive.google.com/file/d/${activeVideo.id}/preview`}
                allow="autoplay; fullscreen"
                allowFullScreen
                style={styles.iframe}
              />
            </div>
            <div style={styles.nowPlayingText}>Playing: {activeVideo.title}</div>
          </div>
        </div>
      )}
    </main>
  );
}

// Inline CSS Styles for Crunchyroll theme
const styles: { [key: string]: React.CSSProperties } = {
  main: {
    backgroundColor: '#0b0b0b',
    color: '#ffffff',
    minHeight: '100vh',
    paddingBottom: '60px',
    fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    backgroundColor: 'rgba(11, 11, 11, 0.95)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px',
    borderBottom: '1px solid #222',
  },
  logo: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: '#f47521',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  searchBox: {
    backgroundColor: '#222',
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
    fontSize: '0.9rem',
  },
  hero: {
    position: 'relative',
    height: '340px',
    background:
      "linear-gradient(to top, #0b0b0b, transparent 80%), linear-gradient(to right, rgba(11,11,11,0.9), transparent 60%), url('https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200') center/cover",
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '30px 24px',
  },
  heroTitle: {
    fontSize: '2.2rem',
    marginBottom: '6px',
  },
  heroDesc: {
    color: '#a0a0a0',
    maxWidth: '500px',
    fontSize: '0.95rem',
    marginBottom: '16px',
    lineHeight: 1.4,
  },
  playBtn: {
    backgroundColor: '#f47521',
    color: '#fff',
    border: 'none',
    padding: '10px 24px',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: 'fit-content',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '24px 24px 14px',
  },
  sectionBar: {
    width: '4px',
    height: '18px',
    backgroundColor: '#f47521',
    borderRadius: '2px',
  },
  sectionTitle: {
    fontSize: '1.3rem',
    fontWeight: 700,
    margin: 0,
  },
  statusText: {
    padding: '20px 24px',
    color: '#a0a0a0',
    fontSize: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '16px',
    padding: '0 24px',
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: '8px',
    overflow: 'hidden',
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'transform 0.2s',
  },
  cardImg: {
    width: '100%',
    height: '240px',
    objectFit: 'cover',
    backgroundColor: '#151515',
    display: 'block',
  },
  cardInfo: {
    padding: '10px',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardMeta: {
    fontSize: '0.8rem',
    color: '#a0a0a0',
    marginTop: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.94)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },
  modalWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '960px',
  },
  playerContainer: {
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#000',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
  },
  closeBtn: {
    position: 'absolute',
    top: '-38px',
    right: 0,
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.8rem',
    cursor: 'pointer',
  },
  nowPlayingText: {
    marginTop: '14px',
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#fff',
  },
};
