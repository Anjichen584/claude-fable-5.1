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
  {
    index: 4,
    id: 'shadows',
    title: 'Shadows',
    subtitle: '投影之辨',
    concept: '投影不是物体本身：透视与正交各揭示一半信息',
    outro: '影子、剪影、两种真相。正交投影保留对称、丢掉深度；透视保留深度、打破对称。四维物体你永远只能看到影子——但你已经学会了换一盏灯。',
    levels: LEVELS.filter((l) => l.chapter === 4),
  },
  {
    index: 5,
    id: 'polytopes',
    title: 'Other Polytopes',
    subtitle: '异形',
    concept: '四维有六种正多胞体：十六胞体与二十四胞体的截面和对称',
    outro: '十六胞体、二十四胞体、对称。超立方体不是四维的全部：对偶把立方体换成八面体，而二十四胞体根本没有三维的影子。你已经能在不认识的物体上用同样的方法。',
    levels: LEVELS.filter((l) => l.chapter === 5),
  },
  {
    index: 6,
    id: 'crossing',
    title: 'Crossing Over',
    subtitle: '跨越',
    concept: '你自己获得 W 坐标：平台分层，沿 W 移动即可到达三维里不相连的地方',
    outro: '侧步、穿过、你就是切片。前五天你一直站在三维里转动四维；今天你自己迈出了第四个方向。那些在三维里断开的路，从来都是连着的。',
    levels: LEVELS.filter((l) => l.chapter === 6),
  },
  {
    index: 7,
    id: 'nexus',
    title: 'The Nexus',
    subtitle: '枢纽',
    concept: '终章：没有新概念，前六天的每一种能力在同一个枢纽里协同',
    outro: '回响、两盏灯、枢纽。七天：折叠、双旋、截面、影子、异形、跨越，然后是这里。你看到的从来只是切面——但你已经知道怎么转动它、扫描它、换一盏灯看它、换一种物体试它、以及亲自走进去。',
    levels: LEVELS.filter((l) => l.chapter === 7),
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
