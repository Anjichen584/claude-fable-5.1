import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../puzzle/chapters';
import { LEVELS } from '../puzzle/levels';
import {
  chapterDone,
  clearProgress,
  continueLevel,
  emptyProgress,
  formatTime,
  isChapterCompleted,
  isLevelCompleted,
  LEGACY_CHAPTERS_KEY,
  loadProgress,
  PROGRESS_KEY,
  recordLevelComplete,
  saveProgress,
  totalDone,
  withLastLevel,
  type StorageLike,
} from '../puzzle/progress';

class MemStorage implements StorageLike {
  readonly map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

const L = (i: number) => LEVELS.find((l) => l.index === i)!;

describe('存档：记录与推导', () => {
  it('空存档：没有继续点、没有通关；记录一关后 lastLevel / count / bestTime 正确', () => {
    const p0 = emptyProgress();
    expect(continueLevel(p0)).toBeNull();
    expect(totalDone(p0)).toBe(0);
    const r1 = recordLevelComplete(p0, L(1), 42.26);
    expect(r1.isNewBest).toBe(true);
    expect(r1.progress.levels[L(1).id]).toEqual({ bestTime: 42.3, count: 1 });
    expect(r1.progress.lastLevel).toBe(1);
    expect(isLevelCompleted(r1.progress, L(1))).toBe(true);
    expect(isLevelCompleted(r1.progress, L(2))).toBe(false);
    // 更慢的一次：不是新纪录，次数 +1，bestTime 不变
    const r2 = recordLevelComplete(r1.progress, L(1), 60);
    expect(r2.isNewBest).toBe(false);
    expect(r2.progress.levels[L(1).id]).toEqual({ bestTime: 42.3, count: 2 });
    // 更快：新纪录
    const r3 = recordLevelComplete(r2.progress, L(1), 30);
    expect(r3.isNewBest).toBe(true);
    expect(r3.progress.levels[L(1).id].bestTime).toBe(30);
    // 原对象不被修改（纯函数）
    expect(p0.levels).toEqual({});
  });

  it('continueLevel：lastLevel 未通关 → 它本身；已通关 → 之后第一关未通关；全通 → 最近一关', () => {
    let p = withLastLevel(emptyProgress(), 5);
    expect(continueLevel(p)).toBe(5);
    p = recordLevelComplete(p, L(5), 10).progress;
    expect(continueLevel(p)).toBe(6);
    // 前面漏掉的关在后面都通关后才轮到
    for (let i = 6; i <= LEVELS.length; i++) p = recordLevelComplete(p, L(i), 10).progress;
    expect(continueLevel(p)).toBe(1);
    for (let i = 1; i <= 4; i++) p = recordLevelComplete(p, L(i), 10).progress;
    expect(totalDone(p)).toBe(LEVELS.length);
    expect(continueLevel(p)).toBe(4); // 全部通关：回到最近玩的那关（菜单此时显示"再来一遍"而非"继续"）
  });

  it('章节完成由其所有关推导', () => {
    const ch1 = CHAPTERS[0];
    let p = emptyProgress();
    expect(chapterDone(p, ch1)).toEqual({ done: 0, total: 3, completed: false });
    p = recordLevelComplete(p, ch1.levels[0], 1).progress;
    p = recordLevelComplete(p, ch1.levels[1], 1).progress;
    expect(chapterDone(p, ch1)).toEqual({ done: 2, total: 3, completed: false });
    expect(isChapterCompleted(p, ch1)).toBe(false);
    p = recordLevelComplete(p, ch1.levels[2], 1).progress;
    expect(isChapterCompleted(p, ch1)).toBe(true);
    expect(isChapterCompleted(p, CHAPTERS[1])).toBe(false);
  });

  it('formatTime：秒 / 分:秒 / 空', () => {
    expect(formatTime(null)).toBe('—');
    expect(formatTime(7.26)).toBe('7.3s');
    expect(formatTime(83.4)).toBe('1:23.4');
    expect(formatTime(600)).toBe('10:00.0');
  });
});

describe('存档：读写与迁移', () => {
  it('save → load 往返一致；无存储时 load 为空、save 不抛', () => {
    const st = new MemStorage();
    const p = recordLevelComplete(withLastLevel(emptyProgress(), 3), L(3), 12.5).progress;
    saveProgress(st, p);
    expect(st.getItem(PROGRESS_KEY)).toBeTruthy();
    expect(loadProgress(st)).toEqual(p);
    expect(loadProgress(null)).toEqual(emptyProgress());
    expect(() => saveProgress(null, p)).not.toThrow();
  });

  it('旧版"已通关章节"存档迁移为该章所有关已通关（无用时），新格式优先', () => {
    const st = new MemStorage();
    st.setItem(LEGACY_CHAPTERS_KEY, JSON.stringify(['fold', 'double']));
    const p = loadProgress(st);
    expect(isChapterCompleted(p, CHAPTERS[0])).toBe(true);
    expect(isChapterCompleted(p, CHAPTERS[1])).toBe(true);
    expect(isChapterCompleted(p, CHAPTERS[2])).toBe(false);
    expect(p.levels[L(1).id]).toEqual({ bestTime: null, count: 1 });
    expect(continueLevel(p)).toBe(7);
    // 一旦写入新格式，旧键不再影响
    saveProgress(st, recordLevelComplete(emptyProgress(), L(9), 5).progress);
    const p2 = loadProgress(st);
    expect(isChapterCompleted(p2, CHAPTERS[0])).toBe(false);
    expect(isLevelCompleted(p2, L(9))).toBe(true);
  });

  it('损坏的存档当作空；clearProgress 删除新旧两个键', () => {
    const st = new MemStorage();
    st.setItem(PROGRESS_KEY, '{not json');
    expect(loadProgress(st)).toEqual(emptyProgress());
    st.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, foo: 1 }));
    expect(loadProgress(st)).toEqual(emptyProgress());
    st.setItem(LEGACY_CHAPTERS_KEY, '["fold"]');
    expect(clearProgress(st)).toEqual(emptyProgress());
    expect(st.getItem(PROGRESS_KEY)).toBeNull();
    expect(st.getItem(LEGACY_CHAPTERS_KEY)).toBeNull();
  });

  it('章节 id 与关卡 id 全局唯一（存档以 id 为键）', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
  });
});
