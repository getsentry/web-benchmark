import type * as playwright from 'playwright';

export { TBT };

// https://web.dev/tbt/
class TBT {
  public constructor(private _page: playwright.Page) {}

  public async setup(): Promise<void> {
    await this._page.context().addInitScript(`{
      window.totalBlockingTime = 0;

      const observer = new PerformanceObserver((entryList) => {
        window.totalBlockingTime = entryList.getEntries().reduce((total, {duration}) => total += duration, window.totalBlockingTime);
      });

      observer.observe({type: 'longtask', buffered: true});

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          observer.takeRecords();
          observer.disconnect();
        }
      });
    }`);
  }

  public async collect(): Promise<number | undefined> {
    const result = await this._page.evaluate('window.totalBlockingTime');
    return result as number;
  }
}
