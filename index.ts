import { Command } from 'commander';
import sharp from 'sharp';
import fs from 'fs';

const ALPHA_OFFSET = 3;
const RGBA_CHANNELS = 4;

// Helper function to create a circular mask
async function createCircularMask(width: number, height: number, raw: boolean = true): Promise<Buffer> {
  const radius = (Math.min(width, height) / 2);
  const circle = Buffer.alloc(width * height * RGBA_CHANNELS, 0);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < radius) {
        const idx = (y * width + x) * RGBA_CHANNELS;
        circle[idx + ALPHA_OFFSET] = 255; // Set alpha to 255 for circle area
      }
    }
  }
    // Convert mask to PNG buffer
    const mask = await sharp(circle, { raw: { width, height, channels: RGBA_CHANNELS } })
    .png();

    // Returns raw wether the mask is needed to compare with the image or to be used as a mask
    if (raw) {
      return await mask.raw().toBuffer();
    }
    return await mask.toBuffer();
}

// Helper function to detect if image colors convey a "happy" feeling
async function detectHappiness(imageBuffer: Buffer): Promise<boolean> {
  const { dominant } = await sharp(imageBuffer).stats();
  return dominant.r > 100 && dominant.g > 100; // Simple happy color detection
}

// Helper function to check if an image is circular
async function checkIfCircular(imageBuffer: Buffer, width: number, height: number): Promise<void> {
  const maskBuffer = await createCircularMask(width, height);
  const rawImage = await sharp(imageBuffer).png().raw().toBuffer();

  for (let i = 0; i < width * height; i++) {
    if (maskBuffer[i * RGBA_CHANNELS + ALPHA_OFFSET] === 0 && rawImage[i * RGBA_CHANNELS + ALPHA_OFFSET] > 50) {
      throw new Error('Image has non-transparent pixels outside the circle.');
    }
  }
}

async function checkImage(metadata: sharp.Metadata, imageBuffer: Buffer): Promise<void> {
  // Check image dimensions
  if (metadata.width! > 512 || metadata.height! > 512) {
    throw new Error('Image dimensions exceed 512x512 pixels.');
  }
  // Check if the image is circular
  await checkIfCircular(imageBuffer, metadata.width!, metadata.height!);

  // Check if the image conveys a happy feeling
  const isHappy: boolean = await detectHappiness(imageBuffer);
  if (!isHappy) {
    throw new Error('Image does not convey a happy feeling.');
  }

  console.log('Image is valid, circular, and conveys a happy feeling.');
}

// Setup the CLI command
const program = new Command();
program
  .version('1.0.0')
  .description('Player badge validator/formater tool for images')
  .argument('<filepath>', 'Path to the image file')
  .option('--check', 'Check if the image is already circular')
  .action(async (filepath, options) => {
    try {
      // Ensure the file exists
      if (!fs.existsSync(filepath)) {
        throw new Error('File does not exist.');
      }

      const image = sharp(filepath);
      // Extract the image as a buffer
      const imageBuffer: Buffer = await image.png().toBuffer();
      // Get image metadata
      const metadata: sharp.Metadata = await image.metadata();
      if (!metadata || metadata === undefined || !metadata.width || !metadata.height) {
        throw new Error('Failed to read image metadata.');
      }

      if (options.check) {
        if (metadata.format !== 'png') {
          throw new Error('Image format is not PNG.');
        }
        await checkImage(metadata, imageBuffer);
      } else {
        // Create a circular mask
        const circleMask = await createCircularMask(metadata.width!, metadata.height!, false);

        // Apply the circular mask and convert the image to PNG
        await sharp(imageBuffer)
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .png().toFile('output.png');
        console.log('Image is now circular in the output.png file!');
      }
    } catch (error: any) {
      console.error(`Validation failed: ${error.message}`);
    }
  });

program.parse(process.argv);
