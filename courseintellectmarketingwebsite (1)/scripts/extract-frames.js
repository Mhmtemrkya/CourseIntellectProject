/**
 * Extracts JPEG frame sequences from the 3 hero videos.
 *
 * Output:
 *   public/frames/v1/frame_001.jpg ... frame_NNN.jpg
 *   public/frames/v2/...
 *   public/frames/v3/...
 *   public/frames/manifest.json   (per-video frame counts)
 *
 * Usage:
 *   npm run frames
 */

const ffmpegPath = require('ffmpeg-static');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const FRAMES = path.join(PUB, 'frames');

const VIDEOS = [
  { src: 'hero-dimensional-portal.mp4', out: 'v1' },
  { src: 'hero-dimensional-portal2.mp4', out: 'v2' },
  { src: 'hero-dimensional-portal3.mp4', out: 'v3' },
];

// Tunables
const TARGET_FPS = 24;        // frames per second to extract
const SCALE_WIDTH = 1280;     // downscale to 1280p (smaller files, plenty for hero)
const QUALITY = '4';          // ffmpeg -q:v (1=best, 31=worst). 4 = high-quality JPEG (~80-150 KB each)

function probeDuration(src) {
  // Probe duration via ffmpeg by reading container info
  // ffmpeg-static ships only ffmpeg, not ffprobe — we parse stderr instead.
  const res = spawnSync(ffmpegPath, ['-i', src], { encoding: 'utf8' });
  const out = (res.stderr || '') + (res.stdout || '');
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const [, h, mn, s] = m;
  return parseInt(h, 10) * 3600 + parseInt(mn, 10) * 60 + parseFloat(s);
}

function clean(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function extract({ src, out }) {
  const srcPath = path.join(PUB, src);
  if (!fs.existsSync(srcPath)) {
    console.error(`✗ missing source: ${srcPath}`);
    return null;
  }
  const outDir = path.join(FRAMES, out);
  clean(outDir);

  const duration = probeDuration(srcPath);
  console.log(`▶ ${src} — duration: ${duration ? duration.toFixed(2) + 's' : 'unknown'}`);

  const args = [
    '-y',
    '-i', srcPath,
    '-vf', `fps=${TARGET_FPS},scale=${SCALE_WIDTH}:-2`,
    '-q:v', QUALITY,
    '-pix_fmt', 'yuvj420p',
    path.join(outDir, 'frame_%04d.jpg'),
  ];
  const res = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error(`✗ ffmpeg failed for ${src}`);
    return null;
  }
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).sort();
  console.log(`✓ ${out}: ${files.length} frames extracted`);

  // Quick stats
  const totalBytes = files.reduce((sum, f) => sum + fs.statSync(path.join(outDir, f)).size, 0);
  console.log(`  total ${(totalBytes / 1024 / 1024).toFixed(1)} MB · avg ${(totalBytes / files.length / 1024).toFixed(1)} KB/frame`);

  return { dir: out, count: files.length, duration: duration || null };
}

function main() {
  if (!fs.existsSync(FRAMES)) fs.mkdirSync(FRAMES, { recursive: true });

  const manifest = { fps: TARGET_FPS, width: SCALE_WIDTH, videos: [] };
  for (const v of VIDEOS) {
    const result = extract(v);
    if (result) manifest.videos.push(result);
  }

  fs.writeFileSync(path.join(FRAMES, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✓ wrote manifest: ${path.join(FRAMES, 'manifest.json')}`);
  console.log(`  ${manifest.videos.reduce((s, v) => s + v.count, 0)} frames total\n`);
}

main();
