"use client";

/**
 * Empty state placeholder component
 * Props: icon, title, description, actionLabel, onAction
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {Icon && <Icon size={32} />}
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
