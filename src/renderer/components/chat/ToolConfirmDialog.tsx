import React, { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import styles from './ToolConfirmDialog.module.css';

interface AskQuestion {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
}

const ToolConfirmDialog: React.FC = () => {
  const pending = useAppStore((s) => s.pendingToolConfirmation);
  const confirmTool = useAppStore((s) => s.confirmTool);
  const saveAllDirtyTabs = useAppStore((s) => s.saveAllDirtyTabs);
  const answerAskUserQuestion = useAppStore((s) => s.answerAskUserQuestion);

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  if (!pending) return null;

  const isQuestion = pending.toolName === 'AskUserQuestion';
  const questions: AskQuestion[] = isQuestion
    ? (pending.input as Record<string, unknown>).questions as AskQuestion[] || []
    : [];

  const handleAllow = async () => {
    if (pending.toolName === 'Write' || pending.toolName === 'Edit') {
      try { await saveAllDirtyTabs(); } catch { /* proceed with confirmation even if save fails */ }
    }
    confirmTool(true);
  };

  const handleSubmitAnswers = async () => {
    if (!isQuestion) return;
    const toolUseId = pending.toolUseID;
    const finalAnswers: Record<string, string | string[]> = {};
    for (const q of questions) {
      if (answers[q.question]) {
        finalAnswers[q.question] = answers[q.question];
      } else if (q.options.length > 0) {
        finalAnswers[q.question] = q.multiSelect ? [q.options[0].label] : q.options[0].label;
      } else {
        finalAnswers[q.question] = '';
      }
    }
    const answerText = questions.map((q) => {
      const ans = finalAnswers[q.question];
      return `**${q.header}**: ${Array.isArray(ans) ? ans.join(', ') : ans}`;
    }).join('\n\n');

    // Push answer into the pipe FIRST, then confirm the tool.
    // This way the answer is already in the iterable when the SDK executes the tool.
    await window.hicc.answerQuestion(toolUseId, answerText);
    await window.hicc.confirmTool(true, toolUseId);
    useAppStore.getState().clearToolConfirm();
    setAnswers({});
  };

  const handleSelect = (question: string, option: string, multiSelect: boolean) => {
    if (multiSelect) {
      const current = (answers[question] as string[]) || [];
      const next = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      setAnswers({ ...answers, [question]: next });
    } else {
      setAnswers({ ...answers, [question]: option });
    }
  };

  if (isQuestion && questions.length > 0) {
    return (
      <div className={styles.overlay}>
        <div className={styles.dialog}>
          <div className={styles.title}>
            {pending.displayName || pending.title || 'Answer Required'}
          </div>
          {questions.map((q) => (
            <div key={q.question} className={styles.questionBlock}>
              <div className={styles.questionHeader}>{q.header}</div>
              <div className={styles.questionText}>{q.question}</div>
              <div className={styles.questionOptions}>
                {q.options.map((opt) => {
                  const selected = q.multiSelect
                    ? ((answers[q.question] as string[]) || []).includes(opt.label)
                    : answers[q.question] === opt.label;
                  return (
                    <label
                      key={opt.label}
                      className={`${styles.questionOption} ${selected ? styles.questionOptionSelected : ''}`}
                      onClick={() => handleSelect(q.question, opt.label, q.multiSelect)}
                    >
                      <input
                        type={q.multiSelect ? 'checkbox' : 'radio'}
                        checked={selected}
                        onChange={() => {}}
                        className={styles.radio}
                      />
                      <div>
                        <div className={styles.optionLabel}>{opt.label}</div>
                        {opt.description && (
                          <div className={styles.optionDesc}>{opt.description}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <div className={styles.actions}>
            <button className={styles.rejectButton} onClick={() => confirmTool(false)}>
              Skip
            </button>
            <button className={styles.allowButton} onClick={handleSubmitAnswers}>
              Submit Answer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputPreview = JSON.stringify(pending.input, null, 2).slice(0, 500);

  return (
    <div className={styles.dialog}>
      <div className={styles.title}>
        {pending.displayName || pending.title || `Allow ${pending.toolName}?`}
      </div>
      {pending.description && (
        <div className={styles.description}>{pending.description}</div>
      )}
      <pre className={styles.inputPreview}>{inputPreview}</pre>
      <div className={styles.actions}>
        <button className={styles.rejectButton} onClick={() => confirmTool(false)}>
          Reject
        </button>
        <button className={styles.alwaysButton} onClick={() => confirmTool(true, true)}>
          Always Allow
        </button>
        <button className={styles.allowButton} onClick={handleAllow}>
          Allow
        </button>
      </div>
    </div>
  );
};

export default ToolConfirmDialog;
