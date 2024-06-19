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
    let maxXLeft = cx - Math.sqrt(radius * radius - (y - cy) * (y - cy));
    let minXRight = cx + Math.sqrt(radius * radius - (y - cy) * (y - cy));

    for (let x = maxXLeft; x < minXRight; x++) {
      const idx = (y * width + x) * RGBA_CHANNELS;
      circle[idx + ALPHA_OFFSET] = 255; // Set alpha to 255 for circle area
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

// Function to convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }

  return [h, s, l];
}


// Constants for HSL-based happiness detection

// ranges and minimum values for HSL components to detect a "happy" color
const happyHueRange = { min: 50, max: 220 };
const minSaturation = 0.5;
const minLightness = 0.6;

// weights for each HSL component
const weightHue = 0.7;
const weightSaturation = 0.2;
const weightLightness = 0.1;

// threshold for total score to consider a color conveys a "happy" feeling
const threshold = 0.6;


// HSL-based happiness detection
function isHappyColorHSL(color: { r: number, g: number, b: number }): boolean {
  const [h, s, l] = rgbToHsl(color.r, color.g, color.b);

  const hueScore = (h >= happyHueRange.min && h <= happyHueRange.max) ? 1 : 0;
  const saturationScore = (s >= minSaturation) ? 1 : 0;
  const lightnessScore = (l >= minLightness) ? 1 : 0;
  const totalScore = (hueScore * weightHue) + (saturationScore * weightSaturation) + (lightnessScore * weightLightness);
  return totalScore >= threshold;
}

// Helper function to detect if image colors convey a "happy" feeling
async function detectHappiness(imageBuffer: Buffer): Promise<boolean> {
  const { dominant } = await sharp(imageBuffer).stats();
  return isHappyColorHSL( { r: dominant.r, g: dominant.g, b: dominant.b });
}

// Helper function to check if an image is circular
async function checkIfCircular(imageBuffer: Buffer, width: number, height: number): Promise<void> {
  const rawImage = await sharp(imageBuffer).png().raw().toBuffer();

  const radius = (Math.min(width, height) / 2);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    let minXLeft = 0;
    let maxXLeft = cx - Math.sqrt(radius * radius - (y - cy) * (y - cy));

    let minXRight = cx + Math.sqrt(radius * radius - (y - cy) * (y - cy));
    let maxXRight = width;

    for (let x = minXLeft; x < maxXLeft; x++) {
      if (rawImage[(y * width + x) * RGBA_CHANNELS + ALPHA_OFFSET] > 50) {
        throw new Error('Image has non-transparent pixels outside the circle.');
      }
    }
    for (let x = minXRight; x < maxXRight; x++) {
      if (rawImage[(y * width + x) * RGBA_CHANNELS + ALPHA_OFFSET] > 50) {
        throw new Error('Image has non-transparent pixels outside the circle.');
      }
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
