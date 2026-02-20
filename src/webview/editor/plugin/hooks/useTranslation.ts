import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { sendRequest } from '../../../vscode';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { collectPluginTexts, computeTranslateFingerprint, runConcurrent } from '../translateUtils';
import type { TranslateResult } from '../../../../extension/services/TranslationService';
import type { MergedPlugin } from '../../../../shared/types';

/** useTranslation 回傳值 */
export interface UseTranslationReturn {
  /** 已翻譯的文字對照表（原文 → 譯文） */
  translations: Record<string, string>;
  /** 目前套用的翻譯語言代碼 */
  translateLang: string;
  /** 目前套用的 MyMemory API email */
  translateEmail: string;
  /** 翻譯設定 dialog 是否開啟 */
  dialogOpen: boolean;
  /** 設定 dialog 開啟狀態 */
  setDialogOpen: Dispatch<SetStateAction<boolean>>;
  /** dialog 草稿語言（尚未套用） */
  draftLang: string;
  /** 設定草稿語言 */
  setDraftLang: Dispatch<SetStateAction<string>>;
  /** dialog 草稿 email（尚未套用） */
  draftEmail: string;
  /** 設定草稿 email */
  setDraftEmail: Dispatch<SetStateAction<string>>;
  /** dialog title 的 aria id */
  translateTitleId: string;
  /** email input 的 aria id */
  translateEmailId: string;
  /** language select 的 aria id */
  translateLangId: string;
  /** focus trap ref（掛在 dialog 上） */
  translateTrapRef: RefObject<HTMLDivElement | null>;
  /** 排隊等待翻譯的文字集合 */
  queuedTexts: Set<string>;
  /** 正在翻譯中的文字集合 */
  activeTexts: Set<string>;
  /** 翻譯配額超出等警告訊息 */
  translateWarning: string | null;
  /** 設定翻譯警告 */
  setTranslateWarning: Dispatch<SetStateAction<string | null>>;
  /** Dialog 確認：儲存設定並觸發翻譯 */
  handleDialogConfirm: () => void;
}

/**
 * Plugin 翻譯 hook。
 * 管理翻譯設定、dialog 狀態、分批翻譯邏輯。
 *
 * @param plugins - 完整 plugin 列表（供自動翻譯使用）
 */
export function useTranslation(plugins: MergedPlugin[]): UseTranslationReturn {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translateLang, setTranslateLang] = useState(
    () => localStorage.getItem('plugin.translateLang') ?? '',
  );
  const [translateEmail, setTranslateEmail] = useState(
    () => localStorage.getItem('plugin.translateEmail') ?? '',
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftLang, setDraftLang] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const translateTitleId = useId();
  const translateEmailId = useId();
  const translateLangId = useId();
  const translateTrapRef = useFocusTrap(() => setDialogOpen(false), dialogOpen);
  const [queuedTexts, setQueuedTexts] = useState<Set<string>>(new Set());
  const [activeTexts, setActiveTexts] = useState<Set<string>>(new Set());
  const [translateWarning, setTranslateWarning] = useState<string | null>(null);
  const translateVersionRef = useRef(0);

  /** 語言變更或 plugins 載入後自動翻譯（分批送出，最多 3 併發，逐批更新 UI） */
  const doTranslate = useCallback(async (lang: string, email: string, items: MergedPlugin[]) => {
    const version = ++translateVersionRef.current;

    if (!lang || !email) {
      setTranslations({});
      setQueuedTexts(new Set());
      setActiveTexts(new Set());
      setTranslateWarning(null);
      return;
    }

    // 收集所有可翻譯文字（plugin desc + content desc）
    const texts = [...new Set(collectPluginTexts(items))];
    if (texts.length === 0) return;

    const CHUNK_SIZE = 5;
    const chunks: string[][] = [];
    for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
      chunks.push(texts.slice(i, i + CHUNK_SIZE));
    }

    setTranslations({});
    setTranslateWarning(null);
    setQueuedTexts(new Set(texts));
    setActiveTexts(new Set());

    let quotaExceeded = false;

    const tasks = chunks.map((chunk) => async () => {
      if (translateVersionRef.current !== version || quotaExceeded) return;

      // queued → active
      setQueuedTexts((prev) => {
        const next = new Set(prev);
        for (const t of chunk) next.delete(t);
        return next;
      });
      setActiveTexts((prev) => {
        const next = new Set(prev);
        for (const t of chunk) next.add(t);
        return next;
      });

      try {
        const { translations: result, warning } = await sendRequest<TranslateResult>(
          { type: 'plugin.translate', texts: chunk, targetLang: lang, email },
        );
        if (translateVersionRef.current !== version) return;
        setTranslations((prev) => ({ ...prev, ...result }));
        if (warning) {
          quotaExceeded = true;
          setTranslateWarning(warning);
          setQueuedTexts(new Set());
          setActiveTexts(new Set());
        }
      } catch {
        // 翻譯失敗不影響主流程
      } finally {
        if (!quotaExceeded) {
          setActiveTexts((prev) => {
            const next = new Set(prev);
            for (const t of chunk) next.delete(t);
            return next;
          });
        }
      }
    });

    await runConcurrent(tasks, 3);
  }, []);

  // 語言、email 或 plugins descriptions 變更時自動翻譯
  // fingerprint 含 lang + email + 所有 description，避免 array reference 變更觸發無用重譯
  const textsFingerprint = useMemo(
    () => computeTranslateFingerprint(plugins, translateLang, translateEmail),
    [plugins, translateLang, translateEmail],
  );
  const prevFingerprintRef = useRef('');

  useEffect(() => {
    if (textsFingerprint === prevFingerprintRef.current) return;
    prevFingerprintRef.current = textsFingerprint;

    if (plugins.length > 0 && translateLang && translateEmail) {
      doTranslate(translateLang, translateEmail, plugins);
    }
  // plugins/translateLang/translateEmail 已 encode 進 textsFingerprint，
  // 但 effect body 引用了它們，須列入 deps 以遵守 exhaustive-deps 規則。
  // fingerprint guard 會阻擋 reference-only 變更，避免無用 API call。
  }, [textsFingerprint, plugins, translateLang, translateEmail, doTranslate]);

  /** Dialog confirm：儲存設定並觸發翻譯 */
  const handleDialogConfirm = (): void => {
    localStorage.setItem('plugin.translateEmail', draftEmail);
    localStorage.setItem('plugin.translateLang', draftLang);
    setTranslateEmail(draftEmail);
    setTranslateLang(draftLang);
    setDialogOpen(false);
  };

  return {
    translations,
    translateLang,
    translateEmail,
    dialogOpen,
    setDialogOpen,
    draftLang,
    setDraftLang,
    draftEmail,
    setDraftEmail,
    translateTitleId,
    translateEmailId,
    translateLangId,
    translateTrapRef,
    queuedTexts,
    activeTexts,
    translateWarning,
    setTranslateWarning,
    handleDialogConfirm,
  };
}
