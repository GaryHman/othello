// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Player} from './backend/useSessionLobby';

interface CustomWindow extends Window {
  __PLAYGROUND_DEBUG__?: (show: boolean) => void;
}

export interface MultiplayerGameState {
  status: 'LOBBY' | 'PLAYING' | 'PODIUM';
  tick: number;
  round: number;
  maxRounds: number;
  activePlayerIds: string[];
  queue: string[];
  forfeitedPlayerIds?: string[];
  scores?: Record<string, number>;
  winnerId: string | null;
  standings: Record<string, number>;
  tournamentWinnerId?: string | null;
  isForfeit?: boolean;
  forfeiterId?: string | null;
  [key: string]: any;
}

export interface MultiplayerOverlaysProps {
  appScreen: 'BOOT' | 'LOBBY' | 'PLAYING' | 'PODIUM';
  gameState: MultiplayerGameState;
  players: Player[];
  myPlayerId: string | null;
  isHost: boolean;
  networkStatus?: string;
  customRounds: number | null;
  defaultRounds: number;
  onSetCustomRounds: (
    rounds: number | ((prev: number | null) => number),
  ) => void;
  onCommenceTournament: () => void;
  onStartNextRound: () => void;
  onRestartTournament: () => void;
  onReturnToLobby?: () => void;
  onEndLobby: () => void;
  onForfeit: () => void;
  getPlayerName: (id: string | null | undefined) => string;

  // Modal Visibility State & Handlers
  showDebugHud?: boolean;
  setShowDebugHud?: React.Dispatch<React.SetStateAction<boolean>>;
  showInGameMenu?: boolean;
  setShowInGameMenu?: React.Dispatch<React.SetStateAction<boolean>>;
  showHowToPlay?: boolean;
  setShowHowToPlay?: React.Dispatch<React.SetStateAction<boolean>>;
  showForfeitModal?: boolean;
  setShowForfeitModal?: React.Dispatch<React.SetStateAction<boolean>>;

  // Performance & WebRTC HUD Metrics
  hudMetrics?: {
    fps?: number;
    lowFps?: number;
    jitter?: number;
    rtt?: number;
    packetLoss?: number;
    heapUsed?: number;
  };

  // Custom UI Text & Elements
  gameTitle?: string;
  subtitle?: string;
  howToPlayRules?: string[];
  howToPlayContent?: React.ReactNode;
  forfeitModalText?: string;
  topBarRightContent?: React.ReactNode;
  isMusicMuted?: boolean;
  onToggleMusic?: () => void;
  isSfxMuted?: boolean;
  onToggleSfx?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function MultiplayerOverlays({
  appScreen,
  gameState,
  players,
  myPlayerId,
  isHost,
  networkStatus,
  customRounds,
  defaultRounds,
  onSetCustomRounds,
  onCommenceTournament,
  onStartNextRound,
  onRestartTournament,
  onReturnToLobby,
  onEndLobby,
  onForfeit,
  getPlayerName,
  showDebugHud: controlledShowDebugHud,
  setShowDebugHud: controlledSetShowDebugHud,
  showInGameMenu: controlledShowInGameMenu,
  setShowInGameMenu: controlledSetShowInGameMenu,
  showHowToPlay: controlledShowHowToPlay,
  setShowHowToPlay: controlledSetShowHowToPlay,
  showForfeitModal: controlledShowForfeitModal,
  setShowForfeitModal: controlledSetShowForfeitModal,
  hudMetrics,
  gameTitle,
  subtitle,
  howToPlayRules,
  howToPlayContent,
  forfeitModalText,
  topBarRightContent,
  isMusicMuted,
  onToggleMusic,
  isSfxMuted,
  onToggleSfx,
  isFullscreen,
  onToggleFullscreen,
}: MultiplayerOverlaysProps) {
  // Internal modal states if not controlled from parent
  const [internalShowDebugHud, setInternalShowDebugHud] = useState(false);
  const [internalShowInGameMenu, setInternalShowInGameMenu] = useState(false);
  const [internalShowHowToPlay, setInternalShowHowToPlay] = useState(false);
  const [internalShowForfeitModal, setInternalShowForfeitModal] =
    useState(false);

  const showDebugHud =
    controlledShowDebugHud !== undefined
      ? controlledShowDebugHud
      : internalShowDebugHud;
  const setShowDebugHud = controlledSetShowDebugHud || setInternalShowDebugHud;

  const showInGameMenu =
    controlledShowInGameMenu !== undefined
      ? controlledShowInGameMenu
      : internalShowInGameMenu;
  const setShowInGameMenu =
    controlledSetShowInGameMenu || setInternalShowInGameMenu;

  const showHowToPlay =
    controlledShowHowToPlay !== undefined
      ? controlledShowHowToPlay
      : internalShowHowToPlay;
  const setShowHowToPlay =
    controlledSetShowHowToPlay || setInternalShowHowToPlay;

  const showForfeitModal =
    controlledShowForfeitModal !== undefined
      ? controlledShowForfeitModal
      : internalShowForfeitModal;
  const setShowForfeitModal =
    controlledSetShowForfeitModal || setInternalShowForfeitModal;

  // Keyboard shortcut listener for F2 Debug HUD toggle (only when uncontrolled)
  useEffect(() => {
    if (controlledSetShowDebugHud) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setShowDebugHud((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlledSetShowDebugHud, setShowDebugHud]);

  // Window hook to toggle debug HUD
  useEffect(() => {
    (window as CustomWindow).__PLAYGROUND_DEBUG__ = (show: boolean) => {
      setShowDebugHud(show);
    };
  }, [setShowDebugHud]);

  const effectiveRounds = customRounds !== null ? customRounds : defaultRounds;

  const isForfeited =
    !!myPlayerId &&
    ((gameState.isForfeit && gameState.forfeiterId === myPlayerId) ||
      !!gameState.forfeitedPlayerIds?.includes(myPlayerId));

  const isSpectating =
    appScreen === 'PLAYING' &&
    gameState.status === 'PLAYING' &&
    !!myPlayerId &&
    !gameState.activePlayerIds.includes(myPlayerId);

  return (
    <>
      {/* ==========================================
       * 1. TOP-LEFT NETWORK STATUS
       * ========================================== */}
      {networkStatus && (
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-800 text-xs text-zinc-400 z-50 pointer-events-none">
          <span
            className={`w-2 h-2 rounded-full ${
              networkStatus === 'Connected'
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-yellow-500 animate-pulse'
            }`}
          />
          <span className="font-mono text-[10px] tracking-wider uppercase font-bold">
            {networkStatus}
          </span>
        </div>
      )}

      {/* ==========================================
       * 2. TOP-RIGHT IN-GAME ACTION BAR (Forfeit & Menu)
       * ========================================== */}
      {appScreen === 'PLAYING' && (
        <div className="absolute top-1 right-2 md:top-4 md:right-4 flex items-center gap-2 z-50">
          {topBarRightContent}

          {gameState.activePlayerIds.includes(myPlayerId || '') && (
            <button
              onClick={() => setShowForfeitModal(true)}
              aria-label="Forfeit"
              className="bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md flex items-center gap-1.5">
              <span>🏳️</span>
              <span className="hidden md:inline">Forfeit</span>
            </button>
          )}

          <button
            onClick={() => setShowInGameMenu(true)}
            className="bg-black/60 hover:bg-zinc-800 border border-zinc-700 text-white w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all active:scale-95 cursor-pointer shadow-lg backdrop-blur-md">
            ≡
          </button>
        </div>
      )}

      {/* ==========================================
       * 3. LOBBY SCREEN OVERLAY
       * ========================================== */}
      {appScreen === 'LOBBY' && (
        <div className="fixed inset-0 z-50 overflow-y-auto touch-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl w-full max-w-md text-center shadow-2xl space-y-6">
            <div>
              <h1 className="text-3xl font-black tracking-wider uppercase text-cyan-400">
                {gameTitle || 'Multiplayer Lobby'}
              </h1>
              <p className="text-xs text-zinc-400 tracking-widest uppercase mt-1">
                {subtitle || 'Tournament Mode'}
              </p>
            </div>

            {/* Player Roster */}
            <div className="space-y-2">
              <div className="text-left text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Players Joined ({players.length})
              </div>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {players.map((p, idx) => (
                  <div
                    key={p.playerId}
                    className="flex justify-between items-center bg-zinc-800/80 border border-zinc-700/60 px-4 py-2.5 rounded-xl">
                    <span className="text-sm font-bold text-zinc-200 truncate">
                      {getPlayerName(p.playerId)}{' '}
                      {p.playerId === myPlayerId && '(You)'}
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded">
                      {idx === 0 ? 'HOST' : `P${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tournament Rounds Configuration */}
            <div className="bg-black/30 border border-zinc-800/80 p-4 rounded-xl space-y-2">
              <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Tournament Length
              </div>
              {isHost ? (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() =>
                      onSetCustomRounds((prev) =>
                        Math.max(1, (prev !== null ? prev : defaultRounds) - 1),
                      )
                    }
                    className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold transition-all active:scale-95 cursor-pointer touch-manipulation">
                    -
                  </button>
                  <span className="text-lg font-mono font-black text-cyan-400 min-w-[80px]">
                    {effectiveRounds}{' '}
                    {effectiveRounds === 1 ? 'Round' : 'Rounds'}
                  </span>
                  <button
                    onClick={() =>
                      onSetCustomRounds((prev) =>
                        Math.min(
                          10,
                          (prev !== null ? prev : defaultRounds) + 1,
                        ),
                      )
                    }
                    className="w-10 h-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold transition-all active:scale-95 cursor-pointer touch-manipulation">
                    +
                  </button>
                </div>
              ) : (
                <div className="text-sm font-mono font-black text-cyan-400">
                  {effectiveRounds} {effectiveRounds === 1 ? 'Round' : 'Rounds'}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isForfeited && gameState.status === 'PODIUM' ? (
              <p className="text-xs text-red-400 tracking-widest uppercase font-bold animate-pulse">
                You forfeited this match. Spectating next round...
              </p>
            ) : isHost ? (
              <button
                disabled={players.length < 2}
                onClick={
                  gameState.round > 1 ? onStartNextRound : onCommenceTournament
                }
                className={`w-full py-3.5 rounded-xl font-black uppercase tracking-wider text-sm transition-all shadow-lg min-h-[48px] touch-manipulation ${
                  players.length >= 2
                    ? 'bg-cyan-400 hover:bg-cyan-300 text-black active:scale-95 cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                }`}>
                {players.length >= 2
                  ? gameState.round > 1
                    ? `Start Round ${gameState.round}`
                    : 'Start Tournament'
                  : 'Waiting for Players...'}
              </button>
            ) : (
              <p className="text-xs text-cyan-400 tracking-widest uppercase animate-pulse">
                {gameState.round > 1
                  ? `Awaiting Host to start Round ${gameState.round}...`
                  : 'Awaiting Host to start tournament...'}
              </p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ==========================================
       * 4. PODIUM SCREEN OVERLAY
       * ========================================== */}
      {appScreen === 'PODIUM' && (
        <div className="fixed inset-0 z-50 overflow-y-auto touch-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="min-h-full flex flex-col items-center p-4">
            {gameState.tournamentWinnerId ? (
              <div className="m-auto bg-zinc-900 border border-yellow-500/40 p-6 md:p-8 rounded-2xl w-full max-w-md text-center shadow-2xl">
              <h2 className="text-3xl font-black text-yellow-400 tracking-wider uppercase mb-1">
                Tournament Over
              </h2>
              <p className="text-xs text-zinc-400 tracking-widest uppercase mb-6">
                Final Results
              </p>

              {/* Champion Announcement */}
              <div className="flex flex-col items-center mb-6 bg-black/40 border border-yellow-500/30 p-5 rounded-xl">
                <span className="text-5xl mb-2">🏆</span>
                {gameState.tournamentWinnerId === 'TIE' ? (
                  <>
                    <span className="text-[10px] text-zinc-400 tracking-wider uppercase font-bold mb-1">
                      Result
                    </span>
                    <span className="text-xl font-black text-white">
                      It's a Draw!
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-yellow-400 tracking-wider uppercase font-bold mb-1">
                      Grand Champion
                    </span>
                    <span className="text-2xl font-black text-white truncate max-w-[280px]">
                      {getPlayerName(gameState.tournamentWinnerId ?? null)}
                    </span>
                  </>
                )}
              </div>

              {/* Final Leaderboard */}
              <div className="text-left mb-6 bg-black/20 border border-zinc-800 p-4 rounded-xl">
                <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-3 border-b border-zinc-800 pb-1 font-bold">
                  Final Leaderboard
                </h3>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {Object.entries(gameState.standings)
                    .sort(([, a], [, b]) => b - a)
                    .map(([playerId, wins], idx) => {
                      const isFirst = idx === 0 && wins > 0;
                      return (
                        <div
                          key={playerId}
                          className={`flex justify-between items-center p-2.5 rounded-lg border ${
                            isFirst
                              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                              : 'bg-black/40 border-zinc-800 text-zinc-300'
                          }`}>
                          <div className="flex items-center gap-3 truncate">
                            <span className="text-xs font-mono font-bold w-4">
                              #{idx + 1}
                            </span>
                            <span className="text-sm truncate font-bold">
                              {getPlayerName(playerId)}
                            </span>
                          </div>
                          <span className="text-sm font-black font-mono">
                            {wins} {wins === 1 ? 'Win' : 'Wins'}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {isHost ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={onRestartTournament}
                    className="w-full py-3.5 bg-cyan-400 hover:bg-cyan-300 text-black font-black uppercase rounded-xl transition-all active:scale-95 text-xs tracking-wider cursor-pointer min-h-[48px] touch-manipulation">
                    Restart Tournament
                  </button>
                  <button
                    onClick={onEndLobby}
                    className="w-full py-3.5 bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-300 font-bold uppercase rounded-xl transition-all active:scale-95 text-xs tracking-wider cursor-pointer min-h-[48px] touch-manipulation">
                    Close Lobby
                  </button>
                </div>
              ) : (
                <p className="text-xs text-cyan-400 tracking-widest uppercase animate-pulse">
                  Awaiting Host to restart...
                </p>
              )}
            </div>
          ) : (
            <div className="m-auto bg-zinc-900 border border-zinc-700 p-6 md:p-8 rounded-2xl w-full max-w-md text-center shadow-2xl space-y-6">
              <h2 className="text-2xl font-black text-white tracking-widest uppercase">
                Match Complete
              </h2>

              <div className="flex flex-col items-center bg-black/40 border border-zinc-800 p-5 rounded-xl">
                {gameState.winnerId && gameState.winnerId !== 'DRAW' ? (
                  <>
                    <span className="text-4xl mb-1">👑</span>
                    <span className="text-[10px] text-yellow-400 tracking-wider uppercase font-bold mb-1">
                      Winner {gameState.isForfeit && '(By Forfeit)'}
                    </span>
                    <span className="text-xl font-bold truncate text-white">
                      {getPlayerName(gameState.winnerId)}
                    </span>
                  </>
                ) : gameState.isForfeit && gameState.forfeiterId ? (
                  <>
                    <span className="text-4xl mb-1">🏳️</span>
                    <span className="text-[10px] text-red-400 tracking-wider uppercase font-bold mb-1">
                      Match Forfeited
                    </span>
                    <span className="text-lg font-bold truncate text-white">
                      {getPlayerName(gameState.forfeiterId)} Forfeited
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-4xl mb-1">🤝</span>
                    <span className="text-[10px] text-zinc-400 tracking-wider uppercase font-bold mb-1">
                      Result
                    </span>
                    <span className="text-lg font-bold truncate text-white">
                      It's a Draw!
                    </span>
                  </>
                )}
              </div>

              <div className="bg-black/30 border border-zinc-800 rounded-xl p-3">
                <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1 font-bold">
                  Next Matchup
                </div>
                <div className="text-sm text-cyan-400 font-bold">
                  {gameState.activePlayerIds.length === 2
                    ? `${getPlayerName(gameState.activePlayerIds[0])} VS ${getPlayerName(gameState.activePlayerIds[1])}`
                    : gameState.activePlayerIds.length > 2
                      ? `${gameState.activePlayerIds.length} Players Active`
                      : gameState.activePlayerIds.length === 1
                        ? `Awaiting Challengers (${getPlayerName(gameState.activePlayerIds[0])})`
                        : 'Awaiting players...'}
                </div>
              </div>

              {isHost ? (
                <button
                  onClick={onStartNextRound}
                  className="w-full py-3.5 bg-pink-500 hover:bg-pink-400 text-black font-black uppercase rounded-xl transition-all active:scale-95 text-xs tracking-wider cursor-pointer min-h-[48px] touch-manipulation">
                  Start Next Round
                </button>
              ) : (
                <p className="text-xs text-pink-400 tracking-widest uppercase animate-pulse">
                  Awaiting Host to advance...
                </p>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* ==========================================
       * 5. SPECTATOR BANNER (Queue / Forfeit indicator)
       * ========================================== */}
      {isSpectating && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest pointer-events-none z-40 backdrop-blur-md">
          {isForfeited && gameState.status === 'PLAYING'
            ? 'Spectating (Forfeited)'
            : 'Spectating (In Queue)'}
        </div>
      )}

      {/* ==========================================
       * 6. IN-GAME MENU MODAL
       * ========================================== */}
      {showInGameMenu && (
        <div className="fixed inset-0 z-[60] overflow-y-auto touch-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
              Game Menu
            </h3>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => setShowInGameMenu(false)}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold uppercase rounded-xl text-xs tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                Resume Game
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onToggleSfx}
                  className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation">
                  <span>{isSfxMuted ? '🔇' : '🔊'}</span>
                  <span>SFX: {isSfxMuted ? 'Off' : 'On'}</span>
                </button>
                <button
                  onClick={onToggleMusic}
                  className="py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation">
                  <span>{isMusicMuted ? '🔇' : '🎵'}</span>
                  <span>Music: {isMusicMuted ? 'Off' : 'On'}</span>
                </button>
              </div>

              {onToggleFullscreen && (
                <button
                  onClick={onToggleFullscreen}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation">
                  <span>{isFullscreen ? '⤓' : '⤢'}</span>
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (Immersive)'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowDebugHud((prev) => !prev);
                  setShowInGameMenu(false);
                }}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                {showDebugHud ? 'Hide Debug HUD' : 'Show Debug HUD'}
              </button>

              <button
                onClick={() => setShowHowToPlay(true)}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                How to Play
              </button>

              {gameState.activePlayerIds.includes(myPlayerId || '') && (
                <button
                  onClick={() => {
                    setShowInGameMenu(false);
                    setShowForfeitModal(true);
                  }}
                  className="w-full py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/60 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                  Forfeit Match
                </button>
              )}

              {/* Host Controls */}
              {isHost && (
                <>
                  <div className="border-t border-zinc-800 my-1"></div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Host Controls
                  </div>

                  <button
                    onClick={() => {
                      setShowInGameMenu(false);
                      onRestartTournament();
                    }}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-700/50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                    Restart Match
                  </button>

                  {onReturnToLobby && (
                    <button
                      onClick={() => {
                        setShowInGameMenu(false);
                        onReturnToLobby();
                      }}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-cyan-700/50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                      Exit to Lobby
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setShowInGameMenu(false);
                      onEndLobby();
                    }}
                    className="w-full py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/60 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer min-h-[44px] touch-manipulation">
                    End Lobby
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ==========================================
       * 7. HOW TO PLAY MODAL
       * ========================================== */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-[60] overflow-y-auto touch-auto bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md text-left shadow-2xl space-y-4">
            <h3 className="text-xl font-bold text-cyan-400 uppercase tracking-wide border-b border-zinc-800 pb-2">
              How to Play
            </h3>
            {howToPlayContent || (
              <div className="text-xs text-zinc-300 space-y-2 max-h-60 overflow-y-auto pr-1">
                {howToPlayRules && howToPlayRules.length > 0 ? (
                  howToPlayRules.map((rule, idx) => <p key={idx}>• {rule}</p>)
                ) : (
                  <>
                    <p>
                      • Use your controls to maneuver and outscore your
                      opponent.
                    </p>
                    <p>
                      • The host coordinates game state, round transitions, and
                      standings.
                    </p>
                    <p>
                      • Press ESC or click the Menu button at any time to
                      pause/access controls.
                    </p>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setShowHowToPlay(false)}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase rounded-xl text-xs tracking-wider transition-all cursor-pointer min-h-[44px] touch-manipulation">
              Close
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ==========================================
       * 8. FORFEIT CONFIRMATION MODAL
       * ========================================== */}
      {showForfeitModal && (
        <div className="fixed inset-0 z-[70] overflow-y-auto touch-auto bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-red-700/60 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl space-y-4">
            <div className="text-3xl">🏳️</div>
            <h3 className="text-xl font-bold text-red-400 uppercase tracking-wide">
              Forfeit Match?
            </h3>
            <p className="text-xs text-zinc-300">
              {forfeitModalText ||
                'Are you sure you want to forfeit this round? You will surrender your slot in this round and rotate to the back of the queue.'}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowForfeitModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase rounded-xl text-xs tracking-wider transition-all cursor-pointer min-h-[44px] touch-manipulation">
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowForfeitModal(false);
                  onForfeit();
                }}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase rounded-xl text-xs tracking-wider transition-all cursor-pointer min-h-[44px] touch-manipulation">
                Forfeit
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ==========================================
       * 9. DEBUG / PERFORMANCE HUD
       * ========================================== */}
      {showDebugHud && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#00ffcc',
            padding: '10px',
            borderRadius: '5px',
            fontFamily: 'monospace',
            fontSize: '12px',
            zIndex: 9999,
            pointerEvents: 'none',
            border: '1px solid #00ffcc',
            boxShadow: '0 0 10px rgba(0, 255, 204, 0.5)',
          }}>
          <div style={{fontWeight: 'bold', marginBottom: '5px'}}>DEBUG HUD</div>
          <div>
            FPS: {hudMetrics?.fps ?? 0} (1% low: {hudMetrics?.lowFps ?? 0})
          </div>
          <div>Jitter: {hudMetrics?.jitter ?? 0} ms</div>
          <div>Heap: {hudMetrics?.heapUsed ?? 0} MB</div>
          <div style={{margin: '5px 0', borderTop: '1px solid #333'}} />
          <div>RTT: {hudMetrics?.rtt ?? 0} ms</div>
          <div>Loss: {hudMetrics?.packetLoss ?? 0}%</div>
        </div>
      )}
    </>
  );
}
