
import { GoogleGenAI, Modality, Chat } from "@google/genai";
import { decodeBase64, pcmToWav } from "../utils/audioUtils";

const getApiKey = () => {
  try {
    // Safely attempt to access process.env, which is shimmed in index.tsx
    return (window as any).process?.env?.API_KEY || '';
  } catch (e) {
    return '';
  }
};

export async function generateSpeech(text: string, voiceName: string, speed: number = 1.0): Promise<Blob> {
  const key = getApiKey();
  if (!key) throw new Error("API Key is missing. Please check your environment configuration.");
  
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const speedInstruction = speed === 1.0 ? "" : `Speak at ${speed}x speed. `;
    const fullPrompt = `${speedInstruction}${text}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data returned from Gemini API");
    }

    const pcmData = decodeBase64(base64Audio);
    return await pcmToWav(pcmData, 24000);
  } catch (error) {
    console.error("Speech generation error:", error);
    throw error;
  }
}

export function createAssistantChat(): Chat | null {
  const key = getApiKey();
  if (!key) {
    console.warn("Gemini API key is missing. Chat Assistant will be disabled.");
    return null;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    return ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        systemInstruction: 'You are an elite Script Architect and Research Assistant. Help users brainstorm, analyze, and write professional scripts for voiceovers. Use Google Search to ensure factual accuracy. Format your output clearly with sections like "Analysis", "Draft", and "Research Findings".',
        tools: [{ googleSearch: {} }]
      },
    });
  } catch (err) {
    console.error("Failed to create Chat instance:", err);
    return null;
  }
}

export interface ImageReferences {
  subjects: Array<{ type: 'image' | 'text', data: string }>;
  style?: { type: 'image' | 'text', data: string };
  scene?: { type: 'image' | 'text', data: string };
  mainImage?: string;
}

export async function generateImage(
  prompt: string, 
  aspectRatio: string = "1:1", 
  references?: ImageReferences
): Promise<{ base64: string, url: string }> {
  const key = getApiKey();
  if (!key) throw new Error("API Key is missing for visual synthesis.");
  
  const ai = new GoogleGenAI({ apiKey: key });
  try {
    const parts: any[] = [];
    let complexPrompt = prompt ? `Primary Instructions: ${prompt}\n\n` : "Generate an image based on the provided visual and descriptive references.\n\n";

    if (references?.mainImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: references.mainImage,
        },
      });
      complexPrompt += `CORE FOUNDATION: Use the attached [Main Reference] image as the structural starting point. Modify it according to the instructions.\n`;
    }

    if (references?.subjects && references.subjects.length > 0) {
      complexPrompt += `SUBJECTS/CHARACTERS:\n`;
      references.subjects.forEach((ref, idx) => {
        if (ref.type === 'image') {
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: ref.data,
            },
          });
          complexPrompt += `- [Subject Image Reference ${idx + 1}]: Incorporate this character/object precisely.\n`;
        } else {
          complexPrompt += `- [Subject Description ${idx + 1}]: ${ref.data}\n`;
        }
      });
    }

    if (references?.style) {
      if (references.style.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: references.style.data,
          },
        });
        complexPrompt += `AESTHETIC STYLE: Apply the exact lighting, art style, and mood from the attached [Style Image Reference].\n`;
      } else {
        complexPrompt += `AESTHETIC STYLE: ${references.style.data}\n`;
      }
    }

    if (references?.scene) {
      if (references.scene.type === 'image') {
        parts.push({
          inlineData: {
            mimeType: 'image/png',
            data: references.scene.data,
          },
        });
        complexPrompt += `SCENE/ENVIRONMENT: Use the layout and environment structure from the attached [Scene Image Reference].\n`;
      } else {
        complexPrompt += `SCENE/ENVIRONMENT: ${references.scene.data}\n`;
      }
    }

    parts.unshift({ text: complexPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        return {
          base64,
          url: `data:image/png;base64,${base64}`
        };
      }
    }
    throw new Error("No image data generated");
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }
}

export async function upscaleImage(originalBase64: string, prompt: string): Promise<{ base64: string, url: string }> {
  const windowObj = window as any;
  const hasKey = windowObj.aistudio?.hasSelectedApiKey ? await windowObj.aistudio.hasSelectedApiKey() : true;
  if (!hasKey && windowObj.aistudio?.openSelectKey) {
    await windowObj.aistudio.openSelectKey();
  }

  try {
    const key = getApiKey();
    if (!key) throw new Error("API Key required for Pro features.");
    
    const highResAi = new GoogleGenAI({ apiKey: key });
    const response = await highResAi.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: originalBase64,
              mimeType: 'image/png',
            },
          },
          {
            text: `Upscale and enhance this image to high resolution (2K). Sharpen details, improve textures, and maintain the original style perfectly. Original description was: ${prompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          imageSize: '2K',
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64 = part.inlineData.data;
        return {
          base64,
          url: `data:image/png;base64,${base64}`
        };
      }
    }
    throw new Error("Upscaling failed: No image returned.");
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found") && windowObj.aistudio?.openSelectKey) {
      await windowObj.aistudio.openSelectKey();
      throw new Error("Project not found. Please re-select a paid project API key.");
    }
    console.error("Upscale error:", error);
    throw error;
  }
}

export async function generateVideo(
  prompt: string,
  imageContent: string, 
  aspectRatio: '16:9' | '9:16' = '16:9',
  resolution: '720p' | '1080p' = '1080p'
): Promise<string> {
  const windowObj = window as any;
  const hasKey = windowObj.aistudio?.hasSelectedApiKey ? await windowObj.aistudio.hasSelectedApiKey() : true;
  if (!hasKey && windowObj.aistudio?.openSelectKey) {
    await windowObj.aistudio.openSelectKey();
  }

  const key = getApiKey();
  if (!key) throw new Error("API Key required for Video generation.");
  
  const dynamicAi = new GoogleGenAI({ apiKey: key });

  try {
    let operation = await dynamicAi.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: imageContent,
        mimeType: 'image/png',
      },
      config: {
        numberOfVideos: 1,
        resolution: resolution,
        aspectRatio: aspectRatio
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await dynamicAi.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Video generation failed: No download link returned.");

    const response = await fetch(`${downloadLink}&key=${key}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error: any) {
    if (error.message?.includes("Requested entity was not found") && windowObj.aistudio?.openSelectKey) {
      await windowObj.aistudio.openSelectKey();
      throw new Error("Project not found. Please re-select a paid project API key.");
    }
    throw error;
  }
}
