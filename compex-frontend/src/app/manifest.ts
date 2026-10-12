import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Compex Solution",
    short_name: "Compex",
    description: "Electronic component sourcing and procurement.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0B1F3A",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
