"use client";

import { useEffect, useRef, useState } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);

  // Initialize Plyr instance
  useEffect(() => {
    if (videoRef.current) {
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
        settings: ["speed", "quality"],
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="rounded-xl overflow-hidden shadow-2xl bg-black">
        <video
          ref={videoRef}
          className="plyr-react plyr"
          playsInline
          controls
        >
          <source
            src="https://fragrant-frog-a096.thinkingnew.workers.dev/?id=YOUR_FILE_ID"
            type="video/mp4"
          />
        </video>
      </div>
    </div>
  );
}
