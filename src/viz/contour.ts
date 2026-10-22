/**
 * Marching squares iso-line at `level` over a row-major res×res grid of cell-centre values.
 * Returns segments as [x0, y0, x1, y1, …] in grid units (cell centre of (r, c) = (c + .5, r + .5)).
 */
export function isoLines(grid: ArrayLike<number>, res: number, level = 0.5): Float32Array {
  const out: number[] = [];
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let r = 0; r < res - 1; r++) {
    for (let c = 0; c < res - 1; c++) {
      const tl = grid[r * res + c];
      const tr = grid[r * res + c + 1];
      const br = grid[(r + 1) * res + c + 1];
      const bl = grid[(r + 1) * res + c];
      const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = c + 0.5;
      const y = r + 0.5;
      const top = [x + lerp(tl, tr), y];
      const right = [x + 1, y + lerp(tr, br)];
      const bottom = [x + lerp(bl, br), y + 1];
      const left = [x, y + lerp(tl, bl)];
      const seg = (a: number[], b: number[]) => out.push(a[0], a[1], b[0], b[1]);
      switch (idx) {
        case 1:
        case 14:
          seg(left, bottom);
          break;
        case 2:
        case 13:
          seg(bottom, right);
          break;
        case 3:
        case 12:
          seg(left, right);
          break;
        case 4:
        case 11:
          seg(top, right);
          break;
        case 6:
        case 9:
          seg(top, bottom);
          break;
        case 7:
        case 8:
          seg(left, top);
          break;
        case 5:
          seg(left, top);
          seg(bottom, right);
          break;
        case 10:
          seg(top, right);
          seg(left, bottom);
          break;
      }
    }
  }
  return Float32Array.from(out);
}
