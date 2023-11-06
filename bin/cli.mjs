#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from "node:util";
import * as url from 'node:url';

import {MetricsCollector, MetricsStats, ResultsAnalyzer, ResultsSet, printStats, printAnalysis} from '../lib/index.js';

async function main() {
  const options = {
    'headless': {
      type: 'boolean',
    },
    'runs': {
      type: 'string',
      short: 'c'
    },
    'cpu': {
      type: 'string',
    },
    'network': {
      type: 'string',
      short: 'n',
    },
    'file': {
      type: 'string',
      short: 'f',
      multiple: true,
    },
    'device':{
      type: 'string',
      short: 'd',
    }
  }

  const {
    values: { headless, runs, cpu, network, file, device },
  } = parseArgs({options});

  if (!file || file.length < 1) {
    // need file!
    throw new Error('No scenario files given')
  }


  const modules = await Promise.all(file.map(async f => import(path.resolve('./', f))));
  const scenarios = modules.flatMap(m => Object.values(m))

  const collector = new MetricsCollector({
    headless: headless ?? false,
    cpuThrottling: cpu ? parseFloat(cpu) : false,
    networkConditions: network,
    device: device,
  });

  const result = await collector.execute({
    name: 'default',
    scenarios: scenarios.map(C => new C()),
    runs: runs ?? 1,
    tries: (runs ?? 1) * 5,
    async shouldAccept(results) {
      printStats(results);
  
      const cpuUsage = MetricsStats.mean(results, MetricsStats.cpu);
      if (cpuUsage > 0.9) {
        console.error(
          `CPU usage too high to be accurate: ${(cpuUsage * 100).toFixed(2)} %.`,
          'Consider simplifying the scenario or changing the CPU throttling factor.',
        );
        return false;
      }
      return true;
    },
  });
  
  result.writeToFile(`out/result-${Date.now()}.json`);
  result.writeToFile('out/latest-result.json');

  const resultsSet = new ResultsSet('out/');
  const analysis = await ResultsAnalyzer.analyze(result, resultsSet);
  printAnalysis(analysis, result);
}

main();
