import { CHAPTERS } from './chapters';
import { LEVELS } from './levels';
import type { ChapterDef, LevelDef } from './types';

/**
 * 存档与进度（纯逻辑，存储后端可注入，方便测试）。
 * - 每关：是否通关、最佳用时、通关次数
 * - 最近游玩的关（"继续"按钮）
 * - 章节是否通关由其所有关推导
 * 旧版只存"已通关章节"（nexus4d.completedChapters），首次读取时迁移：该章所有关标记为已通关（无用时）。
 */
export interface LevelRecord {
  /** 最佳用时（秒）；旧存档迁移来的记录没有用时 */
  bestTime: number | null;
  count: number;
}

export interface Progress {
  version: 2;
  levels: Record<string, LevelRecord>;
  /** 最近开始/完成的关的全局序号 */
  lastLevel: number | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PROGRESS_KEY = 'nexus4d.progress';
export const LEGACY_CHAPTERS_KEY = 'nexus4d.completedChapters';

export function emptyProgress(): Progress {
  return { version: 2, levels: {}, lastLevel: null };
}

/** 读取存档；没有则尝试从旧版章节存档迁移；都没有则空 */
export function loadProgress(storage: StorageLike | null | undefined): Progress {
  if (!storage) return emptyProgress();
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      if (p && p.version === 2 && p.levels && typeof p.levels === 'object') {
        return { version: 2, levels: { ...p.levels }, lastLevel: typeof p.lastLevel === 'number' ? p.lastLevel : null };
      }
    }
    const legacy = storage.getItem(LEGACY_CHAPTERS_KEY);
    if (legacy) {
      const ids = new Set(JSON.parse(legacy) as string[]);
      const p = emptyProgress();
      for (const ch of CHAPTERS) if (ids.has(ch.id)) for (const lv of ch.levels) p.levels[lv.id] = { bestTime: null, count: 1 };
      return p;
    }
  } catch {
    /* 损坏的存档当作空 */
  }
  return emptyProgress();
}

export function saveProgress(storage: StorageLike | null | undefined, p: Progress): void {
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* 无存储环境忽略 */
  }
}

export function clearProgress(storage: StorageLike | null | undefined): Progress {
  try {
    storage?.removeItem(PROGRESS_KEY);
    storage?.removeItem(LEGACY_CHAPTERS_KEY);
  } catch {
    /* ignore */
  }
  return emptyProgress();
}

/** 记录一次通关；返回 { progress, isNewBest } */
export function recordLevelComplete(p: Progress, level: LevelDef, seconds: number): { progress: Progress; isNewBest: boolean } {
  const prev = p.levels[level.id];
  const t = Math.max(0, Math.round(seconds * 10) / 10);
  const isNewBest = !prev || prev.bestTime === null || t < prev.bestTime;
  const rec: LevelRecord = { bestTime: isNewBest ? t : (prev as LevelRecord).bestTime, count: (prev?.count ?? 0) + 1 };
  return { progress: { ...p, levels: { ...p.levels, [level.id]: rec }, lastLevel: level.index }, isNewBest };
}

export function withLastLevel(p: Progress, index: number): Progress {
  return p.lastLevel === index ? p : { ...p, lastLevel: index };
}

export function isLevelCompleted(p: Progress, level: LevelDef): boolean {
  return !!p.levels[level.id];
}

export function chapterDone(p: Progress, ch: ChapterDef): { done: number; total: number; completed: boolean } {
  const done = ch.levels.filter((l) => isLevelCompleted(p, l)).length;
  return { done, total: ch.levels.length, completed: done === ch.levels.length && ch.levels.length > 0 };
}

export function isChapterCompleted(p: Progress, ch: ChapterDef): boolean {
  return chapterDone(p, ch).completed;
}

/**
 * "继续"应该进入的关：
 * - 没有任何记录 → null（显示"开始"即可）
 * - 否则：若 lastLevel 本身未通关则就是它；否则 lastLevel 之后第一关未通关的（再找前面漏掉的）；全部通关 → 回到 lastLevel
 */
export function continueLevel(p: Progress): number | null {
  const anyRecord = Object.keys(p.levels).length > 0 || p.lastLevel !== null;
  if (!anyRecord) return null;
  const last = p.lastLevel ?? 0;
  const lastDef = LEVELS.find((l) => l.index === last);
  if (lastDef && !isLevelCompleted(p, lastDef)) return last;
  // 从 last 之后找第一关未通关
  for (const l of LEVELS) if (l.index > last && !isLevelCompleted(p, l)) return l.index;
  // 前面有漏掉的也算
  for (const l of LEVELS) if (!isLevelCompleted(p, l)) return l.index;
  return lastDef ? lastDef.index : LEVELS[LEVELS.length - 1].index;
}

export function totalDone(p: Progress): number {
  return LEVELS.filter((l) => isLevelCompleted(p, l)).length;
}

/** 秒 → "1:23.4" */
export function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`;
}
