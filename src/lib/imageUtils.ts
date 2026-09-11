/**
 * Compresses an image file down to a reasonable dimension and quality using HTML Canvas
 * to prevent QuotaExceededError when saving base64 to localStorage.
 */
export const compressImage = (
  file: File,
  maxWidth = 1200,
  maxHeight = 600,
  quality = 0.75
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original read base64 if canvas context creation fails
          resolve(event.target?.result as string);
          return;
        }

        const isPng = file.type === 'image/png';

        // Only fill background with white if it is NOT a PNG with transparency
        if (!isPng) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        
        try {
          const format = isPng ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(format, isPng ? undefined : quality);
          resolve(dataUrl);
        } catch (e) {
          // Fallback if security or other canvas issue happens
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
};
