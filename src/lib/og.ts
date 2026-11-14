/* Open Graph cards, drawn at build time. Satori lays out a small React-like
   element tree with flexbox and the site's own fonts; resvg rasterises the
   SVG to PNG. One card per note and one for the archive, so a shared link
   shows the title instead of the generic site image. */
import fs from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const WIDTH = 1200;
const HEIGHT = 630;

const FONT_DIR = (pkg: string) => path.resolve(process.cwd(), "node_modules/@fontsource", pkg, "files");
const fontFiles = [
  { name: "Big Shoulders Display", weight: 500, file: path.join(FONT_DIR("big-shoulders-display"), "big-shoulders-display-latin-500-normal.woff") },
  { name: "IBM Plex Sans", weight: 400, file: path.join(FONT_DIR("ibm-plex-sans"), "ibm-plex-sans-latin-400-normal.woff") },
  { name: "IBM Plex Sans", weight: 500, file: path.join(FONT_DIR("ibm-plex-sans"), "ibm-plex-sans-latin-500-normal.woff") },
  { name: "IBM Plex Mono", weight: 500, file: path.join(FONT_DIR("ibm-plex-mono"), "ibm-plex-mono-latin-500-normal.woff") },
] as const;

let fontsPromise: Promise<{ name: string; weight: 400 | 500; data: Buffer; style: "normal" }[]> | undefined;
function fonts() {
  fontsPromise ??= Promise.all(
    fontFiles.map(async (f) => ({ name: f.name, weight: f.weight, style: "normal" as const, data: await fs.readFile(f.file) })),
  );
  return fontsPromise;
}

const palette = {
  background: "#0b0e11",
  surface: "#12161b",
  foreground: "#e7e9e4",
  muted: "#8b9198",
  hairline: "rgba(231, 233, 228, 0.12)",
  primary: "#f5a623",
  good: "#3fbf7f",
};

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style, ...extra, ...(children === undefined ? {} : { children }) },
});

const mono = (text: string, color = palette.muted, size = 18) =>
  el("div", { display: "flex", fontFamily: "IBM Plex Mono", fontWeight: 500, fontSize: size, letterSpacing: Math.round(size * 0.2), textTransform: "uppercase", color, whiteSpace: "nowrap" }, text);

export type Card = {
  /* the small line above the title, e.g. "component / writing" */
  label: string;
  title: string;
  deck?: string;
  /* the log line at the bottom left, e.g. "2026-09-30 · 6 min read" */
  meta?: string;
  tags?: string[];
};

export async function renderCard(card: Card): Promise<Buffer> {
  const titleSize = card.title.length <= 28 ? 104 : card.title.length <= 44 ? 88 : 72;
  const tags = (card.tags ?? []).slice(0, 4);

  /* satori sizes boxes as content-box, so the root is the canvas minus its
     padding and the absolutely placed rule spans the full width from -64 */
  const tree = el(
    "div",
    {
      width: WIDTH - 128,
      height: HEIGHT - 104,
      display: "flex",
      flexDirection: "column",
      padding: "56px 64px 48px",
      backgroundColor: palette.background,
      backgroundImage: "radial-gradient(circle at 85% 15%, rgba(245, 166, 35, 0.10), transparent 45%)",
      color: palette.foreground,
      fontFamily: "IBM Plex Sans",
    },
    [
      /* the amber rule at the top edge */
      el("div", { position: "absolute", top: -56, left: -64, width: WIDTH, height: 6, backgroundColor: palette.primary }),

      /* status bar */
      el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", height: 40, flexShrink: 0 }, [
        el("div", { display: "flex", alignItems: "center", gap: 16 }, [
          el(
            "div",
            { display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 6, backgroundColor: palette.primary, color: "#1a1000", fontFamily: "Big Shoulders Display", fontWeight: 500, fontSize: 24 },
            "DA",
          ),
          mono("darshan-atkari", palette.muted, 18),
          el("div", { display: "flex", alignItems: "center", gap: 10 }, [
            el("div", { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.good }),
            mono("operational", palette.good, 18),
          ]),
        ]),
        mono(card.label, palette.muted, 18),
      ]),

      /* title and deck fill the middle, centred between the bars */
      el("div", { display: "flex", flexDirection: "column", justifyContent: "center", gap: 20, flexGrow: 1, width: 1072, paddingTop: 24, paddingBottom: 24 }, [
        el(
          "div",
          { fontFamily: "Big Shoulders Display", fontWeight: 500, fontSize: titleSize, lineHeight: 0.92, letterSpacing: "0.006em", textTransform: "uppercase", color: palette.foreground, lineClamp: 3 },
          card.title,
        ),
        ...(card.deck ? [el("div", { fontSize: 30, lineHeight: 1.3, color: palette.muted, lineClamp: 2 }, card.deck)] : []),
      ]),

      /* log line and tags */
      el("div", { display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 104, flexShrink: 0, borderTop: `1px solid ${palette.hairline}`, paddingTop: 22 }, [
        el("div", { display: "flex", flexDirection: "column", gap: 12 }, [
          ...(card.meta ? [mono(card.meta, palette.primary, 18)] : []),
          el(
            "div",
            { display: "flex", gap: 10 },
            tags.map((t) =>
              el(
                "div",
                { display: "flex", padding: "5px 12px", border: `1px solid ${palette.hairline}`, borderRadius: 4, backgroundColor: "rgba(231, 233, 228, 0.03)", fontFamily: "IBM Plex Mono", fontWeight: 500, fontSize: 16, color: palette.muted, whiteSpace: "nowrap" },
                t,
              ),
            ),
          ),
        ]),
        mono("atkaridarshan.online", palette.muted, 18),
      ]),
    ],
  );

  const svg = await satori(tree as never, { width: WIDTH, height: HEIGHT, fonts: await fonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng();
}

export const png = (data: Buffer) =>
  new Response(new Uint8Array(data), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
