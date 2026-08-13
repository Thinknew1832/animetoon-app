'use client';
import { useState, useEffect } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import { MediaPlayer, MediaProvider } from '@vidstack/react';
import { defaultLayoutIcons, DefaultVideoLayout } from '@vidstack/react/player/layouts/default';

const ROOT_FOLDER_ID = '1qJu2_VmnxluIFlgARfX-G606W-tCDAlG'; 
const GOOGLE_API_KEY = 'AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w'; 

type WatchStatus = 'Watching' | 'Plan to Watch' | 'On Hold' | 'Dropped' | 'Completed';
type NavigationTab = 'Home' | 'My Lists' | 'Browse' | 'Account';

const DEFAULT_POSTER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80';
const DEFAULT_BANNER = 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&q=80';

interface AnimeShow {
  id: string;
  name: string;
  genreId: string;
  genreName: string;
  poster: string;   // Image 1
  banner: string;   // Image 2
  createdTime?: string;
}

interface GenreCategory {
  id: string;
  rawName: string;
  cleanName: string;
  shows: AnimeShow[];
}

export default function AnimeToonApp() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('Home');
  const [genres, setGenres] = useState<GenreCategory[]>([]);
  const [featuredAnime, setFeaturedAnime] = useState<AnimeShow[]>([]);
  const [selectedGenreView, setSelectedGenreView] = useState<GenreCategory | null>(null);
  
  const [selectedShow, setSelectedShow] = useState<AnimeShow | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [watchStatuses, setWatchStatuses] = useState<Record<string, WatchStatus>>({});
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const [activePlayerEpisode, setActivePlayerEpisode] = useState<any>(null);

  const [loadingData, setLoadingData] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [featuredIndex, setFeaturedIndex] = useState(0);

  // Auto-slide dynamic hero carousel every 7 SECONDS
  useEffect(() => {
    if (featuredAnime.length === 0) return;
    const timer = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredAnime.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [featuredAnime.length]);

  // Load saved watch statuses
  useEffect(() => {
    const savedStatuses = localStorage.getItem('animetoon_watch_statuses');
    if (savedStatuses) {
      try {
        setWatchStatuses(JSON.parse(savedStatuses));
      } catch (e) {
        console.error('Failed to parse watch statuses', e);
      }
    }
  }, []);

  // Fetch Genre Folders -> Anime Folders -> Dynamically Select 5 Newest for Carousel
  useEffect(() => {
    async function fetchFullLibrary() {
      try {
        setLoadingData(true);
        const genreQuery = encodeURIComponent(`'${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
        const genreUrl = `https://www.googleapis.com/drive/v3/files?q=${genreQuery}&fields=files(id,name)&key=${GOOGLE_API_KEY}`;
        const genreRes = await fetch(genreUrl);
        const genreData = await genreRes.json();

        if (genreData.files) {
          const sortedGenreFolders = genreData.files.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));

          const processedGenres: GenreCategory[] = await Promise.all(
            sortedGenreFolders.map(async (genreFolder: any) => {
              const cleanName = genreFolder.name.replace(/^\d+\.\s*/, '');

              const animeQuery = encodeURIComponent(`'${genreFolder.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
              const animeUrl = `https://www.googleapis.com/drive/v3/files?q=${animeQuery}&fields=files(id,name,createdTime)&key=${GOOGLE_API_KEY}`;
              const animeRes = await fetch(animeUrl);
              const animeData = await animeRes.json();

              let animeList: AnimeShow[] = [];

              if (animeData.files) {
                animeList = await Promise.all(
                  animeData.files.map(async (animeFolder: any) => {
                    let cardPoster = DEFAULT_POSTER;  
                    let infoBanner = DEFAULT_BANNER;  

                    try {
                      const imgQuery = encodeURIComponent(`'${animeFolder.id}' in parents and (mimeType contains 'image/') and trashed = false`);
                      const imgUrl = `https://www.googleapis.com/drive/v3/files?q=${imgQuery}&fields=files(id,name)&key=${GOOGLE_API_KEY}`;
                      const imgRes = await fetch(imgUrl);
                      const imgData = await imgRes.json();

                      if (imgData.files) {
                        imgData.files.forEach((file: any) => {
                          const lowerName = file.name.toLowerCase();
                          if (lowerName.includes('image 1') || lowerName.includes('image1')) {
                            cardPoster = `https://lh3.googleusercontent.com/d/${file.id}=s0`;
                          } else if (lowerName.includes('image 2') || lowerName.includes('image2')) {
                            infoBanner = `https://lh3.googleusercontent.com/d/${file.id}=s0`;
                          }
                        });
                      }
                    } catch (err) {
                      console.error('Error fetching images:', err);
                    }

                    return {
                      id: animeFolder.id,
                      name: animeFolder.name,
                      genreId: genreFolder.id,
                      genreName: cleanName,
                      poster: cardPoster,
                      banner: infoBanner !== DEFAULT_BANNER ? infoBanner : cardPoster,
                      createdTime: animeFolder.createdTime,
                    };
                  })
                );
              }

              return {
                id: genreFolder.id,
                rawName: genreFolder.name,
                cleanName: cleanName,
                shows: animeList,
              };
            })
          );

          setGenres(processedGenres);

          // Extract all shows, sort by newest creation date, take top 5
          const allShows = processedGenres.flatMap((g) => g.shows);
          const newestShows = [...allShows]
            .sort((a, b) => new Date(b.createdTime || 0).getTime() - new Date(a.createdTime || 0).getTime())
            .slice(0, 5);

          setFeaturedAnime(newestShows);
        }
      } catch (error) {
        console.error('Error fetching library:', error);
      } finally {
        setLoadingData(false);
      }
    }

    fetchFullLibrary();
  }, []);

  const handleSelectShow = async (show: AnimeShow) => {
    setSelectedShow(show);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);

    try {
      const subfolderQuery = encodeURIComponent(`'${show.id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
      const subfolderUrl = `https://www.googleapis.com/drive/v3/files?q=${subfolderQuery}&fields=files(id,name)&key=${GOOGLE_API_KEY}`;
      const res = await fetch(subfolderUrl);
      const data = await res.json();

      if (data.files && data.files.length > 0) {
        const sortedSeasons = data.files.sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        setSeasons(sortedSeasons);
        handleSelectSeason(sortedSeasons[0]);
      } else {
        fetchEpisodesFromFolder(show.id, 'Season 1');
      }
    } catch (error) {
      console.error('Error fetching show contents:', error);
    }
  };

  const handleSelectSeason = (season: any) => {
    setSelectedSeason(season);
    fetchEpisodesFromFolder(season.id, season.name);
  };

  const fetchEpisodesFromFolder = async (folderId: string, seasonLabel: string) => {
    setLoadingEpisodes(true);

    try {
      const fileQuery = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder' and not (mimeType contains 'image/')`);
      const fileUrl = `https://www.googleapis.com/drive/v3/files?q=${fileQuery}&fields=files(id,name)&key=${GOOGLE_API_KEY}`;
      const res = await fetch(fileUrl);
      const data = await res.json();

      if (data.files) {
        const seasonNum = seasonLabel.match(/\d+/) ? seasonLabel.match(/\d+/)?.[0].padStart(2, '0') : '01';
        const formatted = data.files.map((file: any, index: number) => ({
          id: file.id,
          code: `S${seasonNum} E${(index + 1).toString().padStart(2, '0')}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          streamUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
          webUrl: `https://drive.google.com/file/d/${file.id}/view`,
        }));
        setEpisodes(formatted);
      } else {
        setEpisodes([]);
      }
    } catch (error) {
      console.error('Error fetching episodes:', error);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const setStatusForShow = (showId: string, status: WatchStatus) => {
    const updated = { ...watchStatuses, [showId]: status };
    setWatchStatuses(updated);
    localStorage.setItem('animetoon_watch_statuses', JSON.stringify(updated));
    setShowStatusMenu(false);
  };

  const allAnimeList = genres.flatMap((g) => g.shows);
  const searchedAnime = allAnimeList.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const renderAnimeCard = (show: AnimeShow) => {
    const status = watchStatuses[show.id];
    return (
      <div
        key={show.id}
        onClick={() => handleSelectShow(show)}
        className="w-28 shrink-0 space-y-1.5 cursor-pointer relative group"
      >
        {status && (
          <span className="absolute top-1.5 right-1.5 bg-[#FF2A7A] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow">
            {status}
          </span>
        )}
        <div className="w-28 h-40 rounded-2xl overflow-hidden shadow-md relative bg-gray-200 transition group-hover:scale-95">
          <img src={show.poster} alt={show.name} className="w-full h-full object-cover" />
        </div>
        <p className="text-xs font-bold text-gray-800 truncate px-0.5">{show.name}</p>
      </div>
    );
  };

  return (
    <main className="bg-[#F6F7FA] text-gray-900 min-h-screen pb-24 flex justify-center font-sans">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col gap-4 relative shadow-xl">
        
        {/* Header */}
        <header className="flex justify-between items-center px-4 py-3 bg-white/90 sticky top-0 z-30 backdrop-blur-md border-b border-gray-100">
          <h1 className="text-2xl font-black text-[#FF2A7A] tracking-tight">AnimeToon</h1>
          <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-xl">🔍</button>
        </header>

        {isSearchOpen && (
          <div className="px-4 py-2 bg-pink-50 border-b border-pink-100">
            <input
              type="text"
              placeholder="Search anime in library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-pink-200 outline-none focus:border-[#FF2A7A]"
            />
          </div>
        )}

        {/* VIEW 1: ANIME DETAILS PAGE */}
        {selectedShow ? (
          <div className="p-4 space-y-4">
            <button
              onClick={() => setSelectedShow(null)}
              className="text-xs font-bold text-[#FF2A7A] bg-pink-50 px-3 py-1.5 rounded-xl flex items-center gap-1 border border-pink-100"
            >
              ← Back
            </button>

            <div className="rounded-2xl overflow-hidden shadow-md relative h-48 bg-gray-900">
              <img src={selectedShow.banner} alt={selectedShow.name} className="w-full h-full object-cover" />
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 text-xs font-bold text-[#FF2A7A]">
                <span>{selectedShow.genreName}</span> • <span>Animation</span>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 leading-tight">{selectedShow.name}</h2>
              
              <div className="flex items-center gap-3 pt-2 relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="px-3 py-1 bg-pink-50 border border-[#FF2A7A] text-[#FF2A7A] font-bold text-xs rounded-xl"
                >
                  {watchStatuses[selectedShow.id] ? `Status: ${watchStatuses[selectedShow.id]}` : '+ Add to Watchlist'}
                </button>

                {showStatusMenu && (
                  <div className="absolute left-0 top-10 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 p-2 w-44 flex flex-col gap-1">
                    {(['Watching', 'Plan to Watch', 'Completed', 'Dropped'] as WatchStatus[]).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusForShow(selectedShow.id, status)}
                        className="text-left text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-pink-50 text-gray-700"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {seasons.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {seasons.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectSeason(s)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 border transition ${
                        selectedSeason?.id === s.id ? 'bg-[#FF2A7A] text-white border-[#FF2A7A]' : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      📋 {s.name.toUpperCase()}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-100 font-bold text-xs px-4 py-2.5 rounded-xl border border-gray-200 inline-block">
                  📋 SEASON 1
                </div>
              )}

              <div className="space-y-2 bg-[#F1F3F6] p-3 rounded-2xl">
                {loadingEpisodes ? (
                  <p className="text-xs text-gray-500 animate-pulse text-center py-6">Loading episodes...</p>
                ) : episodes.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-6">No videos found.</p>
                ) : (
                  episodes.map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => setActivePlayerEpisode(ep)}
                      className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-200 cursor-pointer hover:border-[#FF2A7A]"
                    >
                      <div>
                        <p className="text-[10px] font-bold text-[#FF2A7A]">{ep.code}</p>
                        <p className="text-xs font-bold text-gray-800 line-clamp-1 max-w-[200px]">{ep.title}</p>
                      </div>
                      <button className="p-2 text-[#FF2A7A] font-bold text-lg">▶</button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : selectedGenreView ? (
          /* VIEW 2: SEE ALL GENRE VIEW */
          <div className="p-4 space-y-4">
            <button
              onClick={() => setSelectedGenreView(null)}
              className="text-xs font-bold text-[#FF2A7A] bg-pink-50 px-3 py-1.5 rounded-xl flex items-center gap-1 border border-pink-100"
            >
              ← Back to Home
            </button>

            <h2 className="text-xl font-black text-gray-900">{selectedGenreView.cleanName}</h2>

            <div className="flex flex-wrap gap-3 pt-2">
              {selectedGenreView.shows.length === 0 ? (
                <p className="text-xs text-gray-400 font-bold">No anime added to this zone yet.</p>
              ) : (
                selectedGenreView.shows.map(renderAnimeCard)
              )}
            </div>
          </div>
        ) : (
          /* VIEW 3: HOME MAIN TAB */
          currentTab === 'Home' ? (
            <div className="space-y-6">
              {/* DYNAMIC HERO BANNER */}
              {featuredAnime.length > 0 && (
                <div 
                  onClick={() => handleSelectShow(featuredAnime[featuredIndex])}
                  className="relative w-full h-72 bg-gray-900 overflow-hidden flex flex-col justify-end p-4 cursor-pointer"
                >
                  <img 
                    key={featuredAnime[featuredIndex].id}
                    src={featuredAnime[featuredIndex].banner} 
                    alt="Hero" 
                    className="absolute inset-0 w-full h-full object-cover opacity-70 transition-opacity duration-700" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="relative z-10 space-y-1 text-white">
                    <span className="text-[10px] font-bold text-[#FF2A7A] uppercase bg-white/90 px-2 py-0.5 rounded shadow">
                      NEW RELEASE • {featuredAnime[featuredIndex].genreName}
                    </span>
                    <h2 className="text-2xl font-black">{featuredAnime[featuredIndex].name}</h2>
                    
                    {/* Carousel Dots */}
                    <div className="flex gap-2 pt-2">
                      {featuredAnime.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setFeaturedIndex(idx); }}
                          className={`h-1.5 rounded-full transition-all duration-500 ${featuredIndex === idx ? 'w-6 bg-[#FF2A7A]' : 'w-2 bg-white/50'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-6">
                {searchQuery ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-extrabold text-gray-800">🔍 Search Results</h3>
                    <div className="flex flex-wrap gap-3">
                      {searchedAnime.map(renderAnimeCard)}
                    </div>
                  </div>
                ) : loadingData ? (
                  <p className="text-xs text-gray-400 font-bold animate-pulse text-center py-6">
                    Fetching Latest Uploads & Thumbnails...
                  </p>
                ) : (
                  genres.map((genre) => (
                    <div key={genre.id} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-extrabold text-gray-800">🔥 {genre.cleanName}</h3>
                        {genre.shows.length > 3 && (
                          <button
                            onClick={() => setSelectedGenreView(genre)}
                            className="text-xs font-bold text-[#FF2A7A] hover:underline"
                          >
                            See all ({genre.shows.length}) →
                          </button>
                        )}
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                        {genre.shows.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic">No anime added yet.</p>
                        ) : (
                          genre.shows.slice(0, 3).map(renderAnimeCard)
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : currentTab === 'Browse' ? (
            <div className="p-4 space-y-4">
              <h2 className="text-lg font-black text-gray-900">Full Anime Library</h2>
              <div className="flex flex-wrap gap-3 pt-2">
                {allAnimeList.map(renderAnimeCard)}
              </div>
            </div>
          ) : currentTab === 'My Lists' ? (
            <div className="p-4 space-y-4">
              <h2 className="text-lg font-black text-gray-900">My Watchlist</h2>
              <div className="flex flex-wrap gap-3 pt-2">
                {allAnimeList.filter((s) => watchStatuses[s.id]).map(renderAnimeCard)}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 font-bold text-xs">AnimeToon Account Settings</div>
          )
        )}

        {/* VIDSTACK POWERED VIDEO PLAYER MODAL */}
        {activePlayerEpisode && (
          <div className="fixed inset-0 bg-black/95 z-50 flex flex-col justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl space-y-3">
              <div className="flex justify-between items-center px-4 pt-3 text-white">
                <span className="text-xs font-bold truncate max-w-[200px]">{activePlayerEpisode.title}</span>
                <button
                  onClick={() => setActivePlayerEpisode(null)}
                  className="text-gray-400 text-xl font-bold hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Vidstack Player Container */}
              <div className="relative aspect-video bg-black flex items-center justify-center">
                <MediaPlayer
                  title={activePlayerEpisode.title}
                  src={activePlayerEpisode.streamUrl}
                  autoPlay
                  playsInline
                  className="w-full h-full"
                >
                  <MediaProvider />
                  <DefaultVideoLayout icons={defaultLayoutIcons} />
                </MediaPlayer>
              </div>

              <div className="p-3 bg-gray-900 rounded-b-2xl text-center">
                <a
                  href={activePlayerEpisode.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block bg-[#FF2A7A] text-white text-xs font-bold px-4 py-2 rounded-xl shadow"
                >
                  Open Direct in Google Drive ↗
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-200 flex justify-around items-center py-2 z-40 shadow-lg">
          <button onClick={() => { setCurrentTab('Home'); setSelectedShow(null); setSelectedGenreView(null); }} className={`flex flex-col items-center gap-0.5 ${currentTab === 'Home' ? 'text-[#FF2A7A]' : 'text-gray-400'}`}>
            <span className="text-xl">🏠</span>
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button onClick={() => { setCurrentTab('My Lists'); setSelectedShow(null); setSelectedGenreView(null); }} className={`flex flex-col items-center gap-0.5 ${currentTab === 'My Lists' ? 'text-[#FF2A7A]' : 'text-gray-400'}`}>
            <span className="text-xl">🔖</span>
            <span className="text-[10px] font-bold">My Lists</span>
          </button>
          <button onClick={() => { setCurrentTab('Browse'); setSelectedShow(null); setSelectedGenreView(null); }} className={`flex flex-col items-center gap-0.5 ${currentTab === 'Browse' ? 'text-[#FF2A7A]' : 'text-gray-400'}`}>
            <span className="text-xl">㗊</span>
            <span className="text-[10px] font-bold">Browse</span>
          </button>
          <button onClick={() => { setCurrentTab('Account'); setSelectedShow(null); setSelectedGenreView(null); }} className={`flex flex-col items-center gap-0.5 ${currentTab === 'Account' ? 'text-[#FF2A7A]' : 'text-gray-400'}`}>
            <span className="text-xl">👤</span>
            <span className="text-[10px] font-bold">Account</span>
          </button>
        </nav>

      </div>
    </main>
  );
}
