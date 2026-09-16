export interface Point { x: number; y: number }
export interface DiagramBox { x: number; y: number; width: number; height: number }

function crossings(points: Point[], boxes: DiagramBox[]) {
  let count = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    for (const box of boxes) {
      if (a.x === b.x
        ? a.x > box.x && a.x < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height
        : a.y > box.y && a.y < box.y + box.height && Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width) count++;
    }
  }
  return count;
}

/** A few bounded alternatives for upward wires; do not move or rewrite the user's graph. */
export function returnWire(source: Point, target: Point, boxes: DiagramBox[]): Point[] {
  const left = Math.min(source.x, target.x, ...boxes.map(b => b.x)) - 28;
  const right = Math.max(source.x, target.x, ...boxes.map(b => b.x + b.width)) + 28;
  const sourceBox = boxes.find(b => source.x >= b.x && source.x <= b.x + b.width && Math.abs(source.y - b.y - b.height) <= 10);
  const targetBox = boxes.find(b => target.x >= b.x && target.x <= b.x + b.width && Math.abs(target.y - b.y) <= 10);
  const lanes = [(source.x + target.x) / 2, left, right,
    ...[sourceBox, targetBox].flatMap(b => b ? [b.x - 28, b.x + b.width + 28] : [])];
  let best: Point[] = [], score = Infinity;
  for (const x of new Set(lanes)) {
    const points = [source, { x: source.x, y: source.y + 28 }, { x, y: source.y + 28 }, { x, y: target.y - 28 }, { x: target.x, y: target.y - 28 }, target];
    const length = points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y), 0);
    const candidateScore = crossings(points, boxes) * 1e9 + length;
    if (candidateScore < score) { score = candidateScore; best = points; }
  }
  return best;
}

export function roundedWire(points: Point[]): [string, number, number] {
  const clean = points.filter((p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  let path = `M ${clean[0].x} ${clean[0].y}`, longest = 0, label = clean[0];
  for (let i = 1; i < clean.length; i++) {
    const before = clean[i - 1], p = clean[i], after = clean[i + 1];
    const length = Math.hypot(p.x - before.x, p.y - before.y);
    if (length > longest) { longest = length; label = { x: (p.x + before.x) / 2, y: (p.y + before.y) / 2 }; }
    if (!after) { path += ` L ${p.x} ${p.y}`; break; }
    const r = Math.min(12, length / 2, Math.hypot(after.x - p.x, after.y - p.y) / 2);
    path += ` L ${p.x - Math.sign(p.x - before.x) * r} ${p.y - Math.sign(p.y - before.y) * r} Q ${p.x} ${p.y} ${p.x + Math.sign(after.x - p.x) * r} ${p.y + Math.sign(after.y - p.y) * r}`;
  }
  return [path, label.x, label.y];
}
