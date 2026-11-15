import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Coffee,
  Eraser,
  Lightbulb,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import { CoopCellActor, Difficulty } from '../shared/types';
import {
  cloneBoard,
  cloneNotes,
  computeAllCandidates,
  DIFFICULTY_CONFIG,
  getProgressStats,
  getRemainingNumberCounts,
  isBoardSolved,
} from '../shared/sudoku';
import {
  playButtonClickSound,
  playCorrectSound,
  playEraseSound,
  playMistakeSound,
  playNumberSelectSound,
  playTapSound,
  playToggleSound,
} from '../utils/sound';
import { formatDuration } from './BrandMark';

interface UndoSnapshot {
  board: number[][];
  notes: number[][][];
}

export interface SudokuBoardProps {
  mode: 'solo' | 'daily' | 'coop' | 'race';
  difficulty: Difficulty;
  puzzle: number[][];
  solution?: number[][];
  board: number[][];
  notes: number[][][];
  mistakeCells?: string[];
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
  score: number;
  fastPencilDefault?: boolean;
  isPaused?: boolean;
  readOnly?: boolean;
  coopActors?: Record<string, CoopCellActor>;
  puzzleKey?: string;
  multiplayerMatchHintsLeft?: number;
  accountHintCredits?: number;
  accountPencilCredits?: number;
  fastPencilUnlocked?: boolean;
  onMultiplayerHint?: (row?: number, col?: number) => void;
  onMultiplayerUnlockFastPencil?: () => void;
  onTogglePause?: () => void;
  onNewGame?: (difficulty: Difficulty) => void;
  onLocalStateChange?: (next: {
    board: number[][];
    notes: number[][][];
    mistakes: number;
    hintsUsed: number;
    score: number;
  }) => void;
  onMultiplayerMove?: (row: number, col: number, value: number, isPencil: boolean) => void;
  onSolved?: (finalState: {
    board: number[][];
    mistakes: number;
    hintsUsed: number;
    score: number;
    elapsedSeconds: number;
  }) => void;
}

export function SudokuBoard({
  mode,
  difficulty,
  puzzle,
  solution,
  board,
  notes,
  mistakeCells = [],
  elapsedSeconds,
  mistakes,
  hintsUsed,
  score,
  fastPencilDefault = false,
  isPaused = false,
  readOnly = false,
  coopActors,
  puzzleKey: puzzleKeyProp,
  multiplayerMatchHintsLeft = 3,
  accountHintCredits = 0,
  accountPencilCredits = 0,
  fastPencilUnlocked = false,
  onMultiplayerHint,
  onMultiplayerUnlockFastPencil,
  onTogglePause,
  onNewGame,
  onLocalStateChange,
  onMultiplayerMove,
  onSolved,
}: SudokuBoardProps) {
  const isMultiplayer = mode === 'coop' || mode === 'race';
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [boardCellHighlight, setBoardCellHighlight] = useState(false);
  const [pencilMode, setPencilMode] = useState(false);
  const [fastPencil, setFastPencil] = useState(isMultiplayer ? Boolean(fastPencilUnlocked) : fastPencilDefault);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [showNewGameMenu, setShowNewGameMenu] = useState(false);
  const [errorCellKey, setErrorCellKey] = useState<string | null>(null);
  const [creditNotice, setCreditNotice] = useState<string | null>(null);

  // Track which cells have already awarded score so erasing & re-entering doesn't inflate score
  const scoredCellsRef = useRef<Set<string>>(new Set());

  const mistakeCellSet = useMemo(() => new Set(mistakeCells), [mistakeCells]);
  const puzzleContentKey = useMemo(() => puzzle.map((r) => r.join(',')).join(';'), [puzzle]);
  const effectivePuzzleKey = puzzleKeyProp || puzzleContentKey;
  const totalMultiplayerHints = multiplayerMatchHintsLeft + accountHintCredits;

  // Reset per-puzzle state ONLY when a brand-new puzzle loads (never on WebSocket room:state updates for the same puzzle)
  useEffect(() => {
    setUndoStack([]);
    setSelectedCell(null);
    setSelectedNumber(null);
    setBoardCellHighlight(false);
    setCreditNotice(null);
    if (isMultiplayer) {
      setFastPencil(Boolean(fastPencilUnlocked));
    }
    const initialScored = new Set<string>();
    if (solution) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r][c] === 0 && board[r][c] === solution[r][c] && board[r][c] !== 0) {
            initialScored.add(`${r}-${c}`);
          }
        }
      }
    }
    scoredCellsRef.current = initialScored;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePuzzleKey]);

  const prevFastUnlockedRef = useRef(Boolean(fastPencilUnlocked));
  useEffect(() => {
    if (!isMultiplayer) return;
    if (fastPencilUnlocked && !prevFastUnlockedRef.current) {
      setFastPencil(true);
      setCreditNotice(null);
      playToggleSound(true);
    }
    prevFastUnlockedRef.current = Boolean(fastPencilUnlocked);
  }, [isMultiplayer, fastPencilUnlocked]);

  useEffect(() => {
    if (!creditNotice) return;
    const t = window.setTimeout(() => setCreditNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [creditNotice]);

  // Auto-computed candidates when Fast Pencil is ON
  const autoCandidates = useMemo(() => {
    if (!fastPencil) return null;
    return computeAllCandidates(board);
  }, [fastPencil, board]);

  const remainingCounts = useMemo(() => {
    if (solution) return getRemainingNumberCounts(board, solution);
    const counts: Record<number, number> = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 9, 6: 9, 7: 9, 8: 9, 9: 9 };
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const val = board[r][c];
        if (val >= 1 && val <= 9 && !mistakeCellSet.has(`${r}-${c}`)) {
          counts[val] = Math.max(0, counts[val] - 1);
        }
      }
    }
    return counts;
  }, [board, solution, mistakeCellSet]);

  const progress = useMemo(() => {
    if (solution) return getProgressStats(puzzle, board, solution);
    let filledCorrect = 0;
    let totalToFill = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] === 0) {
          totalToFill++;
          if (board[r][c] !== 0 && !mistakeCellSet.has(`${r}-${c}`)) {
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
  }, [puzzle, board, solution, mistakeCellSet]);

  // Highlight ONLY the currently active number-pad selection (or tapped board cell's digit when pad selection is cleared)
  const activeHighlightDigit = useMemo(() => {
    if (selectedNumber !== null) return selectedNumber;
    if (boardCellHighlight && selectedCell) {
      const [r, c] = selectedCell;
      if (board[r]?.[c] > 0) return board[r][c];
    }
    return null;
  }, [selectedNumber, boardCellHighlight, selectedCell, board]);

  const applyDigitToCell = useCallback(
    (row: number, col: number, digit: number, forcePencil?: boolean) => {
      if (readOnly || isPaused) return;
      // Never modify or overwrite original fixed clues
      if (puzzle[row][col] !== 0) return;

      const usePencil = forcePencil ?? pencilMode;

      if (isMultiplayer && onMultiplayerMove) {
        const isMistakeCell = mistakeCellSet.has(`${row}-${col}`);
        // In multiplayer, prevent overwriting already-correct cells, allow clearing/replacing mistakes
        if (board[row][col] !== 0 && !isMistakeCell && digit !== 0) {
          return;
        }
        // Tapping a user-filled wrong cell again with its same active digit clears it cleanly
        if (!usePencil && digit !== 0 && isMistakeCell && board[row][col] === digit) {
          playEraseSound();
          onMultiplayerMove(row, col, 0, false);
          return;
        }
        if (digit === 0) {
          playEraseSound();
        } else {
          playTapSound();
        }
        onMultiplayerMove(row, col, digit, usePencil);
        return;
      }

      if (!onLocalStateChange || !solution) return;

      const currentVal = board[row][col];

      // Prevent adding manual pencil notes onto an already filled cell (and avoid no-op undo snapshot)
      if (usePencil && digit !== 0 && currentVal !== 0) {
        return;
      }

      // If erasing an already empty cell with no notes, skip creating a no-op undo entry
      if (digit === 0 && currentVal === 0 && notes[row][col].length === 0) {
        return;
      }

      // Save undo snapshot before mutating
      setUndoStack((prev) => [...prev.slice(-49), { board: cloneBoard(board), notes: cloneNotes(notes) }]);

      const nextBoard = cloneBoard(board);
      const nextNotes = cloneNotes(notes);
      let nextMistakes = mistakes;
      let nextScore = score;

      // Erase action (digit === 0) OR tapping user-filled cell again with same digit clears it
      if (digit === 0 || (!usePencil && currentVal === digit)) {
        if (nextBoard[row][col] !== 0) {
          nextBoard[row][col] = 0;
        } else {
          nextNotes[row][col] = [];
        }
        playEraseSound();
        onLocalStateChange({
          board: nextBoard,
          notes: nextNotes,
          mistakes: nextMistakes,
          hintsUsed,
          score: nextScore,
        });
        return;
      }

      // Manual Pencil Mode (candidate notes)
      if (usePencil) {
        const cellNotes = nextNotes[row][col];
        const idx = cellNotes.indexOf(digit);
        if (idx >= 0) cellNotes.splice(idx, 1);
        else cellNotes.push(digit);
        cellNotes.sort((a, b) => a - b);
        playNumberSelectSound(digit);
        onLocalStateChange({
          board: nextBoard,
          notes: nextNotes,
          mistakes: nextMistakes,
          hintsUsed,
          score: nextScore,
        });
        return;
      }

      // Normal number entry (works identically with Fast Pencil ON or OFF)
      nextBoard[row][col] = digit;
      nextNotes[row][col] = [];

      if (digit === solution[row][col]) {
        playCorrectSound();
        const cellKey = `${row}-${col}`;
        if (!scoredCellsRef.current.has(cellKey)) {
          scoredCellsRef.current.add(cellKey);
          nextScore += Math.round(50 * DIFFICULTY_CONFIG[difficulty].multiplier);
        }
        // Clear matching manual notes in row, col, and 3x3 box
        for (let i = 0; i < 9; i++) {
          nextNotes[row][i] = nextNotes[row][i].filter((n) => n !== digit);
          nextNotes[i][col] = nextNotes[i][col].filter((n) => n !== digit);
        }
        const br = Math.floor(row / 3) * 3;
        const bc = Math.floor(col / 3) * 3;
        for (let r = br; r < br + 3; r++) {
          for (let c = bc; c < bc + 3; c++) {
            nextNotes[r][c] = nextNotes[r][c].filter((n) => n !== digit);
          }
        }
      } else {
        playMistakeSound();
        nextMistakes += 1;
        nextScore = Math.max(0, nextScore - 20);
        setErrorCellKey(`${row}-${col}`);
        setTimeout(() => setErrorCellKey(null), 350);
      }

      onLocalStateChange({
        board: nextBoard,
        notes: nextNotes,
        mistakes: nextMistakes,
        hintsUsed,
        score: nextScore,
      });

      if (isBoardSolved(nextBoard, solution) && onSolved) {
        onSolved({
          board: nextBoard,
          mistakes: nextMistakes,
          hintsUsed,
          score: nextScore,
          elapsedSeconds,
        });
      }
    },
    [
      readOnly,
      isPaused,
      puzzle,
      pencilMode,
      isMultiplayer,
      onMultiplayerMove,
      onLocalStateChange,
      board,
      notes,
      mistakes,
      score,
      hintsUsed,
      solution,
      difficulty,
      onSolved,
      elapsedSeconds,
      mistakeCellSet,
    ]
  );

  // Tapping a cell on the 9x9 board
  const handleCellClick = (row: number, col: number) => {
    if (isPaused || readOnly) return;
    setSelectedCell([row, col]);

    if (selectedNumber === null) {
      setBoardCellHighlight(board[row][col] > 0);
      playButtonClickSound();
      return;
    }

    setBoardCellHighlight(false);

    // Fixed clues can be selected/highlighted, never modified
    if (puzzle[row][col] !== 0) {
      playButtonClickSound();
      return;
    }

    // Place/toggle active selected number immediately while keeping it selected
    applyDigitToCell(row, col, selectedNumber);
  };

  // Tapping a number (1..9) on the number pad:
  // Persistent number selection — immediately updates active highlight & placement digit to `num`.
  const handleNumberPadClick = (num: number) => {
    if (isPaused || readOnly) return;
    setBoardCellHighlight(false);
    const next = selectedNumber === num ? null : num;
    setSelectedNumber(next);
    if (next === null) {
      playEraseSound();
    } else {
      playNumberSelectSound(next);
    }
  };

  const handleUndo = useCallback(() => {
    if (isPaused || readOnly || isMultiplayer || !onLocalStateChange || undoStack.length === 0) return;
    const prevSnap = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    playButtonClickSound();
    onLocalStateChange({
      board: prevSnap.board,
      notes: prevSnap.notes,
      mistakes,
      hintsUsed,
      score,
    });
  }, [isPaused, readOnly, isMultiplayer, onLocalStateChange, undoStack, mistakes, hintsUsed, score]);

  const handleErase = useCallback(() => {
    if (!selectedCell || isPaused || readOnly) return;
    const [r, c] = selectedCell;
    if (puzzle[r][c] !== 0) return;
    applyDigitToCell(r, c, 0, false);
  }, [selectedCell, isPaused, readOnly, puzzle, applyDigitToCell]);

  const handleFastPencilToggle = useCallback(() => {
    if (isPaused || readOnly) return;
    if (!isMultiplayer) {
      setFastPencil((v) => {
        const next = !v;
        playToggleSound(next);
        return next;
      });
      return;
    }

    if (fastPencilUnlocked) {
      setFastPencil((v) => {
        const next = !v;
        playToggleSound(next);
        return next;
      });
      return;
    }

    if (accountPencilCredits > 0) {
      setCreditNotice(null);
      onMultiplayerUnlockFastPencil?.();
    } else {
      playButtonClickSound();
      setCreditNotice('No Pencil credits remaining. Complete a Co-op or Match game to earn Pencil credits!');
    }
  }, [isPaused, readOnly, isMultiplayer, fastPencilUnlocked, accountPencilCredits, onMultiplayerUnlockFastPencil]);

  const handleHint = useCallback(() => {
    if (isPaused || readOnly) return;

    if (isMultiplayer) {
      if (totalMultiplayerHints <= 0) {
        playButtonClickSound();
        setCreditNotice('All 3 hints used! Complete a Co-op or Match game to earn more Hint credits.');
        return;
      }
      setCreditNotice(null);
      playCorrectSound();
      onMultiplayerHint?.(selectedCell?.[0], selectedCell?.[1]);
      return;
    }

    if (!onLocalStateChange || !solution) return;

    let target: [number, number] | null = null;
    if (selectedCell) {
      const [r, c] = selectedCell;
      if (puzzle[r][c] === 0 && board[r][c] !== solution[r][c]) {
        target = [r, c];
      }
    }
    if (!target) {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r][c] === 0 && board[r][c] !== solution[r][c]) {
            target = [r, c];
            break;
          }
        }
        if (target) break;
      }
    }
    if (!target) return;

    const [tr, tc] = target;
    setSelectedCell([tr, tc]);
    setUndoStack((prev) => [...prev.slice(-49), { board: cloneBoard(board), notes: cloneNotes(notes) }]);

    const nextBoard = cloneBoard(board);
    const nextNotes = cloneNotes(notes);
    const answer = solution[tr][tc];
    nextBoard[tr][tc] = answer;
    nextNotes[tr][tc] = [];

    for (let i = 0; i < 9; i++) {
      nextNotes[tr][i] = nextNotes[tr][i].filter((n) => n !== answer);
      nextNotes[i][tc] = nextNotes[i][tc].filter((n) => n !== answer);
    }

    const nextHints = hintsUsed + 1;
    const nextScore = Math.max(0, score - 25);
    scoredCellsRef.current.add(`${tr}-${tc}`);
    playCorrectSound();

    onLocalStateChange({
      board: nextBoard,
      notes: nextNotes,
      mistakes,
      hintsUsed: nextHints,
      score: nextScore,
    });

    if (isBoardSolved(nextBoard, solution) && onSolved) {
      onSolved({
        board: nextBoard,
        mistakes,
        hintsUsed: nextHints,
        score: nextScore,
        elapsedSeconds,
      });
    }
  }, [
    isPaused,
    readOnly,
    isMultiplayer,
    totalMultiplayerHints,
    onMultiplayerHint,
    onLocalStateChange,
    selectedCell,
    puzzle,
    board,
    solution,
    notes,
    hintsUsed,
    score,
    mistakes,
    onSolved,
    elapsedSeconds,
  ]);

  // Keyboard navigation & input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' && onTogglePause && !isMultiplayer) {
        e.preventDefault();
        onTogglePause();
        return;
      }
      if (isPaused || readOnly) return;

      if (e.key >= '1' && e.key <= '9') {
        const digit = Number(e.key);
        setBoardCellHighlight(false);
        setSelectedNumber(digit);
        if (selectedCell && puzzle[selectedCell[0]][selectedCell[1]] === 0) {
          applyDigitToCell(selectedCell[0], selectedCell[1], digit);
        } else {
          playNumberSelectSound(digit);
        }
        return;
      }
      if (e.key === 'Escape') {
        setBoardCellHighlight(false);
        setSelectedNumber(null);
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        if (selectedCell) applyDigitToCell(selectedCell[0], selectedCell[1], 0, false);
        return;
      }
      if (e.key.toLowerCase() === 'p') {
        setPencilMode((v) => !v);
        return;
      }
      if (e.key.toLowerCase() === 'f') {
        handleFastPencilToggle();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        setSelectedCell((prev) => {
          const [r, c] = prev ?? [4, 4];
          if (e.key === 'ArrowUp') return [Math.max(0, r - 1), c];
          if (e.key === 'ArrowDown') return [Math.min(8, r + 1), c];
          if (e.key === 'ArrowLeft') return [r, Math.max(0, c - 1)];
          return [r, Math.min(8, c + 1)];
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPaused, readOnly, selectedCell, puzzle, applyDigitToCell, handleUndo, handleFastPencilToggle, onTogglePause, isMultiplayer]);

  const canEraseSelected = Boolean(
    selectedCell &&
      puzzle[selectedCell[0]][selectedCell[1]] === 0 &&
      (!isMultiplayer ||
        board[selectedCell[0]][selectedCell[1]] === 0 ||
        mistakeCellSet.has(`${selectedCell[0]}-${selectedCell[1]}`)) &&
      (board[selectedCell[0]][selectedCell[1]] !== 0 || notes[selectedCell[0]][selectedCell[1]].length > 0)
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Center: Top HUD + 9x9 Sudoku Grid */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Compact HUD Bar */}
          <div className="w-full max-w-[520px] flex items-center justify-between gap-3 mb-2.5 px-1">
            <div className="flex items-center gap-2.5 text-sm min-w-0">
              <span className="font-display font-bold text-[#76533D] dark:text-[#C99A75] shrink-0">
                {DIFFICULTY_CONFIG[difficulty].label}
              </span>
              <span className="text-[#B98B68]" aria-hidden="true">·</span>
              <span className="font-mono-tabular text-[#49382D] dark:text-[#EDE2D3] shrink-0">
                Mistakes: <strong className={mistakes > 0 ? 'text-red-600 dark:text-red-400' : ''}>{mistakes}</strong>
              </span>
              <span className="text-[#B98B68]" aria-hidden="true">·</span>
              <span className="font-mono-tabular text-[#49382D] dark:text-[#EDE2D3] truncate">
                Score: <strong>{score}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono-tabular font-semibold text-sm text-[#49382D] dark:text-[#F5EBDD]">
                {formatDuration(elapsedSeconds)}
              </span>
              {onTogglePause && !isMultiplayer && (
                <button
                  type="button"
                  onClick={onTogglePause}
                  aria-label={isPaused ? 'Resume game' : 'Pause game'}
                  className="min-h-[34px] px-2.5 py-1 rounded-xl bg-[#E8D5BC] dark:bg-[#352A23] hover:bg-[#B98B68]/40 text-[#49382D] dark:text-[#F5EBDD] flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer touch-manipulation"
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sleek Progress Strip */}
          <div className="w-full max-w-[520px] mb-3 px-1">
            <div className="flex items-center justify-between text-xs text-[#76533D] dark:text-[#D2C2B0] mb-1">
              <span>Puzzle Progress</span>
              <span className="font-mono-tabular font-semibold">
                {progress.filledCorrect}/{progress.totalToFill} ({progress.percent}%)
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#E8D5BC] dark:bg-[#352A23] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#76533D] dark:bg-[#C99A75] transition-all duration-200"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* 9x9 Sudoku Grid Container */}
          <div className="relative w-full max-w-[520px] aspect-square rounded-2xl overflow-hidden border-[3px] border-[#76533D] dark:border-[#C99A75] bg-[#FCF8F2] dark:bg-[#241C17] shadow-sm select-none touch-manipulation">
            <div className="grid grid-cols-9 grid-rows-9 w-full h-full">
              {board.map((rowArr, r) =>
                rowArr.map((cellVal, c) => {
                  const isGiven = puzzle[r][c] !== 0;
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isSameRowOrCol =
                    selectedCell !== null && (selectedCell[0] === r || selectedCell[1] === c);
                  const isSameBox =
                    selectedCell !== null &&
                    Math.floor(selectedCell[0] / 3) === Math.floor(r / 3) &&
                    Math.floor(selectedCell[1] / 3) === Math.floor(c / 3);
                  const isMatchingVal = activeHighlightDigit !== null && cellVal === activeHighlightDigit;
                  const isIncorrect =
                    cellVal !== 0 && (solution ? cellVal !== solution[r][c] : mistakeCellSet.has(`${r}-${c}`));
                  const isShaking = errorCellKey === `${r}-${c}`;

                  const displayNotes =
                    cellVal === 0
                      ? fastPencil && autoCandidates
                        ? autoCandidates[r][c]
                        : notes[r][c]
                      : [];

                  const hasHighlightedCandidate =
                    cellVal === 0 &&
                    activeHighlightDigit !== null &&
                    displayNotes.includes(activeHighlightDigit);

                  const actor = coopActors?.[`${r}-${c}`];

                  // 3x3 heavy section borders
                  const rightBorder =
                    c === 2 || c === 5
                      ? 'border-r-2 border-r-[#76533D] dark:border-r-[#C99A75]'
                      : c < 8
                      ? 'border-r border-r-[#E8D5BC] dark:border-r-[#3D3028]'
                      : '';
                  const bottomBorder =
                    r === 2 || r === 5
                      ? 'border-b-2 border-b-[#76533D] dark:border-b-[#C99A75]'
                      : r < 8
                      ? 'border-b border-b-[#E8D5BC] dark:border-b-[#3D3028]'
                      : '';

                  let bgClass = 'bg-transparent';
                  if (isIncorrect) {
                    bgClass = isSelected
                      ? 'bg-red-200/95 dark:bg-red-900/75 ring-2 ring-inset ring-red-600 dark:ring-red-400'
                      : 'bg-red-100/90 dark:bg-red-950/60';
                  } else if (isMatchingVal && isSelected) {
                    bgClass =
                      'bg-[#C89364]/50 dark:bg-[#B98B68]/50 ring-2 ring-inset ring-[#76533D] dark:ring-[#F5EBDD]';
                  } else if (isMatchingVal) {
                    bgClass = 'bg-[#C89364]/42 dark:bg-[#B98B68]/42';
                  } else if (isSelected) {
                    bgClass =
                      'bg-[#E8D5BC]/75 dark:bg-[#3A2E26] ring-2 ring-inset ring-[#76533D] dark:ring-[#C99A75]';
                  } else if (hasHighlightedCandidate && fastPencil) {
                    bgClass = 'bg-blue-50/90 dark:bg-blue-950/35';
                  } else if (isSameRowOrCol || isSameBox) {
                    bgClass = 'bg-[#E8D5BC]/40 dark:bg-[#352A23]/55';
                  }

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      data-cell={`${r}-${c}`}
                      data-highlighted={isMatchingVal ? 'true' : 'false'}
                      data-in-zone={isSameRowOrCol || isSameBox ? 'true' : 'false'}
                      data-selected={isSelected ? 'true' : 'false'}
                      onClick={() => handleCellClick(r, c)}
                      aria-label={`Row ${r + 1} Column ${c + 1}${cellVal ? `, value ${cellVal}` : ', empty'}`}
                      className={`relative flex items-center justify-center w-full h-full transition-colors duration-100 cursor-pointer touch-manipulation select-none focus:outline-none ${rightBorder} ${bottomBorder} ${bgClass} ${
                        isShaking ? 'animate-cell-shake' : ''
                      }`}
                    >
                      {cellVal !== 0 ? (
                        <span
                          className={`text-xl sm:text-2xl leading-none font-mono-tabular pointer-events-none ${
                            isIncorrect
                              ? 'font-bold text-red-700 dark:text-red-300'
                              : isMatchingVal
                              ? 'font-extrabold text-[#3B261A] dark:text-[#FFF8EE]'
                              : isGiven
                              ? 'font-bold text-[#49382D] dark:text-[#F5EBDD]'
                              : 'font-semibold text-[#8C5A36] dark:text-[#E5B892]'
                          }`}
                        >
                          {cellVal}
                        </span>
                      ) : displayNotes.length > 0 ? (
                        <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-[2px] sm:p-1 pointer-events-none">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                            const present = displayNotes.includes(n);
                            const isTargetHighlight = present && activeHighlightDigit === n;
                            return (
                              <span
                                key={n}
                                className={`flex items-center justify-center text-[8px] sm:text-[10px] leading-none font-mono-tabular ${
                                  present
                                    ? isTargetHighlight
                                      ? fastPencil
                                        ? 'font-extrabold text-blue-600 dark:text-blue-400'
                                        : 'font-extrabold text-[#76533D] dark:text-[#F5EBDD]'
                                      : fastPencil
                                      ? 'font-semibold text-blue-700/80 dark:text-blue-300/85'
                                      : 'font-medium text-[#76533D]/80 dark:text-[#D2C2B0]/80'
                                    : 'opacity-0'
                                }`}
                              >
                                {n}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}

                      {/* Co-op teammate attribution dot */}
                      {actor && !isGiven && cellVal !== 0 && (
                        <span
                          title={`Placed by ${actor.username}`}
                          className="absolute bottom-0.5 right-0.5 text-[7px] sm:text-[8px] font-bold px-1 rounded bg-[#E8D5BC]/90 dark:bg-[#352A23]/90 text-[#76533D] dark:text-[#C99A75] leading-tight pointer-events-none"
                        >
                          {actor.username.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Pause Overlay */}
            {isPaused && (
              <div className="absolute inset-0 z-20 bg-[#F7F0E5]/95 dark:bg-[#1E1713]/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#E8D5BC] dark:bg-[#352A23] text-[#76533D] dark:text-[#C99A75] flex items-center justify-center mb-4">
                  <Coffee className="w-7 h-7" />
                </div>
                <h3 className="font-display text-2xl font-bold text-[#49382D] dark:text-[#F5EBDD]">
                  Coffee Break
                </h3>
                <p className="text-sm text-[#76533D] dark:text-[#D2C2B0] mt-1 mb-5 max-w-xs">
                  Your timer is paused and the puzzle is tucked away until you return.
                </p>
                {onTogglePause && (
                  <button
                    type="button"
                    onClick={onTogglePause}
                    className="px-6 py-3 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] font-semibold text-sm flex items-center gap-2 cursor-pointer touch-manipulation"
                  >
                    <Play className="w-4 h-4" />
                    <span>Resume Puzzle</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right / Bottom: Controls Toolbar & Number Pad */}
        <div className="lg:col-span-5 w-full max-w-[520px] mx-auto lg:max-w-none space-y-4">
          {/* Action Tools */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm space-y-3">
            <div className={`grid gap-2 ${isMultiplayer ? 'grid-cols-4' : 'grid-cols-5'}`}>
              {!isMultiplayer && (
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={undoStack.length === 0 || isPaused}
                  className="min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] hover:bg-[#E8D5BC] dark:hover:bg-[#46382E] text-[#49382D] dark:text-[#F5EBDD] disabled:opacity-40 transition-colors cursor-pointer touch-manipulation select-none"
                >
                  <Undo2 className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">Undo</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleErase}
                disabled={!canEraseSelected || isPaused || readOnly}
                className="min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] hover:bg-[#E8D5BC] dark:hover:bg-[#46382E] text-[#49382D] dark:text-[#F5EBDD] disabled:opacity-40 transition-colors cursor-pointer touch-manipulation select-none"
              >
                <Eraser className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Erase</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const next = !pencilMode;
                  setPencilMode(next);
                  playToggleSound(next);
                }}
                aria-pressed={pencilMode}
                className={`min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer touch-manipulation select-none ${
                  pencilMode
                    ? 'bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713]'
                    : 'bg-[#F7F0E5] dark:bg-[#352A23] hover:bg-[#E8D5BC] dark:hover:bg-[#46382E] text-[#49382D] dark:text-[#F5EBDD]'
                }`}
              >
                <Pencil className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Pencil</span>
              </button>

              {/* Signature Blue Lightning Fast Pencil Button */}
              <button
                type="button"
                onClick={handleFastPencilToggle}
                disabled={isPaused || readOnly}
                aria-pressed={fastPencil}
                className={`min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl transition-all cursor-pointer touch-manipulation select-none disabled:opacity-40 ${
                  fastPencil
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-400/50'
                    : isMultiplayer && !fastPencilUnlocked && accountPencilCredits <= 0
                    ? 'bg-blue-50/60 dark:bg-blue-950/25 text-blue-700/60 dark:text-blue-300/60 border border-blue-200/60 dark:border-blue-800/40'
                    : 'bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                }`}
              >
                <Zap className={`w-4 h-4 ${fastPencil ? 'fill-white' : 'fill-blue-600/20'}`} />
                <span className="text-[11px] font-semibold whitespace-nowrap">
                  {isMultiplayer && !fastPencilUnlocked ? `Fast (${accountPencilCredits})` : 'Fast'}
                </span>
              </button>

              {!isMultiplayer ? (
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={isPaused}
                  className="min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] hover:bg-[#E8D5BC] dark:hover:bg-[#46382E] text-[#49382D] dark:text-[#F5EBDD] disabled:opacity-40 transition-colors cursor-pointer touch-manipulation select-none"
                >
                  <Lightbulb className="w-4 h-4 text-[#B98B68]" />
                  <span className="text-[11px] font-semibold">Hint ({hintsUsed})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={isPaused || readOnly || totalMultiplayerHints <= 0}
                  data-mp-hint-btn="true"
                  className="min-h-[54px] flex flex-col items-center justify-center gap-1 rounded-xl bg-[#F7F0E5] dark:bg-[#352A23] hover:bg-[#E8D5BC] dark:hover:bg-[#46382E] text-[#49382D] dark:text-[#F5EBDD] disabled:opacity-40 transition-colors cursor-pointer touch-manipulation select-none"
                >
                  <Lightbulb className="w-4 h-4 text-[#B98B68]" />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    Hint ({totalMultiplayerHints})
                  </span>
                </button>
              )}
            </div>

            {isMultiplayer && (
              <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-[#76533D] dark:text-[#D2C2B0] font-mono-tabular">
                <span>
                  Hints left: <strong className="text-[#49382D] dark:text-[#F5EBDD]">{totalMultiplayerHints}</strong>
                  {accountHintCredits > 0 ? ` (${multiplayerMatchHintsLeft} match + ${accountHintCredits} saved)` : ` (${multiplayerMatchHintsLeft}/3)`}
                </span>
                <span>
                  Pencil credits: <strong className="text-[#49382D] dark:text-[#F5EBDD]">{accountPencilCredits}</strong>
                </span>
              </div>
            )}

            {creditNotice && (
              <div className="px-3 py-2 rounded-xl bg-[#E8D5BC]/70 dark:bg-[#352A23] border border-[#B98B68]/40 text-xs text-[#49382D] dark:text-[#F5EBDD]">
                {creditNotice}
              </div>
            )}

            {fastPencil && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/45 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-800 dark:text-blue-200">
                <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 fill-current" />
                <span>
                  <strong>Fast Pencil ON:</strong> Auto-candidates visible. Select a number below and tap cells to fill rapidly.
                </span>
              </div>
            )}
          </div>

          {/* 1-9 Persistent Number Pad (Mobile 5-col large tap targets, Desktop 3-col) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FCF8F2] dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028] shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-semibold text-[#76533D] dark:text-[#C99A75]">
                {selectedNumber !== null
                  ? `Active Number: ${selectedNumber}${pencilMode ? ' (Pencil)' : ''}`
                  : pencilMode
                  ? 'Select a number for Pencil notes'
                  : 'Tap a number to place repeatedly'}
              </span>
              {selectedNumber !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setBoardCellHighlight(false);
                    setSelectedNumber(null);
                    playEraseSound();
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#E8D5BC]/80 dark:bg-[#352A23] text-xs font-semibold text-[#49382D] dark:text-[#F5EBDD] cursor-pointer touch-manipulation"
                >
                  <X className="w-3 h-3" />
                  <span>Deselect</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 lg:grid-cols-3 gap-2 sm:gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                const rem = remainingCounts[num] ?? 0;
                const isComplete = rem === 0;
                const isActive = selectedNumber === num;

                return (
                  <button
                    key={num}
                    type="button"
                    data-numpad={num}
                    onClick={() => handleNumberPadClick(num)}
                    disabled={isPaused || readOnly}
                    aria-pressed={isActive}
                    className={`min-h-[56px] sm:min-h-[60px] flex flex-col items-center justify-center rounded-xl border transition-all cursor-pointer touch-manipulation select-none active:scale-[0.97] ${
                      isActive
                        ? fastPencil
                          ? 'bg-blue-600 border-blue-600 text-white shadow-md ring-2 ring-blue-400/60'
                          : 'bg-[#76533D] dark:bg-[#C99A75] border-[#76533D] dark:border-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713] shadow-md ring-2 ring-[#B98B68]/60'
                        : isComplete
                        ? 'bg-[#F7F0E5]/50 dark:bg-[#241C17]/50 border-[#E8D5BC]/50 dark:border-[#3D3028]/40 text-[#76533D]/40 dark:text-[#D2C2B0]/35'
                        : 'bg-[#F7F0E5] dark:bg-[#352A23] hover:bg-[#E8D5BC] dark:hover:bg-[#46382E] border-[#E8D5BC] dark:border-[#49382D] text-[#49382D] dark:text-[#F5EBDD]'
                    }`}
                  >
                    <span className="font-mono-tabular font-bold text-xl sm:text-2xl leading-none">{num}</span>
                    <span
                      className={`text-[10px] font-mono-tabular mt-1 ${
                        isActive
                          ? 'text-white/90 dark:text-[#1E1713]/85'
                          : isComplete
                          ? 'text-[#76533D]/40 dark:text-[#D2C2B0]/35'
                          : 'text-[#76533D] dark:text-[#C99A75]'
                      }`}
                    >
                      {isComplete ? 'done' : `${rem} left`}
                    </span>
                  </button>
                );
              })}

              {/* 10th mobile grid slot: Clear Selection / Deselect Number for balanced 5x2 mobile layout */}
              <button
                type="button"
                onClick={() => {
                  setBoardCellHighlight(false);
                  setSelectedNumber(null);
                  playEraseSound();
                }}
                disabled={selectedNumber === null || isPaused || readOnly}
                className="lg:hidden min-h-[56px] flex flex-col items-center justify-center rounded-xl border border-[#E8D5BC] dark:border-[#49382D] bg-[#E8D5BC]/55 dark:bg-[#352A23]/80 text-[#49382D] dark:text-[#F5EBDD] disabled:opacity-40 cursor-pointer touch-manipulation select-none"
              >
                <X className="w-4 h-4" />
                <span className="text-[10px] font-semibold mt-0.5">Clear #</span>
              </button>
            </div>
          </div>

          {/* Solo New Game Difficulty Selector */}
          {mode === 'solo' && onNewGame && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#E8D5BC]/45 dark:bg-[#29201B] border border-[#E8D5BC] dark:border-[#3D3028]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display font-bold text-sm text-[#49382D] dark:text-[#F5EBDD]">Start New Game</p>
                  <p className="text-xs text-[#76533D] dark:text-[#D2C2B0]">Pick a difficulty for a fresh puzzle</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewGameMenu((v) => !v);
                    playButtonClickSound();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#76533D] hover:bg-[#5E412F] dark:bg-[#C99A75] dark:hover:bg-[#B98B68] text-[#F7F0E5] dark:text-[#1E1713] text-xs font-semibold flex items-center gap-1.5 cursor-pointer touch-manipulation"
                >
                  {showNewGameMenu ? <RotateCcw className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>New Game</span>
                </button>
              </div>

              {showNewGameMenu && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#B98B68]/25">
                  {(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).map((diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => {
                        setShowNewGameMenu(false);
                        playButtonClickSound();
                        onNewGame(diff);
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer touch-manipulation ${
                        diff === difficulty
                          ? 'bg-[#76533D] dark:bg-[#C99A75] text-[#F7F0E5] dark:text-[#1E1713]'
                          : 'bg-[#FCF8F2] dark:bg-[#352A23] hover:bg-[#E8D5BC] text-[#49382D] dark:text-[#F5EBDD]'
                      }`}
                    >
                      {DIFFICULTY_CONFIG[diff].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
