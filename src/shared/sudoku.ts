import { Difficulty } from './types';

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; clues: number; baseXp: number; multiplier: number; description: string }
> = {
  easy: {
    label: 'Easy',
    clues: 44,
    baseXp: 80,
    multiplier: 1,
    description: 'Gentle warm-up with 44 clues.',
  },
  medium: {
    label: 'Medium',
    clues: 35,
    baseXp: 140,
    multiplier: 1.5,
    description: 'Balanced latte-pace logic with 35 clues.',
  },
  hard: {
    label: 'Hard',
    clues: 28,
    baseXp: 220,
    multiplier: 2.2,
    description: 'Rich dark roast challenge with 28 clues.',
  },
  expert: {
    label: 'Expert',
    clues: 23,
    baseXp: 340,
    multiplier: 3,
    description: 'Master-level 23-clue precision puzzle.',
  },
};

export function createEmptyBoard(): number[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function createEmptyNotes(): number[][][] {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
}

export function cloneBoard(board: number[][]): number[][] {
  return board.map((row) => [...row]);
}

export function cloneNotes(notes: number[][][]): number[][][] {
  return notes.map((row) => row.map((cell) => [...cell]));
}

// Seeded PRNG (mulberry32) so Daily Challenge is deterministic per date string
export function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function isValidPlacement(board: number[][], row: number, col: number, num: number): boolean {
  for (let c = 0; c < 9; c++) {
    if (c !== col && board[row][c] === num) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (r !== row && board[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && board[r][c] === num) return false;
    }
  }
  return true;
}

function fillBoard(board: number[][], rng: () => number): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const nums = shuffleWithRng([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
        for (const n of nums) {
          if (isValidPlacement(board, r, c, n)) {
            board[r][c] = n;
            if (fillBoard(board, rng)) return true;
            board[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board: number[][], limit = 2): number {
  let bestRow = -1;
  let bestCol = -1;
  let bestCandidates: number[] | null = null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const candidates: number[] = [];
        for (let n = 1; n <= 9; n++) {
          if (isValidPlacement(board, r, c, n)) {
            candidates.push(n);
          }
        }
        if (candidates.length === 0) return 0;
        if (!bestCandidates || candidates.length < bestCandidates.length) {
          bestRow = r;
          bestCol = c;
          bestCandidates = candidates;
          if (candidates.length === 1) break;
        }
      }
    }
    if (bestCandidates && bestCandidates.length === 1) break;
  }

  if (bestRow === -1 || !bestCandidates) {
    return 1;
  }

  let total = 0;
  for (const n of bestCandidates) {
    board[bestRow][bestCol] = n;
    total += countSolutions(board, limit);
    board[bestRow][bestCol] = 0;
    if (total >= limit) return total;
  }
  return total;
}

export function generateSudoku(
  difficulty: Difficulty,
  seedString?: string
): { puzzle: number[][]; solution: number[][] } {
  const rng = seedString ? createSeededRng(hashStringToSeed(seedString)) : Math.random;
  const solution = createEmptyBoard();
  fillBoard(solution, rng);

  const puzzle = cloneBoard(solution);
  const targetClues = DIFFICULTY_CONFIG[difficulty].clues;
  const positions = shuffleWithRng(
    Array.from({ length: 81 }, (_, idx) => [Math.floor(idx / 9), idx % 9] as [number, number]),
    rng
  );

  let remainingClues = 81;
  for (const [r, c] of positions) {
    if (remainingClues <= targetClues) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;

    // Ensure unique solution
    const testBoard = cloneBoard(puzzle);
    if (countSolutions(testBoard, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      remainingClues--;
    }
  }

  return { puzzle, solution };
}

export function computeCellCandidates(board: number[][], row: number, col: number): number[] {
  if (board[row][col] !== 0) return [];
  const candidates: number[] = [];
  for (let n = 1; n <= 9; n++) {
    if (isValidPlacement(board, row, col, n)) {
      candidates.push(n);
    }
  }
  return candidates;
}

export function computeAllCandidates(board: number[][]): number[][][] {
  const result = createEmptyNotes();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        result[r][c] = computeCellCandidates(board, r, c);
      }
    }
  }
  return result;
}

export function isBoardSolved(board: number[][], solution: number[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}

export function getRemainingNumberCounts(board: number[][], solution?: number[][]): Record<number, number> {
  const counts: Record<number, number> = {
    1: 9,
    2: 9,
    3: 9,
    4: 9,
    5: 9,
    6: 9,
    7: 9,
    8: 9,
    9: 9,
  };
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = board[r][c];
      if (val >= 1 && val <= 9) {
        if (!solution || solution[r][c] === val) {
          counts[val] = Math.max(0, counts[val] - 1);
        }
      }
    }
  }
  return counts;
}

export function getProgressStats(puzzle: number[][], board: number[][], solution: number[][]): {
  filledCorrect: number;
  totalToFill: number;
  percent: number;
} {
  let filledCorrect = 0;
  let totalToFill = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (puzzle[r][c] === 0) {
        totalToFill++;
        if (board[r][c] === solution[r][c]) {
          filledCorrect++;
        }
      }
    }
  }
  return {
    filledCorrect,
    totalToFill,
    percent: totalToFill === 0 ? 100 : Math.round((filledCorrect / totalToFill) * 100),
  };
}
