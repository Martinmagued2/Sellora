"use client";

import { Search } from "lucide-react";

/**
 * Reusable filter bar component
 * Props: tabs (array of {key, label, count}), activeTab, onTabChange, searchValue, onSearchChange, searchPlaceholder
 */
export default function FilterBar({
  tabs = [],
  activeTab,
  onTabChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}) {
  return (
    <div className="filter-bar">
      {tabs.length > 0 && (
        <div className="filter-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`filter-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    padding: "1px 6px",
                    borderRadius: "var(--radius-full)",
                    background: activeTab === tab.key ? "rgba(108, 92, 231, 0.2)" : "var(--bg-glass)",
                    color: activeTab === tab.key ? "var(--accent-primary-light)" : "var(--text-tertiary)",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {onSearchChange && (
        <div className="filter-search">
          <Search size={14} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue || ""}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
