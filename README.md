<p align="center">
  <a href="https://sentry.io/?utm_source=github&utm_medium=logo" target="_blank">
    <img src="https://sentry-brand.storage.googleapis.com/sentry-wordmark-dark-280x84.png" alt="Sentry" width="280" height="84">
  </a>
</p>

[![npm version](https://img.shields.io/npm/v/@sentry-internal/web-benchmark.svg)](https://www.npmjs.com/package/@sentry-internal/web-benchmark)
[![Discord](https://img.shields.io/discord/621778831602221064)](https://discord.gg/Ww9hbqr)

# web-benchmark

Evaluates Sentry & Replay impact on website performance by running a web app in Chromium via Playwright and collecting various metrics.

The general idea is to run a web app without Sentry, and then run the same app again with Sentry and another one with Sentry+Replay included.
For the three scenarios, we collect some metrics (CPU, memory, vitals) and later compare them and post as a comment in a PR.
Changes in the metrics, compared to previous runs from the main branch, should be evaluated on case-by-case basis when preparing and reviewing the PR.


## Getting Started


### Creating a New Scenario
The `web-benchmark` script will instanciate all classes that are exported from your scenario module and call the `run()` method in each scenario run. The `run()` method is called with two arguments: [browser](https://playwright.dev/docs/api/class-browser) and [page](https://playwright.dev/docs/api/class-page). If you are familiar with Playwright you can go ahead a write a benchmarking scenario, otherwise, you can use [Playwright's Codegen](https://playwright.dev/docs/codegen#running-codegen) to assist in writing one. 
Note: Only ESM is supported, your scenario *must* be in a `.mjs` file.

```javascript
export class MyBaseScenario {
  async run(browser, page) {
    await page.goto('https://sentry.io/welcome/')
    await page.getByRole('navigation').getByRole('link', { name: 'Pricing' }).click()
  }
}
```

### Running

To run: 

`npx @sentry-internal/web-benchmark -f myScenario.mjs`


#### Supported Options

| arg         | required | default | description |
| ----------- | -------- | ------- | ----------- |
| --file / -f | true     |         | The path to your scenario file |
| --headless  | false    | true    | Run in headless mode |
| --runs / -c | false    | 1       | The number of times to run the scenario |
| --cpu       | false    | 1       | The CPU throttle factor. e.g. "2" represents a 2x throttle |
| --network   | false    | false   | The network speed to emulate (e.g. "Fast 3G" or "Slow 3G") |


## Resources

* https://github.com/addyosmani/puppeteer-webperf
* https://web.dev/
