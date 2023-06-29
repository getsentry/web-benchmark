<p align="center">
  <a href="https://sentry.io/?utm_source=github&utm_medium=logo" target="_blank">
    <img src="https://sentry-brand.storage.googleapis.com/sentry-wordmark-dark-280x84.png" alt="Sentry" width="280" height="84">
  </a>
</p>

[![npm version](https://img.shields.io/npm/v/@sentry-internal/web-benchmark.svg)](https://www.npmjs.com/package/@sentry-internal/web-benchmark)
[![Discord](https://img.shields.io/discord/621778831602221064)](https://discord.gg/Ww9hbqr)

# Overhead performance metrics

Evaluates Sentry & Replay impact on website performance by running a web app in Chromium via Playwright and collecting various metrics.

The general idea is to run a web app without Sentry, and then run the same app again with Sentry and another one with Sentry+Replay included.
For the three scenarios, we collect some metrics (CPU, memory, vitals) and later compare them and post as a comment in a PR.
Changes in the metrics, compared to previous runs from the main branch, should be evaluated on case-by-case basis when preparing and reviewing the PR.


## Instructions

WIP

`npx @sentry-internal/overhead -f myScenario.js`

## Resources

* https://github.com/addyosmani/puppeteer-webperf
* https://web.dev/
