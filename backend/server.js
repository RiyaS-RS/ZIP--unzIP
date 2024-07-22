const express = require('express');
const { Storage } = require('@google-cloud/storage');
const multer = require('multer');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3002;

const storage = new Storage({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

app.post('/generate-presigned-url', async (req, res) => {
    const { fileName } = req.body;
    if (!fileName) {
        return res.status(400).send('File name is required');
    }
    const options = {
        version: 'v4',
        action: 'write',
        expires: Date.now() + 1 * 60 * 60 * 1000, 

        contentType: 'application/zip',
    };
    try {
        const [url] = await storage.bucket(bucketName).file(fileName).getSignedUrl(options);
        res.json({ preSignedUrl: url });
    } catch (err) {
        console.error('Error generating presigned URL:', err);
        res.status(500).send(err.message);
    }
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('Upload request received');
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.file;
    console.log(`File received: ${file.originalname}`);

    const bucket = storage.bucket(bucketName);
    const blob = bucket.file(file.originalname);
    const blobStream = blob.createWriteStream();

    blobStream.on('error', (err) => {
      console.error('Error uploading to GCS:', err);
      res.status(500).json({ error: 'Error uploading file' });
    });

    blobStream.on('finish', async () => {
      console.log('File uploaded to GCS, waiting for processing');
      setTimeout(async () => {
        try {
          const [files] = await bucket.getFiles();
          const fileData = files.map((file, index) => ({
            no: index + 1,
            name: file.name,
            size: file.metadata.size,
            created: file.metadata.timeCreated,
            type: file.name.split('.').pop() 
          }));

          for (let file of fileData) {
            await pool.query(
              'INSERT INTO files (name, size, created, type) VALUES ($1, $2, $3, $4)',
              [file.name, file.size, file.created, file.type]
            );
          }

          console.log('File processed and data inserted into database');
          res.json({ message: 'File uploaded and processed successfully', files: fileData });
        } catch (err) {
          console.error('Error processing uploaded file:', err);
          res.status(500).json({ error: 'Error processing file', details: err.message });
        }
      }, 5000); 
    });

    blobStream.end(file.buffer);
  } catch (error) {
    console.error('Error in /upload:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.get('/files', async (req, res) => {
  try {
    console.log('Files request received');
    const result = await pool.query('SELECT * FROM files ORDER BY created DESC');
    const filesWithExtension = result.rows.map(file => ({
      ...file,
      type: file.name.split('.').pop() 
    }));
    console.log(`Returning ${filesWithExtension.length} files`);
    res.json(filesWithExtension);
  } catch (error) {
    console.error('Error in /files:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.post('/reset-files', async (req, res) => {
  try {

    await pool.query('TRUNCATE TABLE files');

    const [files] = await storage.bucket(bucketName).getFiles();
    await Promise.all(files.map(file => file.delete()));

    res.json({ message: 'Files table and storage bucket reset successfully' });
  } catch (error) {
    console.error('Error resetting files:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).send('Route not found');
});

const server = app.listen(port, async (err) => {
  if (err) {
    console.error('Error starting server:', err);
  } else {
    console.log(`Server running at http://localhost:${port}`);
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('Successfully connected to the database');
    } catch (err) {
      console.error('Error connecting to the database:', err);
    }
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('HTTP server closed')
  })
});