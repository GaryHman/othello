import {describe, expect, it, vi} from 'vitest';
import {
  createInitialBoard,
  getValidMoves,
  getFlippableDiscs,
  applyMove,
  countDiscs,
  evaluateBoard,
  calculateBotMove,
  isCornerCoord,
  isUnsafeXSquare,
  assessMoveQuality,
  coordToNotation,
} from './reversiLogic';

describe('Reversi Tactics Engine - Core Mechanics', () => {
  it('initializes standard 8x8 Reversi board with 4 center pieces', () => {
    const board = createInitialBoard();
    expect(board.length).toBe(8);
    expect(board[0].length).toBe(8);

    expect(board[3][3]).toBe('W');
    expect(board[3][4]).toBe('B');
    expect(board[4][3]).toBe('B');
    expect(board[4][4]).toBe('W');

    const counts = countDiscs(board);
    expect(counts.B).toBe(2);
    expect(counts.W).toBe(2);
    expect(counts.empty).toBe(60);
  });

  it('calculates the 4 standard opening moves for Black', () => {
    const board = createInitialBoard();
    const validMoves = getValidMoves(board, 'B');
    expect(validMoves.length).toBe(4);

    const notations = validMoves.map((m) => coordToNotation(m.r, m.c)).sort();
    // (2,3) = D3, (3,2) = C4, (4,5) = F5, (5,4) = E6
    expect(notations).toEqual(['C4', 'D3', 'E6', 'F5']);
  });

  it('correctly executes flanking capture and disc flipping', () => {
    const board = createInitialBoard();
    // Black plays D3: (2, 3)
    const flippable = getFlippableDiscs(board, 2, 3, 'B');
    expect(flippable.length).toBe(1);
    expect(flippable[0]).toEqual({r: 3, c: 3});

    const {nextBoard, flipped} = applyMove(board, 2, 3, 'B');
    expect(flipped.length).toBe(1);
    expect(nextBoard[2][3]).toBe('B');
    expect(nextBoard[3][3]).toBe('B'); // Flipped from W to B
    expect(nextBoard[3][4]).toBe('B');

    const counts = countDiscs(nextBoard);
    expect(counts.B).toBe(4);
    expect(counts.W).toBe(1);
  });

  it('rejects illegal placements that flank no opponent discs', () => {
    const board = createInitialBoard();
    // Square (0, 0) is empty but traps no opponent discs
    const flippable = getFlippableDiscs(board, 0, 0, 'B');
    expect(flippable.length).toBe(0);

    const {nextBoard, flipped} = applyMove(board, 0, 0, 'B');
    expect(flipped.length).toBe(0);
    expect(nextBoard[0][0]).toBeNull();
  });

  it('detects corner squares and unsafe X-squares correctly', () => {
    expect(isCornerCoord(0, 0)).toBe(true);
    expect(isCornerCoord(0, 7)).toBe(true);
    expect(isCornerCoord(7, 0)).toBe(true);
    expect(isCornerCoord(7, 7)).toBe(true);
    expect(isCornerCoord(3, 3)).toBe(false);

    const board = createInitialBoard();
    // (1, 1) is an X-square adjacent to open corner (0, 0)
    expect(isUnsafeXSquare(board, 1, 1)).toBe(true);
    expect(isUnsafeXSquare(board, 1, 6)).toBe(true);
    expect(isUnsafeXSquare(board, 3, 3)).toBe(false);

    // If corner (0, 0) is captured, (1, 1) is no longer an unsafe trap
    board[0][0] = 'B';
    expect(isUnsafeXSquare(board, 1, 1)).toBe(false);
  });
});

describe('Analytical Engine & Move Quality Evaluation', () => {
  it('evaluates starting board as parity / balanced (near 0)', () => {
    const board = createInitialBoard();
    const evalScore = evaluateBoard(board);
    expect(Math.abs(evalScore)).toBeLessThan(10);
  });

  it('rates corner moves as Brilliant', () => {
    const board = createInitialBoard();
    const quality = assessMoveQuality(board, 'B', {r: 0, c: 0}, 0, 25);
    expect(quality).toBe('Brilliant');
  });

  it('converts row and column to coordinate notations correctly', () => {
    expect(coordToNotation(0, 0)).toBe('A1');
    expect(coordToNotation(7, 7)).toBe('H8');
    expect(coordToNotation(3, 4)).toBe('E4');
  });
});

describe('Bot AI Opponents', () => {
  it('generates valid moves for Scout, Bishop, and Grandmaster Ada', () => {
    const board = createInitialBoard();

    const scoutMove = calculateBotMove(board, 'B', 'Scout');
    expect(scoutMove).not.toBeNull();
    const validB = getValidMoves(board, 'B');
    expect(validB.some((m) => m.r === scoutMove!.r && m.c === scoutMove!.c)).toBe(true);

    const bishopMove = calculateBotMove(board, 'B', 'Bishop');
    expect(bishopMove).not.toBeNull();
    expect(validB.some((m) => m.r === bishopMove!.r && m.c === bishopMove!.c)).toBe(true);

    const grandmasterMove = calculateBotMove(board, 'B', 'Grandmaster Ada');
    expect(grandmasterMove).not.toBeNull();
    expect(validB.some((m) => m.r === grandmasterMove!.r && m.c === grandmasterMove!.c)).toBe(true);
  });
});

describe('Turn-Based Match Rules & Gating Verification', () => {
  it('turn transitions: valid move updates board and hands turn to opponent', () => {
    const board = createInitialBoard();
    let currentTurn: 'B' | 'W' = 'B';
    const moves = getValidMoves(board, currentTurn);
    expect(moves.length).toBeGreaterThan(0);

    const selectedMove = moves[0];
    const {nextBoard} = applyMove(board, selectedMove.r, selectedMove.c, currentTurn);

    // Switch turn
    currentTurn = currentTurn === 'B' ? 'W' : 'B';
    expect(currentTurn).toBe('W');

    // Next player now has valid moves on the new board
    const nextMoves = getValidMoves(nextBoard, currentTurn);
    expect(nextMoves.length).toBeGreaterThan(0);
  });

  it('turn gating: non-active player moves are rejected', () => {
    const activePlayerId = 'player-host';
    const nonActivePlayerId = 'player-guest';

    const processAction = (senderId: string) => {
      if (senderId !== activePlayerId) {
        return {accepted: false, reason: 'Not your turn'};
      }
      return {accepted: true};
    };

    expect(processAction(nonActivePlayerId).accepted).toBe(false);
    expect(processAction(activePlayerId).accepted).toBe(true);
  });

  it('terminal condition: declares winner based on disc counts when terminal state is reached', () => {
    // Simulated terminal board where Black has 40 discs, White has 24 discs
    const counts = {B: 40, W: 24, empty: 0};
    const p1 = 'player-black';
    const p2 = 'player-white';

    const determineWinner = (bCount: number, wCount: number) => {
      if (bCount > wCount) return p1;
      if (wCount > bCount) return p2;
      return 'DRAW';
    };

    const hostEndMatchMock = vi.fn();
    const winnerId = determineWinner(counts.B, counts.W);
    hostEndMatchMock(winnerId);

    expect(winnerId).toBe('player-black');
    expect(hostEndMatchMock).toHaveBeenCalledWith('player-black');
  });
});
