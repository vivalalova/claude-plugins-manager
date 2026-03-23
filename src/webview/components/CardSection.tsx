import React from 'react';
import { CollapsibleSection } from './CollapsibleSection';

interface BaseCardSectionProps {
  title: React.ReactNode;
  count?: React.ReactNode;
  extra?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}

interface CollapsibleCardSectionProps extends BaseCardSectionProps {
  variant: 'collapsible';
  isCollapsed: boolean;
  onToggle: () => void;
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
}

interface StaticCardSectionProps extends BaseCardSectionProps {
  variant?: 'static';
  ariaLabel: string;
  sectionClassName?: string;
  headerClassName?: string;
  titleRowClassName?: string;
  titleClassName?: string;
  countClassName?: string;
  bodyClassName?: string;
}

export type CardSectionProps = CollapsibleCardSectionProps | StaticCardSectionProps;

/**
 * 統一 card section 外殼；互動邏輯與 item render 仍保留在各頁面內。
 */
export function CardSection(props: CardSectionProps): React.ReactElement {
  if (props.variant === 'collapsible') {
    return (
      <CollapsibleSection
        label={props.title}
        badge={props.count}
        extra={props.extra}
        isCollapsed={props.isCollapsed}
        onToggle={props.onToggle}
        headerActions={props.headerActions}
        headerProps={props.headerProps}
      >
        {props.children}
      </CollapsibleSection>
    );
  }

  return (
    <section
      className={props.sectionClassName ?? 'mcp-section'}
      role="region"
      aria-label={props.ariaLabel}
    >
      <div className={props.headerClassName ?? 'mcp-section-header'}>
        <div className={props.titleRowClassName ?? 'mcp-section-title-row'}>
          <h2 className={props.titleClassName ?? 'mcp-section-title'}>{props.title}</h2>
          {props.count !== undefined && (
            <span className={props.countClassName ?? 'mcp-section-count'}>{props.count}</span>
          )}
        </div>
        {props.headerActions}
      </div>
      {props.extra}
      <div className={props.bodyClassName ?? 'card-list'}>
        {props.children}
      </div>
    </section>
  );
}
