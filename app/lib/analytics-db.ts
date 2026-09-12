/**
 * 📊 ANALYTICS DATABASE - VISITANTES ÚNICOS POR DEVICE-ID
 * Tracks unique visitors by device-id and clicks for daily analytics
 * Uses API endpoint instead of direct Firestore writes (more secure)
 */

import { db } from "./firebase";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { getOrCreateDeviceId } from "./device-id-client";
import { isWebViewOrLowPerformance } from "./webview-detect";

const ANALYTICS_COLLECTION = "analytics";
const API_TRACK_URL = "/api/analytics/track";

// Cache para evitar tracking excesivo en WebViews
let lastTrackTime = 0;
const TRACK_COOLDOWN = isWebViewOrLowPerformance() ? 5000 : 1000; // 5s en WebView, 1s normal

interface DailyAnalytics {
  date: string; // YYYY-MM-DD format
  uniqueVisitors: number;
  visitorIds: string[]; // Array de device-ids únicos
  totalClicks: number;
  clicksByType: {
    productClick: number;
    categoryClick: number;
    buttonClick: number;
    linkClick: number;
    blogClick: number;
    [key: string]: number;
  };
  lastUpdated: any;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

/**
 * Track a page view by device-id (counts unique visitors)
 * Uses API endpoint for safety and permissions
 * Optimized for WebViews with cooldown
 */
export async function trackPageView(): Promise<void> {
  try {
    // En WebViews, aplicar cooldown para evitar requests excesivos
    const now = Date.now();
    if (now - lastTrackTime < TRACK_COOLDOWN) {
      return;
    }
    lastTrackTime = now;

    const deviceId = getOrCreateDeviceId();
    
    const response = await fetch(API_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType: "pageView",
        deviceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // API returned non-ok status
    }
  } catch (error) {
    // Error tracking page view
  }
}

/**
 * Track a click event
 * Uses API endpoint for safety and permissions
 */
export async function trackClick(
  type: "productClick" | "categoryClick" | "buttonClick" | "linkClick" | "blogClick" = "buttonClick"
): Promise<void> {
  try {
    const deviceId = getOrCreateDeviceId();
    
    const response = await fetch(API_TRACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventType: "click",
        clickType: type,
        deviceId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // Click API returned non-ok status
    }
  } catch (error) {
    // Error tracking click
  }
}

/**
 * Get today's analytics
 */
export async function getTodayAnalytics(): Promise<DailyAnalytics | null> {
  try {
    const today = getTodayDate();
    const docRef = doc(db, ANALYTICS_COLLECTION, today);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as DailyAnalytics;
    }
    return null;
  } catch (error) {
    console.error("[Analytics] Error getting today's analytics:", error);
    return null;
  }
}

/**
 * Reset today's analytics (DO NOT USE - only for development)
 * The API endpoint handles daily resets via cron job
 */
export async function resetTodayAnalytics(): Promise<void> {
  console.warn("[Analytics] resetTodayAnalytics is deprecated - use /api/admin/reset-analytics instead");
}

/**
 * Get analytics for a specific date
 */
export async function getAnalyticsByDate(date: string): Promise<DailyAnalytics | null> {
  try {
    const docRef = doc(db, ANALYTICS_COLLECTION, date);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as DailyAnalytics;
    }
    return null;
  } catch (error) {
    console.error("[Analytics] Error getting analytics for date:", date, error);
    return null;
  }
}
