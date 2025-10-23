// leaderboardImage.js
// Generates a PNG Buffer of the leaderboard using node-canvas
import { createCanvas, loadImage, registerFont } from "canvas";

try {
  // Register common fonts if present on the system/container
  registerFont("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", {
    family: "DejaVu Sans",
  });
  registerFont("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", {
    family: "DejaVu Sans",
    weight: "bold",
  });
} catch {}

const PALETTE = {
  bg: "#141821",
  panel: "#1C222E",
  panel2: "#212838",
  text: "#ECEFF4",
  muted: "#B0BEC5",
  grid: "#2A3241",
  gold: "#FFD700",
  silver: "#C0C0C0",
  bronze: "#CD7F32",
  accent: "#4285F4",
};

function fitText(ctx, text, maxPx, baseSize, font = "DejaVu Sans") {
  let size = baseSize;
  do {
    ctx.font = `400 ${size}px "${font}"`;
    if (ctx.measureText(text).width <= maxPx) return { size, text };
    size -= 1;
  } while (size >= 10);
  // Ellipsize
  let t = text;
  while (ctx.measureText(t + "…").width > maxPx && t.length > 1)
    t = t.slice(0, -1);
  return { size: Math.max(size, 10), text: t + "…" };
}

export function renderLeaderboardImage({
  title = "AUTOMIX Leaderboard",
  rows = [],
  lastUpdate = "",
}) {
  const width = 1100;
  const rowH = 48;
  const headerH = 64;
  const footerH = 56;
  const pad = 24;
  const height = pad * 2 + headerH + rows.length * rowH + footerH;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, width, height);

  // Panel
  ctx.fillStyle = PALETTE.panel;
  ctx.roundRect(pad, pad, width - pad * 2, height - pad * 2, 18);
  ctx.fill();

  // Title
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 36px "DejaVu Sans"`;
  ctx.fillText(title, pad + 24, pad + 14 + 32);

  // Header panel
  const hx1 = pad + 12;
  const hy1 = pad + 64;
  const hx2 = width - pad - 12;
  const hy2 = hy1 + headerH - 18;
  ctx.fillStyle = PALETTE.panel2;
  ctx.fillRect(hx1, hy1, hx2 - hx1, hy2 - hy1);

  // Columns (pixel anchors)
  const cols = {
    // Right-anchored numeric columns for stable layout
    // moved anchors slightly left to add more spacing between numeric columns
    KDR: width - pad - 40,
    Deaths: width - pad - 140,
    Kills: width - pad - 240,
    Points: width - pad - 340,
    Name: pad + 120,
    "#": pad + 40,
  };

  // Header text
  const headers = ["#", "Name", "Points", "Kills", "Deaths", "KDR"];
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `700 22px "DejaVu Sans"`;
  headers.forEach((h) => {
    const x = cols[h];
    const alignRight = ["#", "Points", "Kills", "Deaths", "KDR"].includes(h);
    const w = ctx.measureText(h).width;
    const tx = alignRight ? x - w : x;
    ctx.fillText(h, tx, hy1 + 38);
  });

  // Grid
  const startY = hy2 + 6;
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= rows.length; i++) {
    const y = startY + i * rowH;
    ctx.beginPath();
    ctx.moveTo(hx1, y);
    ctx.lineTo(hx2, y);
    ctx.stroke();
  }

  // Rows
  ctx.font = `400 22px "DejaVu Sans"`;
  rows.forEach((r, i) => {
    const y = startY + i * rowH + 10;
    const rank = i + 1;

    // Rank color (medals for top 3)
    const rankColor =
      rank === 1
        ? PALETTE.gold
        : rank === 2
        ? PALETTE.silver
        : rank === 3
        ? PALETTE.bronze
        : PALETTE.muted;

    // Rank number (right-aligned)
    const rankTxt = String(rank);
    ctx.fillStyle = rankColor;
    ctx.font = `700 22px "DejaVu Sans"`;
    const rankW = ctx.measureText(rankTxt).width;
    ctx.fillText(rankTxt, cols["#"] - rankW, y + 22);

    // Name (truncate/fit if needed)
    const maxNamePx = cols.Points - cols.Name - 40;
    ctx.fillStyle = PALETTE.text;
    const { size: nameSize, text: nameFitted } = fitText(
      ctx,
      String(r.name ?? ""),
      maxNamePx,
      22
    );
    ctx.font = `400 ${nameSize}px "DejaVu Sans"`;
    ctx.fillText(nameFitted, cols.Name, y + 22);

    // restore body font for numbers
    ctx.font = `400 22px "DejaVu Sans"`;

    // Numeric columns (right-aligned)
    const cells = [
      ["Points", r.points],
      ["Kills", r.kills],
      ["Deaths", r.deaths],
      ["KDR", Number.isFinite(r.kdr) ? r.kdr.toFixed(2) : "—"],
    ];
    cells.forEach(([key, val]) => {
      const str = String(val);
      const w = ctx.measureText(str).width;
      ctx.fillText(str, cols[key] - w, y + 22);
    });
  });

  return canvas.toBuffer("image/png");
}
