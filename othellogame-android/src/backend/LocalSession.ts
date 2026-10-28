/**
 * Offline "session" backend.
 *
 * The original Google AI Studio build ran on the Playground multiplayer SDK.
 * The Android v1 is fully offline: there is exactly one local player (the
 * device owner), who is always the host. This class implements the subset of
 * the SDK surface that the game code calls, so the rest of the game logic
 * (tournament flow, rounds, podium) works unchanged.
 *
 * To add online multiplayer later (e.g. Firebase), write another class with
 * the same methods and return it from `createGameBackend()` in
 * `useGameBackend.ts`.
 */
export interface GameBackend {
  init(
    onGameEvent: (event: any) => void,
    onPresence: (presence: any) => void,
    onLobbyStatus: (status: any) => void,
  ): Promise<void>;
  createLobby(callback: (lobbyInfo: any) => void): void;
  getLobby(arg1: any, arg2?: any): void;
  updatePlayerPresence(...args: any[]): void;
  startGame(lobbyId?: string): void;
  sendGameEvent(eventData: any): void;
  scoreUpdated(scoreData: any): void;
  levelComplete(level: number | string): void;
  gameOver(lobbyId?: string): void;
  pauseStateChanged(isPaused: boolean): void;
}

export const LOCAL_PLAYER_ID = 'local_player';

export class LocalSession implements GameBackend {
  private readonly lobbyId = 'local';

  async init(): Promise<void> {}

  private lobbyInfo() {
    return {
      lobbyId: this.lobbyId,
      status: 'WAITING_FOR_PLAYERS',
      players: [
        {
          playerId: LOCAL_PLAYER_ID,
          displayName: 'You',
          isHost: true,
          isCurrentPlayer: true,
        },
      ],
    };
  }

  createLobby(callback: (lobbyInfo: any) => void): void {
    callback(this.lobbyInfo());
  }

  getLobby(arg1: any, arg2?: any): void {
    const cb = typeof arg1 === 'function' ? arg1 : arg2;
    if (typeof cb === 'function') cb(this.lobbyInfo());
  }

  updatePlayerPresence(...args: any[]): void {
    const cb = args.find((a) => typeof a === 'function');
    if (cb) cb(true);
  }

  // Single device: nothing to broadcast. These are intentional no-ops.
  startGame(): void {}
  sendGameEvent(): void {}
  scoreUpdated(): void {}
  levelComplete(): void {}
  gameOver(): void {}
  pauseStateChanged(): void {}
}
