"use client";

/**
 * Loading spinner component
 * Props: size (sm/md/lg), text
 */
export default function LoadingSpinner({ size = "md", text }) {
  return (
    <div className="loading-spinner-wrapper">
      <div className={`loading-spinner ${size}`} />
      {text && <div className="loading-spinner-text">{text}</div>}
    </div>
  );
}
