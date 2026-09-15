// ============================================================================
// JARVISTRAVEL MARKETING - APP CAPTURES
//
// Real screens of the app, produced by web-app's capture harness from the
// shipped demo trip (web-app capture/README.md). To refresh them:
//
//   in web-app:  npm run capture && npm run capture:encode
//   then copy, keeping the names, from capture/dist/ into src/assets/captures/:
//     desktop/<screen>-light-{720,960,1440}.webp  and  desktop/<screen>-light-720.png
//     mobile/<screen>-light-{390,780}.webp
//
// IMPORTED, not served from public/: a missing or misnamed file fails the
// build instead of shipping a broken image, and a refreshed file gets a new
// hashed URL instead of a stale cached one.
//
// Light only, because the site has no dark theme. The screens keep the demo's
// in-app photos as the app renders them: a trip screen without its photos
// reads as unfinished (brand owner, 2026-09-14).
// ============================================================================

import dayDetailBadge720 from '../../assets/captures/desktop/day-detail-badge-light-720.webp';
import dayDetailBadge960 from '../../assets/captures/desktop/day-detail-badge-light-960.webp';
import dayDetailBadge1440 from '../../assets/captures/desktop/day-detail-badge-light-1440.webp';
import dayDetailBadgePng from '../../assets/captures/desktop/day-detail-badge-light-720.png';
import dayDetailBadgePhone390 from '../../assets/captures/mobile/day-detail-badge-light-390.webp';
import dayDetailBadgePhone780 from '../../assets/captures/mobile/day-detail-badge-light-780.webp';

import tripPlanDays720 from '../../assets/captures/desktop/trip-plan-days-light-720.webp';
import tripPlanDays960 from '../../assets/captures/desktop/trip-plan-days-light-960.webp';
import tripPlanDays1440 from '../../assets/captures/desktop/trip-plan-days-light-1440.webp';
import tripPlanDaysPng from '../../assets/captures/desktop/trip-plan-days-light-720.png';
import tripPlanDaysPhone390 from '../../assets/captures/mobile/trip-plan-days-light-390.webp';
import tripPlanDaysPhone780 from '../../assets/captures/mobile/trip-plan-days-light-780.webp';

import homeTab720 from '../../assets/captures/desktop/home-tab-light-720.webp';
import homeTab960 from '../../assets/captures/desktop/home-tab-light-960.webp';
import homeTab1440 from '../../assets/captures/desktop/home-tab-light-1440.webp';
import homeTabPng from '../../assets/captures/desktop/home-tab-light-720.png';
import homeTabPhone390 from '../../assets/captures/mobile/home-tab-light-390.webp';
import homeTabPhone780 from '../../assets/captures/mobile/home-tab-light-780.webp';

import budgetTracker720 from '../../assets/captures/desktop/budget-tracker-light-720.webp';
import budgetTracker960 from '../../assets/captures/desktop/budget-tracker-light-960.webp';
import budgetTracker1440 from '../../assets/captures/desktop/budget-tracker-light-1440.webp';
import budgetTrackerPng from '../../assets/captures/desktop/budget-tracker-light-720.png';
import budgetTrackerPhone390 from '../../assets/captures/mobile/budget-tracker-light-390.webp';
import budgetTrackerPhone780 from '../../assets/captures/mobile/budget-tracker-light-780.webp';

import flowMap720 from '../../assets/captures/desktop/flow-map-light-720.webp';
import flowMap960 from '../../assets/captures/desktop/flow-map-light-960.webp';
import flowMap1440 from '../../assets/captures/desktop/flow-map-light-1440.webp';
import flowMapPng from '../../assets/captures/desktop/flow-map-light-720.png';
import flowMapPhone390 from '../../assets/captures/mobile/flow-map-light-390.webp';
import flowMapPhone780 from '../../assets/captures/mobile/flow-map-light-780.webp';

import journalDay720 from '../../assets/captures/desktop/journal-day-light-720.webp';
import journalDay960 from '../../assets/captures/desktop/journal-day-light-960.webp';
import journalDay1440 from '../../assets/captures/desktop/journal-day-light-1440.webp';
import journalDayPng from '../../assets/captures/desktop/journal-day-light-720.png';
import journalDayPhone390 from '../../assets/captures/mobile/journal-day-light-390.webp';
import journalDayPhone780 from '../../assets/captures/mobile/journal-day-light-780.webp';

/** One screen, as both device profiles the harness captures. */
export interface AppCaptureImage {
  /** srcset of the desktop profile (a 1440x900 viewport). */
  desktop: string;
  /** srcset of the phone profile (a 390x844 viewport). */
  phone: string;
  /** A PNG of the desktop profile, for a browser without WebP. */
  fallback: string;
}

/** Each width sits beside the file named for it, so a mismatch shows in review. */
const srcSet = (...candidates: [url: string, width: number][]) =>
  candidates.map(([url, width]) => `${url} ${width}w`).join(', ');

export const DAY_DETAIL: AppCaptureImage = {
  desktop: srcSet([dayDetailBadge720, 720], [dayDetailBadge960, 960], [dayDetailBadge1440, 1440]),
  phone: srcSet([dayDetailBadgePhone390, 390], [dayDetailBadgePhone780, 780]),
  fallback: dayDetailBadgePng,
};

export const PACKED_DAY: AppCaptureImage = {
  desktop: srcSet([tripPlanDays720, 720], [tripPlanDays960, 960], [tripPlanDays1440, 1440]),
  phone: srcSet([tripPlanDaysPhone390, 390], [tripPlanDaysPhone780, 780]),
  fallback: tripPlanDaysPng,
};

export const TRIP_HOME: AppCaptureImage = {
  desktop: srcSet([homeTab720, 720], [homeTab960, 960], [homeTab1440, 1440]),
  phone: srcSet([homeTabPhone390, 390], [homeTabPhone780, 780]),
  fallback: homeTabPng,
};

/** The Budget Tracker panel itself, not the budget card on the trip's home screen. */
export const BUDGET: AppCaptureImage = {
  desktop: srcSet([budgetTracker720, 720], [budgetTracker960, 960], [budgetTracker1440, 1440]),
  phone: srcSet([budgetTrackerPhone390, 390], [budgetTrackerPhone780, 780]),
  fallback: budgetTrackerPng,
};

export const DAY_ROUTE: AppCaptureImage = {
  desktop: srcSet([flowMap720, 720], [flowMap960, 960], [flowMap1440, 1440]),
  phone: srcSet([flowMapPhone390, 390], [flowMapPhone780, 780]),
  fallback: flowMapPng,
};

/** A journal day with a place card open, not the journal's cover (JAR-1618). */
export const JOURNAL: AppCaptureImage = {
  desktop: srcSet([journalDay720, 720], [journalDay960, 960], [journalDay1440, 1440]),
  phone: srcSet([journalDayPhone390, 390], [journalDayPhone780, 780]),
  fallback: journalDayPng,
};
