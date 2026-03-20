import React from 'react';
import { ScopeBadge } from '../../components/ScopeBadge';
import type { AgentSkill } from '../../../shared/types';
import { useI18n } from '../../i18n/I18nContext';

/** 主流 agent 品牌色（name → { bg, fg }） */
const AGENT_BRAND_COLORS: Record<string, { bg: string; fg: string }> = {
  'claude-code':     { bg: '#da7756', fg: '#fff' },  // Anthropic orange
  'cursor':          { bg: '#2d2d2d', fg: '#fff' },  // Cursor dark
  'gemini-cli':      { bg: '#4285f4', fg: '#fff' },  // Google blue
  'github-copilot':  { bg: '#6e40c9', fg: '#fff' },  // GitHub Copilot purple
  'codex':           { bg: '#6b5ce7', fg: '#fff' },  // OpenAI Codex purple-blue
  'windsurf':        { bg: '#09b6a2', fg: '#fff' },  // Codeium teal-green
  'cline':           { bg: '#eab308', fg: '#000' },  // Cline yellow-gold
  'roo':             { bg: '#4fc3f7', fg: '#000' },  // Roo Code light blue
  'amp':             { bg: '#ff5543', fg: '#fff' },  // Sourcegraph red
  'augment':         { bg: '#6366f1', fg: '#fff' },  // Augment indigo
};

/** 非主流 agent 用 hash 取色 */
const FALLBACK_COLORS = [
  { bg: '#6366f1', fg: '#fff' },
  { bg: '#0891b2', fg: '#fff' },
  { bg: '#be185d', fg: '#fff' },
  { bg: '#65a30d', fg: '#fff' },
] as const;

function getAgentColor(name: string): { bg: string; fg: string } {
  const brand = AGENT_BRAND_COLORS[name];
  if (brand) return brand;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

interface SkillCardProps {
  skill: AgentSkill;
  removing: boolean;
  onRemove: () => void;
  onOpenFile: () => void;
  onViewDetail: () => void;
}

/** 單一 skill 卡片（flat layout，agents 與 scope 同列） */
export const SkillCard = React.memo(function SkillCard({
  skill,
  removing,
  onRemove,
  onOpenFile,
  onViewDetail,
}: SkillCardProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <div
      className="card"
      tabIndex={0}
      role="group"
      aria-label={skill.name}
    >
      <div className="card-header">
        <div>
          <span className="card-name">{skill.name}</span>
        </div>
        <div className="card-header-right">
          <button className="btn btn-sm" onClick={onViewDetail}>
            {t('skill.card.viewDetail')}
          </button>
          <button className="btn btn-sm" onClick={onOpenFile} title={t('skill.card.openFile')}>
            {t('skill.card.openFile')}
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={onRemove}
            disabled={removing}
          >
            {removing ? t('skill.card.removing') : t('skill.card.remove')}
          </button>
        </div>
      </div>

      <div className="card-description">
        {skill.description || t('skill.card.noDescription')}
      </div>

      <div className="scope-chips-row">
        <ScopeBadge scope={skill.scope} />
        {skill.agents.length > 0 && (
          <>
            <span className="skill-agent-divider" />
            {skill.agents.map((agent) => {
              const color = getAgentColor(agent);
              return (
                <span
                  key={agent}
                  className="skill-agent-tag"
                  style={{ background: color.bg, color: color.fg }}
                >
                  {agent}
                </span>
              );
            })}
          </>
        )}
      </div>

      {skill.path && (
        <div className="skill-path">{skill.path}</div>
      )}
    </div>
  );
});
