"use client";

import { useEffect, useState } from "react";

interface Episode {
  id: string;
  name: string;
  displayName: string;
}

const CONFIG = {
  folderId: "1qJu2_VmnxluIFlgARfX-G606W-tCDAlG",
  apiKey: "AIzaSyCwhYhosnTrfHyi6N1C0N8AJl4gT85xg9w",
};

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [activeEpisode, setActiveEpisode] = useState<Episode | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const cleanTitle = (fileName: string) => {
    return fileName.replace(/\.(mp4|mkv|avi|mov|webm)$/i, "");
  };

  useEffect(() => {
    async function fetchEpisodes() {
      const query = encodeURIComponent(`'${CONFIG.folderId}' in parents and trashed = false`);
      const fields = encodeURIComponent("files(id, name, mimeType, size)");
      const endpoint = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&pageSize=1000&key=${CONFIG.apiKey}`;

      try {
        setLoading(true);
        const res = await fetch(endpoint);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `API error: ${res.status}`);
        }

        const data = await res.json();
        const files: { id: string; name: string }[] = data.files || [];

        if (files.length === 0) {
          setError("No video files found in the specified folder.");
          return;
        }

        // Sort episodes naturally (Episode 1, Episode 2, Episode 10)
        files.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        );

        const parsedEpisodes: Episode[] = files.map((file) => ({
          id: file.id,
          name: file.name,
          displayName: cleanTitle(file.name),
        }));

        setEpisodes(parsedEpisodes);
        setActiveEpisode(parsedEpisodes[0]);
        setActiveIndex(0);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load episodes from Drive.");
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  const handleSelectEpisode = (ep: Episode, index: number) => {
    setActiveEpisode(ep);
    setActiveIndex(index);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f8fafc] flex flex-col">
      {/* Navbar */}
      <header className="bg-[#151e32] border-b border-[#23304a] px-6 py-4 flex justify-between items-center">
        <div className="text-xl font-bold text-indigo-500 tracking-wide flex items-center gap-2">
          <span>🎬</span> AnimeStream
        </div>
        <div className="text-xs px-3 py-1 bg-[#23304a] rounded-full text-slate-400">
          {loading ? "Connecting to Drive..." : error ? "Error" : "Connected"}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Video Player Section */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#23304a] shadow-2xl">
            {activeEpisode ? (
              <iframe
                src={`https://drive.google.com/file/d/${activeEpisode.id}/preview`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                {loading ? "Loading stream..." : "Select an episode"}
              </div>
            )}
          </div>

          <div className="bg-[#151e32] p-5 rounded-xl border border-[#23304a]">
            <h2 className="text-lg font-semibold text-white">
              {activeEpisode ? activeEpisode.displayName : "No Episode Selected"}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {activeEpisode
                ? `Now Playing: Episode ${activeIndex + 1} of ${episodes.length}`
                : "Choose an episode from the playlist."}
            </p>
          </div>
        </div>

        {/* Episode Playlist Sidebar */}
        <div className="bg-[#151e32] rounded-xl border border-[#23304a] flex flex-col h-[550px] overflow-hidden">
          <div className="p-4 border-b border-[#23304a] flex justify-between items-center">
            <span className="font-semibold text-sm">Episodes</span>
            <span className="text-xs text-slate-400">{episodes.length} items</span>
          </div>

          <div className="overflow-y-auto p-2 flex flex-col gap-1.5 flex-1 custom-scrollbar">
            {loading && (
              <div className="p-6 text-center text-slate-400 text-sm">Loading playlist...</div>
            )}

            {error && (
              <div className="p-4 text-center text-red-400 text-xs bg-red-950/30 rounded-lg border border-red-900/50">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              episodes.map((ep, index) => {
                const isActive = activeIndex === index;
                return (
                  <button
                    key={ep.id}
                    onClick={() => handleSelectEpisode(ep, index)}
                    className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30"
                        : "hover:bg-[#1e293b] text-slate-300"
                    }`}
                  >
                    <span
                      className={`text-xs font-bold min-w-[20px] ${
                        isActive ? "text-white" : "text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-xs md:text-sm truncate">{ep.displayName}</span>
                  </button>
                );
              })}
          </div>
        </div>
      </main>
    </div>
  );
}
