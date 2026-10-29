import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { signedObjectUrl, storageLocation } from "./objectStorage";

// Compares two fabric print photos by their colors. Two photos of the same
// print can be taken at different angles and in different light, so this
// only rules out prints that clearly differ; the maker confirms the rest.

type Pixels = { width: number; height: number; data: Uint8Array | Buffer };

const binsPerChannel = 4;
const similarAt = 0.55;

function decode(bytes: Buffer, contentType: string | null): Pixels | null {
  const isPng = contentType?.includes("png") || bytes.subarray(1, 4).toString("ascii") === "PNG";
  const isJpeg = contentType?.includes("jpeg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
  if (isPng) return PNG.sync.read(bytes);
  if (isJpeg) return jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 256 });
  // WebP and anything else can't be read here.
  return null;
}

// Share of pixels in each of 64 coarse color bins, sampling about 40,000 pixels.
export function colorHistogram(image: Pixels): number[] {
  const bins = new Array<number>(binsPerChannel ** 3).fill(0);
  const step = Math.max(1, Math.floor(Math.sqrt((image.width * image.height) / 40_000)));
  let counted = 0;
  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const at = (y * image.width + x) * 4;
      const bin = (channel: number) => Math.min(binsPerChannel - 1, Math.floor((image.data[at + channel]! / 256) * binsPerChannel));
      bins[bin(0) * binsPerChannel * binsPerChannel + bin(1) * binsPerChannel + bin(2)]! += 1;
      counted += 1;
    }
  }
  return bins.map((count) => (counted ? count / counted : 0));
}

export function histogramsMatch(a: number[], b: number[]): boolean {
  const overlap = a.reduce((sum, share, index) => sum + Math.min(share, b[index] ?? 0), 0);
  return overlap >= similarAt;
}

async function readPhoto(photoPath: string): Promise<Pixels | null> {
  const { bucketName, objectName } = storageLocation(photoPath.slice("/objects/".length));
  const response = await fetch(await signedObjectUrl(bucketName, objectName, "GET"), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return null;
  return decode(Buffer.from(await response.arrayBuffer()), response.headers.get("content-type"));
}

// True or false when both photos could be read, null when one couldn't.
export async function printsLookAlike(photoPath: string, otherPhotoPath: string): Promise<boolean | null> {
  try {
    const [one, other] = await Promise.all([readPhoto(photoPath), readPhoto(otherPhotoPath)]);
    if (!one || !other) return null;
    return histogramsMatch(colorHistogram(one), colorHistogram(other));
  } catch {
    return null;
  }
}
