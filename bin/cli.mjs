#!/usr/bin/env node

import path from 'node:path';
import { parseArgs } from "node:util";
import * as url from 'node:url';

import {MetricsCollector, MetricsStats, printStats} from '../lib/index.js';

// From: https://exploringjs.com/nodejs-shell-scripting/ch_nodejs-path.html#detecting-if-module-is-main
const modulePath = url.fileURLToPath(import.meta.url);
if (import.meta.url.startsWith('file:')) { // (A)
  if (process.argv[1] === modulePath) { // (B)
    main();
  }
}


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
  }

  const {
    values: { headless, runs, cpu, network, file },
  } = parseArgs({options});

  console.log({
    headless,
    runs,
    cpu,
    network,
    file
  })

  if (!file || file.length < 1) {
    // need file!
    throw new Error('No scenario files given')
  }


  const modules = await Promise.all(file.map(async f => import(path.resolve('./', f))));
  const scenarios = modules.flatMap(m => Object.values(m))

  const collector = new MetricsCollector();
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
  
  result.writeToFile('out/latest-result.json');

// const resultsSet = new ResultsSet(outDir);
// const latestResult = Result.readFromFile(latestResultFile);
//
// const analysis = await ResultsAnalyzer.analyze(latestResult, resultsSet);
// printAnalysis(analysis, latestResult);
}

