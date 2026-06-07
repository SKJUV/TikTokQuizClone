import { normaliserPost, postsLocaux, VIDEO_PAR_DEFAUT, extraireHashtags, convertirLienDrive } from '../src/utils/feedHelpers';

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
    expect(p.mediaType).toBe('video');
    expect(p.hashtags).toEqual([]);
  });

  test('normaliserPost preserves comments and hashtags', () => {
    const raw = {
      description: 'Révision #maths',
      hashtags: ['#maths'],
      comments: { c1: { auteur: 'alice', texte: 'Top', createdAt: 1 } },
      mediaType: 'photo',
      createdAt: 42,
    };
    const p = normaliserPost('id2', raw);
    expect(p.hashtags).toEqual(['#maths']);
    expect(p.comments).toEqual(raw.comments);
    expect(p.mediaType).toBe('photo');
    expect(p.createdAt).toBe(42);
  });

  test('extraireHashtags returns lowercase tags', () => {
    expect(extraireHashtags('Cours #React #Hooks')).toEqual(['#react', '#hooks']);
    expect(extraireHashtags('')).toEqual([]);
  });

  test('convertirLienDrive transforms share links', () => {
    expect(convertirLienDrive('https://drive.google.com/file/d/abc123/view')).toBe(
      'https://drive.usercontent.google.com/download?id=abc123&export=download&confirm=t',
    );
  });

  test('postsLocaux returns an array with at least one item', () => {
    const local = postsLocaux();
    expect(Array.isArray(local)).toBe(true);
    expect(local.length).toBeGreaterThanOrEqual(1);
    expect(local[0].videoUrl).toBeDefined();
  });
});
