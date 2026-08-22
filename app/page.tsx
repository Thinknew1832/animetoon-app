"use client";

import { useEffect, useRef, useState } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);

  const cleanTitle = (fileName: string) => {
    return fileName
      .replace(/\.(mp4|mkv|avi|mov|webm)$/i, "")
      .replace(/\[.*?\]|\(.*?\)/g, "")
      .replace(/@\w+/g, "")
      .trim();
  };

  // Fetch episodes from Google Drive API
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
          setError("No files found in folder.");
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
        setError(err.message || "Failed to load episodes.");
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  // Initialize and update Plyr instance
  useEffect(() => {
    if (videoRef.current) {
      if (!playerRef.current) {
        playerRef.current = new Plyr(videoRef.current, {
          controls: [
            "play-large",
            "play",
            "progress",
            "current-time",
            "duration",
            "mute",
            "volume",
            "settings",
            "fullscreen",
          ],
          settings: ["speed"],
          speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
        });
      }

      if (activeEpisode) {
        playerRef.current.source = {
          type: "video",
          title: activeEpisode.displayName,
          sources: [
            {
              src: `${CONFIG.workerUrl}/?id=${activeEpisode.id}`,
              type: "video/mp4",
            },
          ],
        };
      }
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [activeEpisode]);

  const handleSelect = (ep: Episode, idx: number) => {
    setActiveEpisode(ep);
    setActiveIndex(idx);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-[#151e32] border-b border-[#23304a] px-5 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="text-lg font-bold text-indigo-400 flex items-center gap-2">
          <span>🎬</span> AnimeStream
        </div>
        <div className="text-xs px-2.5 py-1 bg-[#23304a] rounded-full text-slate-300">
          {loading ? "Loading..." : `${episodes.length} Episodes`}
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-6xl w-full mx-auto p-3 sm:p-5 flex flex-col lg:grid lg:grid-cols-3 gap-5 flex-1">
        {/* Plyr Video Section */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-[#23304a] shadow-2xl relative flex items-center justify-center">
            <video
              ref={videoRef}
              className="plyr-react plyr w-full h-full object-contain"
              playsInline
              crossOrigin="anonymous"
            />
          </div>

          <div className="bg-[#151e32] p-4 rounded-xl border border-[#23304a] flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-semibold text-white truncate">
                {activeEpisode ? activeEpisode.displayName : "No Episode Selected"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeEpisode
                  ? `Episode ${activeIndex + 1} of ${episodes.length}`
                  : "Choose an episode from the playlist"}
              </p>
            </div>

            {activeEpisode && (
              <a
                href={`https://drive.google.com/file/d/${activeEpisode.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap shadow-md"
              >
                <span>Drive App</span>
                <span>↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-[#151e32] rounded-xl border border-[#23304a] flex flex-col max-h-[480px] lg:max-h-[580px] overflow-hidden">
          <div className="p-3.5 border-b border-[#23304a] font-semibold text-sm flex justify-between items-center">
            <span>Episodes</span>
            <span className="text-xs text-slate-400 font-normal">Playlist</span>
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
                  onClick={() => handleSelect(ep, idx)}
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
