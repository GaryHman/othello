/**
 * Reversi Tactics Core Game Logic & AI Engine
 * Independent pure functions for 8x8 Othello/Reversi board mechanics,
 * move validation, positional evaluation, and AI bot personalities.
 */

export type DiscColor = 'B' | 'W';
export type BoardCell = DiscColor | null;
export type Board = BoardCell[][];

export interface MoveCoord {
  r: number;
  c: number;
}

export interface ValidMove extends MoveCoord {
  flippable: MoveCoord[];
}

export type MoveQuality = 'Brilliant' | 'Best' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder';

export interface MoveRecord {
  ply: number;
  player: DiscColor;
  coord: MoveCoord | null; // null represents pass
  notation: string;
  flippedCount: number;
  evalAfter: number; // -100 to 100 advantage
  quality?: MoveQuality;
  isCorner?: boolean;
}

// 8 Directions (orthogonal & diagonal)
export const DIRECTIONS: [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

// Strategic positional matrix
export const SQUARE_WEIGHTS: number[][] = [
  [ 120, -25,  15,   5,   5,  15, -25, 120],
  [ -25, -45,  -5,  -5,  -5,  -5, -45, -25],
  [  15,  -5,   3,   2,   2,   3,  -5,  15],
  [   5,  -5,   2,   1,   1,   2,  -5,   5],
  [   5,  -5,   2,   1,   1,   2,  -5,   5],
  [  15,  -5,   3,   2,   2,   3,  -5,  15],
  [ -25, -45,  -5,  -5,  -5,  -5, -45, -25],
  [ 120, -25,  15,   5,   5,  15, -25, 120],
];

export const CORNERS: MoveCoord[] = [
  {r: 0, c: 0}, {r: 0, c: 7},
  {r: 7, c: 0}, {r: 7, c: 7},
];

export const X_SQUARES: {corner: MoveCoord; xSquare: MoveCoord}[] = [
  {corner: {r: 0, c: 0}, xSquare: {r: 1, c: 1}},
  {corner: {r: 0, c: 7}, xSquare: {r: 1, c: 6}},
  {corner: {r: 7, c: 0}, xSquare: {r: 6, c: 1}},
  {corner: {r: 7, c: 7}, xSquare: {r: 6, c: 6}},
];

/** Creates standard initial 8x8 Reversi board */
export function createInitialBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  board[3][3] = 'W';
  board[3][4] = 'B';
  board[4][3] = 'B';
  board[4][4] = 'W';
  return board;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function getOpponent(color: DiscColor): DiscColor {
  return color === 'B' ? 'W' : 'B';
}

export function isInside(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

/** Returns list of opponent discs trapped and flippable by placing a disc at (r, c) */
export function getFlippableDiscs(board: Board, r: number, c: number, color: DiscColor): MoveCoord[] {
  if (!isInside(r, c) || board[r][c] !== null) return [];

  const opponent = getOpponent(color);
  const flippable: MoveCoord[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    let currR = r + dr;
    let currC = c + dc;
    const line: MoveCoord[] = [];

    while (isInside(currR, currC) && board[currR][currC] === opponent) {
      line.push({r: currR, c: currC});
      currR += dr;
      currC += dc;
    }

    if (line.length > 0 && isInside(currR, currC) && board[currR][currC] === color) {
      flippable.push(...line);
    }
  }

  return flippable;
}

/** Calculates all legal moves for given player */
export function getValidMoves(board: Board, color: DiscColor): ValidMove[] {
  const validMoves: ValidMove[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === null) {
        const flippable = getFlippableDiscs(board, r, c, color);
        if (flippable.length > 0) {
          validMoves.push({r, c, flippable});
        }
      }
    }
  }
  return validMoves;
}

/** Executes move on board copy, flipping discs */
export function applyMove(board: Board, r: number, c: number, color: DiscColor): {nextBoard: Board; flipped: MoveCoord[]} {
  const nextBoard = cloneBoard(board);
  const flippable = getFlippableDiscs(board, r, c, color);
  if (flippable.length === 0) return {nextBoard, flipped: []};

  nextBoard[r][c] = color;
  for (const f of flippable) {
    nextBoard[f.r][f.c] = color;
  }
  return {nextBoard, flipped: flippable};
}

/** Counts total pieces for both sides */
export function countDiscs(board: Board): {B: number; W: number; empty: number} {
  let B = 0;
  let W = 0;
  let empty = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === 'B') B++;
      else if (board[r][c] === 'W') W++;
      else empty++;
    }
  }
  return {B, W, empty};
}

/** Checks whether coordinate is a corner */
export function isCornerCoord(r: number, c: number): boolean {
  return (r === 0 || r === 7) && (c === 0 || c === 7);
}

/** Checks whether coordinate is an X-square adjacent to open corner */
export function isUnsafeXSquare(board: Board, r: number, c: number): boolean {
  for (const item of X_SQUARES) {
    if (item.xSquare.r === r && item.xSquare.c === c) {
      return board[item.corner.r][item.corner.c] === null;
    }
  }
  return false;
}

/** Converts (row, col) to standard coordinate string like 'E4' */
export function coordToNotation(r: number, c: number): string {
  const colLetter = String.fromCharCode(65 + c);
  const rowNumber = r + 1;
  return `${colLetter}${rowNumber}`;
}

/**
 * Tactical evaluation of board equity (-100 for White winning to +100 for Black winning).
 * Incorporates positional weights, mobility, corner leverage, and endgame parity.
 */
export function evaluateBoard(board: Board): number {
  const {B, W, empty} = countDiscs(board);
  if (empty === 0 || (getValidMoves(board, 'B').length === 0 && getValidMoves(board, 'W').length === 0)) {
    if (B > W) return 100;
    if (W > B) return -100;
    return 0;
  }

  let positionalScore = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      let weight = SQUARE_WEIGHTS[r][c];

      // Dynamic adjustment: If corner is owned, adjacent X and C squares are safe
      for (const item of X_SQUARES) {
        if (item.xSquare.r === r && item.xSquare.c === c && board[item.corner.r][item.corner.c] === piece) {
          weight = 25; // Safe stable territory
        }
      }

      if (piece === 'B') positionalScore += weight;
      else positionalScore -= weight;
    }
  }

  // Mobility (number of moves available)
  const bMoves = getValidMoves(board, 'B').length;
  const wMoves = getValidMoves(board, 'W').length;
  const mobilityDiff = bMoves + wMoves > 0 ? (bMoves - wMoves) * 8 : 0;

  // Corner control
  let bCorners = 0;
  let wCorners = 0;
  for (const cor of CORNERS) {
    if (board[cor.r][cor.c] === 'B') bCorners++;
    else if (board[cor.r][cor.c] === 'W') wCorners++;
  }
  const cornerDiff = (bCorners - wCorners) * 35;

  // Endgame piece parity emphasis
  const discParity = empty < 15 ? (B - W) * 4 : (B - W) * 0.5;

  const totalRaw = positionalScore * 0.8 + mobilityDiff + cornerDiff + discParity;
  // Normalized sigmoid curve mapped to [-100, 100]
  const evalScaled = Math.tanh(totalRaw / 120) * 100;
  return Math.round(evalScaled);
}

/** Determines move quality compared to engine optimal move */
export function assessMoveQuality(
  boardBefore: Board,
  color: DiscColor,
  playedMove: MoveCoord,
  evalBefore: number,
  evalAfter: number
): MoveQuality {
  const valid = getValidMoves(boardBefore, color);
  if (valid.length <= 1) return 'Best';

  if (isCornerCoord(playedMove.r, playedMove.c)) {
    return 'Brilliant';
  }

  // Find best possible next eval from candidate moves
  let bestNextEval = color === 'B' ? -999 : 999;
  for (const vm of valid) {
    const {nextBoard} = applyMove(boardBefore, vm.r, vm.c, color);
    const ev = evaluateBoard(nextBoard);
    if (color === 'B' && ev > bestNextEval) bestNextEval = ev;
    else if (color === 'W' && ev < bestNextEval) bestNextEval = ev;
  }

  const delta = color === 'B' ? bestNextEval - evalAfter : evalAfter - bestNextEval;

  if (delta <= 2) {
    return isCornerCoord(playedMove.r, playedMove.c) ? 'Brilliant' : 'Best';
  }
  if (delta <= 10) return 'Good';
  if (delta <= 24) return 'Inaccuracy';
  if (delta <= 45) return 'Mistake';
  return 'Blunder';
}

/** AI Bot Algorithms */
export type BotPersonality = 'Scout' | 'Bishop' | 'Grandmaster Ada';

/** Scout (Rating 600): Aggressive for immediate flips, ignores corner traps */
function getBotMoveScout(board: Board, color: DiscColor): MoveCoord | null {
  const moves = getValidMoves(board, color);
  if (moves.length === 0) return null;

  // Sort by flip count, with slight randomness
  moves.sort((a, b) => b.flippable.length - a.flippable.length);
  // Pick from top 2
  const pick = Math.random() < 0.8 ? moves[0] : moves[Math.min(1, moves.length - 1)];
  return {r: pick.r, c: pick.c};
}

/** Bishop (Rating 1200): Positional evaluator, prioritizes edges, avoids X-squares */
function getBotMoveBishop(board: Board, color: DiscColor): MoveCoord | null {
  const moves = getValidMoves(board, color);
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    const {nextBoard} = applyMove(board, m.r, m.c, color);
    let score = SQUARE_WEIGHTS[m.r][m.c] * 2 + m.flippable.length;

    if (isCornerCoord(m.r, m.c)) score += 200;
    if (isUnsafeXSquare(board, m.r, m.c)) score -= 150;

    // Favor restricting opponent mobility
    const oppMoves = getValidMoves(nextBoard, getOpponent(color)).length;
    score -= oppMoves * 5;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }

  return {r: bestMove.r, c: bestMove.c};
}

/** Grandmaster Ada (Rating 1800): Minimax with Alpha-Beta pruning & endgame search */
function getBotMoveGrandmaster(board: Board, color: DiscColor): MoveCoord | null {
  const moves = getValidMoves(board, color);
  if (moves.length === 0) return null;

  // Immediate corner capture
  const cornerMove = moves.find((m) => isCornerCoord(m.r, m.c));
  if (cornerMove) return {r: cornerMove.r, c: cornerMove.c};

  const emptyCells = countDiscs(board).empty;
  const searchDepth = emptyCells <= 8 ? 6 : emptyCells <= 12 ? 4 : 3;

  function minimax(
    b: Board,
    currColor: DiscColor,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): number {
    const currentMoves = getValidMoves(b, currColor);
    if (depth === 0 || currentMoves.length === 0) {
      return evaluateBoard(b);
    }

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of currentMoves) {
        const {nextBoard} = applyMove(b, move.r, move.c, currColor);
        const ev = minimax(nextBoard, getOpponent(currColor), depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of currentMoves) {
        const {nextBoard} = applyMove(b, move.r, move.c, currColor);
        const ev = minimax(nextBoard, getOpponent(currColor), depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  let bestMove = moves[0];
  const isBlack = color === 'B';
  let bestEval = isBlack ? -Infinity : Infinity;

  for (const move of moves) {
    const {nextBoard} = applyMove(board, move.r, move.c, color);
    const ev = minimax(nextBoard, getOpponent(color), searchDepth - 1, -Infinity, Infinity, !isBlack);

    if (isBlack) {
      if (ev > bestEval) {
        bestEval = ev;
        bestMove = move;
      }
    } else {
      if (ev < bestEval) {
        bestEval = ev;
        bestMove = move;
      }
    }
  }

  return {r: bestMove.r, c: bestMove.c};
}

export function calculateBotMove(board: Board, color: DiscColor, personality: BotPersonality): MoveCoord | null {
  if (personality === 'Scout') return getBotMoveScout(board, color);
  if (personality === 'Bishop') return getBotMoveBishop(board, color);
  return getBotMoveGrandmaster(board, color);
}
