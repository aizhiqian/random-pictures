const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

const CATEGORY_PATTERN = /^[a-zA-Z0-9_-]+$/;
const CACHE_TTL_MS = Number.parseInt(process.env.CACHE_TTL_MS || '30000', 10);

const fileCache = new Map();
const dirCache = new Map();

class AppError extends Error {
  constructor(code, message, status = 500, meta = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.meta = meta;
  }
}

const now = () => Date.now();

const getCache = (cache, key) => {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
};

const setCache = (cache, key, value) => {
  if (!Number.isFinite(CACHE_TTL_MS) || CACHE_TTL_MS <= 0) {
    return;
  }

  cache.set(key, {
    value,
    expiresAt: now() + CACHE_TTL_MS,
  });
};

const clearCaches = () => {
  fileCache.clear();
  dirCache.clear();
};

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const readDir = (dirPath) => new Promise((resolve, reject) => {
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      reject(err);
      return;
    }

    resolve(files);
  });
});

const readFileUtf8 = (filePath) => new Promise((resolve, reject) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      reject(err);
      return;
    }

    resolve(data);
  });
});

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const getTxtFiles = async (dirPath) => {
  const cacheKey = path.resolve(dirPath);
  const cached = getCache(dirCache, cacheKey);

  if (cached) {
    return cached;
  }

  const files = await readDir(dirPath);
  const txtFiles = files.filter((file) => file.endsWith('.txt'));
  setCache(dirCache, cacheKey, txtFiles);

  return txtFiles;
};

const getValidImageUrls = async (filePath) => {
  const cacheKey = path.resolve(filePath);
  const cached = getCache(fileCache, cacheKey);

  if (cached) {
    return cached;
  }

  let data;

  try {
    data = await readFileUtf8(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new AppError('CATEGORY_NOT_FOUND', 'Category not found', 404, { filePath });
    }

    throw new AppError('FILE_READ_FAILED', 'Failed to read category file', 500, {
      filePath,
      cause: error && error.message,
    });
  }

  const urls = data
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter(isValidHttpUrl);

  if (urls.length === 0) {
    throw new AppError('CATEGORY_NO_VALID_URLS', 'Category has no valid image URLs', 422, { filePath });
  }

  setCache(fileCache, cacheKey, urls);

  return urls;
};

// 从指定文件中获取随机图像链接的函数
const getRandomImage = async (filePath) => {
  const validUrls = await getValidImageUrls(filePath);
  return pickRandom(validUrls);
};

// 从所有文本文件中随机获取图片链接的函数
const getRandomImageFromAllFiles = async () => {
  const dirPath = path.join(__dirname);
  const txtFiles = await getTxtFiles(dirPath);

  if (txtFiles.length === 0) {
    throw new AppError('NO_CATEGORY_FILES', 'No category files found', 404, { dirPath });
  }

  const settled = await Promise.allSettled(
    txtFiles.map((file) => getRandomImage(path.join(dirPath, file))),
  );

  const availableImages = settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  if (availableImages.length === 0) {
    throw new AppError('NO_IMAGES_AVAILABLE', 'No valid image URLs available', 404, {
      dirPath,
      categoryFileCount: txtFiles.length,
    });
  }

  return pickRandom(availableImages);
};

const logError = (req, error) => {
  const payload = {
    level: 'error',
    route: req.path,
    method: req.method,
    category: req.params && req.params.category,
    errorType: error && error.code ? error.code : 'INTERNAL_ERROR',
    message: error && error.message ? error.message : 'Unknown error',
  };

  console.error(JSON.stringify(payload));
};

const sendError = (req, res, error) => {
  if (error instanceof AppError) {
    logError(req, error);
    res.status(error.status).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  logError(req, error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
};

// 使用cors中间件
app.use(cors({
  origin: '*',
  // 或者指定特定的域名
  // origin: 'https://www.api1.link'
}));

// Serve static files from the public directory
app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 所有类别随机图像的路由
app.get('/random', async (req, res) => {
  try {
    const imageUrl = await getRandomImageFromAllFiles();
    res.redirect(imageUrl);
  } catch (error) {
    sendError(req, res, error);
  }
});

// Default route to serve the documentation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 指定类别随机图像的路由
app.get('/:category', async (req, res) => {
  const category = req.params.category;

  if (!CATEGORY_PATTERN.test(category)) {
    sendError(req, res, new AppError('INVALID_CATEGORY', 'Invalid category format', 400, { category }));
    return;
  }

  const filePath = path.join(__dirname, `${category}.txt`);

  try {
    const imageUrl = await getRandomImage(filePath);
    res.redirect(imageUrl);
  } catch (error) {
    sendError(req, res, error);
  }
});

module.exports = app;
module.exports._internal = {
  clearCaches,
};
