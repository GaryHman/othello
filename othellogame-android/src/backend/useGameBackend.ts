import {useEffect, useRef, useState} from 'react';
import {GameBackend, LocalSession} from './LocalSession';

/** Swap this for an online backend (e.g. Firebase) in a later version. */
function createGameBackend(): GameBackend {
  return new LocalSession();
}

/**
 * Drop-in replacement for the AI Studio `usePlaygroundMultiplayer` hook.
 * Same return shape, but backed by an offline local session.
 */
export function useGameBackend() {
  const [isReady, setIsReady] = useState(false);
  const sdkRef = useRef<GameBackend | null>(null);
  const onGameEventRef = useRef<((event: any) => void) | null>(null);
  const onPresenceEventRef = useRef<((presence: any) => void) | null>(null);
  const onLobbyStatusRef = useRef<((status: any) => void) | null>(null);

  useEffect(() => {
    if (sdkRef.current) return;
    const backend = createGameBackend();
    sdkRef.current = backend;
    backend
      .init(
        (e) => onGameEventRef.current?.(e),
        (p) => onPresenceEventRef.current?.(p),
        (s) => onLobbyStatusRef.current?.(s),
      )
      .then(() => setIsReady(true));
  }, []);

  return {
    sdk: sdkRef.current as any,
    isReady,
    onGameEventRef,
    onPresenceEventRef,
    onLobbyStatusRef,
  };
}
