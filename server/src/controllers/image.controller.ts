import {Request, Response} from 'express';
import {
  createImages,
  getSignedURLs,
} from '../services/image.service';

/** Controller to handle ticket generation requests */
export const imageGenerationHandler = async (req: Request, res: Response) => {
  const {fromName, toName, message, id: presaveId} = req.body;

  if ([fromName, toName, message, presaveId].includes(undefined)) {
    res.status(400).json({
      success: false,
      message:
        "Invalid request: please include 'fromName', 'toName', 'message' and 'id' properties",
    });
    return;
  }

  await createImages(fromName, toName, message, presaveId);

  res.json({
    success: true,
    message: 'Tickets created',
  });
};

/** Controller to handle ticket requests */
export const imageRetrievalHandler = async (req: Request, res: Response) => {
  const id = req.query.id as string;

  if (!id) {
    res.status(400).json({
      success: false,
      message: 'No data ID parameter passed',
    });
    return;
  }

  const urls = await getSignedURLs(id);

  res.json({
    success: true,
    urls,
  });
};
