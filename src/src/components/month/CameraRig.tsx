import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Vector3 } from 'three';
import type { CameraPose } from '../../lib/camera';

interface OrbitLike {
  target: Vector3;
  update: () => void;
}

const isOrbitLike = (value: unknown): value is OrbitLike =>
  typeof value === 'object' && value !== null && 'target' in value && 'update' in value;

export interface CameraRigProps {
  pose: CameraPose;
}

/** pose が変わるたびにカメラ位置と注視点を補間で移動する。到着後はユーザー操作に任せる。 */
export const CameraRig = ({ pose }: CameraRigProps) => {
  const controls = useThree((state) => state.controls);
  const animating = useRef(true);

  useEffect(() => {
    animating.current = true;
  }, [pose]);

  useFrame(({ camera }, delta) => {
    if (!animating.current) {
      return;
    }
    const k = 1 - Math.exp(-delta * 3.8);
    camera.position.lerp(pose.position, k);
    if (isOrbitLike(controls)) {
      controls.target.lerp(pose.target, k);
      controls.update();
    } else {
      camera.lookAt(pose.target);
    }
    if (camera.position.distanceTo(pose.position) < 0.01) {
      camera.position.copy(pose.position);
      if (isOrbitLike(controls)) {
        controls.target.copy(pose.target);
        controls.update();
      } else {
        camera.lookAt(pose.target);
      }
      animating.current = false;
    }
  });

  return null;
};
