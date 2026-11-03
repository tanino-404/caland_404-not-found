import './CloudOverlay.css';

export interface CloudOverlayProps {
  /** true で雲が左右から流れ込んで画面を覆う。false で晴れる */
  active: boolean;
}

/** 左右それぞれの雲の塊。番号ごとに CSS で大きさと位置を変える */
const CLOUD_IDS = [1, 2, 3, 4, 5] as const;

/**
 * 月⇔年の切り替え中に画面全体を覆う雲。常にマウントし、クラスの切り替えで出し入れする。
 * 雲の下でワールドとカメラを差し替えるための目隠し
 */
export const CloudOverlay = ({ active }: CloudOverlayProps) => (
  <div className={active ? 'cloud-overlay is-active' : 'cloud-overlay'} aria-hidden="true">
    <div className="cloud-sky" />
    <div className="cloud-bank cloud-bank-left">
      {CLOUD_IDS.map((id) => (
        <span key={id} className={`cloud cloud-${id}`} />
      ))}
    </div>
    <div className="cloud-bank cloud-bank-right">
      {CLOUD_IDS.map((id) => (
        <span key={id} className={`cloud cloud-${id}`} />
      ))}
    </div>
  </div>
);
