'use client';

import React, { useState, useEffect } from 'react';

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
}

interface NavStep {
  id: string;
  name: string;
}

export default function Home() {
  const GOOGLE_API_KEY = "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w";
  const ROOT_FOLDER_ID = "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG";
  const PROXY_BASE = "https://animetoon-proxy.thinkingnew.workers.dev";

  // Breadcrumb navigation stack
  const [navStack, setNavStack] = useState<NavStep[]>([
    { id: ROOT_FOLDER_ID, name: 'Library' },
  ]);

  const currentFolder = navStack[navStack.length - 1];

  const [items, setItems] = useState<DriveItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<DriveItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeVideo, setActiveVideo] = useState<{ title: string; id: string } | null>(null);

  // Fetch contents of whichever folder is currently active
  useEffect(() => {
    async function fetchFolderContents() {
      try {
        setLoading(true);
        setError('');
        const endpoint = `https://www.googleapis.com/drive/v3/files?q='${currentFolder.id}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink)&orderBy=folder,name&key=${GOOGLE_API_KEY}`;
        const res = await fetch(endpoint);
        const data = await res.json();

        if (data.error) {
          setError(`Drive API Error: ${data.error.message}`);
          setLoading(false);
          return;
        }

        const driveItems: DriveItem[] = (data.files || []).filter((f: DriveItem) =>
          f.mimeType === 'application/vnd.google-apps.folder' ||
          (f.mimeType && f.mimeType.includes('video')) ||
          f.name.match(/\.(mp4|mkv|webm|avi|mov)$/i)
        );

        setItems(driveItems);
        setFilteredItems(driveItems);
      } catch (err: any) {
        setError('Failed to connect to Google Drive.');
      } finally {
        setLoading(false);
      }
    }

    fetchFolderContents();
  }, [currentFolder.id]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredItems(items);
    } else {
      setFilteredItems(
        items.filter((item) =>
          item.name.toLowerCase().includes(query.toLowerCase())
        )
      );
    }
  };

  // Step inside a folder
  const enterFolder = (folderId: string, folderName: string) => {
    setSearchQuery('');
    setNavStack((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  // Navigate backward using breadcrumbs
  const navigateToBreadcrumb = (index: number) => {
    setSearchQuery('');
    setNavStack((prev) => prev.slice(0, index + 1));
  };

  const streamUrl = activeVideo ? `${PROXY_BASE}/?id=${activeVideo.id}` : '';

  return (
    <main style={styles.main}>
      {/* Top Navbar */}
      <header style={styles.header}>
        <div style={styles.logo} onClick={() => navigateToBreadcrumb(0)}>
          <span style={{ color: '#f47521' }}>▶</span> ANIMETOON
        </div>
        <div style={styles.searchBox}>
          <input
            type="text"
            placeholder="Search here..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </header>

      {/* Breadcrumb Navigation Trail */}
      <div style={styles.breadcrumbBar}>
        {navStack.map((step, idx) => {
          const isLast = idx === navStack.length - 1;
          return (
            <React.Fragment key={step.id}>
              <span
                style={{
                  ...styles.breadcrumbItem,
                  color: isLast ? '#f47521' : '#aaaaaa',
                  fontWeight: isLast ? 700 : 500,
                  cursor: isLast ? 'default' : 'pointer',
                }}
                onClick={() => !isLast && navigateToBreadcrumb(idx)}
              >
                {step.name}
              </span>
              {!isLast && <span style={styles.breadcrumbDivider}>/</span>}
            </React.Fragment>
          );
        })}
      </div>

      {/* Section Status & Count */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionBar}></span>
        <h2 style={styles.sectionTitle}>{currentFolder.name}</h2>
        <span style={styles.itemCount}>({filteredItems.length} items)</span>
      </div>

      {loading && <p style={styles.statusText}>Loading contents from Google Drive...</p>}
      {error && <p style={{ ...styles.statusText, color: '#ff5555' }}>{error}</p>}
      {!loading && !error && filteredItems.length === 0 && (
        <p style={styles.statusText}>This folder is empty.</p>
      )}

      {/* Grid of Folders and Video Files */}
      <div style={styles.grid}>
        {filteredItems.map((item) => {
          const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
          const titleClean = item.name.replace(/\.[^/.]+$/, '');
          const thumbnail = item.thumbnailLink
            ? item.thumbnailLink.replace('=s220', '=s500')
            : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';

          return (
            <div
              key={item.id}
              style={styles.card}
              onClick={() => {
                if (isFolder) {
                  enterFolder(item.id, item.name);
                } else {
                  setActiveVideo({ title: titleClean, id: item.id });
                }
              }}
            >
              <div style={styles.cardImgWrapper}>
                {isFolder ? (
                  <div style={styles.folderCover}>
                    <span style={styles.folderIcon}>📁</span>
                    <span style={styles.folderBadge}>Folder</span>
                  </div>
                ) : (
                  <>
                    <img
                      src={thumbnail}
                      alt={item.name}
                      style={styles.cardImg}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=500';
                      }}
                    />
                    <div style={styles.cardHoverOverlay}>
                      <div style={styles.playCircle}>▶</div>
                    </div>
                  </>
                )}
              </div>
              <div style={styles.cardInfo}>
                <div style={styles.cardTitle} title={item.name}>
                  {titleClean}
                </div>
                <div style={styles.cardMeta}>
                  <span>{isFolder ? 'Category / Directory' : 'Multi-Audio'}</span>
                  <span style={{ color: '#f47521', fontWeight: 600 }}>
                    {isFolder ? 'Open ➔' : 'Stream'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Video Streaming Modal */}
      {activeVideo && (
        <div style={styles.playerBackdrop}>
          <div style={styles.playerModal}>
            <button style={styles.closeBtn} onClick={() => setActiveVideo(null)}>
              ✕
            </button>
            <div style={styles.videoContainer}>
              <video
                src={streamUrl}
                controls
                autoPlay
                playsInline
                style={styles.videoElement}
              />
            </div>
            <div style={styles.modalInfo}>
              <div style={styles.videoTitleText}>{activeVideo.title}</div>
              <div style={styles.externalLauncherGroup}>
                <button
                  style={styles.btnVidhub}
                  onClick={() => {
                    window.location.href = `vidhub://play?url=${encodeURIComponent(streamUrl)}`;
                  }}
                >
                  🚀 VidHub (Telugu/Hindi)
                </button>
                <button
                  style={styles.btnVlc}
                  onClick={() => {
                    window.location.href = `vlc://${streamUrl}`;
                  }}
                >
                  ⚡ VLC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

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
  breadcrumbBar: {
    padding: '12px 20px',
    backgroundColor: '#0d0d0d',
    borderBottom: '1px solid #1a1a1a',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflowX: 'auto',
    whiteSpace: 'nowrap',
  },
  breadcrumbItem: {
    fontSize: '0.88rem',
    transition: 'color 0.15s ease',
  },
  breadcrumbDivider: {
    color: '#555555',
    fontSize: '0.8rem',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '20px 20px 14px',
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
  itemCount: {
    fontSize: '0.85rem',
    color: '#777777',
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
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #1c1c1c',
    cursor: 'pointer',
    transition: 'transform 0.15s ease',
  },
  cardImgWrapper: {
    position: 'relative',
    width: '100%',
    height: '200px',
    backgroundColor: '#161616',
  },
  cardImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  folderCover: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'linear-gradient(145deg, #1c1c1c, #111111)',
  },
  folderIcon: {
    fontSize: '3.2rem',
  },
  folderBadge: {
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    color: '#f47521',
    backgroundColor: 'rgba(244, 117, 33, 0.15)',
    padding: '3px 8px',
    borderRadius: '4px',
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
    padding: '12px 10px',
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
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '16px',
  },
  playerModal: {
    position: 'relative',
    width: '100%',
    maxWidth: '920px',
  },
  closeBtn: {
    position: 'absolute',
    top: '-38px',
    right: 0,
    background: 'none',
    border: 'none',
    color: '#ffffff',
    fontSize: '1.8rem',
    cursor: 'pointer',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    border: '1px solid #222',
  },
  videoElement: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
  modalInfo: {
    marginTop: '14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  videoTitleText: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    maxWidth: '60%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  externalLauncherGroup: {
    display: 'flex',
    gap: '8px',
  },
  btnVidhub: {
    backgroundColor: '#f47521',
    color: '#000000',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnVlc: {
    backgroundColor: '#282828',
    color: '#ffffff',
    border: '1px solid #444',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
