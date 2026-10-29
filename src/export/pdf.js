import puppeteer from "puppeteer";

/**
 * Renders HTML to a text-based PDF using headless Chrome's print engine.
 * The browser is launched once and reused for every resume in a build.
 */
export class PdfRenderer {
  #browser = null;

  async #launch() {
    if (!this.#browser) {
      this.#browser = await puppeteer.launch({
        headless: true,
        // GitHub's Ubuntu runners restrict Chrome's sandbox; it's safe to disable
        // there because we only render our own local HTML.
        args: process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
      });
    }
    return this.#browser;
  }

  async render(html, { pageSize = "Letter" } = {}) {
    const browser = await this.#launch();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      await page.emulateMediaType("print");
      return await page.pdf({
        format: pageSize,
        printBackground: true,
        preferCSSPageSize: true,
        tagged: true, // accessibility tags: headings and lists survive in the PDF structure
        outline: true, // PDF bookmarks from headings
      });
    } finally {
      await page.close();
    }
  }

  async close() {
    await this.#browser?.close();
    this.#browser = null;
  }
}
