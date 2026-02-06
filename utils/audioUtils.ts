
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Promise<Blob> {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const uint8View = new Uint8Array(buffer, 44);
  uint8View.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generates an MP4 video (or WebM depending on browser support) 
 * with a static frame containing the text and branding.
 */
export async function audioBlobToVideo(audioBlob: Blob, text: string, voiceName: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject("Canvas context not available");

    // Draw Static Frame
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1e1b4b'); // indigo-950
    gradient.addColorStop(1, '#0f172a'); // slate-950
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Overlay Glow
    const glow = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, 600);
    glow.addColorStop(0, 'rgba(79, 70, 229, 0.1)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // Title / Branding
    ctx.fillStyle = '#6366f1'; // indigo-500
    ctx.font = 'bold 24px Inter, sans-serif';
    ctx.fillText('VOXGEM AI', 60, 60);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillText(`Voice: ${voiceName}`, 60, 90);

    // Main Text Body
    ctx.fillStyle = '#f8fafc';
    ctx.font = '32px Inter, sans-serif';
    const maxWidth = width - 120;
    const lineHeight = 45;
    const words = text.split(' ');
    let line = '';
    let y = height / 2 - 50;

    for (let n = 0; n < words.length; n++) {
      let testLine = line + words[n] + ' ';
      let metrics = ctx.measureText(testLine);
      let testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, 60, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
      if (y > height - 100) break; // Don't overflow
    }
    ctx.fillText(line, 60, y);

    // Audio Processing
    const audio = new Audio();
    audio.src = URL.createObjectURL(audioBlob);
    audio.crossOrigin = "anonymous";

    audio.oncanplaythrough = () => {
      const stream = canvas.captureStream(0); // Capture canvas at 0fps since it's static
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audio);
      const destination = audioCtx.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioCtx.destination);

      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        resolve(finalBlob);
        URL.revokeObjectURL(audio.src);
      };

      recorder.start();
      audio.play();

      audio.onended = () => {
        recorder.stop();
        audioCtx.close();
      };
    };

    audio.onerror = (e) => reject(e);
  });
}
