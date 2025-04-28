# Sharp Remove BG AI

[![](https://img.shields.io/npm/v/sharp-remove-bg-ai)](https://www.npmjs.com/package/sharp-remove-bg-ai)

Sharp Remove BG AI lets you **easily remove backgrounds** from images using the [U2-Net AI model](https://github.com/xuebinqin/U-2-Net).

This package uses [sharp](https://github.com/lovell/sharp) for image processing and [onnxruntime-node](https://github.com/microsoft/onnxruntime) for running the AI model.

⚠️ This project is a fork from: [rembg-node](https://www.npmjs.com/package/rembg-node) by [makidoll](https://github.com/makidoll)

## Installation

```bash
# Using npm
npm install sharp-remove-bg-ai sharp

# Using yarn
yarn add sharp-remove-bg-ai sharp

# Using pnpm
pnpm add sharp-remove-bg-ai sharp
```

Note: `sharp` is a peer dependency and must be installed separately.

## Usage

### Basic Example

```typescript
import { Rembg } from "sharp-remove-bg-ai";
import sharp from "sharp";

// Using CommonJS:
// const { Rembg } = require("sharp-remove-bg-ai");
// const sharp = require("sharp");

async function removeBackground() {
  // Create an instance of Rembg
  const rembg = new Rembg({
    logging: true, // Optional: set to false to disable logging
  });

  // Load your image with sharp
  const input = sharp("path/to/your/image.jpg");
  
  // Remove the background
  const output = await rembg.remove(input);
  
  // Save the result
  await output.png().toFile("output.png");
  
  // Optionally trim transparent edges
  await output.trim().png().toFile("output-trimmed.png");
}

removeBackground().catch(console.error);
```

### Integration with Express.js

```typescript
import express from "express";
import multer from "multer";
import { Rembg } from "sharp-remove-bg-ai";
import sharp from "sharp";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const rembg = new Rembg();

app.post("/remove-background", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No image uploaded");
    }
    
    // Process the uploaded image
    const input = sharp(req.file.buffer);
    const output = await rembg.remove(input);
    
    // Send the processed image back
    const processedImageBuffer = await output.png().toBuffer();
    
    res.set("Content-Type", "image/png");
    res.send(processedImageBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing image");
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### Using in React/Next.js

```typescript
// Example component that removes background from uploaded image
import { useState, useRef } from 'react';
import axios from 'axios';

function BackgroundRemover() {
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOriginalImage(URL.createObjectURL(file));
      setProcessedImage(null);
    }
  };

  const removeBackground = async () => {
    if (!fileInputRef.current.files[0]) return;
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', fileInputRef.current.files[0]);
      
      const response = await axios.post('/api/remove-background', formData, {
        responseType: 'blob',
      });
      
      setProcessedImage(URL.createObjectURL(response.data));
    } catch (error) {
      console.error('Error removing background:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange} 
        ref={fileInputRef}
      />
      <button 
        onClick={removeBackground} 
        disabled={!originalImage || loading}
      >
        {loading ? 'Processing...' : 'Remove Background'}
      </button>
      
      <div style={{ display: 'flex', marginTop: '20px' }}>
        {originalImage && (
          <div>
            <h3>Original</h3>
            <img src={originalImage} alt="Original" style={{ maxWidth: '300px' }} />
          </div>
        )}
        
        {processedImage && (
          <div style={{ marginLeft: '20px' }}>
            <h3>Background Removed</h3>
            <img src={processedImage} alt="Processed" style={{ maxWidth: '300px' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default BackgroundRemover;
```

## How It Works

1. The package downloads the U2-Net model on first use (stored in the user's home directory)
2. Images are processed through the AI model to create a mask of the foreground
3. The mask is applied to the original image to create a transparent background
4. The resulting image is returned as a Sharp instance for further processing

## API Reference

### `new Rembg(options)`

Creates a new instance of the Rembg class.

**Parameters:**
- `options` (optional): Configuration object
  - `logging` (boolean): Whether to log progress to the console (default: `false`)

**Returns:** Rembg instance

### `rembg.remove(sharpInput)`

Removes the background from an image.

**Parameters:**
- `sharpInput`: A Sharp instance of the image to process

**Returns:** Promise that resolves to a Sharp instance with the background removed

## License

MIT
