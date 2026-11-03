import './SideArrows.css';

/** 階段状の三角（◀）。'#' が塗り。▶ は各行を反転する */
const ARROW_LEFT = ['.......#', '.....###', '...#####', '.#######', '...#####', '.....###', '.......#'];
const ARROW_RIGHT = ARROW_LEFT.map((row) => row.split('').reverse().join(''));

interface PixelArrowProps {
  rows: string[];
}

const PixelArrow = ({ rows }: PixelArrowProps) => (
  <svg
    viewBox={`0 0 ${rows[0].length} ${rows.length}`}
    shapeRendering="crispEdges"
    aria-hidden="true"
    focusable="false"
  >
    {rows.flatMap((row, y) =>
      row
        .split('')
        .map((ch, x) =>
          ch === '#' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} /> : null,
        ),
    )}
  </svg>
);

export interface SideArrowsProps {
  /** 左の矢印の下に出す看板。例 "2月" / "2025" */
  prevLabel: string;
  /** 右の矢印の下に出す看板。例 "4月" / "2027" */
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}

/** 画面の左右に出す「前へ / 次へ」の矢印ボタンと、その下の行き先の看板 */
export const SideArrows = ({ prevLabel, nextLabel, onPrev, onNext }: SideArrowsProps) => (
  <>
    <div className="side-arrow side-arrow-prev">
      <button
        type="button"
        className="btn side-arrow-btn"
        aria-label={`前へ：${prevLabel}`}
        onClick={onPrev}
      >
        <PixelArrow rows={ARROW_LEFT} />
      </button>
      <span className="panel side-arrow-label">{prevLabel}</span>
    </div>
    <div className="side-arrow side-arrow-next">
      <button
        type="button"
        className="btn side-arrow-btn"
        aria-label={`次へ：${nextLabel}`}
        onClick={onNext}
      >
        <PixelArrow rows={ARROW_RIGHT} />
      </button>
      <span className="panel side-arrow-label">{nextLabel}</span>
    </div>
  </>
);
