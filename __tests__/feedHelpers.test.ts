import { normaliserPost, postsLocaux, VIDEO_PAR_DEFAUT } from '../src/utils/feedHelpers';

describe('feedHelpers', () => {
  test('normaliserPost fills defaults for missing fields', () => {
    const raw: any = {};
    const p = normaliserPost('id1', raw as any);
    expect(p.id).toBe('id1');
    expect(p.videoUrl).toBe(VIDEO_PAR_DEFAUT);
    expect(p.auteur).toBe('Anonyme');
    expect(p.description).toBe('Quiz communautaire');
    expect(p.likes).toBe(0);
    expect(p.shares).toBe(0);
  });

  test('postsLocaux returns an array with at least one item', () => {
    const local = postsLocaux();
    expect(Array.isArray(local)).toBe(true);
    expect(local.length).toBeGreaterThanOrEqual(1);
    expect(local[0].videoUrl).toBeDefined();
  });
});
