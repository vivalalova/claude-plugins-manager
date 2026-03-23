import { useCallback, useEffect, useState } from 'react';
import { getViewState, initGlobalState, setGlobalState, setViewState } from '../../../vscode';

const SKILL_AGENTS_KEY = 'skill.agents';
const DEFAULT_SKILL_AGENTS = ['claude-code'];

export function usePersistedSkillAgents(): {
  selectedAgents: string[];
  persistSelectedAgents: (agents: string[]) => void;
} {
  const [selectedAgents, setSelectedAgents] = useState<string[]>(
    () => getViewState<string[]>(SKILL_AGENTS_KEY, DEFAULT_SKILL_AGENTS),
  );

  useEffect(() => {
    void initGlobalState([{ key: SKILL_AGENTS_KEY, fallback: DEFAULT_SKILL_AGENTS }])
      .then(() => {
        setSelectedAgents(getViewState<string[]>(SKILL_AGENTS_KEY, DEFAULT_SKILL_AGENTS));
      })
      .catch(() => {});
  }, []);

  const persistSelectedAgents = useCallback((agents: string[]): void => {
    setSelectedAgents(agents);
    setViewState(SKILL_AGENTS_KEY, agents);
    void setGlobalState(SKILL_AGENTS_KEY, agents);
  }, []);

  return {
    selectedAgents,
    persistSelectedAgents,
  };
}
