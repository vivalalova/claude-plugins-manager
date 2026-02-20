import React from 'react';

/** Skeleton 元素的形狀 */
type SkeletonVariant = 'text' | 'rect' | 'circle';

interface SkeletonProps {
  /** 形狀：text（圓角長條）、rect（矩形）、circle（圓形） */
  variant?: SkeletonVariant;
  /** 寬度（CSS 值），預設 100% */
  width?: string | number;
  /** 高度（CSS 值），預設依 variant：text=14px, rect=40px, circle=width */
  height?: string | number;
  /** 額外 className */
  className?: string;
}

/** variant 預設高度 */
const DEFAULT_HEIGHTS: Record<SkeletonVariant, number> = {
  text: 14,
  rect: 40,
  circle: 32,
};

/**
 * Skeleton 骨架元素。
 * 使用 CSS pulse 動畫，顏色透過 VSCode theme variables 自動適配 light/dark。
 */
export function Skeleton({
  variant = 'text',
  width,
  height,
  className,
}: SkeletonProps): React.ReactElement {
  const h = height ?? DEFAULT_HEIGHTS[variant];
  const w = width ?? (variant === 'circle' ? h : '100%');

  return (
    <div
      className={`skeleton skeleton--${variant}${className ? ` ${className}` : ''}`}
      style={{ width: w, height: h }}
      aria-hidden="true"
    />
  );
}

/** 預設 skeleton 卡片數量 */
const SKELETON_COUNT = 3;

/** Plugin 頁面的 skeleton 卡片列表 */
export function PluginCardSkeleton(): React.ReactElement {
  return (
    <div className="card-list" role="status" aria-label="Loading plugins">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Skeleton variant="text" width={120} height={16} />
              <Skeleton variant="text" width={80} height={14} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton variant="text" width={100} height={12} />
              <Skeleton variant="rect" width={60} height={24} />
            </div>
          </div>
          <Skeleton variant="text" width="90%" height={12} />
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <Skeleton variant="rect" width={56} height={20} />
            <Skeleton variant="rect" width={64} height={20} />
            <Skeleton variant="rect" width={52} height={20} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Marketplace 頁面的 skeleton 卡片列表 */
export function MarketplaceCardSkeleton(): React.ReactElement {
  return (
    <div className="card-list" role="status" aria-label="Loading marketplaces">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="card-header">
            <Skeleton variant="text" width={140} height={16} />
            <Skeleton variant="text" width={180} height={12} />
          </div>
          <Skeleton variant="text" width={120} height={12} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Skeleton variant="rect" width={90} height={24} />
            <Skeleton variant="rect" width={64} height={24} />
            <Skeleton variant="rect" width={64} height={24} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** MCP 頁面的 skeleton 卡片列表 */
export function McpCardSkeleton(): React.ReactElement {
  return (
    <div className="card-list" role="status" aria-label="Loading servers">
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className="card skeleton-card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton variant="text" width={100} height={16} />
              <Skeleton variant="rect" width={50} height={18} />
            </div>
            <Skeleton variant="rect" width={72} height={18} />
          </div>
          <Skeleton variant="text" width="70%" height={12} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Skeleton variant="rect" width={60} height={24} />
            <Skeleton variant="rect" width={48} height={24} />
            <Skeleton variant="rect" width={60} height={24} />
          </div>
        </div>
      ))}
    </div>
  );
}
