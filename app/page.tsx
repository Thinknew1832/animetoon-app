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
  const [activeVideo, setActiveVideo] = useState<{ title: string; id: string; rawUrl: string } | null>(null);

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

  // Deep Link Launchers
  const openInVidHub = (fileId: string) => {
    const directStreamUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    window.location.href = `vidhub://play?url=${encodeURIComponent(directStreamUrl)}`;
  };

  const openInVLC = (fileId: string) => {
    const directStreamUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_API_KEY}`;
    window.location.href = `vlc://${directStreamUrl}`;
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
          Direct Google Drive stream synced with VidHub Premium hardware acceleration.
        </p>
        {episodes.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              style={styles.playBtn}
              onClick={() =>
                setActiveVideo({
                  title: episodes[0].name.replace(/\.[^/.]+$/, ''),
                  id: episodes[0].id,
                  rawUrl: `https://www.googleapis.com/drive/v3/files/${episodes[0].id}?alt=media&key=${GOOGLE_API_KEY}`,
                })
              }
            >
              ▶ Web Player
            </button>
            <button
              style={styles.vidhubHeroBtn}
              onClick={() => openInVidHub(episodes[0].id)}
            >
              🚀 Play in VidHub
            </button>
          </div>
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
            <div key={file.id} style={styles.card}>
              <img
                src={thumbnail}
                alt={file.name}
                style={styles.cardImg}
                onClick={() =>
                  setActiveVideo({
                    title: titleClean,
                    id: file.id,
                    rawUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`,
                  })
                }
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';
                }}
              />
              <div style={styles.cardInfo}>
                <div
                  style={styles.cardTitle}
                  title={titleClean}
                  onClick={() =>
                    setActiveVideo({
                      title: titleClean,
                      id: file.id,
                      rawUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`,
                    })
                  }
                >
                  {titleClean}
                </div>
                <div style={styles.btnRow}>
                  <button
                    style={styles.actionBtnWeb}
                    onClick={() =>
                      setActiveVideo({
                        title: titleClean,
                        id: file.id,
                        rawUrl: `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GOOGLE_API_KEY}`,
                      })
                    }
                  >
                    ▶ Web
                  </button>
                  <button
                    style={styles.actionBtnVidhub}
                    onClick={() => openInVidHub(file.id)}
                    title="Launch directly in VidHub"
                  >
                    🚀 VidHub
                  </button>
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
            <div style={styles.modalFooter}>
              <div style={styles.nowPlayingText}>Playing: {activeVideo.title}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={styles.modalVidhubBtn}
                  onClick={() => openInVidHub(activeVideo.id)}
                >
                  Open in VidHub App
                </button>
                <button
                  style={styles.modalVlcBtn}
                  onClick={() => openInVLC(activeVideo.id)}
                >
                  VLC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Styling (Crunchyroll Dark & Orange Theme)
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
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  vidhubHeroBtn: {
    backgroundColor: '#1f1f1f',
    color: '#fff',
    border: '1px solid #444',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
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
    border: '1px solid #282828',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  cardImg: {
    width: '100%',
    height: '220px',
    objectFit: 'cover',
    backgroundColor: '#151515',
    cursor: 'pointer',
    display: 'block',
  },
  cardInfo: {
    padding: '10px',
  },
  cardTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '8px',
    cursor: 'pointer',
  },
  btnRow: {
    display: 'flex',
    gap: '6px',
  },
  actionBtnWeb: {
    flex: 1,
    backgroundColor: '#282828',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 0',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  actionBtnVidhub: {
    flex: 1,
    backgroundColor: '#f47521',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 0',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
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
  modalFooter: {
    marginTop: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  nowPlayingText: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
  },
  modalVidhubBtn: {
    backgroundColor: '#f47521',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalVlcBtn: {
    backgroundColor: '#ff8800',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 14px',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
