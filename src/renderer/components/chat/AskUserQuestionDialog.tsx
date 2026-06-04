import React, { useState } from 'react';
import { useAppStore } from '../../store/app-store';
import styles from './AskUserQuestionDialog.module.css';

interface Question {
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
}

const AskUserQuestionDialog: React.FC = () => {
  const pending = useAppStore((s) => s.pendingAskUserQuestion);
  const answerAskUserQuestion = useAppStore((s) => s.answerAskUserQuestion);

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  if (!pending) return null;

  const handleSubmit = () => {
    // Fill in defaults for unanswered questions
    const finalAnswers: Record<string, string | string[]> = {};
    for (const q of pending.questions) {
      if (answers[q.question]) {
        finalAnswers[q.question] = answers[q.question];
      } else if (q.options.length > 0) {
        finalAnswers[q.question] = q.multiSelect ? [q.options[0].label] : q.options[0].label;
      } else {
        finalAnswers[q.question] = '';
      }
    }
    answerAskUserQuestion(pending.toolUseId, finalAnswers);
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

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.title}>Answer Required</div>
        {pending.questions.map((q) => (
          <div key={q.question} className={styles.questionBlock}>
            <div className={styles.questionHeader}>{q.header}</div>
            <div className={styles.questionText}>{q.question}</div>
            <div className={styles.options}>
              {q.options.map((opt) => {
                const selected = q.multiSelect
                  ? ((answers[q.question] as string[]) || []).includes(opt.label)
                  : answers[q.question] === opt.label;
                return (
                  <label
                    key={opt.label}
                    className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
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
          <button className={styles.submitButton} onClick={handleSubmit}>
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
};

export default AskUserQuestionDialog;
