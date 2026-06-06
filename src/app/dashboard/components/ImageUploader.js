"use client";

import { useState, useRef, useCallback } from "react";
import { ImagePlus, X, Loader2, Package, Search } from "lucide-react";

/**
 * ImageUploader component
 * - A component for uploading/attaching images in chat
 * - Drag & drop or click to upload
 * - Shows preview of uploaded image
 * - Sends to the recognition API
 * - Displays matching products from the catalog
 */
export default function ImageUploader({ onProductSelect, onSendImageMessage, disabled = false, compact = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [matchingProducts, setMatchingProducts] = useState([]);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const fileInputRef = useRef(null);

  const resetState = useCallback(() => {
    setImagePreview(null);
    setImageBase64(null);
    setIsAnalyzing(false);
    setAnalysis(null);
    setMatchingProducts([]);
    setError(null);
    setShowResults(false);
  }, []);

  const analyzeImage = useCallback(async (base64) => {
    setIsAnalyzing(true);
    setAnalysis(null);
    setMatchingProducts([]);
    setShowResults(true);

    try {
      const res = await fetch("/api/messages/recognize-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });

      const data = await res.json();

      if (data.success) {
        setAnalysis(data.analysis);
        setMatchingProducts(data.products || []);

        // If there's an AI response, pass it up
        if (data.ai_response && onSendImageMessage) {
          onSendImageMessage(data.ai_response, data.analysis, data.products);
        }
      } else {
        setError(data.error || "Image analysis failed");
      }
    } catch (err) {
      console.error("Image recognition error:", err);
      setError("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [onSendImageMessage]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPEG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }

    setError(null);

    // Read and preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setImagePreview(dataUrl);

      // Extract base64
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);

      // Auto-analyze
      await analyzeImage(base64);
    };
    reader.readAsDataURL(file);
  }, [analyzeImage]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be selected again
    e.target.value = "";
  }, [handleFile]);

  // Compact mode: just a camera/image button (for chat input)
  if (compact) {
    return (
      <>
        <button
          type="button"
          className="image-upload-compact"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isAnalyzing}
          title="Upload image for product recognition"
        >
          {isAnalyzing ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />

        {/* Compact results popup */}
        {imagePreview && showResults && (
          <div className="image-recognize-popup">
            <div className="image-recognize-popup-header">
              <span style={{ fontWeight: 600, fontSize: 12 }}>Image Analysis</span>
              <button
                type="button"
                onClick={resetState}
                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="image-recognize-popup-preview">
              <img src={imagePreview} alt="Uploaded" />
            </div>
            {isAnalyzing && (
              <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <Loader2 size={12} className="spin" /> Analyzing image...
              </div>
            )}
            {error && (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--accent-red)" }}>
                {error}
              </div>
            )}
            {analysis && !isAnalyzing && (
              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {analysis.slice(0, 200)}{analysis.length > 200 ? "..." : ""}
              </div>
            )}
            {matchingProducts.length > 0 && (
              <div className="image-recognize-products">
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", padding: "6px 12px 4px" }}>
                  Matching Products
                </div>
                {matchingProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    className="image-recognize-product-item"
                    onClick={() => {
                      onProductSelect?.(product);
                      resetState();
                    }}
                  >
                    <Package size={12} style={{ color: "var(--accent-primary-light)", flexShrink: 0 }} />
                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{ fontWeight: 600, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                        {product.price} EGP • {product.confidence}% match
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  // Full mode: with drag & drop area (for standalone use)
  return (
    <div className="image-uploader">
      {/* Upload area */}
      {!imagePreview ? (
        <div
          className={`image-upload-area ${isDragging ? "drag-over" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="image-upload-placeholder">
            <div className="image-upload-icon">
              <ImagePlus size={24} />
            </div>
            <div className="image-upload-text">
              <span>Click to upload</span> or drag & drop
            </div>
            <div className="image-upload-hint">
              PNG, JPG, GIF, WebP up to 10MB
            </div>
          </div>
        </div>
      ) : (
        <div className="image-upload-preview-container">
          <div className="image-preview-wrapper">
            <img src={imagePreview} alt="Upload preview" className="image-preview" />
            <button
              type="button"
              className="image-remove-btn"
              onClick={resetState}
              title="Remove image"
            >
              <X size={14} />
            </button>
          </div>

          {/* Analysis results */}
          {isAnalyzing && (
            <div className="image-analyzing">
              <Loader2 size={16} className="spin" />
              <span>Analyzing image and searching catalog...</span>
            </div>
          )}

          {error && (
            <div className="image-analysis-error">
              <span>⚠️ {error}</span>
            </div>
          )}

          {analysis && !isAnalyzing && (
            <div className="image-analysis-result">
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <Search size={14} style={{ color: "var(--accent-secondary)" }} />
                <span style={{ fontWeight: 600, fontSize: 12, color: "var(--accent-secondary)" }}>Analysis</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {analysis}
              </p>
            </div>
          )}

          {matchingProducts.length > 0 && !isAnalyzing && (
            <div className="image-match-results">
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: 8 }}>
                Matching Products ({matchingProducts.length})
              </div>
              {matchingProducts.map((product) => (
                <div key={product.id} className="image-match-product">
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{product.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {product.price} EGP • {product.category || "General"} • Stock: {product.stock}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="image-match-confidence" style={{
                      background: product.confidence > 60 ? "rgba(0,230,118,0.12)" : product.confidence > 30 ? "rgba(255,145,0,0.12)" : "rgba(255,82,82,0.12)",
                      color: product.confidence > 60 ? "var(--accent-green)" : product.confidence > 30 ? "var(--accent-orange)" : "var(--accent-red)",
                    }}>
                      {product.confidence}% match
                    </span>
                    {onProductSelect && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "4px 12px", fontSize: 11 }}
                        onClick={() => onProductSelect(product)}
                      >
                        Send
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}
