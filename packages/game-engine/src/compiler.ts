export interface CompileOptions {
  minify?: boolean;
  includePhaserCDN?: boolean;
  assets?: any;
  metadata?: any;
}

export class GameCompiler {
  async compile(code: string, options: CompileOptions = {}): Promise<{
    code: string;
    assets: any;
    html?: string;
  }> {
    let compiledCode = this.cleanMarkdown(code);
    
    // Add Phaser CDN if requested
    if (options.includePhaserCDN && !compiledCode.trim().startsWith("<!DOCTYPE") && !compiledCode.trim().startsWith("<html")) {
      compiledCode = this.wrapWithHTML(compiledCode, options.metadata);
    }
    
    // Minify if requested (placeholder for now)
    if (options.minify) {
      compiledCode = this.minifyCode(compiledCode);
    }
    
    // Process assets
    const processedAssets = this.processAssets(options.assets || {});
    
    return {
      code: compiledCode,
      assets: processedAssets,
      html: options.includePhaserCDN ? compiledCode : undefined
    };
  }
  
  private wrapWithHTML(code: string, metadata?: any): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${metadata?.name || 'GameVibe Game'}</title>
    <script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-color: #1a1a1a;
            font-family: Arial, sans-serif;
        }
        #game-container {
            border: 2px solid #333;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        .game-info {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            text-align: center;
            background: rgba(0, 0, 0, 0.7);
            padding: 10px 20px;
            border-radius: 5px;
        }
        .game-info h1 {
            margin: 0 0 5px 0;
            font-size: 24px;
        }
        .game-info p {
            margin: 0;
            font-size: 14px;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="game-info">
        <h1>${metadata?.name || 'GameVibe Game'}</h1>
        <p>${metadata?.description || 'Created with GameVibe AI'}</p>
    </div>
    <div id="game-container"></div>
    <script>
${code}
    </script>
</body>
</html>`;
  }
  
  private minifyCode(code: string): string {
    // Simple minification - remove comments and extra whitespace
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*$/gm, '') // Remove line comments
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/\s*([{}();,:])\s*/g, '$1') // Remove whitespace around syntax
      .trim();
  }
  
  private processAssets(assets: any): any {
    // Process and validate assets
    const processed: any = {
      images: {},
      audio: {},
      data: {}
    };
    
    // Process images
    if (assets.images) {
      for (const [key, value] of Object.entries(assets.images)) {
        processed.images[key] = this.processImage(value);
      }
    }
    
    // Process audio
    if (assets.audio) {
      for (const [key, value] of Object.entries(assets.audio)) {
        processed.audio[key] = this.processAudio(value);
      }
    }
    
    return processed;
  }
  
  private processImage(imageData: any): any {
    // Validate and process image data
    if (typeof imageData === 'string') {
      // It's a URL or data URI
      return { url: imageData };
    }
    
    // Generate placeholder image data
    return {
      url: this.generatePlaceholderImage(imageData.width || 32, imageData.height || 32, imageData.color || '#808080')
    };
  }
  
  private processAudio(audioData: any): any {
    // Process audio (placeholder for now)
    return {
      url: audioData.url || null,
      volume: audioData.volume || 1.0
    };
  }
  
  private generatePlaceholderImage(width: number, height: number, color: string): string {
    // Generate a simple data URI for a colored rectangle
    const canvas = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
    </svg>`;
    
    const base64 = Buffer.from(canvas).toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
}
  // Clean markdown formatting from AI-generated code
  private cleanMarkdown(code: string): string {
    // If the code already starts with <!DOCTYPE or <html, it's probably clean
    if (code.trim().startsWith('<!DOCTYPE') || code.trim().startsWith('<html')) {
      // Check if there's markdown before the html and extract just the html
      const htmlMatch = code.match(/<html[\s\S]*<\/html>/i);
      if (htmlMatch) {
        return htmlMatch[0];
      }
      // Strip any leading text before <html>
      const stripMatch = code.match(/<html/i);
      if (stripMatch) {
        return code.substring(stripMatch.index!);
      }
      return code;
    }

    // Try to extract code block content
    // Match ```html or ```javascript or ``` and capture content
    const codeBlockMatch = code.match(/```(?:html|javascript)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      let extracted = codeBlockMatch[1].trim();
      // If it starts with <!DOCTYPE or <html, use it
      if (extracted.startsWith('<!DOCTYPE') || extracted.startsWith('<html')) {
        return extracted;
      }
      // Otherwise wrap in basic HTML
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>
</head>
<body>
<script>
${extracted}
</script>
</body>
</html>`;
    }

    // If there's a script tag, try to extract from there
    const scriptMatch = code.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      const scriptContent = scriptMatch[1].trim();
      // If we have a Phaser.Game, wrap it properly
      if (scriptContent.includes('Phaser.Game') || scriptContent.includes('new Phaser.Game')) {
        return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js"></script>
</head>
<body>
<script>
${scriptContent}
</script>
</body>
</html>`;
      }
    }

    // Last resort: return as-is (might work if it's clean)
    return code;
  }
}
