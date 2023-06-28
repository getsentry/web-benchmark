import { filesize } from 'filesize';

import type { Metrics } from '../collector.js';
import type { Analysis } from '../results/analyzer.js';
import { AnalyzerItemMetric } from '../results/analyzer.js';
import { MetricsStats } from '../results/metrics-stats.js';
import { Result } from '../results/result.js';

export async function consoleGroup<T>(code: () => Promise<T>): Promise<T> {
  console.group();
  return code().finally(console.groupEnd);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrintableTable = { [k: string]: any };

export function printStats(items: Metrics[]): void {
  console.table({
    lcp: `${MetricsStats.mean(items, MetricsStats.lcp)?.toFixed(2)} ms`,
    // ['lcp (median)']: `${MetricsStats.median(items, MetricsStats.lcp)?.toFixed(2)} ms`,
    // ['lcp (stddev)']: `${MetricsStats.stddev(items, MetricsStats.lcp)?.toFixed(2)} ms`,
    cls: `${MetricsStats.mean(items, MetricsStats.cls)?.toFixed(2)} ms`,
    fid: `${MetricsStats.mean(items, MetricsStats.fid)?.toFixed(2)} ms`,
    tbt: `${MetricsStats.mean(items, MetricsStats.tbt)?.toFixed(2)} ms`,
    cpu: `${((MetricsStats.mean(items, MetricsStats.cpu) || 0) * 100).toFixed(2)} %`,
    memoryMean: filesize(MetricsStats.mean(items, MetricsStats.memoryMean)),
    memoryMax: filesize(MetricsStats.max(items, MetricsStats.memoryMax)),
    netTx: filesize(MetricsStats.mean(items, MetricsStats.netTx)),
    netRx: filesize(MetricsStats.mean(items, MetricsStats.netRx)),
  });
}

export function printAnalysis(analysis: Analysis, latestResult: Result): void {
  const table: PrintableTable = {};
  const numResults = latestResult.scenarioResults.length;
  const scenarioNames = latestResult.scenarioResults.map(scenarioRuns => scenarioRuns[0].name);
  for (const item of analysis.items) {
    table[AnalyzerItemMetric[item.metric] || item.metric] = Object.fromEntries(
      [...Array(numResults)].map((_, i) => [scenarioNames[i], item.values.value(i)]),
    );
  }
  console.table(table);
}
