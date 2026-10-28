import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kohego — Penjualan Pupuk Organik",
    short_name: "Kohego",
    description: "Dasbor penjualan dan distribusi pupuk organik: kohe kambing, sapi, ayam, dan POC.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#166534",
    lang: "id",
  };
}
