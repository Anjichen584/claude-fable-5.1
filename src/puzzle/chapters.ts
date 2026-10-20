import { LEVELS } from './levels';
import type { ChapterDef, LevelDef } from './types';

/** 七章游玩流程中已实现的章节。每章一个新概念，章末综合。 */
export const CHAPTERS: readonly ChapterDef[] = [
  {
    index: 1,
    id: 'fold',
    title: 'The Fold',
    subtitle: '折叠',
    concept: 'XW / YW / ZW 单平面旋转、透视投影、W 切片',
    outro: '三座桥、一个隐藏的切面。你已经学会让一个四维物体在三维里改变形状。这只是七个切面中的第一个。',
    levels: LEVELS.filter((l) => l.chapter === 1),
  },
  {
    index: 2,
    id: 'double',
    title: 'Double Rotation',
    subtitle: '双旋',
    concept: '两个正交平面同时旋转；四维旋转没有固定轴',
    outro: '双手、等角、配重。三维里每个旋转都有一根不动的轴；四维里可以两个平面一起转，只有原点不动。你已经用过了它。',
    levels: LEVELS.filter((l) => l.chapter === 2),
  },
  {
    index: 3,
    id: 'sections',
    title: 'Cross-Sections',
    subtitle: '截面',
    concept: '同一个超立方体，不同的朝向给出不同形状的截面',
    outro: '立方体、长方体、三棱柱、四面体。你没有换物体，只是换了它朝向 W 的那一端：一个胞、一个面、一条棱、一个顶点。用三维切片扫描四维，这就是方法。',
    levels: LEVELS.filter((l) => l.chapter === 3),
  },
];

export function chapterOf(level: LevelDef): ChapterDef {
  const c = CHAPTERS.find((ch) => ch.index === level.chapter);
  if (!c) throw new Error(`level ${level.id} 的章节 ${level.chapter} 不存在`);
  return c;
}

export function isLastInChapter(level: LevelDef): boolean {
  const ch = chapterOf(level);
  return ch.levels[ch.levels.length - 1]?.index === level.index;
}

export function nextChapter(ch: ChapterDef): ChapterDef | undefined {
  return CHAPTERS.find((c) => c.index === ch.index + 1);
}
