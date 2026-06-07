import {
  normaliserPost,
  postsLocaux,
  VIDEO_PAR_DEFAUT,
  PHOTO_PAR_DEFAUT,
  extraireHashtags,
  convertirLienDrive,
  detecterTypeMedia,
  infererMediaType,
  resoudreUrlsMedia,
} from '../src/utils/feedHelpers';

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
    expect(convertirLienDrive('https://drive.google.com/file/d/abc123/view', 'photo')).toBe(
      'https://drive.google.com/thumbnail?id=abc123&sz=w1920',
    );
    expect(convertirLienDrive('https://drive.google.com/file/d/abc123/view', 'video')).toContain('abc123');
  });

  test('detecterTypeMedia respects intention and mime', () => {
    expect(detecterTypeMedia('image/jpeg', 'photo.jpg', 'photo')).toBe('photo');
    expect(detecterTypeMedia('video/mp4', 'clip.mp4', 'video')).toBe('video');
    expect(detecterTypeMedia(undefined, 'image.png', 'photo')).toBe('photo');
  });

  test('infererMediaType uses mimeType when mediaType absent', () => {
    expect(infererMediaType({ mimeType: 'image/png' })).toBe('photo');
    expect(infererMediaType({ mimeType: 'video/mp4' })).toBe('video');
  });

  test('resoudreUrlsMedia provides photo-specific drive urls', () => {
    const urls = resoudreUrlsMedia('https://drive.google.com/uc?id=abc123', 'photo');
    expect(urls[0]).toContain('thumbnail');
    expect(urls[urls.length - 1]).toBe(PHOTO_PAR_DEFAUT);
  });

  test('postsLocaux returns an array with at least one item', () => {
    const local = postsLocaux();
    expect(Array.isArray(local)).toBe(true);
    expect(local.length).toBeGreaterThanOrEqual(1);
    expect(local[0].videoUrl).toBeDefined();
  });
});
