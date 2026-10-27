import { useMemo, useRef } from "react";
import photo1xUrl from "../../assets/sign-in/photo-1x.webp";
import photo2xUrl from "../../assets/sign-in/photo-2x.webp";
import { blobPath, createBlobPoints, type BlobSettings } from "./livingBlob";
import { useAnimationLoop } from "./useAnimationLoop";
import { useMediaQuery } from "./useMediaQuery";
import styles from "./SignInScene.module.scss";

// The sign-in page's art (build plan S.20c): the dog-and-cat photo in a slowly
// breathing blob with a mint halo, and the other mint shapes and dots moving
// gently, after codepen.io/supah/pen/PoZrzQx. Decorative only. With reduced
// motion it is drawn once and stands still.

type BlobName = "halo" | "photo" | "top" | "bottomRight" | "bottomLeft";

interface Dot {
  x: number;
  y: number;
  r: number;
}

interface SceneLayout {
  viewBox: string;
  // Where the photo sits, in scene units; the animals are left of its centre.
  image: { x: number; y: number; width: number; height: number };
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

// Narrow screens: the hero band, the photo in a round blob as in the reference.
const bandLayout: SceneLayout = {
  viewBox: "0 0 1000 460",
  image: { x: 134, y: -21, width: 860, height: 483 },
  blobs: {
    halo: { centerX: 505, centerY: 232, minRadius: 205, maxRadius: 228, minDuration: 3.5, maxDuration: 6.5, points: 9, seed: 23, fill: halo },
    photo: { centerX: 500, centerY: 230, minRadius: 196, maxRadius: 214, minDuration: 3, maxDuration: 6, points: 9, seed: 11, fill: "none" }
  },
  dots: [
    { x: 690, y: 385, r: 10 },
    { x: 668, y: 405, r: 7.5 },
    { x: 688, y: 418, r: 9.5 },
    { x: 655, y: 428, r: 8.5 }
  ]
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
  const layout = isNarrow ? bandLayout : wideLayout;
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
  }, !isStill);

  const startPath = (name: BlobName) => {
    const blob = blobs.find((entry) => entry.name === name);
    return blob ? blobPath(blob.settings, blob.points, 0, isStill) : "";
  };

  return (
    <svg
      className={`${styles.scene} ${className ?? ""}`}
      viewBox={layout.viewBox}
      preserveAspectRatio={isNarrow ? "xMidYMid meet" : "xMidYMid slice"}
      aria-hidden="true"
      focusable="false"
    >
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

      {blobs.map(({ name, settings }) =>
        name === "photo" ? (
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
