import {createCanvas, loadImage, registerFont, Canvas} from 'canvas';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import drawMultilineText from 'canvas-multiline-text';
import {Storage} from '@google-cloud/storage';
import dayjs from 'dayjs'
import fs from 'fs'

require('dotenv').config();
dayjs.extend(advancedFormat);

const storage = new Storage();
const bucketName = process.env.FILE_BUCKET;
const bucket = storage.bucket(bucketName!);

/**
 * Create a horizontal picture with user defined variables
 *
 * Creates canvas with background image with variables overlaid
 *
 * Uploads the file to Google Cloud Storage and retrieves a signed URL for download
 *
 * @param fromName UGC: 'From' name
 * @param toName UGC: 'To' name
 * @param message UGC: 'Message'
 * @param id ID to link to front-end
 */
 export const createImages = async (fromName: string, toName: string, message: string, id: string) => {

  registerFont(`./assets/ernie.ttf`, { family: 'Ernie' });
  const canvas = createCanvas(1920, 1080);
  const ctx = canvas.getContext('2d');

  const picture = await loadImage('./assets/picture-horizontal.png');

  ctx.drawImage(picture, 0, 0);
  ctx.font = '48px Ernie';
  ctx.textBaseline = 'top';

  // DRAW 'TO' NAME
  ctx.save();
  ctx.rotate(-11 * Math.PI / 180);
  ctx.fillText(`TO: ${toName}`, 262, 200, 200);
  ctx.restore();

  // DRAW 'FROM' NAME
  ctx.save();
  ctx.rotate(-1 * Math.PI / 180);
  ctx.fillText(`FROM: ${fromName}`, 1276, 642);
  ctx.restore();

  // DRAW DATE
  const currentDate = getDate();
  ctx.save();
  ctx.rotate(-1 * Math.PI / 180);
  ctx.fillText(currentDate, 1500, 950);
  ctx.restore();

  // DRAW MESSAGE
  ctx.save();
  ctx.rotate(-8 * Math.PI / 180);
  const fontSizeUsed = drawMultilineText(ctx, message, {
    rect: {
      x: 100,
      y: 300,
      width: 1000,
      height: 400
    },
    font: 'Ernie',
    lineHeight: 1.4,
    minFontSize: 48,
    maxFontSize: 160
  });

  try {
    await createOutputImages(canvas, id);
  } catch (error) {
    throw Error(`Failed to insert image into output files. ${error.toString()}`);
  }

  return;

};

/**
 * Create horizontal and vertical output images from one generated picture
 * - Puts picture in two separate output canvases to create horizontal and vertical output images
 * - Uploads files to GCS
 * @param horizontalImage Canvas of created image
 * @param id Data ID
 */
 const createOutputImages = async (horizontalImage: Canvas, id: string) => {

  /**
   * Create a horizontal output image
   * - Puts the created picture in a horizontal output image
   * - Uploads file to GCS
   */
  const createHorizontalOutputImage = async () => {

    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    const background = await loadImage('./assets/output-horizontal.jpg');
    ctx.drawImage(background, 0, 0);

    ctx.save()
    ctx.rotate(10 * Math.PI / 180);
    ctx.drawImage(horizontalImage, 800, 80, 1100, 619);

    const buffer = canvas.toBuffer('image/jpeg');
    const filename = `./output/hor-${id}.jpg`;
    fs.writeFileSync(filename, buffer);

    await bucket.upload(filename, {
      destination: `pictures/${id}/DROELOE-picture-horizontal.jpg`
    });

    fs.unlinkSync(filename);

    return;

  }

  /**
   * Create a vertical output image
   * - Puts the created picture in a vertical output image
   * - Uploads file to GCS
   */
  const createVerticalOutputImage = async () => {

    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    const background = await loadImage('./assets/output-vertical.jpg');
    ctx.drawImage(background, 0, 0);

    ctx.save()
    ctx.rotate(8 * Math.PI / 180);
    ctx.drawImage(horizontalImage, 200, 800, 950, 534);

    const buffer = canvas.toBuffer('image/jpeg');
    const filename = `./output/vert-${id}.jpg`;
    fs.writeFileSync(filename, buffer);

    await bucket.upload(filename, {
      destination: `pictures/${id}/DROELOE-picture-vertical.jpg`
    });

    fs.unlinkSync(filename);

    return;

  }

  return Promise.all([createHorizontalOutputImage(), createVerticalOutputImage()]);

}

/**
 * Get date string in 'MMMM Do' format
 * @example 'October 1st'
 */
 const getDate = (): string => {
  return dayjs().format('MMMM D');
}

/**
 * Get a horizontal ticket's file data from GCS by its uuid
 *
 * Used for Twitter sharing feature
 *
 * @param id the presave UUID
 * @returns the raw file data
 */
 export const getFileData = async (id: string) => {
  const fileDownload = await bucket
    .file(`pictures/${id}/DROELOE-picture-horizontal.jpg`)
    .download();
  return fileDownload[0];
};

/**
 * Get signed URLs for all files from the given data ID
 * @param id ID that is used to connect to right user
 */
export const getSignedURLs = async (id: string) => {

  const expiration = Date.now() + 604800;
  const urls: {vertical?: string, horizontal?: string} = {};

  try {
    const [files] = await bucket.getFiles({ prefix: `pictures/${id}` });
    if (files.length !== 2) {
      throw Error(`Unable to find pictures with ID: ${id}`);
    }
    for (const file of files) {

      const [signedURL] = await file.getSignedUrl({
        action: 'read',
        expires: expiration,
        version: 'v4',
      });

      if (file.name.includes('vertical')) {
        urls.vertical = signedURL;
      } else {
        urls.horizontal = signedURL;
      }

    };

    return urls;
  } catch (error) {
    console.error(error);
    throw Error(error)
  }

};
