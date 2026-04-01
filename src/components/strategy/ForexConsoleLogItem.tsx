import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { FONT_SIZES, SPACING, RADIUS, LINE_HEIGHTS } from '../../theme';
import { fontScale, moderateScale } from '../../utils/responsive';
import type { ForexLogEntry, ForexLogType } from '../../types/forex';

// ── Color scheme ────────────────────────────────────────────────────────────────

const LOG_COLORS: Record<ForexLogType, string> = {
  RFQ: '#60a5fa',       // blue
  QUOTE: '#22d3ee',     // cyan
  MATCH: '#4ade80',     // green
  SETTLE: '#34d399',    // bright green
  PVP: '#a78bfa',       // purple
  HEDGE: '#fb923c',     // orange
  CLEAR: '#c084fc',     // light purple
  POSITION: '#fbbf24',  // amber
  PNL: '#4ade80',       // green
  SYSTEM: '#a1a1aa',    // gray
};

const LOG_BG: Partial<Record<ForexLogType, string>> = {
  MATCH: 'rgba(74,222,128,0.10)',
  SETTLE: 'rgba(52,211,153,0.11)',
  PVP: 'rgba(167,139,250,0.10)',
  PNL: 'rgba(74,222,128,0.08)',
};

const TYPE_ICONS: Record<ForexLogType, string> = {
  RFQ: '\u25CB',       // circle
  QUOTE: '\u25C8',     // diamond
  MATCH: '\u2713',     // check
  SETTLE: '\u25B2',    // triangle
  PVP: '\u2592',       // block
  HEDGE: '\u25BA',     // arrow
  CLEAR: '\u25CF',     // filled circle
  POSITION: '\u25A0',  // square
  PNL: '\u2248',       // approx
  SYSTEM: '\u2500',    // dash
};

const HIGHLIGHT_TYPES: Set<ForexLogType> = new Set(['MATCH', 'SETTLE', 'PVP']);

const MONO_FONT = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

// ── Props ───────────────────────────────────────────────────────────────────────

interface ForexConsoleLogItemProps {
  entry: ForexLogEntry;
}

// ── Component ───────────────────────────────────────────────────────────────────

const ForexConsoleLogItemInner: React.FC<ForexConsoleLogItemProps> = ({ entry }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();

    if (HIGHLIGHT_TYPES.has(entry.type)) {
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, []);

  const baseColor = entry.type === 'PNL' && entry.message.includes('-')
    ? '#f87171'
    : LOG_COLORS[entry.type];

  const timestamp = formatTimestamp(entry.timestamp);
  const isHighlight = HIGHLIGHT_TYPES.has(entry.type);
  const bgColor = LOG_BG[entry.type] || 'transparent';
  const icon = TYPE_ICONS[entry.type] || '';

  const flashBgRgba = hexToRgba(baseColor, 0.18);
  const flashBg = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', flashBgRgba],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.View
        style={[
          styles.inner,
          { backgroundColor: flashBg },
          isHighlight && styles.innerHighlight,
          bgColor !== 'transparent' && { backgroundColor: bgColor },
        ]}
      >
        {/* Left color bar */}
        <View style={[styles.leftBar, { backgroundColor: baseColor }]} />

        <View style={styles.content}>
          {/* Header line: timestamp + type badge */}
          <View style={styles.headerRow}>
            <Text style={styles.timestamp}>{timestamp}</Text>

            <View style={[styles.typeBadge, { backgroundColor: hexToRgba(baseColor, 0.15) }]}>
              <Text style={[styles.typeIcon, { color: baseColor }]}>{icon}</Text>
              <Text style={[styles.typeText, { color: baseColor }]}>{entry.type}</Text>
            </View>

            {entry.importance === 'high' && (
              <View style={styles.importanceDot} />
            )}
          </View>

          {/* Message line */}
          <Text style={[styles.message, { color: baseColor }]} numberOfLines={4}>
            {entry.message}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginVertical: moderateScale(6),
    marginHorizontal: SPACING.xs,
  },
  inner: {
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
  },
  innerHighlight: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  leftBar: {
    width: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
    gap: SPACING.sm,
  },
  timestamp: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.small),
    color: '#9CA3AF',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    gap: 3,
  },
  typeIcon: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.small),
  },
  typeText: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.small),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  importanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
    marginLeft: 'auto',
  },
  message: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.body),
    lineHeight: LINE_HEIGHTS.body,
  },
});

// ── Memo ────────────────────────────────────────────────────────────────────────

export const ForexConsoleLogItem = React.memo(ForexConsoleLogItemInner, (prev, next) => {
  return prev.entry.id === next.entry.id;
});
