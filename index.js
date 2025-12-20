import express from 'express';
import { chromium } from 'playwright';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

/**
 * ✅ Health check (fixes Cannot GET /)
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'geneye-video-worker'
  });
});

/**
 * 🎥 Capture video endpoint
 */
app.post('/capture', async (req, res) => {
  const { question, viewport, run_date } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  const width = viewport?.width || 430;
  const height = viewport?.height || 932;

  const tmpDir = '/tmp';
  const outputName = `geneye-${run_date}-${Date.now()}.mp4`;
  const finalVideo = path.join(tmpDir, outputName);

  let browser;
  let context;

  try {
    browser = await chromium.launch();
    context = await browser.newContext({
      viewport: { width, height },
      recordVideo: {
        dir: tmpDir,
        size: { width, height }
      }
    });

    const page = await context.newPage();

    await page.goto('https://geneye.ai', { waitUntil: 'networkidle' });

    // ⚠️ adjust selector if UI changes
    await page.fill('textarea', question);
    await page.keyboard.press('Enter');

    // Record ~9 seconds
    await page.waitForTimeout(9000);

    await context.close();
    await browser.close();

    // Find newest recorded webm
    const recordedFile = fs
      .readdirSync(tmpDir)
      .filter(f => f.endsWith('.webm'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(tmpDir, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time)[0];

    if (!recordedFile) {
      throw new Error('No video recorded');
    }

    const recordedPath = path.join(tmpDir, recordedFile.name);

    // Convert to mp4
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${recordedPath}" -movflags faststart -pix_fmt yuv420p "${finalVideo}"`,
        err => (err ? reject(err) : resolve())
      );
    });

    const title = 'Same question. Different AI answers.';
    const caption = `We asked GenEye:\n"${question}"\n\nWhich answer do you agree with? 👀`;

    res.json({
      success: true,
      video: finalVideo,
      title,
      caption
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    try {
      if (context) await context.close();
      if (browser) await browser.close();
    } catch (_) {}
  }
});

app.listen(PORT, () => {
  console.log(`GenEye video worker running on port ${PORT}`);
});
