import { useEffect, useRef, useState } from 'react';

interface UseTiltControlsParams {
  enabled: boolean;
  isActivePlay: boolean;
  onTiltCorrect: () => void;
  onTiltWrong: () => void;
}

/**
 * Optional motion gesture controls for compatible mobile devices:
 * - Tilting phone downward (beta > 135 or < -135 face-down nod) triggers Correct
 * - Tilting phone sharply backward/upward (beta < 15 flat-back flip) after neutral upright hold triggers Wrong Guess
 * Touch buttons always remain active and primary.
 */
export function useTiltControls({
  enabled,
  isActivePlay,
  onTiltCorrect,
  onTiltWrong,
}: UseTiltControlsParams) {
  const [permissionState, setPermissionState] = useState<'unknown' | 'granted' | 'denied'>(
    'unknown'
  );
  const cooldownRef = useRef<number>(0);
  const armedNeutralRef = useRef<boolean>(false);

  const requestTiltPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setPermissionState('denied');
      return false;
    }
    const DevOrient = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof DevOrient.requestPermission === 'function') {
      try {
        const res = await DevOrient.requestPermission();
        setPermissionState(res);
        return res === 'granted';
      } catch {
        setPermissionState('denied');
        return false;
      }
    }
    setPermissionState('granted');
    return true;
  };

  useEffect(() => {
    if (!enabled || !isActivePlay || typeof window === 'undefined') return;

    const handler = (ev: DeviceOrientationEvent) => {
      if (ev.beta === null) return;
      const now = Date.now();
      if (now - cooldownRef.current < 1500) return;

      const beta = ev.beta; // ~60-100 when held upright facing player/audience

      if (beta >= 50 && beta <= 105) {
        armedNeutralRef.current = true;
        return;
      }

      if (!armedNeutralRef.current) return;

      // Nodding phone face-down (> 135 deg) => Correct!
      if (beta > 135) {
        armedNeutralRef.current = false;
        cooldownRef.current = now;
        onTiltCorrect();
      } else if (beta < 15 && beta > -30) {
        // Tilting phone flat/backward => Wrong guess!
        armedNeutralRef.current = false;
        cooldownRef.current = now;
        onTiltWrong();
      }
    };

    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [enabled, isActivePlay, onTiltCorrect, onTiltWrong]);

  return {
    permissionState,
    requestTiltPermission,
  };
}
