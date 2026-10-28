// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createPulse, lerp} from './animation';
import {GAME_ID, getConfig} from './constants';
import {MultiplayerOverlays} from './MultiplayerOverlays';
import {
  applyMove,
  assessMoveQuality,
  Board,
  BotPersonality,
  calculateBotMove,
  coordToNotation,
  countDiscs,
  createInitialBoard,
  DiscColor,
  evaluateBoard,
  getFlippableDiscs,
  getOpponent,
  getValidMoves,
  isCornerCoord,
  isUnsafeXSquare,
  MoveCoord,
  MoveRecord,
  ValidMove,
} from './reversiLogic';
import {SyncEventType} from './types';
import {Player, useMultiplayerLobby} from './useMultiplayerLobby';
import {BaseTournamentGameState, useTournament} from './useTournament';
import BackgroundMusic from './utils/BackgroundMusic';
import {
  createFixedStepper,
  drawAsset,
  drawBackground,
  formatTime,
  gameAudio,
  prepareCanvas,
  useAssets,
  useIsMobile,
} from './utils/helper';
import {useRpc} from './utils/usePlayground';

interface CustomWindow extends Window {
  canHandleBackKey?: boolean;
}

// Assets Manifest
const ASSETS_MANIFEST: Record<string, string> = {
  tabletop_background: 'assets/images/tabletop_background.png',
  reversi_board_felt: 'assets/images/reversi_board_felt.png',
  disc_black_gloss: 'assets/images/disc_black_gloss.png',
  disc_white_ivory: 'assets/images/disc_white_ivory.png',
  avatar_player_default: 'assets/images/avatar_player_default.png',
  avatar_bot_scout: 'assets/images/avatar_bot_scout.png',
  avatar_bot_bishop: 'assets/images/avatar_bot_bishop.png',
  avatar_bot_grandmaster: 'assets/images/avatar_bot_grandmaster.png',
  icon_move_evaluation: 'assets/images/icon_move_evaluation.png',
};

// Flip Animation Tracking
interface FlipAnimation {
  r: number;
  c: number;
  fromColor: DiscColor;
  toColor: DiscColor;
  startTime: number;
  duration: number;
}

// Particle Effect (Corner Capture / Golden Flash)
interface GoldenParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

// --- Tournament Game State interface ---
export interface TournamentGameState extends BaseTournamentGameState {
  activePlayerIndex: number;
  turnNumber: number;
  board: Board;
  currentTurnColor: DiscColor;
  moveHistory: MoveRecord[];
  blackPlayerId: string;
  whitePlayerId: string;
  blackTimeLeft: number;
  whiteTimeLeft: number;
  lastMove: MoveCoord | null;
  evalAdvantage: number; // -100 to 100
  gameMode: 'MULTIPLAYER' | 'BOT' | 'LOCAL';
  botPersonality: BotPersonality;
  botRating: number;
  consecutivePasses: number;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();
  const uiPulseRef = useRef<number>(0);
  const isMobile = useIsMobile();

  // Preload Assets
  const {assets, isReady: assetsLoaded} = useAssets(ASSETS_MANIFEST);

  // Audio Mute State (Controlled exclusively via Game Menu)
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isSfxMuted, setIsSfxMuted] = useState(false);

  // Local Game Options & Accessibility
  const [showHints, setShowHints] = useState<boolean>(
    () => getConfig('enableHints') as boolean,
  );
  const [colorblindMode, setColorblindMode] = useState<boolean>(
    () => getConfig('colorblindMode') as boolean,
  );
  const [selectedBot, setSelectedBot] = useState<BotPersonality>('Bishop');
  const [selectedMode, setSelectedMode] = useState<'MULTIPLAYER' | 'BOT' | 'LOCAL'>('MULTIPLAYER');
  const [reviewPly, setReviewPly] = useState<number | null>(null);

  // UI Interactive States
  const [hoverCoord, setHoverCoord] = useState<MoveCoord | null>(null);
  const hoverCoordRef = useRef<MoveCoord | null>(null);
  hoverCoordRef.current = hoverCoord;

  // Local Animations & Particles Ref (Client simulation)
  const flipAnimationsRef = useRef<FlipAnimation[]>([]);
  const particlesRef = useRef<GoldenParticle[]>([]);
  const cornerFlashRef = useRef<{x: number; y: number; alpha: number} | null>(null);
  const animatedEvalAdvantageRef = useRef<number>(0);

  // --- MULTIPLAYER LOBBY & SDK INTEGRATION ---
  const {
    sdk,
    isSdkReady,
    lobbyId,
    lobbyIdRef,
    isHost,
    isHostRef,
    myPlayerId,
    myPlayerIdRef,
    players,
    playersRef,
    networkStatus,
    refreshLobbyData,
    getPlayerName,
    onGameEventRef,
  } = useMultiplayerLobby({
    onLobbyJoined: (_lobbyId, _players, _isHost) => {
      setAppScreen((prev) => (prev === 'BOOT' ? 'LOBBY' : prev));
    },
  });
  const [exitChat] = useRpc<Record<string, unknown>, void>('ExitChat');

  // --- UI Routing Screen State ---
  const [appScreen, setAppScreen] = useState<'BOOT' | 'LOBBY' | 'PLAYING' | 'PODIUM'>('BOOT');
  const appScreenRef = useRef<'BOOT' | 'LOBBY' | 'PLAYING' | 'PODIUM'>('BOOT');
  useEffect(() => {
    appScreenRef.current = appScreen;
    console.log('[App] Flow Control: appScreen changed to ->', appScreen);
  }, [appScreen]);

  // Modal Visibility States
  const [showDebugHud, setShowDebugHud] = useState(false);
  const [showInGameMenu, setShowInGameMenu] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [showExitMatchModal, setShowExitMatchModal] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!stepperRef.current) {
    stepperRef.current = createFixedStepper(
      getConfig('stepMs'),
      getConfig('maxSubSteps'),
    );
  }

  const handleIncomingActionRef = useRef<(senderId: string, action: any) => void>();

  // Helper to create fresh round state
  const createCleanRoundState = useCallback(
    (p1: string, p2: string, mode: 'MULTIPLAYER' | 'BOT' | 'LOCAL' = 'MULTIPLAYER', bot: BotPersonality = 'Bishop'): Partial<TournamentGameState> => {
      const initialBoard = createInitialBoard();
      const initialEval = evaluateBoard(initialBoard);
      const timerSec = (getConfig('turnTimerSeconds') as number) || 60;
      const botRatings: Record<BotPersonality, number> = {
        Scout: 600,
        Bishop: 1200,
        'Grandmaster Ada': 1800,
      };

      return {
        activePlayerIndex: 0,
        turnNumber: 1,
        board: initialBoard,
        currentTurnColor: 'B',
        moveHistory: [],
        blackPlayerId: p1,
        whitePlayerId: p2,
        blackTimeLeft: timerSec,
        whiteTimeLeft: timerSec,
        lastMove: null,
        evalAdvantage: initialEval,
        gameMode: mode,
        botPersonality: bot,
        botRating: botRatings[bot],
        consecutivePasses: 0,
        scores: {
          [p1]: 2,
          [p2]: 2,
        },
      };
    },
    [],
  );

  // --- TOURNAMENT STATE & FLOW MACHINE ---
  const {
    gameState,
    setGameState,
    gameStateRef,
    customRounds,
    setCustomRounds,
    getDefaultRounds,
    commenceTournament,
    startNextRound,
    hostEndMatch,
    restartTournament,
    endLobby,
    returnToLobby,
    handleForfeit,
    handleTournamentEvent,
  } = useTournament<TournamentGameState>({
    gameId: GAME_ID,
    maxActivePlayers: (getConfig('activePlayersCount') as number) || 2,
    sdk,
    isHost,
    isHostRef,
    myPlayerId,
    myPlayerIdRef,
    players,
    playersRef,
    lobbyId,
    lobbyIdRef,
    appScreen,
    appScreenRef,
    setAppScreen,
    onGameEventRef,
    onCustomGameEvent: (event, payload, senderId) => {
      if (isHostRef.current) {
        if (event?.type === SyncEventType.INPUT_SYNC && senderId) {
          handleIncomingActionRef.current?.(senderId, payload.action);
        }
      }
    },
    initialCustomState: {
      ...createCleanRoundState('p1', 'p2', selectedMode, selectedBot),
    },
    onInitRound: (isFirstRound, currentGS) => {
      const p1 = currentGS.activePlayerIds[0] || 'p1';
      const p2 = currentGS.activePlayerIds[1] || 'p2';
      return createCleanRoundState(p1, p2, selectedMode, selectedBot);
    },
    onResetMatch: () => {
      const p1 = gameStateRef.current.activePlayerIds[0] || 'p1';
      const p2 = gameStateRef.current.activePlayerIds[1] || 'p2';
      return createCleanRoundState(p1, p2, selectedMode, selectedBot);
    },
    onForfeit: (forfeiterId, remainingActive, currentGS) => {
      const currentActiveId =
        currentGS.activePlayerIds[currentGS.activePlayerIndex];
      const nextActiveIndex =
        currentActiveId === forfeiterId
          ? currentGS.activePlayerIndex % remainingActive.length
          : remainingActive.indexOf(currentActiveId);
      return {
        activePlayerIndex: Math.max(0, nextActiveIndex),
      };
    },
  });

  // Determine if it is local user's turn
  const isMyTurn = useMemo(() => {
    if (gameState.status !== 'PLAYING') return false;
    if (gameState.gameMode === 'LOCAL') return true;
    if (gameState.gameMode === 'BOT') {
      return gameState.currentTurnColor === 'B';
    }
    if (!myPlayerId) return false;
    const activePlayerId = gameState.activePlayerIds[gameState.activePlayerIndex];
    return activePlayerId === myPlayerId;
  }, [
    gameState.status,
    gameState.gameMode,
    gameState.currentTurnColor,
    gameState.activePlayerIds,
    gameState.activePlayerIndex,
    myPlayerId,
  ]);

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement);
      if (!isFs) {
        const rootEl = document.documentElement as any;
        if (rootEl.requestFullscreen) {
          await rootEl.requestFullscreen();
        } else if (rootEl.webkitRequestFullscreen) {
          await rootEl.webkitRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('[Fullscreen] toggle error:', err);
    }
  }, []);

  // Track Fullscreen state changes
  useEffect(() => {
    const handleFsChange = () => {
      const doc = document as any;
      setIsFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Android PWA Meta tags & CSS safe area / overscroll configuration
  useEffect(() => {
    const metaDefinitions: Array<{ name?: string; property?: string; content: string }> = [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
      },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'theme-color', content: '#0f172a' },
      { name: 'msapplication-navbutton-color', content: '#0f172a' },
      { name: 'format-detection', content: 'telephone=no' },
    ];

    metaDefinitions.forEach(({ name, property, content }) => {
      const selector = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        if (name) el.name = name;
        if (property) el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.content = content;
    });

    // Style document body and html to prevent rubber-banding and pull-to-refresh
    document.documentElement.style.overscrollBehavior = 'none';
    document.documentElement.style.userSelect = 'none';
    document.documentElement.style.webkitUserSelect = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.backgroundColor = '#0f172a';

    // Prevent multi-touch pinch zoom gesture on Android Chrome
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);

  // Android Web Audio Unlocking on first touch/pointerdown interaction
  useEffect(() => {
    const unlockAudio = () => {
      gameAudio.resume();
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (Ctor) {
          // Trigger resume on any suspended context
          const dummy = new Ctor();
          dummy.resume().then(() => {
            dummy.close();
          }).catch(() => {});
        }
      } catch (_) {}
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });
    window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Android Hardware / Gesture Back Button Handling (popstate & beforeunload)
  useEffect(() => {
    // Push an initial history state
    window.history.pushState({ app: 'reversi-tactics', screen: appScreen }, '');

    const handlePopState = () => {
      // Priority 1: Close topmost open modals if open
      if (showExitMatchModal) {
        setShowExitMatchModal(false);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }
      if (showForfeitModal) {
        setShowForfeitModal(false);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }
      if (showHowToPlay) {
        setShowHowToPlay(false);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }
      if (showMobileHistory) {
        setShowMobileHistory(false);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }
      if (showInGameMenu) {
        setShowInGameMenu(false);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }
      if (reviewPly !== null) {
        setReviewPly(null);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }

      // Priority 2: In active match, prompt confirmation modal rather than terminating session
      if (appScreenRef.current === 'PLAYING') {
        setShowExitMatchModal(true);
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }

      // Priority 3: In Lobby or Podium, navigate back to game mode selection boot screen
      if (appScreenRef.current === 'LOBBY' || appScreenRef.current === 'PODIUM') {
        setAppScreen('BOOT');
        window.history.pushState({ app: 'reversi-tactics' }, '');
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [
    showExitMatchModal,
    showForfeitModal,
    showHowToPlay,
    showMobileHistory,
    showInGameMenu,
    reviewPly,
    appScreen,
  ]);

  // Protect against accidental refresh / window close during active match
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (appScreenRef.current === 'PLAYING') {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Keyboard shortcut listener for Esc and In-Game Actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        setShowDebugHud((prev) => !prev);
      } else if (e.key === 'Escape' && appScreenRef.current === 'PLAYING') {
        if (showExitMatchModal) {
          setShowExitMatchModal(false);
        } else if (showForfeitModal) {
          setShowForfeitModal(false);
        } else if (showHowToPlay) {
          setShowHowToPlay(false);
        } else if (showMobileHistory) {
          setShowMobileHistory(false);
        } else {
          setShowInGameMenu((prev) => !prev);
        }
      } else if (e.key.toLowerCase() === 'h') {
        setShowHints((prev) => !prev);
      } else if (e.key.toLowerCase() === 'u') {
        // Undo in solo/bot practice
        if (gameStateRef.current.gameMode === 'BOT' || gameStateRef.current.gameMode === 'LOCAL') {
          handleUndoMove();
        }
      } else if (e.key === ' ') {
        // Spacebar Pass
        handlePassTurn();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showExitMatchModal, showForfeitModal, showHowToPlay, showMobileHistory]);

  // Audio SFX helper
  const playSfx = useCallback((type: 'click' | 'flip' | 'confirm' | 'corner' | 'win' | 'lose' | 'buzz') => {
    if (isSfxMuted) return;
    try {
      if (type === 'click') gameAudio.playCrispClick();
      else if (type === 'flip') gameAudio.playFootstepWood();
      else if (type === 'confirm') gameAudio.playConfirmSelect();
      else if (type === 'corner') gameAudio.playPowerupChime();
      else if (type === 'win') gameAudio.playVictoryFanfare();
      else if (type === 'lose') gameAudio.playDefeatMotif();
      else if (type === 'buzz') gameAudio.playErrorBuzz();
    } catch (_) {}
  }, [isSfxMuted]);

  // Trigger Win/Defeat audio motifs on status changes
  useEffect(() => {
    if (gameState.status === 'PODIUM') {
      const isWinner =
        myPlayerId && gameState.winnerId === myPlayerId;
      if (isWinner) {
        playSfx('win');
      } else if (gameState.winnerId && gameState.winnerId !== 'DRAW') {
        playSfx('lose');
      }
    }
  }, [gameState.status, gameState.winnerId, myPlayerId, playSfx]);

  // ==========================================
  // AUTHORITATIVE MOVE PROCESSOR (HOST)
  // ==========================================
  const handleIncomingAction = useCallback(
    (senderId: string, action: any) => {
      if (!isHostRef.current || !sdk || !lobbyIdRef.current) {
        console.warn('[App] handleIncomingAction guard check failed');
        return;
      }

      const currentGS = gameStateRef.current;
      if (currentGS.status !== 'PLAYING') {
        console.warn('[App] Rejected action: Game is not playing.');
        return;
      }

      // Check turn authority in multiplayer mode
      if (currentGS.gameMode === 'MULTIPLAYER') {
        const activePlayerId = currentGS.activePlayerIds[currentGS.activePlayerIndex];
        if (senderId !== activePlayerId) {
          console.warn(`[App] Rejected action from ${senderId}: Not their turn.`);
          return;
        }
      }

      console.log('[App] Handling incoming action:', action);

      let nextGS = {...currentGS};
      let stateChanged = false;

      if (action.type === 'MOVE') {
        const {r, c} = action.payload;
        const color = currentGS.currentTurnColor;
        const validMoves = getValidMoves(currentGS.board, color);
        const validMove = validMoves.find((m) => m.r === r && m.c === c);

        if (!validMove) {
          console.warn(`[App] Rejected invalid move at (${r}, ${c}) for ${color}`);
          return;
        }

        const evalBefore = currentGS.evalAdvantage;
        const {nextBoard, flipped} = applyMove(currentGS.board, r, c, color);
        const evalAfter = evaluateBoard(nextBoard);
        const quality = assessMoveQuality(currentGS.board, color, {r, c}, evalBefore, evalAfter);
        const isCorner = isCornerCoord(r, c);

        // Record ply
        const newRecord: MoveRecord = {
          ply: currentGS.moveHistory.length + 1,
          player: color,
          coord: {r, c},
          notation: coordToNotation(r, c),
          flippedCount: flipped.length,
          evalAfter,
          quality,
          isCorner,
        };

        const discCounts = countDiscs(nextBoard);
        const nextTurnColor = getOpponent(color);
        const opponentMoves = getValidMoves(nextBoard, nextTurnColor);
        const currentMovesAfter = getValidMoves(nextBoard, color);

        // Update scores
        const p1 = currentGS.blackPlayerId;
        const p2 = currentGS.whitePlayerId;
        const nextScores = {
          [p1]: discCounts.B,
          [p2]: discCounts.W,
        };

        nextGS.board = nextBoard;
        nextGS.lastMove = {r, c};
        nextGS.evalAdvantage = evalAfter;
        nextGS.moveHistory = [...currentGS.moveHistory, newRecord];
        nextGS.scores = nextScores;
        nextGS.turnNumber = currentGS.turnNumber + 1;

        // Check terminal conditions
        const isBoardFull = discCounts.empty === 0;
        const isBothStuck = opponentMoves.length === 0 && currentMovesAfter.length === 0;

        if (isBoardFull || isBothStuck) {
          let winnerId: string | null = null;
          if (discCounts.B > discCounts.W) {
            winnerId = p1;
          } else if (discCounts.W > discCounts.B) {
            winnerId = p2;
          } else {
            winnerId = 'DRAW';
          }
          console.log('[App] Match finished. Winner:', winnerId, 'Counts:', discCounts);
          hostEndMatch(winnerId);
          return;
        }

        // Handle turn rotation and auto-pass
        if (opponentMoves.length > 0) {
          nextGS.currentTurnColor = nextTurnColor;
          nextGS.activePlayerIndex =
            (currentGS.activePlayerIndex + 1) % currentGS.activePlayerIds.length;
          nextGS.consecutivePasses = 0;
        } else {
          // Opponent has no moves, player keeps turn!
          console.log(`[App] Opponent ${nextTurnColor} has no legal moves. Passing turn back to ${color}.`);
          nextGS.consecutivePasses = currentGS.consecutivePasses + 1;
        }

        stateChanged = true;
      } else if (action.type === 'PASS') {
        const color = currentGS.currentTurnColor;
        const validMoves = getValidMoves(currentGS.board, color);
        if (validMoves.length > 0) {
          console.warn('[App] Cannot pass when legal moves exist.');
          return;
        }

        const nextTurnColor = getOpponent(color);
        const opponentMoves = getValidMoves(currentGS.board, nextTurnColor);

        if (opponentMoves.length === 0 || currentGS.consecutivePasses >= 1) {
          // Neither player has moves: Game Over!
          const counts = countDiscs(currentGS.board);
          const p1 = currentGS.blackPlayerId;
          const p2 = currentGS.whitePlayerId;
          let winnerId: string | null = null;
          if (counts.B > counts.W) winnerId = p1;
          else if (counts.W > counts.B) winnerId = p2;
          else winnerId = 'DRAW';

          hostEndMatch(winnerId);
          return;
        }

        nextGS.currentTurnColor = nextTurnColor;
        nextGS.activePlayerIndex =
          (currentGS.activePlayerIndex + 1) % currentGS.activePlayerIds.length;
        nextGS.consecutivePasses = currentGS.consecutivePasses + 1;
        stateChanged = true;
      }

      // Broadcast new state to all clients
      if (stateChanged) {
        console.log('[App] State changed, broadcasting STATE_SYNC:', nextGS);
        nextGS.tick++;
        gameStateRef.current = nextGS;
        setGameState(nextGS);

        let broadcasts = 0;
        const intervalId = setInterval(() => {
          sdk.sendGameEvent({
            type: SyncEventType.STATE_SYNC,
            gameId: GAME_ID,
            lobbyId: lobbyIdRef.current,
            round: nextGS.round,
            tick: nextGS.tick,
            payload: JSON.stringify({...nextGS, _full: true}),
          });
          broadcasts++;
          if (broadcasts >= 5) clearInterval(intervalId);
        }, 100);
      }
    },
    [sdk, lobbyIdRef, hostEndMatch],
  );
  handleIncomingActionRef.current = handleIncomingAction;

  // Send action wrapper
  const sendAction = useCallback(
    (action: {type: string; payload: any}) => {
      if (gameStateRef.current.status !== 'PLAYING') {
        console.log('[App] sendAction skipped: status not playing');
        return;
      }

      if (!isMyTurn) {
        playSfx('buzz');
        console.warn('[App] Cannot send action: It is not your turn.');
        return;
      }

      if (isHostRef.current) {
        handleIncomingActionRef.current?.(myPlayerIdRef.current || 'host', action);
      } else {
        if (sdk && lobbyIdRef.current) {
          sdk.sendGameEvent({
            type: SyncEventType.INPUT_SYNC,
            gameId: GAME_ID,
            lobbyId: lobbyIdRef.current,
            round: gameStateRef.current.round,
            tick: gameStateRef.current.tick,
            payload: JSON.stringify({
              senderId: myPlayerIdRef.current,
              action,
            }),
          });
        }
      }
    },
    [isMyTurn, sdk, lobbyIdRef, playSfx],
  );

  // Trigger disc move
  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (reviewPly !== null) {
        setReviewPly(null); // exit review on new interaction
      }
      if (gameState.status !== 'PLAYING') return;
      if (!isMyTurn) {
        playSfx('buzz');
        return;
      }

      const flippable = getFlippableDiscs(gameState.board, r, c, gameState.currentTurnColor);
      if (flippable.length === 0) {
        playSfx('buzz');
        return;
      }

      playSfx('confirm');

      // Schedule local domino flip animation for visual juice
      const now = performance.now();
      const newFlips: FlipAnimation[] = flippable.map((f, idx) => ({
        r: f.r,
        c: f.c,
        fromColor: gameState.board[f.r][f.c] as DiscColor,
        toColor: gameState.currentTurnColor,
        startTime: now + idx * 55, // Domino wave delay
        duration: (getConfig('flipAnimDurationMs') as number) || 320,
      }));
      flipAnimationsRef.current.push(...newFlips);

      // Golden particle flash if capturing corner
      if (isCornerCoord(r, c)) {
        playSfx('corner');
        cornerFlashRef.current = {x: c, y: r, alpha: 1.0};
        for (let i = 0; i < 24; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 40 + Math.random() * 80;
          particlesRef.current.push({
            x: c,
            y: r,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0,
            maxLife: 0.6 + Math.random() * 0.4,
            size: 3 + Math.random() * 4,
            color: Math.random() > 0.4 ? '#f59e0b' : '#38bdf8',
          });
        }
      }

      sendAction({type: 'MOVE', payload: {r, c}});
    },
    [gameState, isMyTurn, reviewPly, playSfx, sendAction],
  );

  // Pass Turn handler
  const handlePassTurn = useCallback(() => {
    if (gameState.status !== 'PLAYING' || !isMyTurn) return;
    const moves = getValidMoves(gameState.board, gameState.currentTurnColor);
    if (moves.length === 0) {
      playSfx('click');
      sendAction({type: 'PASS', payload: {}});
    } else {
      playSfx('buzz');
    }
  }, [gameState, isMyTurn, playSfx, sendAction]);

  // Undo move (Solo / Bot Practice only)
  const handleUndoMove = useCallback(() => {
    if (gameState.gameMode !== 'BOT' && gameState.gameMode !== 'LOCAL') return;
    if (gameState.moveHistory.length === 0) return;

    // In Bot mode, undo 2 plies (bot move + player move); in Local, undo 1 ply
    const pliesToUndo = gameState.gameMode === 'BOT' ? Math.min(2, gameState.moveHistory.length) : 1;
    let newBoard = createInitialBoard();
    const remainingHistory = gameState.moveHistory.slice(0, gameState.moveHistory.length - pliesToUndo);

    for (const record of remainingHistory) {
      if (record.coord) {
        const {nextBoard} = applyMove(newBoard, record.coord.r, record.coord.c, record.player);
        newBoard = nextBoard;
      }
    }

    const lastRec = remainingHistory[remainingHistory.length - 1];
    const nextTurn = remainingHistory.length % 2 === 0 ? 'B' : 'W';

    setGameState((prev) => ({
      ...prev,
      board: newBoard,
      moveHistory: remainingHistory,
      currentTurnColor: nextTurn,
      lastMove: lastRec?.coord || null,
      evalAdvantage: evaluateBoard(newBoard),
    }));
    playSfx('click');
  }, [gameState, playSfx, setGameState]);

  // Bot Thinking & Execution Effect (Host Authoritative)
  useEffect(() => {
    if (
      gameState.status !== 'PLAYING' ||
      gameState.gameMode !== 'BOT' ||
      gameState.currentTurnColor !== 'W' ||
      !isHostRef.current
    ) {
      return;
    }

    const timer = setTimeout(() => {
      const valid = getValidMoves(gameStateRef.current.board, 'W');
      if (valid.length === 0) {
        // Auto pass bot
        handleIncomingActionRef.current?.(gameStateRef.current.whitePlayerId, {
          type: 'PASS',
          payload: {},
        });
        return;
      }

      const botMove = calculateBotMove(
        gameStateRef.current.board,
        'W',
        gameStateRef.current.botPersonality,
      );

      if (botMove) {
        handleIncomingActionRef.current?.(gameStateRef.current.whitePlayerId, {
          type: 'MOVE',
          payload: {r: botMove.r, c: botMove.c},
        });
        playSfx('flip');
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [gameState.status, gameState.gameMode, gameState.currentTurnColor, playSfx]);

  // Auto-pass turn if current player has zero moves and autoPass is enabled
  useEffect(() => {
    if (
      gameState.status !== 'PLAYING' ||
      !isHostRef.current ||
      !(getConfig('autoPass') as boolean)
    ) {
      return;
    }

    const validMoves = getValidMoves(gameState.board, gameState.currentTurnColor);
    if (validMoves.length === 0) {
      const passTimeout = setTimeout(() => {
        const activeId = gameStateRef.current.activePlayerIds[gameStateRef.current.activePlayerIndex] || 'p1';
        handleIncomingActionRef.current?.(activeId, {
          type: 'PASS',
          payload: {},
        });
      }, 800);
      return () => clearTimeout(passTimeout);
    }
  }, [gameState.status, gameState.board, gameState.currentTurnColor]);

  // Clocks countdown (Host updates state periodically)
  useEffect(() => {
    if (gameState.status !== 'PLAYING' || !isHostRef.current) return;

    const clockInterval = setInterval(() => {
      setGameState((prev) => {
        if (prev.status !== 'PLAYING') return prev;
        const color = prev.currentTurnColor;
        let newBlackTime = prev.blackTimeLeft;
        let newWhiteTime = prev.whiteTimeLeft;

        if (color === 'B') {
          newBlackTime = Math.max(0, newBlackTime - 1);
        } else {
          newWhiteTime = Math.max(0, newWhiteTime - 1);
        }

        // Time forfeit
        if (newBlackTime === 0) {
          hostEndMatch(prev.whitePlayerId);
        } else if (newWhiteTime === 0) {
          hostEndMatch(prev.blackPlayerId);
        }

        return {
          ...prev,
          blackTimeLeft: newBlackTime,
          whiteTimeLeft: newWhiteTime,
        };
      });
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [gameState.status, hostEndMatch, setGameState]);

  // ==========================================
  // 60FPS RAF LOOP (Smooth Flips & Advantage Gauge)
  // ==========================================
  const update = (dt: number) => {
    uiPulseRef.current = (uiPulseRef.current + dt) % 1;

    // Smoothly interpolate advantage bar
    const targetAdv = gameStateRef.current.evalAdvantage;
    animatedEvalAdvantageRef.current = lerp(
      animatedEvalAdvantageRef.current,
      targetAdv,
      Math.min(1, dt * 7),
    );

    // Update flip animations
    const now = performance.now();
    flipAnimationsRef.current = flipAnimationsRef.current.filter((anim) => {
      return now < anim.startTime + anim.duration;
    });

    // Update golden particles
    particlesRef.current.forEach((p) => {
      p.life += dt;
      p.x += (p.vx * dt) / 50;
      p.y += (p.vy * dt) / 50;
    });
    particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);

    // Corner flash decay
    if (cornerFlashRef.current) {
      cornerFlashRef.current.alpha -= dt * 2;
      if (cornerFlashRef.current.alpha <= 0) cornerFlashRef.current = null;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const W = getConfig('width') as number;
    const H = getConfig('height') as number;
    prepareCanvas(ctx, W, H);

    // 1. Draw Tabletop Background
    const bgImg = assets['tabletop_background'];
    drawBackground(ctx, bgImg, W, H, '#0f172a');

    // Subtle dark gradient vignette
    const bgGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7);
    bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
    bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    if (gameStateRef.current.status !== 'PLAYING') return;

    // 2. Geometry Layout
    // Centered 8x8 Board
    const boardPadding = isMobile ? 12 : 20;
    const availableBoardSize = Math.min(W * 0.58, H - 120);
    const boardSize = Math.floor(availableBoardSize);
    const boardX = Math.floor((W - boardSize) / 2) + 20;
    const boardY = Math.floor((H - boardSize) / 2) + 15;
    const cellSize = boardSize / 8;

    // 3. Draw Emerald Baize Reversi Board
    const boardImg = assets['reversi_board_felt'];
    drawAsset(ctx, boardImg, boardX, boardY, boardSize, boardSize, (fallbackCtx) => {
      fallbackCtx.fillStyle = '#064e3b';
      fallbackCtx.fillRect(boardX, boardY, boardSize, boardSize);
    });

    // Board Border & Outer Glow
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#78350f'; // Walnut border
    ctx.strokeRect(boardX, boardY, boardSize, boardSize);
    ctx.restore();

    // 4. Draw Coordinate Labels (A-H, 1-8)
    ctx.save();
    ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const colChar = String.fromCharCode(65 + i);
      const rowNum = String(i + 1);
      // Top & Bottom Columns
      ctx.fillText(colChar, boardX + (i + 0.5) * cellSize, boardY - 9);
      ctx.fillText(colChar, boardX + (i + 0.5) * cellSize, boardY + boardSize + 9);
      // Left & Right Rows
      ctx.fillText(rowNum, boardX - 11, boardY + (i + 0.5) * cellSize);
      ctx.fillText(rowNum, boardX + boardSize + 11, boardY + (i + 0.5) * cellSize);
    }
    ctx.restore();

    // Draw Grid Lines on Board
    ctx.save();
    ctx.strokeStyle = 'rgba(2, 44, 34, 0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(boardX + i * cellSize, boardY);
      ctx.lineTo(boardX + i * cellSize, boardY + boardSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boardX, boardY + i * cellSize);
      ctx.lineTo(boardX + boardSize, boardY + i * cellSize);
      ctx.stroke();
    }
    ctx.restore();

    // Board representation for display (either active state or review ply)
    let displayBoard = gameStateRef.current.board;
    if (reviewPly !== null && reviewPly < gameStateRef.current.moveHistory.length) {
      let playbackBoard = createInitialBoard();
      for (let p = 0; p <= reviewPly; p++) {
        const rec = gameStateRef.current.moveHistory[p];
        if (rec.coord) {
          const {nextBoard} = applyMove(playbackBoard, rec.coord.r, rec.coord.c, rec.player);
          playbackBoard = nextBoard;
        }
      }
      displayBoard = playbackBoard;
    }

    // 5. Draw Discs & Flipping Animations
    const blackDiscImg = assets['disc_black_gloss'];
    const whiteDiscImg = assets['disc_white_ivory'];
    const now = performance.now();
    const discRadius = cellSize * 0.42;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = displayBoard[r][c];
        const cx = boardX + (c + 0.5) * cellSize;
        const cy = boardY + (r + 0.5) * cellSize;

        // Check if currently undergoing flip animation
        const activeAnim = flipAnimationsRef.current.find(
          (a) => a.r === r && a.c === c && now >= a.startTime && now <= a.startTime + a.duration,
        );

        if (activeAnim) {
          const progress = (now - activeAnim.startTime) / activeAnim.duration;
          const scaleX = Math.abs(Math.cos(progress * Math.PI));
          const showingColor = progress < 0.5 ? activeAnim.fromColor : activeAnim.toColor;
          const img = showingColor === 'B' ? blackDiscImg : whiteDiscImg;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(Math.max(0.05, scaleX), 1.0);
          drawAsset(ctx, img, -discRadius, -discRadius, discRadius * 2, discRadius * 2, (fb) => {
            fb.fillStyle = showingColor === 'B' ? '#18181b' : '#f8fafc';
            fb.beginPath();
            fb.arc(0, 0, discRadius, 0, Math.PI * 2);
            fb.fill();
          });
          ctx.restore();
        } else if (piece) {
          const img = piece === 'B' ? blackDiscImg : whiteDiscImg;
          drawAsset(ctx, img, cx - discRadius, cy - discRadius, discRadius * 2, discRadius * 2, (fb) => {
            fb.fillStyle = piece === 'B' ? '#18181b' : '#f8fafc';
            fb.beginPath();
            fb.arc(cx, cy, discRadius, 0, Math.PI * 2);
            fb.fill();
          });

          // Colorblind mode glyphs (Sun on White, Moon on Black)
          if (colorblindMode) {
            ctx.save();
            ctx.fillStyle = piece === 'B' ? '#38bdf8' : '#eab308';
            ctx.font = `bold ${Math.floor(cellSize * 0.28)}px system-ui`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(piece === 'B' ? '☾' : '☼', cx, cy);
            ctx.restore();
          }

          // Last move indicator pip
          if (
            gameStateRef.current.lastMove &&
            gameStateRef.current.lastMove.r === r &&
            gameStateRef.current.lastMove.c === c
          ) {
            ctx.save();
            ctx.fillStyle = piece === 'B' ? '#38bdf8' : '#e11d48';
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }

    // 6. Draw Legal Move Pips & Tactical Hints
    const validMoves = getValidMoves(displayBoard, gameStateRef.current.currentTurnColor);
    const pulse = createPulse(uiPulseRef.current, 1.2);

    if (isMyTurn && reviewPly === null) {
      // Find best move for tactical hint indicator
      let bestMoveCoord: MoveCoord | null = null;
      if (showHints && validMoves.length > 0) {
        let bestEval = gameStateRef.current.currentTurnColor === 'B' ? -999 : 999;
        for (const vm of validMoves) {
          const {nextBoard} = applyMove(displayBoard, vm.r, vm.c, gameStateRef.current.currentTurnColor);
          const ev = evaluateBoard(nextBoard);
          if (gameStateRef.current.currentTurnColor === 'B' && ev > bestEval) {
            bestEval = ev;
            bestMoveCoord = {r: vm.r, c: vm.c};
          } else if (gameStateRef.current.currentTurnColor === 'W' && ev < bestEval) {
            bestEval = ev;
            bestMoveCoord = {r: vm.r, c: vm.c};
          }
        }
      }

      validMoves.forEach((vm) => {
        const cx = boardX + (vm.c + 0.5) * cellSize;
        const cy = boardY + (vm.r + 0.5) * cellSize;
        const isBest = bestMoveCoord && bestMoveCoord.r === vm.r && bestMoveCoord.c === vm.c;

        ctx.save();
        if (isBest) {
          // Radiant star badge on engine recommended best move
          const badgeImg = assets['icon_move_evaluation'];
          const badgeSize = cellSize * 0.55;
          ctx.globalAlpha = 0.85 + 0.15 * pulse;
          drawAsset(ctx, badgeImg, cx - badgeSize / 2, cy - badgeSize / 2, badgeSize, badgeSize, (fb) => {
            fb.fillStyle = '#f59e0b';
            fb.beginPath();
            fb.arc(cx, cy, 7, 0, Math.PI * 2);
            fb.fill();
          });
        } else {
          // Soft translucent guide pip
          ctx.fillStyle =
            gameStateRef.current.currentTurnColor === 'B'
              ? 'rgba(0, 0, 0, 0.45)'
              : 'rgba(255, 255, 255, 0.55)';
          ctx.beginPath();
          ctx.arc(cx, cy, 6 + 1.5 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Amber hazard badge on unsafe X-squares
        if (showHints && isUnsafeXSquare(displayBoard, vm.r, vm.c)) {
          ctx.save();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(boardX + vm.c * cellSize + 4, boardY + vm.r * cellSize + 4, cellSize - 8, cellSize - 8);
          ctx.restore();
        }
      });
    }

    // 7. Hover Preview: Highlight Opponent Discs That Will Flip
    const currentHover = hoverCoordRef.current;
    if (isMyTurn && currentHover && displayBoard[currentHover.r]?.[currentHover.c] === null) {
      const flippable = getFlippableDiscs(displayBoard, currentHover.r, currentHover.c, gameStateRef.current.currentTurnColor);
      if (flippable.length > 0) {
        // Draw ripple pulse outline on flippable discs
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 10;
        flippable.forEach((f) => {
          const fx = boardX + (f.c + 0.5) * cellSize;
          const fy = boardY + (f.r + 0.5) * cellSize;
          ctx.beginPath();
          ctx.arc(fx, fy, discRadius + 2 + 2 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Semi-transparent ghost preview on hover target
        const ghostImg = gameStateRef.current.currentTurnColor === 'B' ? blackDiscImg : whiteDiscImg;
        ctx.globalAlpha = 0.5;
        const hx = boardX + (currentHover.c + 0.5) * cellSize;
        const hy = boardY + (currentHover.r + 0.5) * cellSize;
        drawAsset(ctx, ghostImg, hx - discRadius, hy - discRadius, discRadius * 2, discRadius * 2, (fb) => {
          fb.fillStyle = gameStateRef.current.currentTurnColor === 'B' ? '#18181b' : '#f8fafc';
          fb.beginPath();
          fb.arc(hx, hy, discRadius, 0, Math.PI * 2);
          fb.fill();
        });
        ctx.restore();
      }
    }

    // 8. Golden Corner Flash & Star Particles
    if (cornerFlashRef.current) {
      ctx.save();
      const fx = boardX + (cornerFlashRef.current.x + 0.5) * cellSize;
      const fy = boardY + (cornerFlashRef.current.y + 0.5) * cellSize;
      ctx.fillStyle = `rgba(245, 158, 11, ${Math.max(0, cornerFlashRef.current.alpha * 0.6)})`;
      ctx.beginPath();
      ctx.arc(fx, fy, cellSize * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    particlesRef.current.forEach((p) => {
      ctx.save();
      const px = boardX + (p.x + 0.5) * cellSize;
      const py = boardY + (p.y + 0.5) * cellSize;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.5, p.size * (1 - p.life / p.maxLife)), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 9. Draw Evaluation Advantage Bar (Left flank)
    if (getConfig('showEvalBar') as boolean) {
      const barWidth = 22;
      const barHeight = boardSize;
      const barX = boardX - barWidth - 28;
      const barY = boardY;

      // Evaluation Advantage Percentage (-100 to 100 scaled)
      const currentAdv = animatedEvalAdvantageRef.current;
      // Map [-100, 100] to [0, 1], where 0 is 100% White, 1 is 100% Black
      const blackFraction = Math.max(0.05, Math.min(0.95, (currentAdv + 100) / 200));

      ctx.save();
      // Outer border & shadow
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);

      // Top fill: Black (Obsidian)
      const blackHeight = barHeight * blackFraction;
      ctx.fillStyle = '#18181b';
      ctx.fillRect(barX, barY, barWidth, blackHeight);

      // Bottom fill: White (Ivory)
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(barX, barY + blackHeight, barWidth, barHeight - blackHeight);

      // Divider line at parity
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(barX, barY + blackHeight);
      ctx.lineTo(barX + barWidth, barY + blackHeight);
      ctx.stroke();

      // Numerical label
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      const advLabel = currentAdv > 0 ? `+${currentAdv}` : `${currentAdv}`;
      ctx.fillStyle = currentAdv > 0 ? '#ffffff' : '#000000';
      const labelY = currentAdv > 0 ? barY + 14 : barY + barHeight - 8;
      ctx.fillText(advLabel, barX + barWidth / 2, labelY);
      ctx.restore();
    }
  };

  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  // 60FPS Animation Loop
  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop);
      try {
        stepperRef.current?.(time, (dt) => {
          updateRef.current(dt);
        });
      } catch (err) {
        console.error('[App] Stepper error:', err);
      }

      try {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) drawRef.current(ctx);
        }
      } catch (drawErr) {
        console.error('[App] Draw error:', drawErr);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Pointer Click / Touch coordinate mapper
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = getConfig('width') as number;
    const H = getConfig('height') as number;

    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const availableBoardSize = Math.min(W * 0.58, H - 120);
    const boardSize = Math.floor(availableBoardSize);
    const boardX = Math.floor((W - boardSize) / 2) + 20;
    const boardY = Math.floor((H - boardSize) / 2) + 15;
    const cellSize = boardSize / 8;

    if (
      canvasX >= boardX &&
      canvasX < boardX + boardSize &&
      canvasY >= boardY &&
      canvasY < boardY + boardSize
    ) {
      const col = Math.floor((canvasX - boardX) / cellSize);
      const row = Math.floor((canvasY - boardY) / cellSize);
      handleCellClick(row, col);
    }
  };

  // Pointer Move for hover ripple preview
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const W = getConfig('width') as number;
    const H = getConfig('height') as number;

    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;

    const availableBoardSize = Math.min(W * 0.58, H - 120);
    const boardSize = Math.floor(availableBoardSize);
    const boardX = Math.floor((W - boardSize) / 2) + 20;
    const boardY = Math.floor((H - boardSize) / 2) + 15;
    const cellSize = boardSize / 8;

    if (
      canvasX >= boardX &&
      canvasX < boardX + boardSize &&
      canvasY >= boardY &&
      canvasY < boardY + boardSize
    ) {
      const col = Math.floor((canvasX - boardX) / cellSize);
      const row = Math.floor((canvasY - boardY) / cellSize);
      setHoverCoord({r: row, c: col});
    } else {
      setHoverCoord(null);
    }
  };

  const handleCanvasPointerLeave = () => {
    setHoverCoord(null);
  };

  // Start Offline / Bot Match
  const startOfflineMatch = (mode: 'BOT' | 'LOCAL', botType: BotPersonality = 'Bishop') => {
    setSelectedMode(mode);
    setSelectedBot(botType);
    const p1 = myPlayerIdRef.current || 'player_1';
    const p2 = mode === 'BOT' ? `bot_${botType.toLowerCase().replace(/\s+/g, '_')}` : 'guest_local';
    const fresh = createCleanRoundState(p1, p2, mode, botType);

    const initGS: TournamentGameState = {
      ...gameStateRef.current,
      ...fresh,
      status: 'PLAYING',
      activePlayerIds: [p1, p2],
      round: 1,
      maxRounds: (getConfig('tournamentRounds') as number) || 3,
    };

    gameStateRef.current = initGS;
    setGameState(initGS);
    setAppScreen('PLAYING');
    playSfx('confirm');
  };

  // Compute piece counts
  const discStats = useMemo(() => {
    return countDiscs(gameState.board);
  }, [gameState.board]);

  const p1Name = useMemo(() => {
    if (gameState.gameMode === 'BOT') return 'You';
    return getPlayerName(gameState.blackPlayerId);
  }, [gameState.gameMode, gameState.blackPlayerId, getPlayerName]);

  const p2Name = useMemo(() => {
    if (gameState.gameMode === 'BOT') {
      return `${gameState.botPersonality} (${gameState.botRating})`;
    }
    if (gameState.gameMode === 'LOCAL') return 'Player 2 (Ivory)';
    return getPlayerName(gameState.whitePlayerId);
  }, [gameState.gameMode, gameState.botPersonality, gameState.botRating, gameState.whitePlayerId, getPlayerName]);

  const isMusicPlaying = appScreen === 'PLAYING';

  return (
    <div
      className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-zinc-950 text-white font-sans select-none"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}>
      <BackgroundMusic
        url={getConfig('backgroundMusicUrl') as string}
        isPlaying={isMusicPlaying}
        isMuted={isMusicMuted}
      />

      {/* ==========================================
       * 1. TOP TELEMETRY HUD BAR (Dedicated Panel)
       * ========================================== */}
      <div className="w-full bg-zinc-900/90 border-b border-zinc-800 px-3 md:px-4 py-1.5 md:py-2 flex flex-wrap items-center justify-between z-30 shadow-lg backdrop-blur-md gap-2">
        {/* Left: Tournament / Round Status & Opponents */}
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <h1 className="text-xs md:text-sm font-black tracking-wider uppercase text-emerald-400">
              {getConfig('title')}
            </h1>
          </div>
          <span className="text-[10px] md:text-[11px] font-mono text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
            R{gameState.round}/{gameState.maxRounds}
          </span>
          {gameState.gameMode === 'BOT' && (
            <span className="text-[9px] md:text-[10px] uppercase font-bold text-amber-400 bg-amber-950/60 px-1.5 md:px-2 py-0.5 rounded border border-amber-700/50">
              {gameState.botPersonality}
            </span>
          )}
        </div>

        {/* Center: Live Disc Counts & Active Turn Indicator */}
        {appScreen === 'PLAYING' && (
          <div className="flex items-center gap-2 md:gap-4">
            {/* Black / Obsidian Player */}
            <div
              className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 rounded-xl border transition-all ${
                gameState.currentTurnColor === 'B'
                  ? 'bg-zinc-800/90 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-zinc-900/60 border-zinc-800 opacity-70'
              }`}>
              <span className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-black border border-zinc-500 inline-block shadow-sm" />
              <span className="text-[11px] md:text-xs font-bold text-zinc-200 truncate max-w-[70px] md:max-w-[100px]">
                {p1Name}
              </span>
              <span className="text-xs md:text-sm font-mono font-black text-emerald-400 min-w-[16px] text-right">
                {discStats.B}
              </span>
              <span className="text-[9px] md:text-[10px] font-mono text-zinc-400">
                ⏱ {formatTime(gameState.blackTimeLeft)}
              </span>
            </div>

            <span className="text-[10px] md:text-xs font-black text-zinc-500 uppercase">VS</span>

            {/* White / Ivory Player */}
            <div
              className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 rounded-xl border transition-all ${
                gameState.currentTurnColor === 'W'
                  ? 'bg-zinc-800/90 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'bg-zinc-900/60 border-zinc-800 opacity-70'
              }`}>
              <span className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-zinc-100 border border-zinc-300 inline-block shadow-sm" />
              <span className="text-[11px] md:text-xs font-bold text-zinc-200 truncate max-w-[70px] md:max-w-[100px]">
                {p2Name}
              </span>
              <span className="text-xs md:text-sm font-mono font-black text-cyan-300 min-w-[16px] text-right">
                {discStats.W}
              </span>
              <span className="text-[9px] md:text-[10px] font-mono text-zinc-400">
                ⏱ {formatTime(gameState.whiteTimeLeft)}
              </span>
            </div>
          </div>
        )}

        {/* Right: Quick Action Controls & Menu Trigger */}
        <div className="flex items-center gap-1.5 md:gap-2">
          {appScreen === 'PLAYING' && (
            <>
              <button
                onClick={() => setShowHints((prev) => !prev)}
                title="Toggle Hints (H)"
                className={`px-2 py-1 rounded-lg text-[10px] md:text-[11px] font-bold tracking-wider uppercase border transition-all cursor-pointer touch-manipulation ${
                  showHints
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}>
                💡 {showHints ? 'On' : 'Off'}
              </button>

              <button
                onClick={() => setColorblindMode((prev) => !prev)}
                title="Toggle Colorblind Glyphs"
                className={`px-2 py-1 rounded-lg text-[10px] md:text-[11px] font-bold tracking-wider uppercase border transition-all cursor-pointer touch-manipulation ${
                  colorblindMode
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white'
                }`}>
                👁
              </button>

              {(gameState.gameMode === 'BOT' || gameState.gameMode === 'LOCAL') && (
                <button
                  onClick={handleUndoMove}
                  title="Undo Move (U)"
                  className="px-2 py-1 rounded-lg text-[10px] md:text-[11px] font-bold tracking-wider uppercase bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 cursor-pointer touch-manipulation">
                  ↶
                </button>
              )}

              {/* Mobile Move Analysis trigger */}
              {isMobile && (
                <button
                  onClick={() => setShowMobileHistory(true)}
                  title="View Move Analysis"
                  className="px-2 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase bg-zinc-800 border border-zinc-700 text-emerald-400 cursor-pointer touch-manipulation">
                  📋 {gameState.moveHistory.length}
                </button>
              )}

              {/* Fullscreen toggle button on top bar */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                className="px-2 py-1 rounded-lg text-[10px] md:text-[11px] font-bold tracking-wider uppercase bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 cursor-pointer touch-manipulation">
                {isFullscreen ? '⤓' : '⤢'}
              </button>

              {/* Pass button if no moves available */}
              {isMyTurn && getValidMoves(gameState.board, gameState.currentTurnColor).length === 0 && (
                <button
                  onClick={handlePassTurn}
                  className="px-2.5 py-1 rounded-lg text-[10px] md:text-[11px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black shadow-md animate-pulse cursor-pointer touch-manipulation">
                  Pass
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ==========================================
       * 2. MAIN PLAYFIELD VIEWPORT & NOTATION LOG
       * ========================================== */}
      <div className="flex-1 w-full min-h-0 relative flex items-center justify-center p-2">
        {/* Game Canvas */}
        <canvas
          ref={canvasRef}
          width={getConfig('width') as number}
          height={getConfig('height') as number}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerLeave={handleCanvasPointerLeave}
          style={{
            aspectRatio: `${getConfig('width')} / ${getConfig('height')}`,
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            touchAction: 'none',
          }}
          className="h-auto max-w-full max-h-full rounded-2xl shadow-2xl cursor-pointer"
        />

        {/* Tactical Move History Stream (Desktop Right Flank) */}
        {appScreen === 'PLAYING' && !isMobile && (
          <div className="absolute right-4 top-4 bottom-4 w-56 bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-3 flex flex-col shadow-2xl backdrop-blur-md z-20">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Move Analysis
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                Ply {gameState.moveHistory.length}
              </span>
            </div>

            {/* Scrollable Notation Log */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 touch-auto text-xs">
              {gameState.moveHistory.length === 0 ? (
                <p className="text-[11px] text-zinc-500 italic text-center pt-8">
                  Game in progress...
                  <br />
                  Make a flanking move to begin tactical review.
                </p>
              ) : (
                gameState.moveHistory.map((rec, idx) => {
                  const isSelected = reviewPly === idx;
                  const isBlack = rec.player === 'B';
                  const qualityColor =
                    rec.quality === 'Brilliant'
                      ? 'text-cyan-300 bg-cyan-950/70 border-cyan-500/50'
                      : rec.quality === 'Best'
                        ? 'text-emerald-300 bg-emerald-950/70 border-emerald-500/50'
                        : rec.quality === 'Good'
                          ? 'text-blue-300 bg-blue-950/70 border-blue-500/50'
                          : rec.quality === 'Inaccuracy'
                            ? 'text-yellow-300 bg-yellow-950/70 border-yellow-500/50'
                            : rec.quality === 'Mistake'
                              ? 'text-orange-300 bg-orange-950/70 border-orange-500/50'
                              : 'text-red-300 bg-red-950/70 border-red-500/50';

                  return (
                    <div
                      key={idx}
                      onClick={() => setReviewPly(isSelected ? null : idx)}
                      className={`flex items-center justify-between p-1.5 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-zinc-700/80 border-cyan-400 text-white'
                          : 'bg-zinc-800/40 border-zinc-800 hover:bg-zinc-800/70 text-zinc-300'
                      }`}>
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] text-zinc-500 w-5">
                          {rec.ply}.
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full inline-block ${
                            isBlack ? 'bg-black border border-zinc-500' : 'bg-white border border-zinc-300'
                          }`}
                        />
                        <span className="font-mono font-bold text-xs">
                          {rec.notation}
                        </span>
                        {rec.isCorner && <span title="Corner Anchored">👑</span>}
                      </div>

                      {rec.quality && (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${qualityColor}`}>
                          {rec.quality === 'Brilliant' ? '✦ Brilliant' : rec.quality}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Scrubber Controls */}
            {gameState.moveHistory.length > 0 && (
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between gap-1">
                <button
                  disabled={reviewPly === 0}
                  onClick={() => setReviewPly((prev) => Math.max(0, (prev !== null ? prev : gameState.moveHistory.length - 1) - 1))}
                  className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-[10px] font-bold uppercase cursor-pointer">
                  ◀ Prev
                </button>
                <button
                  onClick={() => setReviewPly(null)}
                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold uppercase text-white cursor-pointer">
                  Live
                </button>
                <button
                  disabled={reviewPly === null || reviewPly >= gameState.moveHistory.length - 1}
                  onClick={() => {
                    if (reviewPly === null) return;
                    if (reviewPly >= gameState.moveHistory.length - 1) setReviewPly(null);
                    else setReviewPly(reviewPly + 1);
                  }}
                  className="flex-1 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-[10px] font-bold uppercase cursor-pointer">
                  Next ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==========================================
       * MOBILE MOVE ANALYSIS MODAL DRAWER
       * ========================================== */}
      {showMobileHistory && (
        <div className="fixed inset-0 z-50 overflow-y-auto touch-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-zinc-800 p-5 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  Move History & Analysis
                </h3>
                <button
                  onClick={() => setShowMobileHistory(false)}
                  className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold text-xs cursor-pointer touch-manipulation">
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
                {gameState.moveHistory.length === 0 ? (
                  <p className="text-zinc-500 italic text-center py-8">
                    No moves made yet. Flank a disc to begin analysis.
                  </p>
                ) : (
                  gameState.moveHistory.map((rec, idx) => {
                    const isSelected = reviewPly === idx;
                    const isBlack = rec.player === 'B';
                    const qualityColor =
                      rec.quality === 'Brilliant'
                        ? 'text-cyan-300 bg-cyan-950/70 border-cyan-500/50'
                        : rec.quality === 'Best'
                          ? 'text-emerald-300 bg-emerald-950/70 border-emerald-500/50'
                          : rec.quality === 'Good'
                            ? 'text-blue-300 bg-blue-950/70 border-blue-500/50'
                            : rec.quality === 'Inaccuracy'
                              ? 'text-yellow-300 bg-yellow-950/70 border-yellow-500/50'
                              : rec.quality === 'Mistake'
                                ? 'text-orange-300 bg-orange-950/70 border-orange-500/50'
                                : 'text-red-300 bg-red-950/70 border-red-500/50';

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setReviewPly(isSelected ? null : idx);
                          setShowMobileHistory(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer min-h-[44px] touch-manipulation ${
                          isSelected
                            ? 'bg-zinc-700/80 border-cyan-400 text-white'
                            : 'bg-zinc-800/50 border-zinc-800 text-zinc-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-zinc-500">{rec.ply}.</span>
                          <span
                            className={`w-3 h-3 rounded-full inline-block ${
                              isBlack ? 'bg-black border border-zinc-500' : 'bg-white border border-zinc-300'
                            }`}
                          />
                          <span className="font-mono font-bold text-sm">{rec.notation}</span>
                          {rec.isCorner && <span>👑</span>}
                        </div>
                        {rec.quality && (
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${qualityColor}`}>
                            {rec.quality === 'Brilliant' ? '✦ Brilliant' : rec.quality}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex gap-2">
                <button
                  onClick={() => {
                    setReviewPly(null);
                    setShowMobileHistory(false);
                  }}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase rounded-xl text-xs tracking-wider cursor-pointer min-h-[44px] touch-manipulation">
                  Live View
                </button>
                <button
                  onClick={() => setShowMobileHistory(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold uppercase rounded-xl text-xs tracking-wider cursor-pointer min-h-[44px] touch-manipulation">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
       * 3. START / BOOT HUB (Game Mode Selection)
       * ========================================== */}
      {appScreen === 'BOOT' && (
        <div className="fixed inset-0 z-50 overflow-y-auto touch-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-emerald-500/40 p-6 md:p-8 rounded-2xl w-full max-w-lg text-center shadow-2xl space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 mb-2 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1 rounded-full text-xs font-bold text-emerald-400 uppercase tracking-widest">
                <span>✦</span> Tactical Grid Engine <span>✦</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-wider uppercase text-emerald-400">
                {getConfig('title')}
              </h1>
              <p className="text-xs text-zinc-400 tracking-wider uppercase mt-1">
                Strategic Discs • Move Evaluation • Ranked Bots
              </p>
            </div>

            {/* Play Modes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
              {/* Quick Match / Online Lobby */}
              <button
                onClick={() => {
                  setSelectedMode('MULTIPLAYER');
                  setAppScreen('LOBBY');
                  playSfx('confirm');
                }}
                className="p-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-emerald-500/40 hover:border-emerald-400 transition-all active:scale-95 cursor-pointer flex flex-col justify-between group touch-manipulation min-h-[110px]">
                <div>
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    🌐
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Multiplayer Lobby
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    Host or join 1v1 tournament matches with automatic spectator rotation.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase mt-3">
                  Play Tournament →
                </span>
              </button>

              {/* Bot Match: Scout (600) */}
              <button
                onClick={() => startOfflineMatch('BOT', 'Scout')}
                className="p-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-amber-500/40 hover:border-amber-400 transition-all active:scale-95 cursor-pointer flex flex-col justify-between group touch-manipulation min-h-[110px]">
                <div>
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    🤖
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Novice Bot 'Scout'
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    Rating 600. Aggressive piece hunter, susceptible to corner traps.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase mt-3">
                  Play Novice (600) →
                </span>
              </button>

              {/* Bot Match: Bishop (1200) */}
              <button
                onClick={() => startOfflineMatch('BOT', 'Bishop')}
                className="p-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-purple-500/40 hover:border-purple-400 transition-all active:scale-95 cursor-pointer flex flex-col justify-between group touch-manipulation min-h-[110px]">
                <div>
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    🔮
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Tactical Bot 'Bishop'
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    Rating 1200. Positional strategy, protects corners and edges.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-purple-400 font-bold uppercase mt-3">
                  Play Tactical (1200) →
                </span>
              </button>

              {/* Bot Match: Grandmaster Ada (1800) */}
              <button
                onClick={() => startOfflineMatch('BOT', 'Grandmaster Ada')}
                className="p-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-cyan-500/40 hover:border-cyan-400 transition-all active:scale-95 cursor-pointer flex flex-col justify-between group touch-manipulation min-h-[110px]">
                <div>
                  <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">
                    👑
                  </div>
                  <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-wide">
                    Master 'Grandmaster Ada'
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                    Rating 1800. Minimax search with frontier mobility starvation.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase mt-3">
                  Play Grandmaster (1800) →
                </span>
              </button>
            </div>

            {/* Pass and Play Button */}
            <button
              onClick={() => startOfflineMatch('LOCAL')}
              className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-200 transition-all active:scale-95 cursor-pointer min-h-[48px] touch-manipulation">
              👥 Local Pass & Play (Same Device)
            </button>
          </div>
        </div>
      </div>
      )}

      {/* ==========================================
       * LEAVE / EXIT MATCH CONFIRMATION MODAL (Android Back Key Trap)
       * ========================================== */}
      {showExitMatchModal && (
        <div className="fixed inset-0 z-[70] overflow-y-auto touch-auto bg-black/90 backdrop-blur-md animate-in fade-in duration-150">
          <div className="min-h-full flex flex-col items-center p-4">
            <div className="m-auto bg-zinc-900 border border-amber-600/60 p-6 rounded-2xl w-full max-w-sm text-center shadow-2xl space-y-4">
              <div className="text-3xl">⚠️</div>
              <h3 className="text-xl font-bold text-amber-400 uppercase tracking-wide">
                Leave Active Match?
              </h3>
              <p className="text-xs text-zinc-300">
                {gameState.gameMode === 'MULTIPLAYER'
                  ? 'Leaving now will forfeit this match round and rotate you to the spectator queue.'
                  : 'Are you sure you want to exit your active game? Any unsaved progress will be lost.'}
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExitMatchModal(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold uppercase rounded-xl text-xs tracking-wider transition-all cursor-pointer min-h-[44px] touch-manipulation">
                  Resume Match
                </button>
                <button
                  onClick={() => {
                    setShowExitMatchModal(false);
                    if (gameState.gameMode === 'MULTIPLAYER') {
                      handleForfeit();
                    } else {
                      setAppScreen('BOOT');
                    }
                  }}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-black font-black uppercase rounded-xl text-xs tracking-wider transition-all cursor-pointer min-h-[44px] touch-manipulation">
                  Leave Match
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
       * 4. MULTIPLAYER OVERLAYS & MODALS
       * ========================================== */}
      <MultiplayerOverlays
        appScreen={appScreen}
        gameState={gameState}
        players={players}
        myPlayerId={myPlayerId}
        isHost={isHost}
        networkStatus={networkStatus}
        customRounds={customRounds}
        defaultRounds={getDefaultRounds()}
        onSetCustomRounds={setCustomRounds}
        onCommenceTournament={commenceTournament}
        onStartNextRound={startNextRound}
        onRestartTournament={restartTournament}
        onReturnToLobby={returnToLobby}
        onEndLobby={endLobby}
        onForfeit={handleForfeit}
        getPlayerName={getPlayerName}
        showDebugHud={showDebugHud}
        setShowDebugHud={setShowDebugHud}
        showInGameMenu={showInGameMenu}
        setShowInGameMenu={setShowInGameMenu}
        showHowToPlay={showHowToPlay}
        setShowHowToPlay={setShowHowToPlay}
        showForfeitModal={showForfeitModal}
        setShowForfeitModal={setShowForfeitModal}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        gameTitle={getConfig('title') as string}
        subtitle="Tactical Disc Flipping Tournament"
        isMusicMuted={isMusicMuted}
        onToggleMusic={() => setIsMusicMuted((prev) => !prev)}
        isSfxMuted={isSfxMuted}
        onToggleSfx={() => {
          const next = gameAudio.toggleMute();
          setIsSfxMuted(next);
        }}
        howToPlayRules={[
          "Reversi is played on an 8x8 grid. Obsidian Black moves first, followed by Pearl Ivory White.",
          "Flanking Capture: Place a disc on an empty square to trap one or more opposing discs between your newly placed disc and another friendly disc along orthogonal or diagonal rays.",
          "All flanked discs flip to your color with a domino wave.",
          "Corner Anchors: The four corner squares cannot be flipped once captured, providing permanent strategic leverage.",
          "Danger Squares: X-squares and C-squares adjacent to unowned corners are volatile traps that allow your opponent to claim the corner.",
          "Evaluation Bar: The side gauge evaluates real-time positional control, mobility delta, and piece balance.",
          "Pass & Terminal: If you have no legal moves, you must pass. The game ends when both players pass or all 64 squares are filled.",
        ]}
      />
    </div>
  );
}
