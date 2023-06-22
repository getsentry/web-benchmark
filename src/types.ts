import type { Browser, Page } from 'playwright';
import type { Metrics } from './collector';

// A testing scenario we want to collect metrics for.
export interface Scenario {
  storageState?: string;
  run(browser: Browser, page: Page): Promise<void>;
}

// Two scenarios that are compared to each other.
export interface TestCase {
  name: string;
  scenarios: Scenario[];
  runs: number;
  tries: number;

  // Test function that will be executed and given a scenarios result set with exactly `runs` number of items.
  // Should returns true if this "try" should be accepted and collected.
  // If false is returned, `Collector` will retry up to `tries` number of times.
  shouldAccept(results: Metrics[]): Promise<boolean>;
}
