import { BufferGeometry, Color, Float32BufferAttribute } from 'three';

/**
 * ドット絵を厚みのあるボクセルの板にする（マイクラのアイテムのような押し出し）。
 * rows は上の行から、1 文字 = 1 ピクセル。'.' は空。palette で文字 → 色。
 * 表と裏は同じ色が横に続く範囲を 1 枚にまとめ、側面は隣が空のところだけ作る。原点は絵の中心、1 ピクセル = 1 単位。
 */
export const pixelArtGeometry = (rows: string[], palette: Record<string, string>, depth: number): BufferGeometry => {
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const filled = (x: number, y: number): boolean => {
    if (y < 0 || y >= height || x < 0 || x >= width) return false;
    const char = rows[y][x];
    return char !== undefined && char !== '.';
  };
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const color = new Color();
  const halfD = depth / 2;

  const quad = (corners: number[][], normal: number[], shade: number) => {
    const [a, b, c, d] = corners;
    for (const v of [a, b, c, a, c, d]) {
      positions.push(v[0], v[1], v[2]);
      normals.push(normal[0], normal[1], normal[2]);
      colors.push(color.r * shade, color.g * shade, color.b * shade);
    }
  };

  const setColor = (char: string) => {
    const hex = palette[char];
    if (hex === undefined) {
      throw new Error(`pixelArtGeometry: palette に無い文字です: ${char}`);
    }
    color.set(hex);
  };

  for (let y = 0; y < height; y++) {
    const y1 = height / 2 - y;
    const y0 = y1 - 1;
    let x = 0;
    while (x < width) {
      if (!filled(x, y)) {
        x++;
        continue;
      }
      const char = rows[y][x];
      let end = x + 1;
      while (end < width && rows[y][end] === char) end++;
      setColor(char);
      const x0 = x - width / 2;
      const x1 = end - width / 2;
      quad([[x0, y0, halfD], [x1, y0, halfD], [x1, y1, halfD], [x0, y1, halfD]], [0, 0, 1], 1);
      quad([[x1, y0, -halfD], [x0, y0, -halfD], [x0, y1, -halfD], [x1, y1, -halfD]], [0, 0, -1], 1);
      x = end;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!filled(x, y)) continue;
      setColor(rows[y][x]);
      const x0 = x - width / 2;
      const x1 = x0 + 1;
      const y1 = height / 2 - y;
      const y0 = y1 - 1;
      // 側面は少し暗くして厚みを見せる
      if (!filled(x, y - 1)) quad([[x0, y1, halfD], [x1, y1, halfD], [x1, y1, -halfD], [x0, y1, -halfD]], [0, 1, 0], 0.85);
      if (!filled(x, y + 1)) quad([[x0, y0, -halfD], [x1, y0, -halfD], [x1, y0, halfD], [x0, y0, halfD]], [0, -1, 0], 0.7);
      if (!filled(x + 1, y)) quad([[x1, y0, halfD], [x1, y0, -halfD], [x1, y1, -halfD], [x1, y1, halfD]], [1, 0, 0], 0.78);
      if (!filled(x - 1, y)) quad([[x0, y0, -halfD], [x0, y0, halfD], [x0, y1, halfD], [x0, y1, -halfD]], [-1, 0, 0], 0.78);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
};
