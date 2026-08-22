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
  workerUrl: "https://fragrant-frog-a096.thinkingnew.workers.dev",
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
          setError("No video files found in the folder.");
          return;
        }

        // Sort episodes numerically/alphabetically
        files.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        );

        const parsed: Episode[] = files.map((f) => ({
          id: f.id,
          name: f.name,
          displayName: cleanTitle(f.name),
        }));

        setEpisodes(parsed);
        setActiveEpisode(parsed[0]);
        setActiveIndex(0);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load playlist.");
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-[#151e32] border-b border-[#23304a] px-6 py-4 flex justify-between items-center">
        <div className="text-xl font-bold text-indigo-500 flex items-center gap-2">
          <span>🎬</span> AnimeStream
        </div>
        <div className="text-xs px-3 py-1 bg-[#23304a] rounded-full text-slate-400">
          {loading ? "Loading..." : error ? "Error" : `${episodes.length} Episodes`}
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Video Player Section */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#23304a] shadow-2xl flex items-center justify-center">
            {activeEpisode ? (
              <video
                key={activeEpisode.id}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
                src={`${CONFIG.workerUrl}/?id=${activeEpisode.id}`}
              >
                Your browser does not support HTML5 video playback.
              </video>
            ) : (
              <div className="text-slate-500 text-sm">
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
                ? `Playing Episode ${activeIndex + 1} of ${episodes.length}`
                : "Select an episode from the list to start."}
            </p>
          </div>
        </div>

        {/* Episodes Sidebar */}
        <div className="bg-[#151e32] rounded-xl border border-[#23304a] flex flex-col h-[560px] overflow-hidden">
          <div className="p-4 border-b border-[#23304a] font-semibold text-sm">Episodes</div>
          <div className="overflow-y-auto p-2 flex flex-col gap-1.5 flex-1">
            {error && (
              <div className="p-4 text-center text-red-400 text-xs bg-red-950/30 rounded-lg">
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              episodes.map((ep, idx) => (
                <button
                  key={ep.id}
                  onClick={() => {
                    setActiveEpisode(ep);
                    setActiveIndex(idx);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                    activeIndex === idx
                      ? "bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30"
                      : "hover:bg-[#1e293b] text-slate-300"
                  }`}
                >
                  <span className={`text-xs font-bold ${activeIndex === idx ? "text-white" : "text-slate-500"}`}>
                    {idx + 1}
                  </span>
                  <span className="text-xs md:text-sm truncate">{ep.displayName}</span>
                </button>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
