const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadManyFilesToCloudinary } = require('../../utiils/storj');
const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
    files: 10 // Max 10mb files at once
  }
});

// Upload message files endpoint
router.post('/', upload.array('file', 5), async (req, res) => {
  try {
    console.log('📤 [UPLOAD] Upload request received');
    console.log('📤 [UPLOAD] Files count:', req.files?.length || 0);
    console.log('📤 [UPLOAD] Request body keys:', Object.keys(req.body));
    
    if (!req.files || req.files.length === 0) {
      console.log('❌ [UPLOAD] No files provided');
      return res.status(400).json({
        ok: false,
        message: 'No files provided'
      });
    }

    // Validate file sizes and types
    const maxImageSize = 10 * 1024 * 1024; // 10MB
    const maxVideoSize = 500 * 1024 * 1024; // 500MB 
    
    for (const file of req.files) {
      if (file.mimetype.startsWith('image/')) {
        if (file.size > maxImageSize) {
          return res.status(400).json({
            ok: false,
            message: `Image ${file.originalname} exceeds 10MB limit`
          });
        }
      } else if (file.mimetype.startsWith('video/')) {
        if (file.size > maxVideoSize) {
          return res.status(400).json({
            ok: false,
            message: `Video ${file.originalname} exceeds 500MB limit`

          });
        }
      } else {
        return res.status(400).json({
          ok: false,
          message: `File ${file.originalname} is not an image or video`
        });
      }
    }

    // Upload files to Storj
    console.log('📤 [UPLOAD] Starting upload to Storj...');
    const uploadResults = await uploadManyFilesToCloudinary(req.files, 'message');
    console.log('📤 [UPLOAD] Upload results:', uploadResults);
    
    // Extract file URLs
    const fileUrls = uploadResults
      .filter(result => result.file_link && result.file_link.trim() !== '')
      .map(result => result.file_link);
    
    console.log('📤 [UPLOAD] File URLs extracted:', fileUrls);

    if (fileUrls.length === 0) {
      console.log('❌ [UPLOAD] No valid file URLs generated, trying local fallback...');
      
      // Fallback: Save files locally and return local URLs
      const localUrls = [];
      const uploadsDir = path.join(__dirname, '../../../uploads');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileName = `${Date.now()}-${i}-${file.originalname}`;
        const filePath = path.join(uploadsDir, fileName);
        
        try {
          fs.writeFileSync(filePath, file.buffer);
          const localUrl = `/uploads/${fileName}`;
          localUrls.push(localUrl);
          console.log('✅ [UPLOAD] Saved locally:', localUrl);
        } catch (error) {
          console.error('❌ [UPLOAD] Failed to save locally:', error);
        }
      }
      
      if (localUrls.length === 0) {
        return res.status(500).json({
          ok: false,
          message: 'Failed to upload files - both Storj and local storage failed',
          details: uploadResults
        });
      }
      
      console.log('✅ [UPLOAD] Using local fallback URLs:', localUrls);
      return res.status(200).json({
        ok: true,
        message: 'Files uploaded successfully (local fallback)',
        fileUrls: localUrls,
        count: localUrls.length
      });
    }

    res.status(200).json({
      ok: true,
      message: 'Files uploaded successfully',
      fileUrls: fileUrls,
      count: fileUrls.length
    });

  } catch (error) {
    console.error('❌ [UPLOAD] Upload error:', error);
    console.error('❌ [UPLOAD] Error stack:', error.stack);
    res.status(500).json({
      ok: false,
      message: `Internal server error during file upload: ${error.message}`,
      error: error.message
    });
  }
});

module.exports = router;


















