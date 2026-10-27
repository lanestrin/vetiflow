import { useMemo, useRef, useState } from "react";
import photo1xUrl from "../../assets/sign-in/photo-1x.webp";
import photo2xUrl from "../../assets/sign-in/photo-2x.webp";
import { blobPath, createBlobPoints, type BlobSettings } from "./livingBlob";
import { useAnimationLoop } from "./useAnimationLoop";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./SignInScene.module.scss";

// The sign-in page's art (build plan S.20c): on wide screens the dog-and-cat
// photo in a slowly breathing blob with a mint halo, and the other mint
// shapes and dots moving gently, after codepen.io/supah/pen/PoZrzQx. On
// narrow screens, only pale mint shapes behind the story text. Decorative
// only. With reduced motion it is drawn once and stands still.

type BlobName = "halo" | "photo" | "top" | "bottomRight" | "bottomLeft";

interface Dot {
  x: number;
  y: number;
  r: number;
}

interface SceneLayout {
  viewBox: string;
  // Where the photo sits, in scene units; the animals are left of its centre.
  // Only the wide layout has one.
  image?: { x: number; y: number; width: number; height: number };
  blobs: Partial<Record<BlobName, BlobSettings & { fill: string }>>;
  dots: Dot[];
}

const mint = "#deefe3";
const mintDeep = "#d3eadd";
const halo = "#e3efe8";
const dotGreen = "#5e9e86";

const blobOrder: BlobName[] = ["halo", "photo", "top", "bottomRight", "bottomLeft"];

// Wide screens: the S.20a art box (1672 × 840), placed by SignInPage's .art
// so x = 502 (30%) lines up with the end of the story column. The photo blob
// sits between the story and the card, its left edge just past that line, and
// the animals at the size they had in S.20a; the card covers its right side.
const wideLayout: SceneLayout = {
  viewBox: "0 0 1672 840",
  image: { x: 169, y: 46, width: 1306, height: 735 },
  blobs: {
    halo: { centerX: 840, centerY: 425, minRadius: 356, maxRadius: 384, minDuration: 3.5, maxDuration: 6.5, points: 9, seed: 23, fill: halo },
    photo: { centerX: 832, centerY: 420, minRadius: 336, maxRadius: 360, minDuration: 3, maxDuration: 6, points: 9, seed: 11, fill: "none" },
    top: { centerX: 600, centerY: 0, minRadius: 105, maxRadius: 130, minDuration: 2.5, maxDuration: 5, points: 8, seed: 5, fill: mintDeep },
    bottomRight: { centerX: 1240, centerY: 1080, minRadius: 480, maxRadius: 520, minDuration: 3, maxDuration: 6, points: 9, seed: 13, fill: mint },
    bottomLeft: { centerX: 80, centerY: 930, minRadius: 150, maxRadius: 180, minDuration: 2.5, maxDuration: 5, points: 8, seed: 9, fill: mint }
  },
  // On the mint at the photo's lower right, clear of the card.
  dots: [
    { x: 905, y: 742, r: 12 },
    { x: 876, y: 765, r: 9 },
    { x: 900, y: 786, r: 12.5 },
    { x: 862, y: 800, r: 11 }
  ]
};

// Narrow screens: a layer behind the brand and story. Pale shapes only, no
// photo and no dots, so the text on them keeps its contrast wherever they
// move; they breathe more slowly than the wide art. Drawn to cover (slice),
// so the frame's shape doesn't matter.
const heroLayout: SceneLayout = {
  viewBox: "0 0 1000 800",
  blobs: {
    halo: { centerX: 900, centerY: 120, minRadius: 300, maxRadius: 340, minDuration: 6, maxDuration: 10, points: 9, seed: 23, stretchX: 1.2, fill: halo },
    top: { centerX: 80, centerY: 40, minRadius: 150, maxRadius: 180, minDuration: 6, maxDuration: 9, points: 8, seed: 5, fill: mintDeep },
    bottomLeft: { centerX: 120, centerY: 820, minRadius: 280, maxRadius: 320, minDuration: 7, maxDuration: 10, points: 9, seed: 9, stretchX: 1.4, fill: mint },
    bottomRight: { centerX: 960, centerY: 700, minRadius: 140, maxRadius: 170, minDuration: 6, maxDuration: 9, points: 8, seed: 13, fill: mintDeep }
  },
  dots: []
};

const photoClipId = "sign-in-photo-clip";

// Each dot circles a few units around its place, on its own slow loop.
function dotOffset(index: number, seconds: number) {
  const period = 5 + index * 1.3;
  const angle = (seconds / period + index * 0.27) * Math.PI * 2;
  return { x: Math.sin(angle) * 6, y: Math.cos(angle) * 4 };
}

export function SignInScene({ className }: { className?: string }) {
  const isNarrow = useMediaQuery("(max-width: 84.99rem)");
  const isStill = useMediaQuery("(prefers-reduced-motion: reduce)");
  // An SVG image has no srcset, so the sharper photo is chosen here; only
  // high-density screens download it.
  const isHighDensity = useMediaQuery("(min-resolution: 1.5dppx)");
  const photoUrl = isHighDensity ? photo2xUrl : photo1xUrl;
  const layout = isNarrow ? heroLayout : wideLayout;
  // Watched by the loop, which pauses while the art is off screen.
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const pathRefs = useRef<Partial<Record<BlobName, SVGPathElement | null>>>({});
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);

  const blobs = useMemo(
    () =>
      blobOrder.flatMap((name) => {
        const settings = layout.blobs[name];
        return settings ? [{ name, settings, points: createBlobPoints(settings) }] : [];
      }),
    [layout]
  );

  // Writes straight to the SVG, so React doesn't re-render every frame.
  useAnimationLoop((seconds) => {
    for (const blob of blobs) {
      pathRefs.current[blob.name]?.setAttribute("d", blobPath(blob.settings, blob.points, seconds, false));
    }
    dotRefs.current.forEach((dot, index) => {
      const offset = dotOffset(index, seconds);
      dot?.setAttribute("transform", `translate(${offset.x.toFixed(1)} ${offset.y.toFixed(1)})`);
    });
  }, !isStill, svg);

  const startPath = (name: BlobName) => {
    const blob = blobs.find((entry) => entry.name === name);
    return blob ? blobPath(blob.settings, blob.points, 0, isStill) : "";
  };

  return (
    <svg
      ref={setSvg}
      className={`${styles.scene} ${className ?? ""}`}
      viewBox={layout.viewBox}
      // The narrow layer is often wider than tall, so it keeps the scene's
      // top, where its shapes are.
      preserveAspectRatio={isNarrow ? "xMidYMin slice" : "xMidYMid slice"}
      aria-hidden="true"
      focusable="false"
    >
      {layout.image && (
        <defs>
          <clipPath id={photoClipId}>
            <path
              ref={(element) => {
                pathRefs.current.photo = element;
              }}
              d={startPath("photo")}
            />
          </clipPath>
        </defs>
      )}

      {blobs.map(({ name, settings }) =>
        name === "photo" && layout.image ? (
          <image
            key={name}
            href={photoUrl}
            {...layout.image}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${photoClipId})`}
          />
        ) : (
          <path
            key={name}
            ref={(element) => {
              pathRefs.current[name] = element;
            }}
            d={startPath(name)}
            fill={settings.fill}
          />
        )
      )}

      {layout.dots.map((dot, index) => (
        <circle
          key={`${dot.x}-${dot.y}`}
          ref={(element) => {
            dotRefs.current[index] = element;
          }}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          fill={dotGreen}
        />
      ))}
    </svg>
  );
}
