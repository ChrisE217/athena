import { useCallback, useEffect, useMemo, useState } from 'react';
import { Backdrop } from './components/Backdrop';
import { Overview } from './components/Overview';
import { SettingsMenu } from './components/SettingsMenu';
import { TestPanel } from './components/TestPanel';
import { buildFixPrompt } from './lib/prompt';
import {
  loadSettings,
  saveSettings,
  type AthenaSettings,
} from './lib/settings';
import {
  collectTests,
  GROUP_OUTCOMES,
  isFailing,
  matchesQuery,
  type StatusGroup,
} from './lib/tests';
import type { AthenaReport } from './types';

async function loadReport(): Promise<AthenaReport> {
  if (window.__ATHENA_REPORT__) return window.__ATHENA_REPORT__;
  const res = await fetch('./report.json');
  if (!res.ok) throw new Error(`Failed to load report.json (${res.status})`);
  const report = (await res.json()) as AthenaReport;
  if (!report.tests?.length) report.tests = collectTests(report.suites || []);
  return report;
}

export function App() {
  const [report, setReport] = useState<AthenaReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusGroup>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settings, setSettings] = useState<AthenaSettings>(() => loadSettings());

  function updateSettings(next: AthenaSettings) {
    setSettings(next);
    saveSettings(next);
  }

  useEffect(() => {
    loadReport()
      .then((r) => {
        setReport(r);
        window.__ATHENA_PROMPT_BUILDER__ = buildFixPrompt;
      })
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const closePanel = useCallback(() => setOpenId(null), []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, closePanel]);

  const failures = useMemo(
    () => (report ? report.tests.filter(isFailing) : []),
    [report],
  );

  const visible = useMemo(() => {
    if (!report) return [];
    const outcomes = GROUP_OUTCOMES[filter];
    return report.tests.filter((t) => outcomes.includes(t.outcome) && matchesQuery(t, query));
  }, [report, filter, query]);

  const opened = report?.tests.find((t) => t.id === openId);

  function changeFilter(next: StatusGroup) {
    setFilter((current) => (current === next ? 'all' : next));
  }

  if (error) {
    return (
      <div className="boot">
        <p>{error}</p>
        <p className="muted">Serve the report with: npx athena show</p>
      </div>
    );
  }

  if (!report) return <div className="boot muted">Loading report…</div>;

  return (
    <>
      <Backdrop tone={failures.length ? 'alert' : 'calm'} />
      <div className="shell">
        <header className="topbar glass">
          <button type="button" className="wordmark" onClick={closePanel}>
            ATHENA
          </button>
          <div className="topbar-right">
            <span className="topbar-sub">{report.title}</span>
            <SettingsMenu settings={settings} onChange={updateSettings} />
          </div>
        </header>

        <main className="content">
          {opened ? (
            <TestPanel test={opened} onBack={closePanel} onToast={setToast} />
          ) : (
            <Overview
              report={report}
              failures={failures}
              visible={visible}
              filter={filter}
              query={query}
              settings={settings}
              onFilter={changeFilter}
              onQuery={setQuery}
              onOpen={setOpenId}
            />
          )}
        </main>
      </div>

      {toast ? <div className="toast glass">{toast}</div> : null}
    </>
  );
}
