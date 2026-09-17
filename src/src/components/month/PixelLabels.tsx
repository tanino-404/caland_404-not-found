import { useLayoutEffect, useMemo, useRef } from 'react';
import { BoxGeometry, Color, type InstancedMesh, Matrix4, MeshBasicMaterial, Object3D } from 'three';
import { GLYPH_H, textToPixels, textWidthInPixels } from '../../lib/pixelFont';

export interface PixelLabel {
  text: string;
  /** ラベル中心 */
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  /** 1 ピクセルのピッチ */
  pitch: number;
}

export interface PixelLabelsProps {
  labels: PixelLabel[];
}

const PIXEL_GEOMETRY = new BoxGeometry(1, 1, 1);
const PIXEL_MATERIAL = new MeshBasicMaterial({ color: '#ffffff' });

interface Instance {
  matrix: Matrix4;
  color: Color;
}

const buildInstances = (labels: PixelLabel[]): Instance[] => {
  const base = new Object3D();
  const pixel = new Object3D();
  const instances: Instance[] = [];
  for (const label of labels) {
    base.position.set(...label.position);
    base.rotation.set(...label.rotation);
    base.updateMatrix();
    const color = new Color(label.color);
    const width = textWidthInPixels(label.text);
    const p = label.pitch;
    for (const { x, y } of textToPixels(label.text)) {
      pixel.position.set((x + 0.5 - width / 2) * p, (y + 0.5 - GLYPH_H / 2) * p, 0);
      pixel.scale.set(p * 0.86, p * 0.86, p * 0.4);
      pixel.updateMatrix();
      instances.push({ matrix: base.matrix.clone().multiply(pixel.matrix), color });
    }
  }
  return instances;
};

/** 全ラベルのピクセルを 1 つの InstancedMesh で描く */
export const PixelLabels = ({ labels }: PixelLabelsProps) => {
  const ref = useRef<InstancedMesh>(null);
  const instances = useMemo(() => buildInstances(labels), [labels]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    instances.forEach((inst, i) => {
      mesh.setMatrixAt(i, inst.matrix);
      mesh.setColorAt(i, inst.color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [instances]);

  return (
    <instancedMesh
      key={instances.length}
      ref={ref}
      args={[PIXEL_GEOMETRY, PIXEL_MATERIAL, instances.length]}
    />
  );
};
