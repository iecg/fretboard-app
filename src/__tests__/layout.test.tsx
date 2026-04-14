// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  CONTROLS_MIN_HEIGHT,
  KEY_MIN_HEIGHT,
  SUMMARY_MIN_HEIGHT,
} from '../layout/constants';

// R02 regression tests — UAT-01-R01-a
// Badge visibility (UAT-02) cannot be tested in JSDOM (no real viewport rendering).
// Verified manually via T01 Playwright measurement: reducing .mobile-tab-panel
// min-height from 200px to 150px puts badge within scroll-reach at 375×667.

describe('R02 layout constants', () => {
  it('exports KEY_MIN_HEIGHT as a positive integer', () => {
    expect(typeof KEY_MIN_HEIGHT).toBe('number');
    expect(KEY_MIN_HEIGHT).toBeGreaterThan(0);
    expect(Number.isInteger(KEY_MIN_HEIGHT)).toBe(true);
  });

  it('CONTROLS_MIN_HEIGHT is greater than round-01 value of 260', () => {
    // Round-01 used 260px which was too small — R02 measured controlsColLeftH=311
    // and derived CONTROLS_MIN_HEIGHT=340 (311 + 20px buffer, ceil to 10).
    expect(CONTROLS_MIN_HEIGHT).toBeGreaterThan(260);
  });

  it('KEY_MIN_HEIGHT is at least 280 (CoF legibility floor)', () => {
    // CoF uses aspect-ratio:1; minimum legible diameter ~200px + padding → 280px floor.
    expect(KEY_MIN_HEIGHT).toBeGreaterThanOrEqual(280);
  });

  it('SUMMARY_MIN_HEIGHT is a positive integer', () => {
    expect(typeof SUMMARY_MIN_HEIGHT).toBe('number');
    expect(SUMMARY_MIN_HEIGHT).toBeGreaterThan(0);
    expect(Number.isInteger(SUMMARY_MIN_HEIGHT)).toBe(true);
  });

  it('R02 root min-height formula produces value in 800-900px range', () => {
    // chrome(200) + fretboard-min(240) + max(CONTROLS, KEY) + SUMMARY + 20, ceil to 10
    const chromeH = 200;
    const fretboardMin = 240;
    const safetyMargin = 20;
    const derived =
      Math.ceil(
        (chromeH +
          fretboardMin +
          Math.max(CONTROLS_MIN_HEIGHT, KEY_MIN_HEIGHT) +
          SUMMARY_MIN_HEIGHT +
          safetyMargin) /
          10,
      ) * 10;
    expect(derived).toBeGreaterThanOrEqual(800);
    expect(derived).toBeLessThanOrEqual(900);
  });
});
