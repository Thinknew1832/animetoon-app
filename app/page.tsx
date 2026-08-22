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
    return fileName
      .replace(/\.(mp4|mkv|avi|mov|webm)$/i, "")
      .replace(/\[.*?\]|\(.*?\)/g, "")
      .replace(/@\w+/g, "")
      .trim();
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
      {/* Top Navbar */}
      <header className="bg-[#151e32] border-b border-[#23304a] px-5 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="text-lg font-bold text-indigo-400 flex items-center gap-2">
          <span>🎬</span> AnimeStream
        </div>
        <div className="text-xs px-2.5 py-1 bg-[#23304a] rounded-full text-slate-300">
          {loading ? "Loading..." : `${episodes.length} Episodes`}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:grid lg:grid-cols-3 gap-5 flex-1">
        {/* Player Section */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* Constrained Responsive Player Box */}
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#23304a] shadow-lg relative">
            {activeEpisode ? (
              <iframe
                key={activeEpisode.id}
                src={`https://drive.google.com/file/d/${activeEpisode.id}/preview`}
                className="w-full h-full border-0 absolute inset-0"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                {loading ? "Loading stream..." : "Select an episode"}
              </div>
            )}
          </div>

          {/* Episode Info & Direct Watch Option */}
          <div className="bg-[#151e32] p-4 rounded-xl border border-[#23304a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm md:text-base font-semibold text-white leading-snug">
                {activeEpisode ? activeEpisode.displayName : "No Episode Selected"}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {activeEpisode
                  ? `Episode ${activeIndex + 1} of ${episodes.length}`
                  : "Select an episode from the list below."}
              </p>
            </div>

            {activeEpisode && (
              <a
                href={`https://drive.google.com/file/d/${activeEpisode.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto"
              >
                <span>Full Player Mode</span>
                <span className="text-[10px]">↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Episodes Sidebar */}
        <div className="bg-[#151e32] rounded-xl border border-[#23304a] flex flex-col max-h-[480px] lg:max-h-[580px] overflow-hidden">
          <div className="p-3.5 border-b border-[#23304a] font-semibold text-sm flex justify-between items-center">
            <span>Episodes</span>
            <span className="text-xs text-slate-400 font-normal">Select below</span>
          </div>
          <div className="overflow-y-auto p-2 flex flex-col gap-1.5 flex-1">
            {error && (
              <div className="p-3 text-center text-red-400 text-xs bg-red-950/30 rounded-lg">
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
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-left transition-all ${
                    activeIndex === idx
                      ? "bg-indigo-600 text-white font-medium shadow-sm"
                      : "hover:bg-[#1e293b] text-slate-300"
                  }`}
                >
                  <span
                    className={`text-xs font-bold min-w-[20px] ${
                      activeIndex === idx ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <span className="text-xs truncate">{ep.displayName}</span>
                </button>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
