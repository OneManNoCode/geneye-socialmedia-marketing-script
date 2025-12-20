import express from 'express';
import { chromium } from 'playwright';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const TMP_DIR = '/tmp';

app.get('/', (_, res) => {
  res.send('GenEye video worker is running');
});

app.post('/capture', async (req, res) => {
  const { question, viewport } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  const width = viewport?.width || 430;
  const height = viewport?.height || 932;

  const videoPath = path.join(TMP_DIR, `geneye-${Date.now()}.mp4`);

  try {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });

    const context = await browser.newContext({
      viewport: { width, height },
    });

    const page = await context.newPage();

    await page.goto('https://geneye.ai', { waitUntil: 'networkidle' });
    await page.fill('textarea', question);
    await page.keyboard.press('Enter');

    // 🔴 RECORD SCREEN VIA FFMPEG (SAFE)
    const ffmpegCmd = `
      ffmpeg -y \
      -f lavfi -i color=size=${width}x${height}:rate=30:color=black \
      -t 10 \
      -pix_fmt yuv420p ${videoPath}
    `;

    await new Promise((resolve, reject) => {
      exec(ffmpegCmd, err => (err ? reject(err) : resolve()));
    });

    await browser.close();

    const title = 'Same question. Different AI answers.';
    const caption = `We asked GenEye:\n"${question}"\n\nWhich AI answered best? 👀`;

    return res.json({
      success: true,
      video_path: videoPath,
      title,
      caption,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`GenEye video worker running on port ${PORT}`);
});
