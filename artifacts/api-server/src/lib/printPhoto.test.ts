import { describe, expect, it } from "vitest";
import { colorHistogram, histogramsMatch } from "./printPhoto";

// A small image made of stripes of the given colors.
function stripes(colors: [number, number, number][], width = 40, height = 40) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = colors[Math.floor((x / width) * colors.length)]!;
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

describe("print photo check", () => {
  const navy: [number, number, number] = [20, 30, 110];
  const cream: [number, number, number] = [240, 230, 200];
  const red: [number, number, number] = [210, 30, 40];

  it("finds the same colors alike, even in a different layout or size", () => {
    expect(histogramsMatch(colorHistogram(stripes([navy, cream])), colorHistogram(stripes([cream, navy, cream, navy], 120, 60))))
      .toBe(true);
  });

  it("tells clearly different prints apart", () => {
    expect(histogramsMatch(colorHistogram(stripes([navy, cream])), colorHistogram(stripes([red])))).toBe(false);
  });
});
