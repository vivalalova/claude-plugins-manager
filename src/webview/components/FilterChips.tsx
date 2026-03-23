import React from 'react';

export interface ChipDescriptor {
  key: string;
  label: React.ReactNode;
  active: boolean;
  onSelect: () => void;
  ariaPressed?: boolean;
}

export interface FilterChipsProps {
  groups: ChipDescriptor[][];
}

export function FilterChips({ groups }: FilterChipsProps): React.ReactElement {
  return (
    <div className="filter-chips">
      {groups.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 && <span className="filter-separator" aria-hidden="true" />}
          {group.map((chip) => (
            <button
              key={chip.key}
              className={`filter-chip${chip.active ? ' filter-chip--active' : ''}`}
              aria-pressed={chip.ariaPressed ?? chip.active}
              onClick={chip.onSelect}
            >
              {chip.label}
            </button>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}
