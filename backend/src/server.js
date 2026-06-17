const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const bucketName = process.env.S3_BUCKET_NAME || 'taller3-bucket';
const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.S3_ENDPOINT_URL || 'http://localstack:4566';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'test';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 100 * 1024 * 1024),
  },
});

app.use(cors());
app.use(express.json());

function safeFileName(fileName) {
  const parsed = path.parse(fileName);
  const baseName = parsed.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const extension = parsed.ext.replace(/[^a-zA-Z0-9.]/g, '');
  return `${baseName || 'file'}${extension}`;
}

function buildObjectKey(originalName) {
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`;
  return `uploads/${uniquePrefix}-${safeFileName(originalName)}`;
}

function downloadUrlForKey(key) {
  return `/files/${encodeURIComponent(key)}/download`;
}

async function getObjectDetails(item) {
  const head = await s3.send(
    new HeadObjectCommand({
      Bucket: bucketName,
      Key: item.Key,
    })
  );

  return {
    key: item.Key,
    originalName: head.Metadata?.originalname || path.basename(item.Key),
    size: item.Size,
    lastModified: item.LastModified,
    mimeType: head.ContentType || 'application/octet-stream',
    downloadUrl: downloadUrlForKey(item.Key),
  };
}

async function ensureBucketExists() {
  try {
    await s3.send(
      new HeadBucketCommand({
        Bucket: bucketName,
      })
    );
  } catch (error) {
    if (error?.name !== 'NotFound' && error?.$metadata?.httpStatusCode !== 404) {
      throw error;
    }

    await s3.send(
      new CreateBucketCommand({
        Bucket: bucketName,
      })
    );
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(async (_req, _res, next) => {
  try {
    await ensureBucketExists();
    next();
  } catch (error) {
    next(error);
  }
});

app.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ message: 'Debes enviar al menos un archivo.' });
    }

    const uploadedFiles = [];

    for (const file of files) {
      const key = buildObjectKey(file.originalname);

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            originalname: file.originalname,
          },
        })
      );

      uploadedFiles.push({
        key,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        downloadUrl: downloadUrlForKey(key),
      });
    }

    res.status(201).json({
      message: 'Archivos subidos correctamente.',
      files: uploadedFiles,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/files/latest', async (_req, res, next) => {
  try {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
      })
    );

    const contents = (response.Contents || [])
      .filter((item) => item.Key)
      .sort((left, right) => new Date(right.LastModified || 0) - new Date(left.LastModified || 0))
      .slice(0, 3);

    const files = [];

    for (const item of contents) {
      files.push(await getObjectDetails(item));
    }

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

app.get('/files', async (_req, res, next) => {
  try {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
      })
    );

    const contents = (response.Contents || [])
      .filter((item) => item.Key)
      .sort((left, right) => new Date(right.LastModified || 0) - new Date(left.LastModified || 0));

    const files = [];

    for (const item of contents) {
      files.push(await getObjectDetails(item));
    }

    res.json({ files });
  } catch (error) {
    next(error);
  }
});

app.get('/files/:key/download', async (req, res, next) => {
  try {
    const key = decodeURIComponent(req.params.key);

    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    const object = await s3.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    const downloadName = head.Metadata?.originalname || path.basename(key);

    res.setHeader('Content-Type', head.ContentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/\"/g, '')}"`);

    if (typeof object.Body.pipe === 'function') {
      object.Body.pipe(res);
      return;
    }

    object.Body.on('error', next);
    object.Body.pipe(res);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = error?.name === 'NoSuchKey' ? 404 : 500;
  const message =
    status === 404
      ? 'El archivo solicitado no existe.'
      : error?.message || 'Ocurrió un error inesperado.';

  res.status(status).json({ message });
});

app.listen(port, () => {
  console.log(`Backend escuchando en http://localhost:${port}`);
});
