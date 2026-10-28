// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useGameBackend} from './useGameBackend';

/**
 * @fileoverview Hook for managing Playground SDK and multiplayer lobby lifecycle.
 * Encapsulates SDK initialization, lobby discovery/creation retry loops,
 * player presence events, and local player identification.
 */

export interface Player {
  playerId: string;
  name?: string;
  displayName?: string;
  isHost?: boolean;
  is_host?: boolean;
  isCurrentPlayer?: boolean;
  is_current_player?: boolean;
  avatarUrl?: string;
}

export interface UseMultiplayerLobbyOptions {
  onGameEvent?: (event: any) => void;
  onLobbyJoined?: (lobbyId: string, players: Player[], isHost: boolean) => void;
}

export function useSessionLobby(options?: UseMultiplayerLobbyOptions) {
  const {sdk, isReady, onGameEventRef, onPresenceEventRef, onLobbyStatusRef} =
    useGameBackend();

  // Connection State
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [networkStatus, setNetworkStatus] = useState('INIT'); // INIT, CONNECTING, CONNECTED, ERROR

  // Stable references for high-frequency loops & async event listeners
  const lobbyIdRef = useRef<string | null>(null);
  const isHostRef = useRef(false);
  const myPlayerIdRef = useRef<string | null>(null);
  const playersRef = useRef<Player[]>([]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  useEffect(() => {
    myPlayerIdRef.current = myPlayerId;
  }, [myPlayerId]);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const onGameEventCallbackRef = useRef(options?.onGameEvent);
  useEffect(() => {
    onGameEventCallbackRef.current = options?.onGameEvent;
  }, [options?.onGameEvent]);

  const onLobbyJoinedRef = useRef(options?.onLobbyJoined);
  useEffect(() => {
    onLobbyJoinedRef.current = options?.onLobbyJoined;
  }, [options?.onLobbyJoined]);

  // Refresh lobby participants & local player status
  const refreshLobbyData = useCallback(
    (targetLobbyId?: string) => {
      const activeLobbyId = targetLobbyId || lobbyIdRef.current;
      if (!sdk || !activeLobbyId) return;
      sdk.getLobby((info: any) => {
        if (!info?.players) return;
        setPlayers(info.players);

        const local = info.players.find(
          (p: any) => p.is_current_player || p.isCurrentPlayer,
        );
        if (local) {
          setMyPlayerId(local.playerId);
          const host = !!(local.is_host || local.isHost);
          setIsHost(host);
          setNetworkStatus(`CONNECTED ${host ? '(Host)' : '(Client)'}`);
          onLobbyJoinedRef.current?.(activeLobbyId, info.players, host);
        }
      }, activeLobbyId);
    },
    [sdk],
  );

  // Discovery & Fallback creation polling loop
  useEffect(() => {
    if (!sdk || !isReady) return;
    setNetworkStatus('CONNECTING');

    let attempts = 0;
    const tryConnect = () => {
      attempts++;
      const tid = setTimeout(() => {
        if (attempts < 4) {
          tryConnect();
        } else {
          createFallback();
        }
      }, 1500);

      try {
        sdk.getLobby((info: any) => {
          clearTimeout(tid);
          if (info?.lobbyId) {
            lobbyIdRef.current = info.lobbyId;
            setLobbyId(info.lobbyId);
            sdk.updatePlayerPresence(info.lobbyId, 'JOIN');
            refreshLobbyData(info.lobbyId);
          } else if (attempts < 4) {
            setTimeout(tryConnect, 800);
          } else {
            createFallback();
          }
        });
      } catch (e) {
        clearTimeout(tid);
        if (attempts < 4) setTimeout(tryConnect, 800);
      }
    };

    const createFallback = () => {
      sdk.createLobby((info: any) => {
        if (info?.lobbyId) {
          lobbyIdRef.current = info.lobbyId;
          setLobbyId(info.lobbyId);
          sdk.updatePlayerPresence(info.lobbyId, 'JOIN');
          refreshLobbyData(info.lobbyId);
        } else {
          setNetworkStatus('ERROR');
        }
      });
    };

    setTimeout(tryConnect, 200);
  }, [sdk, isReady, refreshLobbyData]);

  // Hook up event callbacks to SDK
  const handlePresenceEvent = useCallback(() => {
    if (lobbyIdRef.current) refreshLobbyData(lobbyIdRef.current);
  }, [refreshLobbyData]);

  const handleLobbyStatus = useCallback((status: any) => {
    void status;
  }, []);

  useEffect(() => {
    onPresenceEventRef.current = handlePresenceEvent;
    onLobbyStatusRef.current = handleLobbyStatus;
  }, [
    handlePresenceEvent,
    handleLobbyStatus,
    onPresenceEventRef,
    onLobbyStatusRef,
  ]);

  useEffect(() => {
    if (options?.onGameEvent) {
      onGameEventRef.current = (event: any) => {
        onGameEventCallbackRef.current?.(event);
      };
    }
  }, [options?.onGameEvent, onGameEventRef]);

  // Player Name Resolver Helper
  const getPlayerName = useCallback(
    (id: string | null | undefined): string => {
      if (!id) return 'Waiting...';
      const player = players.find((p) => p.playerId === id);
      return player
        ? player.displayName || player.name || id.substring(0, 5)
        : 'Waiting...';
    },
    [players],
  );

  return {
    sdk,
    isSdkReady: isReady,
    lobbyId,
    lobbyIdRef,
    isHost,
    isHostRef,
    myPlayerId,
    myPlayerIdRef,
    players,
    playersRef,
    networkStatus,
    setNetworkStatus,
    refreshLobbyData,
    getPlayerName,
    onGameEventRef,
  };
}
