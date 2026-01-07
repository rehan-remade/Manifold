"use client";

import { useState, useRef, useCallback } from "react";
import { fal } from "@fal-ai/client";

// Configure fal to use our proxy
fal.config({
  proxyUrl: "/api/fal/proxy",
});

interface BottomToolbarProps {
  isStreaming: boolean;
  progress: number;
  currentStage: string;
  glbUrl: string | null;
  onStart: (imageUrl: string, prompt: string) => void;
  onCancel: () => void;
  onOpenLogs: () => void;
  logCount: number;
}

export default function BottomToolbar({
  isStreaming,
  progress,
  currentStage,
  glbUrl,
  onStart,
  onCancel,
  onOpenLogs,
  logCount,
}: BottomToolbarProps) {
  const [prompt, setPrompt] = useState("");
  // User-uploaded image (for image-to-3D flow)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isEnhancingPrompt, setIsEnhancingPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setUploadedImagePreview(previewUrl);
    setIsUploading(true);

    try {
      const url = await fal.storage.upload(file);
      setUploadedImageUrl(url);
    } catch (error) {
      console.error("Failed to upload image:", error);
      setUploadedImagePreview(null);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    setUploadedImageUrl(null);
    setUploadedImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) return;

    const hasUploadedImage = !!uploadedImageUrl;

    // === IMAGE-TO-3D FLOW ===
    if (hasUploadedImage) {
      setIsEnhancingPrompt(true);
      let segmentationPrompt = prompt;

      try {
        // Use VLM to analyze uploaded image + user text
        const response = await fetch("/api/enhance-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt, 
            imageUrl: uploadedImageUrl 
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          segmentationPrompt = data.segmentationPrompt || prompt;
          console.log("VLM segmentation prompt:", segmentationPrompt);
        }
      } catch (error) {
        console.error("Failed to analyze image:", error);
      }
      
      setIsEnhancingPrompt(false);
      onStart(uploadedImageUrl, segmentationPrompt);
      return;
    }

    // === TEXT-TO-3D FLOW ===
    setIsEnhancingPrompt(true);
    let imagePrompt = prompt;
    let segmentationPrompt = prompt;

    try {
      // Use LLM to enhance prompt for image gen + get seg prompt
      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      
      if (response.ok) {
        const data = await response.json();
        imagePrompt = data.imagePrompt || prompt;
        segmentationPrompt = data.segmentationPrompt || prompt;
        console.log("Enhanced prompts:", { imagePrompt, segmentationPrompt });
      }
    } catch (error) {
      console.error("Failed to enhance prompt:", error);
    }
    setIsEnhancingPrompt(false);

    // Generate image (don't show preview - it's intermediate)
    setIsGeneratingImage(true);
    let generatedImageUrl: string | null = null;
    
    try {
      const result = await fal.subscribe("fal-ai/z-image/turbo", {
        input: {
          prompt: imagePrompt,
          image_size: "square_hd",
          num_inference_steps: 8,
          num_images: 1,
          enable_safety_checker: true,
        },
      });
      
      generatedImageUrl = result.data?.images?.[0]?.url || null;
      
      if (!generatedImageUrl) {
        throw new Error("No image URL returned");
      }
    } catch (error) {
      console.error("Failed to generate image:", error);
      setIsGeneratingImage(false);
      return;
    }
    setIsGeneratingImage(false);

    // Start SAM-3D with generated image
    onStart(generatedImageUrl, segmentationPrompt);
  }, [prompt, uploadedImageUrl, onStart]);

  const isProcessing = isStreaming || isGeneratingImage || isUploading || isEnhancingPrompt;
  const isComplete = glbUrl && !isProcessing;
  const hasUploadedImage = !!uploadedImageUrl;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
      <form onSubmit={handleSubmit}>
        <div className="flex items-end gap-2">
          {/* Input container with image preview */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {/* Image preview - only for user uploads */}
            {uploadedImagePreview && (
              <div className="p-2 pb-0">
                <div className="relative inline-block">
                  <img
                    src={uploadedImagePreview}
                    alt="Preview"
                    className={`h-14 w-14 object-cover rounded-lg transition-all duration-300 ${
                      isUploading ? "blur-sm scale-95 opacity-60" : ""
                    }`}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                    </div>
                  )}
                  {!isProcessing && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center transition-colors"
                    >
                      <svg className="w-2.5 h-2.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Input row */}
            <div className="flex items-center gap-2 p-2">
              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Text input */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={hasUploadedImage ? "What to extract? (optional)" : "Describe what to create..."}
                disabled={isProcessing}
                className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-600 disabled:opacity-50"
              />

              {/* Status */}
              {isProcessing && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
                  <span>
                    {isEnhancingPrompt 
                      ? "analyzing" 
                      : isGeneratingImage 
                        ? "generating" 
                        : currentStage?.replace("_", " ") || "processing"}
                  </span>
                  {isStreaming && <span>{Math.round(progress)}%</span>}
                </div>
              )}

              {/* Completed status with download */}
              {isComplete && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">completed</span>
                  <a
                    href={glbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-6 h-6 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Download GLB"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                </div>
              )}

              {/* Logs button */}
              <button
                type="button"
                onClick={onOpenLogs}
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-400 rounded-lg transition-colors relative"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {logCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-zinc-600 rounded-full text-[8px] flex items-center justify-center text-zinc-200">
                    {logCount > 9 ? "+" : logCount}
                  </span>
                )}
              </button>
            </div>

            {/* Progress bar */}
            {isProcessing && (
              <div className="h-0.5 bg-zinc-800">
                <div
                  className="h-full bg-zinc-500 transition-all duration-300"
                  style={{ width: isGeneratingImage ? "100%" : `${progress}%` }}
                />
              </div>
            )}
          </div>

          {/* Submit / Cancel button */}
          {isProcessing ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!prompt.trim() && !hasUploadedImage}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-zinc-100 text-zinc-900 hover:bg-white disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          )}
        </div>

        {/* Helper text */}
        {!isProcessing && !hasUploadedImage && (
          <p className="text-[10px] text-zinc-700 text-center mt-2">
            upload an image or describe what you want
          </p>
        )}
      </form>
    </div>
  );
}
