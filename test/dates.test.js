import { test } from "node:test";
import assert from "node:assert/strict";
import { hasDateRange, detectDateFormats, convertDate } from "../src/validate/dates.js";

test("recognizes common date ranges", () => {
  for (const s of ["10/2020–Present", "Jan 2024 - Mar 2025", "November 2010–March 2020", "2018 to 2020", "3/2020—10/2020"]) {
    assert.ok(hasDateRange(s), s);
  }
  assert.equal(hasDateRange("Maven Machines"), false);
});

test("a full month name is not double counted as a bare year", () => {
  assert.deepEqual(detectDateFormats("November 2010").map((d) => d.format), ["Month YYYY"]);
});

test("converts between month formats", () => {
  assert.equal(convertDate("November 2010", "MM/YYYY"), "11/2010");
  assert.equal(convertDate("3/2020", "Mon YYYY"), "Mar 2020");
  assert.equal(convertDate("Sept 2021", "Month YYYY"), "September 2021");
  assert.equal(convertDate("2018", "MM/YYYY"), null);
});
