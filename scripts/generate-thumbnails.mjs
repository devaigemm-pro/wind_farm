/**
 * Generate pre-rendered thumbnails for inspection photos.
 *
 * For each photo in asset-documents/inspection-imports/ that doesn't
 * already have a corresponding thumb_ file, this script:
 *   1. Downloads the original photo
 *   2. Resizes to 200px wide, quality 60, JPEG format using sharp
 *   3. Uploads the result as thumb_{filename} in the same path
 *
 * Usage: node scripts/generate-thumbnails.mjs
 *
 * Requirements: sharp (install as devDependency: pnpm add -D sharp)
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// ─── Config ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://esphlzrzwmzeozjmyvqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzcGhsenJ6d216ZW96am15dnFtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mzk5NjE0NywiZXhwIjoyMDk5NTcyMTQ3fQ._mM8ruMhm6R0jK2JknIu3wxxywz2gRFGHn0ohKcO8jE';

const BUCKET = 'asset-documents';
const BASE_PATH = 'inspection-imports';
const THUMB_PREFIX = 'thumb_';
const THUMB_WIDTH = 200;
const THUMB_QUALITY = 60;

// ─── Supabase Client (service role for admin access) ────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Recursively list all files under a given path in the bucket.
 */
async function listAllFiles(path) {
  const files = [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(path, { limit: 1000 });

  if (error) {
    console.error(`  Error listing ${path}: ${error.message}`);
    return files;
  }

  for (const item of data || []) {
    const fullPath = `${path}/${item.name}`;
    if (item.id === null || item.metadata === null) {
      // It's a folder — recurse
      const subFiles = await listAllFiles(fullPath);
      files.push(...subFiles);
    } else {
      // It's a file
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Get the thumbnail path for a given photo path.
 * E.g., inspection-imports/camp/blade/face/1_DJI_0002.JPG
 *     → inspection-imports/camp/blade/face/thumb_1_DJI_0002.JPG
 */
function getThumbPath(photoPath) {
  const lastSlash = photoPath.lastIndexOf('/');
  const dir = photoPath.substring(0, lastSlash);
  const filename = photoPath.substring(lastSlash + 1);
  return `${dir}/${THUMB_PREFIX}${filename}`;
}

/**
 * Check if a filename is already a thumbnail.
 */
function isThumbnail(path) {
  const filename = path.substring(path.lastIndexOf('/') + 1);
  return filename.startsWith(THUMB_PREFIX);
}

/**
 * Check if a file is an image (JPEG/PNG).
 */
function isImage(path) {
  return /\.(jpg|jpeg|png)$/i.test(path);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Listing all files in', `${BUCKET}/${BASE_PATH}...`);
  const allFiles = await listAllFiles(BASE_PATH);
  console.log(`   Found ${allFiles.length} total files.`);

  // Filter to only original photos (not thumbnails)
  const photos = allFiles.filter(f => isImage(f) && !isThumbnail(f));
  console.log(`   ${photos.length} original photos found.`);

  // Check which ones already have thumbnails
  const existingThumbs = new Set(allFiles.filter(f => isThumbnail(f)));
  const photosNeedingThumbs = photos.filter(p => !existingThumbs.has(getThumbPath(p)));
  console.log(`   ${photosNeedingThumbs.length} photos need thumbnails.`);

  if (photosNeedingThumbs.length === 0) {
    console.log('✅ All photos already have thumbnails. Nothing to do.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < photosNeedingThumbs.length; i++) {
    const photoPath = photosNeedingThumbs[i];
    const thumbPath = getThumbPath(photoPath);
    const progress = `[${i + 1}/${photosNeedingThumbs.length}]`;

    try {
      // Download original
      const { data: downloadData, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(photoPath);

      if (downloadError || !downloadData) {
        console.error(`  ${progress} ✗ Download failed: ${photoPath} — ${downloadError?.message}`);
        failed++;
        continue;
      }

      // Convert Blob to Buffer
      const arrayBuffer = await downloadData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Resize with sharp
      const thumbBuffer = await sharp(buffer)
        .resize({ width: THUMB_WIDTH })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer();

      // Upload thumbnail
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(thumbPath, thumbBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error(`  ${progress} ✗ Upload failed: ${thumbPath} — ${uploadError.message}`);
        failed++;
        continue;
      }

      const sizeKB = (thumbBuffer.length / 1024).toFixed(1);
      console.log(`  ${progress} ✓ ${thumbPath} (${sizeKB} KB)`);
      success++;
    } catch (err) {
      console.error(`  ${progress} ✗ Error processing ${photoPath}: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('─── Summary ───');
  console.log(`  ✓ Generated: ${success}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  Total photos: ${photos.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
