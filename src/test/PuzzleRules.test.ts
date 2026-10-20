import { describe, expect, it } from 'vitest';
import { createTesseract, identityRotation } from '../math';
import { evaluateBridge, footprintWalkable, pointInAABBxz, resolveAnchor, vertexWorldPosition } from '../puzzle/PuzzleRules';
import { DEFAULT_TOLERANCE, type BridgeDef } from '../puzzle/types';

const T = createTesseract();
const core = { position: [0, 1.8, 0] as const, scale: 1.2 };
const bridge: BridgeDef = {
  id: 'b', start: [0, 0, 2.5],
  walkable: { min: [-0.7, -0.3, -2.6], max: [0.7, 0, 2.6] },
  vertex: 1, plane: 'XW', solution: { ...identityRotation(), XW: 1.0 },
};

describe('vertexWorldPosition / resolveAnchor', () => {
  it('应用核心的位置与缩放', () => {
    const p = vertexWorldPosition(T, 0, identityRotation(), core);
    // 顶点0 = (-1,-1,-1,-1) → 投影 (-0.75,-0.75,-0.75) × 1.2 + (0,1.8,0)
    expect(p[0]).toBeCloseTo(-0.9);
    expect(p[1]).toBeCloseTo(1.8 - 0.9);
    expect(p[2]).toBeCloseTo(-0.9);
  });
  it('锚点 = 解姿态下的顶点位置', () => {
    const a = resolveAnchor(T, bridge, core);
    const p = vertexWorldPosition(T, bridge.vertex, bridge.solution, core);
    expect(a).toEqual(p);
  });
});

describe('evaluateBridge', () => {
  const anchor = resolveAnchor(T, bridge, core);
  it('在精确解处满足', () => {
    const ep = vertexWorldPosition(T, bridge.vertex, bridge.solution, core);
    const e = evaluateBridge(bridge, ep, anchor);
    expect(e.distance).toBeCloseTo(0);
    expect(e.satisfied).toBe(true);
  });
  it('在初始姿态不满足', () => {
    const ep = vertexWorldPosition(T, bridge.vertex, identityRotation(), core);
    expect(evaluateBridge(bridge, ep, anchor).satisfied).toBe(false);
  });
  it('距离阈值边界：刚好小于 δ 满足，大于 δ 不满足', () => {
    const d = DEFAULT_TOLERANCE.distance;
    // 沿锚点相对 start 的方向偏移，保证方向条件不受影响
    const dir = [anchor[0] - bridge.start[0], anchor[1] - bridge.start[1], anchor[2] - bridge.start[2]];
    const len = Math.hypot(...dir);
    const u = dir.map((c) => c / len);
    const near = anchor.map((c, i) => c + u[i] * (d * 0.9)) as unknown as readonly [number, number, number];
    const far = anchor.map((c, i) => c + u[i] * (d * 1.1)) as unknown as readonly [number, number, number];
    expect(evaluateBridge(bridge, near, anchor).satisfied).toBe(true);
    expect(evaluateBridge(bridge, far, anchor).satisfied).toBe(false);
  });
  it('方向条件：距离近但方向错时不满足', () => {
    const b2: BridgeDef = { ...bridge, tolerance: { distance: 10 } };
    const wrong = [bridge.start[0] - 3, bridge.start[1], bridge.start[2] + 3] as const;
    const e = evaluateBridge(b2, wrong, anchor);
    expect(e.distanceOk).toBe(true);
    expect(e.angleOk).toBe(false);
    expect(e.satisfied).toBe(false);
  });
});

describe('pointInAABBxz', () => {
  const box = { min: [-1, 0, -2] as const, max: [1, 0, 2] as const };
  it('内/外/边界/margin', () => {
    expect(pointInAABBxz([0, 5, 0], box)).toBe(true);
    expect(pointInAABBxz([1, 0, 2], box)).toBe(true);
    expect(pointInAABBxz([1.01, 0, 0], box)).toBe(false);
    expect(pointInAABBxz([0.95, 0, 0], box, 0.1)).toBe(false);
  });
});

describe('footprintWalkable', () => {
  const platform = { min: [-2, 0, 2.5] as const, max: [2, 0, 7] as const };
  const bridge = { min: [-0.7, 0, -2.6] as const, max: [0.7, 0, 2.6] as const };
  const boxes = [platform, bridge];
  it('在接缝处（平台边缘 → 桥）没有死区', () => {
    for (let z = 2.2; z <= 3.0; z += 0.05) expect(footprintWalkable([0, 0, z], 0.22, boxes)).toBe(true);
  });
  it('桥边缘以外不可走；平台外不可走', () => {
    expect(footprintWalkable([0.6, 0, 0], 0.22, boxes)).toBe(false);
    expect(footprintWalkable([0.4, 0, 0], 0.22, boxes)).toBe(true);
    expect(footprintWalkable([1.9, 0, 5], 0.22, boxes)).toBe(false);
    expect(footprintWalkable([0, 0, -3], 0.22, boxes)).toBe(false);
  });
});
