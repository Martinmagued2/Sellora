"use client";

// Base skeleton block - animated shimmer
export function Skeleton({ width, height, borderRadius = 8, style = {} }) {
  return (
    <div
      className="skeleton-block"
      style={{
        width: width || "100%",
        height: height || 16,
        borderRadius,
        ...style,
      }}
    />
  );
}

// Skeleton for stat cards (the number cards at the top of dashboard)
export function StatCardSkeleton() {
  return (
    <div className="stat-card" style={{ opacity: 0.7 }}>
      <div className="stat-card-header">
        <Skeleton width={100} height={12} />
        <Skeleton width={42} height={42} borderRadius={12} />
      </div>
      <Skeleton width={80} height={32} borderRadius={8} style={{ marginTop: 8 }} />
      <Skeleton width={120} height={12} borderRadius={6} style={{ marginTop: 6 }} />
    </div>
  );
}

// Skeleton for dashboard panels (Order Pipeline, Channels, etc.)
export function PanelSkeleton({ rows = 3 }) {
  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel-header">
        <Skeleton width={120} height={16} />
      </div>
      <div className="dashboard-panel-body" style={{ padding: "var(--space-lg)" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < rows - 1 ? 12 : 0 }}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton width="60%" height={14} borderRadius={6} />
              <Skeleton width="40%" height={10} borderRadius={6} style={{ marginTop: 6 }} />
            </div>
            <Skeleton width={60} height={14} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Skeleton for table rows
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="table-scroll-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton width={60 + ((i * 17 + 13) % 40)} height={10} borderRadius={4} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  <Skeleton width={50 + ((r * cols + c * 23 + 7) % 60)} height={14} borderRadius={4} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Full dashboard skeleton (main dashboard page)
export function DashboardSkeleton() {
  return (
    <>
      {/* Stats row: 2 wide + 4 normal */}
      <div className="stats-grid">
        <div className="stat-card" style={{ gridColumn: "span 2", opacity: 0.7 }}>
          <div className="stat-card-header">
            <Skeleton width={100} height={12} />
            <Skeleton width={42} height={42} borderRadius={12} />
          </div>
          <Skeleton width={160} height={40} borderRadius={8} style={{ marginTop: 8 }} />
          <Skeleton width={120} height={12} borderRadius={6} style={{ marginTop: 6 }} />
        </div>
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Middle panels */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        <PanelSkeleton rows={4} />
        <PanelSkeleton rows={3} />
      </div>

      {/* Bottom panels */}
      <div className="dashboard-grid" style={{ marginTop: "var(--space-lg)" }}>
        <PanelSkeleton rows={5} />
        <PanelSkeleton rows={4} />
      </div>
    </>
  );
}

// Generic page skeleton (for orders, customers, products pages)
export function PageSkeleton({ showStats = true, showTable = true }) {
  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <Skeleton width={180} height={28} borderRadius={8} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton width={100} height={36} borderRadius={8} />
        </div>
      </div>

      {/* Stats */}
      {showStats && (
        <div className="stats-grid" style={{ marginBottom: "var(--space-xl)" }}>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <Skeleton width={280} height={36} borderRadius={8} />
        <Skeleton width={120} height={36} borderRadius={8} style={{ marginLeft: "auto" }} />
      </div>

      {/* Table */}
      {showTable && <TableSkeleton rows={6} cols={5} />}
    </>
  );
}
