import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "隐界 · Enclave — 一个属于你的 AI 虚拟世界";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          background:
            "linear-gradient(135deg, #fffcf5 0%, #fff4e0 60%, #ffe4bf 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #fbbf24, #f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            隐
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#1a0f05", fontSize: 22, fontWeight: 600 }}>
              隐界
            </span>
            <span style={{ color: "#7a6454", fontSize: 14 }}>Enclave</span>
          </div>
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            background: "linear-gradient(120deg, #f97316, #fb923c)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
            maxWidth: "84%",
          }}
        >
          一个属于你的 AI 虚拟世界
        </div>
        <div
          style={{
            marginTop: 32,
            color: "#4a3728",
            fontSize: 28,
            maxWidth: "82%",
            lineHeight: 1.4,
          }}
        >
          私人 AI 世界 · 浏览器即开即用 · 多端同步
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            display: "flex",
            gap: 24,
            color: "#7a6454",
            fontSize: 22,
          }}
        >
          <span>· enclave · 私人 AI 虚拟世界</span>
          <span>· 免费开始</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
