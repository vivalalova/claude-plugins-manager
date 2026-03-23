import { exportShellScript, importShellScript, type ImportScriptConfig } from '../utils/scriptIO';

interface ExportRecipe {
  defaultFilename: string;
  header: string;
  entityLabel: string;
  emptyMessage: string;
  buildLines: () => Promise<string[]>;
}

interface ScriptRecipe {
  export: ExportRecipe;
  import: ImportScriptConfig;
}

/**
 * Declarative builder for paired shell-script import/export behaviors.
 */
export function createScriptRecipe(recipe: ScriptRecipe): {
  exportScript: () => Promise<void>;
  importScript: () => Promise<string[]>;
} {
  return {
    exportScript: async (): Promise<void> => {
      const lines = await recipe.export.buildLines();
      if (lines.length === 0) {
        throw new Error(recipe.export.emptyMessage);
      }

      await exportShellScript({
        defaultFilename: recipe.export.defaultFilename,
        header: recipe.export.header,
        entityLabel: recipe.export.entityLabel,
        lines,
      });
    },
    importScript: (): Promise<string[]> => importShellScript(recipe.import),
  };
}
