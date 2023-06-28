import pTimeout from 'p-timeout';
import * as playwright from 'playwright';

import type { CpuUsageSerialized } from './perf/cpu.js';
import { CpuUsage, CpuUsageSampler } from './perf/cpu.js';
import type { JsHeapUsageSerialized } from './perf/memory.js';
import { JsHeapUsage, JsHeapUsageSampler } from './perf/memory.js';
import type { NetworkUsageSerialized } from './perf/network.js';
import { NetworkUsage, NetworkUsageCollector } from './perf/network.js';
import { PerfMetricsSampler } from './perf/sampler.js';
import { Result } from './results/result.js';
import type { Scenario, TestCase } from './types.js';
import { consoleGroup } from './util/console.js';
import { WebVitals, WebVitalsCollector } from './vitals/index.js';

enum NetworkConditions {
  FAST_3G = 'Fast 3G',
  SLOW_3G = 'Slow 3G',
}

// Same as puppeteer-core PredefinedNetworkConditions
const PredefinedNetworkConditions = Object.freeze({
  [NetworkConditions.SLOW_3G]: {
    download: ((500 * 1000) / 8) * 0.8,
    upload: ((500 * 1000) / 8) * 0.8,
    latency: 400 * 5,
    connectionType: 'cellular3g',
  },
  [NetworkConditions.FAST_3G]: {
    download: ((1.6 * 1000 * 1000) / 8) * 0.9,
    upload: ((750 * 1000) / 8) * 0.9,
    latency: 150 * 3.75,
    connectionType: 'cellular3g',
  },
});

export class Metrics {
  public constructor(
    public readonly name: string,
    public readonly vitals: WebVitals,
    public readonly cpu: CpuUsage,
    public readonly memory: JsHeapUsage,
    public readonly network: NetworkUsage,
  ) {}

  /**
   *
   */
  public static fromJSON(
    data: Partial<{
      name: string;
      vitals: Partial<WebVitals>;
      cpu: CpuUsageSerialized;
      memory: JsHeapUsageSerialized;
      network: NetworkUsageSerialized;
    }>,
  ): Metrics {
    return new Metrics(
      data.name || '<empty>',
      WebVitals.fromJSON(data.vitals || {}),
      CpuUsage.fromJSON(data.cpu || {}),
      JsHeapUsage.fromJSON(data.memory || {}),
      NetworkUsage.fromJSON(data.network || {}),
    );
  }
}

export interface MetricsCollectorOptions {
  headless: boolean;
  cpuThrottling: false | number;
  networkConditions: false | NetworkConditions;
}

export class MetricsCollector {
  private _options: MetricsCollectorOptions;

  public constructor(options?: Partial<MetricsCollectorOptions>) {
    this._options = {
      headless: false,
      cpuThrottling: false,
      networkConditions: false,
      ...options,
    };
  }

  /**
   *
   */
  public async execute(testCase: TestCase): Promise<Result> {
    console.log(`Executing test case ${testCase.name}`);
    return consoleGroup(async () => {
      const scenarioResults: Metrics[][] = [];
      for (let s = 0; s < testCase.scenarios.length; s++) {
        const scenario = testCase.scenarios[s];
        scenarioResults.push(await this._collect(testCase, scenario.constructor.name, scenario));
      }
      return new Result(testCase.name, this._options.cpuThrottling, this._options.networkConditions, scenarioResults);
    });
  }

  /**
   *
   */
  private async _collect(testCase: TestCase, name: string, scenario: Scenario): Promise<Metrics[]> {
    const doRun = async (run: number, retry: number) => {
      if (retry > testCase.tries) {
        throw `Test case ${testCase.name}, scenario ${name} failed after ${testCase.runs} runs/${testCase.tries} tries.`;
      }

      const innerLabel = `Scenario ${name} data collection, run ${run}/${testCase.runs}${
        testCase.tries > 1 ? ` (try ${retry}/${testCase.tries})` : ''
      }`;
      console.time(innerLabel);
      try {
        results.push(await this._run(scenario));
        console.timeEnd(innerLabel);
      } catch (e) {
        console.warn(`${innerLabel} failed with --> ${e}`);
        console.timeEnd(innerLabel);
        await doRun(run, retry + 1);
      }
    };

    const results: Metrics[] = [];
    const label = `Scenario ${name} data collection (total ${testCase.runs} runs).`;
    console.time(label);
    for (let run = 1; run <= testCase.runs; run++) {
      await doRun(run, 0);
    }
    console.timeEnd(label);

    if (results.length == testCase.runs && (await testCase.shouldAccept(results))) {
      console.log(`Test case ${testCase.name}, scenario ${name} passed with ${testCase.runs} runs.`);
      return results;
    } else {
      throw `Test case ${testCase.name}, scenario ${name} failed with ${results.length}/${testCase.runs} runs.`;
    }

    // Unreachable code, if configured properly:
    console.assert(testCase.tries >= 1);
    return [];
  }

  /**
   *
   */
  private async _run(scenario: Scenario): Promise<Metrics> {
    const disposeCallbacks: (() => Promise<void>)[] = [];
    try {
      return await pTimeout(
        (async () => {
          const browser = await playwright.chromium.launch({
            headless: this._options.headless,
          });
          const context = await browser.newContext({
            ...(scenario.storageState ? { storageState: scenario.storageState } : {}),
          });
          disposeCallbacks.push(() => browser.close());
          const page = await context.newPage();
          disposeCallbacks.push(() => page.close());

          const errorLogs: Array<string> = [];
          page.on('console', message => {
            if (message.type() === 'error') errorLogs.push(message.text());
          });
          page.on('crash', _ => {
            errorLogs.push('Page crashed');
          });
          page.on('pageerror', error => {
            errorLogs.push(`${error.name}: ${error.message}`);
          });

          const cdp = await page.context().newCDPSession(page);

          // Simulate throttling.
          if (this._options.networkConditions) {
            await cdp.send('Network.emulateNetworkConditions', {
              offline: false,
              latency: PredefinedNetworkConditions[this._options.networkConditions].latency,
              uploadThroughput: PredefinedNetworkConditions[this._options.networkConditions].upload,
              downloadThroughput: PredefinedNetworkConditions[this._options.networkConditions].download,
            });
          }

          if (this._options.cpuThrottling) {
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: this._options.cpuThrottling });
          }

          // Collect CPU and memory info 10 times per second.
          const perfSampler = await PerfMetricsSampler.create(cdp, 100);
          disposeCallbacks.push(async () => perfSampler.stop());
          const cpuSampler = new CpuUsageSampler(perfSampler);
          const memSampler = new JsHeapUsageSampler(perfSampler);

          const networkCollector = await NetworkUsageCollector.create(page);
          const vitalsCollector = await WebVitalsCollector.create(page);

          await scenario.run(browser, page);

          // Wait for flushing, which we set to 2000ms - to be safe, we add 1s on top
          await new Promise(resolve => setTimeout(resolve, 3000));

          // NOTE: FID needs some interaction to actually show a value
          const vitals = await vitalsCollector.collect();

          if (errorLogs.length > 0) {
            console.warn(`Error logs in browser console:\n\t\t${errorLogs.join('\n\t\t')}`);
          }

          return new Metrics(
            scenario.constructor.name,
            vitals,
            cpuSampler.getData(),
            memSampler.getData(),
            networkCollector.getData(),
          );
        })(),
        { milliseconds: 60 * 1000 },
      );
    } finally {
      console.log('Disposing of browser and resources');
      disposeCallbacks.reverse();
      const errors = [];
      for (const cb of disposeCallbacks) {
        try {
          await cb();
        } catch (e) {
          errors.push(e instanceof Error ? `${e.name}: ${e.message}` : `${e}`);
        }
      }
      if (errors.length > 0) {
        console.warn(`All disposable callbacks have finished. Errors: ${errors}`);
      } else {
        console.warn('All disposable callbacks have finished.');
      }
    }
  }
}
