import {MusicTrack, SpriteConfig} from './utils/helper';

/**
 * The ID of the game.
 */
export const GAME_ID = 'playground_multiplayer_game';

/**
 * Configuration values for the game adhering to html-constants-schema.
 */
export const CONFIG = {
  // --- Game Info ---
  title: {
    value: 'Reversi Tactics',
    type: 'string',
    label: 'Game Title',
    group: 'Game',
  },
  width: {
    value: 1024,
    type: 'number',
    label: 'Width',
    group: 'System',
  },
  height: {
    value: 720,
    type: 'number',
    label: 'Height',
    group: 'System',
  },
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'System',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'System',
  },
  maxSubSteps: {
    value: 2,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'System',
  },
  syncIntervalMs: {
    value: 1000 / 30,
    type: 'number',
    label: 'Network Sync Interval MS',
    group: 'System',
  },
  inputSyncIntervalMs: {
    value: 1000 / 30,
    type: 'number',
    label: 'Input Sync Interval MS',
    group: 'System',
  },

  // --- Visuals & Theme ---
  backgroundColor: {
    value: '#111827',
    type: 'color',
    label: 'Background Color',
    group: 'Visuals',
  },
  textColor: {
    value: '#f8fafc',
    type: 'color',
    label: 'Text Color',
    group: 'Visuals',
  },
  primaryColor: {
    value: '#059669',
    type: 'color',
    label: 'Felt Green Board Color',
    group: 'Visuals',
  },
  secondaryColor: {
    value: '#e2e8f0',
    type: 'color',
    label: 'Pearl Ivory Color',
    group: 'Visuals',
  },
  accentColor: {
    value: '#f59e0b',
    type: 'color',
    label: 'Gold Tactical Accent',
    group: 'Visuals',
  },
  fontFamily: {
    value: 'system-ui, -apple-system, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'Visuals',
  },
  playerSprite: {
    value: undefined as SpriteConfig | undefined,
    type: 'sprite',
    label: 'Player Sprite',
    group: 'Visuals',
  },

  // --- Audio ---
  backgroundMusicUrl: {
    value: 'assets/audio/bgm_tactical_match.mp3',
    type: 'string',
    label: 'Background Music URL',
    group: 'Audio',
  },
  defaultMusicVolume: {
    value: 0.25,
    type: 'number',
    label: 'Default Music Volume',
    group: 'Audio',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'Audio',
  },

  // --- Tournament & Multiplayer ---
  tournamentRounds: {
    value: 3,
    type: 'number',
    label: 'Tournament Rounds',
    group: 'Tournament',
  },
  maxPlayers: {
    value: 4,
    type: 'number',
    label: 'Max Lobby Players',
    group: 'Tournament',
  },
  activePlayersCount: {
    value: 2, // Head-to-head 1v1 Reversi
    type: 'number',
    label: 'Active Players Per Match',
    group: 'Tournament',
  },

  // --- Game Rules & Tuning ---
  boardSize: {
    value: 8,
    type: 'number',
    label: 'Board Grid Dimension',
    group: 'Rules',
  },
  turnTimerSeconds: {
    value: 60,
    type: 'number',
    label: 'Turn Timer Seconds',
    group: 'Rules',
    min: 15,
    max: 180,
    step: 5,
  },
  enableHints: {
    value: true,
    type: 'boolean',
    label: 'Show Tactical Hints & Flank Preview',
    group: 'Rules',
  },
  colorblindMode: {
    value: false,
    type: 'boolean',
    label: 'Colorblind Disc Glyphs',
    group: 'Rules',
  },
  showEvalBar: {
    value: true,
    type: 'boolean',
    label: 'Display Live Advantage Bar',
    group: 'Rules',
  },
  autoPass: {
    value: true,
    type: 'boolean',
    label: 'Auto Pass Turn When No Moves',
    group: 'Rules',
  },
  flipAnimDurationMs: {
    value: 320,
    type: 'number',
    label: 'Disc Flip Animation Duration MS',
    group: 'Rules',
  },

  // --- Assets Metadata & Dimensions ---
  assetReversiBoardFeltAspectRatio: {
    value: 782 / 785,
    type: 'number',
    label: 'Reversi Board Aspect Ratio',
    group: 'ASSETS',
  },
  assetReversiBoardFeltWidth: {
    value: 782,
    type: 'number',
    label: 'Reversi Board Width',
    group: 'ASSETS',
  },
  assetReversiBoardFeltHeight: {
    value: 785,
    type: 'number',
    label: 'Reversi Board Height',
    group: 'ASSETS',
  },

  assetDiscBlackGlossAspectRatio: {
    value: 909 / 908,
    type: 'number',
    label: 'Black Disc Aspect Ratio',
    group: 'ASSETS',
  },
  assetDiscBlackGlossWidth: {
    value: 909,
    type: 'number',
    label: 'Black Disc Width',
    group: 'ASSETS',
  },
  assetDiscBlackGlossHeight: {
    value: 908,
    type: 'number',
    label: 'Black Disc Height',
    group: 'ASSETS',
  },

  assetDiscWhiteIvoryAspectRatio: {
    value: 858 / 858,
    type: 'number',
    label: 'White Disc Aspect Ratio',
    group: 'ASSETS',
  },
  assetDiscWhiteIvoryWidth: {
    value: 858,
    type: 'number',
    label: 'White Disc Width',
    group: 'ASSETS',
  },
  assetDiscWhiteIvoryHeight: {
    value: 858,
    type: 'number',
    label: 'White Disc Height',
    group: 'ASSETS',
  },

  assetTabletopBgAspectRatio: {
    value: 1376 / 768,
    type: 'number',
    label: 'Tabletop Background Aspect Ratio',
    group: 'ASSETS',
  },
  assetTabletopBgWidth: {
    value: 1376,
    type: 'number',
    label: 'Tabletop Background Width',
    group: 'ASSETS',
  },
  assetTabletopBgHeight: {
    value: 768,
    type: 'number',
    label: 'Tabletop Background Height',
    group: 'ASSETS',
  },

  assetAvatarBotScoutAspectRatio: {
    value: 730 / 730,
    type: 'number',
    label: 'Bot Scout Aspect Ratio',
    group: 'ASSETS',
  },
  assetAvatarBotScoutWidth: {
    value: 730,
    type: 'number',
    label: 'Bot Scout Width',
    group: 'ASSETS',
  },
  assetAvatarBotScoutHeight: {
    value: 730,
    type: 'number',
    label: 'Bot Scout Height',
    group: 'ASSETS',
  },

  assetAvatarBotBishopAspectRatio: {
    value: 630 / 636,
    type: 'number',
    label: 'Bot Bishop Aspect Ratio',
    group: 'ASSETS',
  },
  assetAvatarBotBishopWidth: {
    value: 630,
    type: 'number',
    label: 'Bot Bishop Width',
    group: 'ASSETS',
  },
  assetAvatarBotBishopHeight: {
    value: 636,
    type: 'number',
    label: 'Bot Bishop Height',
    group: 'ASSETS',
  },

  assetAvatarBotGrandmasterAspectRatio: {
    value: 733 / 731,
    type: 'number',
    label: 'Bot Grandmaster Aspect Ratio',
    group: 'ASSETS',
  },
  assetAvatarBotGrandmasterWidth: {
    value: 733,
    type: 'number',
    label: 'Bot Grandmaster Width',
    group: 'ASSETS',
  },
  assetAvatarBotGrandmasterHeight: {
    value: 731,
    type: 'number',
    label: 'Bot Grandmaster Height',
    group: 'ASSETS',
  },

  assetAvatarPlayerDefaultAspectRatio: {
    value: 726 / 726,
    type: 'number',
    label: 'Player Default Avatar Aspect Ratio',
    group: 'ASSETS',
  },
  assetAvatarPlayerDefaultWidth: {
    value: 726,
    type: 'number',
    label: 'Player Default Avatar Width',
    group: 'ASSETS',
  },
  assetAvatarPlayerDefaultHeight: {
    value: 726,
    type: 'number',
    label: 'Player Default Avatar Height',
    group: 'ASSETS',
  },

  assetIconMoveEvaluationAspectRatio: {
    value: 811 / 813,
    type: 'number',
    label: 'Accuracy Badge Aspect Ratio',
    group: 'ASSETS',
  },
  assetIconMoveEvaluationWidth: {
    value: 811,
    type: 'number',
    label: 'Accuracy Badge Width',
    group: 'ASSETS',
  },
  assetIconMoveEvaluationHeight: {
    value: 813,
    type: 'number',
    label: 'Accuracy Badge Height',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
if (playgroundConfig) {
  for (const [key, value] of Object.entries(playgroundConfig)) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/** Type helper for reading values in game code. */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

/**
 * Optional presets for the game.
 */
export const PRESETS = {};

/** Background music tracks available for the game to use. */
export const AVAILABLE_MUSIC_TRACKS: MusicTrack[] = [
  {
    name: 'bgm_tactical_match',
    url: 'assets/audio/bgm_tactical_match.mp3',
    description: 'Pensive tactical lounge ambient theme.',
  },
];
