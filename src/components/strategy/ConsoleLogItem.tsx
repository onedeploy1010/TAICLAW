import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { FONT_SIZES, SPACING, RADIUS, LINE_HEIGHTS } from '../../theme';
import { fontScale, moderateScale } from '../../utils/responsive';
import type { BotLogEntry, BotLogType } from '@one_deploy/sdk';

// ── Color scheme (brighter, high-contrast on dark bg) ──────────────────────────

const LOG_COLORS: Record<BotLogType, string> = {
  SCAN: '#6ec6c6',
  INDICATOR: '#22d3ee',
  NEWS: '#fbbf24',
  SIGNAL: '#fde047',
  ANALYSIS: '#d4d4d8',
  DECISION: '#4ade80',
  ORDER: '#a78bfa',
  FILLED: '#34d399',
  PNL: '#4ade80',
  RISK: '#fb923c',
  SYSTEM: '#a1a1aa',
  STRATEGY: '#818cf8',   // Indigo for strategy context
  THINKING: '#94a3b8',   // Slate for AI thinking
};

// Background tint for important entry types
const LOG_BG: Partial<Record<BotLogType, string>> = {
  SIGNAL: 'rgba(253,224,71,0.10)',
  ORDER: 'rgba(167,139,250,0.10)',
  FILLED: 'rgba(52,211,153,0.11)',
  NEWS: 'rgba(251,191,36,0.08)',
  RISK: 'rgba(251,146,60,0.08)',
  STRATEGY: 'rgba(129,140,248,0.12)',  // Indigo tint for strategy
  THINKING: 'rgba(148,163,184,0.06)',  // Subtle slate for thinking
};

const HIGHLIGHT_TYPES: Set<BotLogType> = new Set(['SIGNAL', 'ORDER', 'FILLED', 'STRATEGY']);

const TYPE_ICONS: Partial<Record<BotLogType, string>> = {
  SCAN: '\u25CB',      // ○
  INDICATOR: '\u25C8',  // ◈
  NEWS: '\u25C6',       // ◆
  SIGNAL: '\u25B2',     // ▲
  ANALYSIS: '\u25CF',   // ●
  DECISION: '\u25BA',   // ►
  ORDER: '\u2592',      // ▒
  FILLED: '\u2713',     // ✓
  PNL: '\u2248',        // ≈
  RISK: '\u26A0',       // ⚠
  SYSTEM: '\u2500',     // ─
  STRATEGY: '\u2756',   // ❖ Diamond with dot
  THINKING: '\u2026',   // … Ellipsis (thinking)
};

const STRATEGY_COLORS: Record<string, string> = {
  'balanced-01': '#60a5fa',
  'conservative-01': '#34d399',
  'aggressive-01': '#f87171',
  'system': '#a1a1aa',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface ConsoleLogItemProps {
  entry: BotLogEntry;
  showBotName: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

const ConsoleLogItemInner: React.FC<ConsoleLogItemProps> = ({ entry, showBotName }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

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
    : entry.type === 'DECISION' && entry.message.includes('SHORT')
      ? '#f87171'
      : LOG_COLORS[entry.type];

  const timestamp = formatTimestamp(entry.timestamp);
  const hasExpandableData = entry.data && (entry.data.indicators || entry.data.signal || entry.data.orderId);
  const strategyColor = STRATEGY_COLORS[entry.strategyId] || '#888';
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
      <Animated.View style={[
        styles.inner,
        { backgroundColor: flashBg },
        isHighlight && styles.innerHighlight,
        bgColor !== 'transparent' && { backgroundColor: bgColor },
      ]}>
        {/* Left color bar */}
        <View style={[styles.leftBar, { backgroundColor: baseColor }]} />

        <TouchableOpacity
          style={styles.content}
          activeOpacity={hasExpandableData ? 0.7 : 1}
          onPress={hasExpandableData ? () => setExpanded(!expanded) : undefined}
          disabled={!hasExpandableData}
        >
          {/* Header line: timestamp + bot name + type badge */}
          <View style={styles.headerRow}>
            <Text style={styles.timestamp}>{timestamp}</Text>

            {showBotName && entry.strategyId !== 'system' && (
              <View style={[styles.botTag, { backgroundColor: strategyColor + '1A' }]}>
                <View style={[styles.botDot, { backgroundColor: strategyColor }]} />
                <Text style={[styles.botName, { color: strategyColor }]}>
                  {entry.strategyName}
                </Text>
              </View>
            )}

            <View style={[styles.typeBadge, { backgroundColor: hexToRgba(baseColor, 0.15) }]}>
              <Text style={[styles.typeIcon, { color: baseColor }]}>{icon}</Text>
              <Text style={[styles.typeText, { color: baseColor }]}>{entry.type}</Text>
            </View>

            {hasExpandableData && (
              <Text style={styles.expandHint}>{expanded ? '\u25B4' : '\u25BE'}</Text>
            )}
          </View>

          {/* Message line */}
          <Text
            style={[styles.message, { color: baseColor }]}
            numberOfLines={expanded ? undefined : 3}
          >
            {entry.message}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded detail panel */}
      {expanded && entry.data && (
        <View style={[styles.expandedData, { borderLeftColor: baseColor + '44' }]}>
          {entry.data.indicators && (
            <View style={styles.dataRow}>
              <DataPill label="RSI" value={entry.data.indicators.rsi.toFixed(1)} color="#22d3ee" />
              <DataPill label="MACD" value={entry.data.indicators.macd.histogram.toFixed(3)} color="#a78bfa" />
              <DataPill label="Vol" value={`${entry.data.indicators.volume.ratio.toFixed(2)}x`} color="#fbbf24" />
            </View>
          )}
          {entry.data.signal && (
            <View style={styles.dataRow}>
              <DataPill
                label="Direction"
                value={entry.data.signal.direction}
                color={entry.data.signal.direction === 'LONG' ? '#4ade80' : '#f87171'}
              />
              <DataPill
                label="Confidence"
                value={`${(entry.data.signal.confidence * 100).toFixed(1)}%`}
                color="#fde047"
              />
            </View>
          )}
          {entry.data.orderId && (
            <View style={styles.dataRow}>
              <DataPill label="ID" value={entry.data.orderId} color="#a78bfa" />
              {entry.data.fillPrice && (
                <DataPill label="Fill" value={`$${entry.data.fillPrice.toFixed(2)}`} color="#34d399" />
              )}
              {entry.data.slippage !== undefined && (
                <DataPill label="Slip" value={`${entry.data.slippage.toFixed(4)}%`} color="#fb923c" />
              )}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
};

// ── DataPill sub-component ─────────────────────────────────────────────────────

const DataPill: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={[dataPillStyles.pill, { backgroundColor: hexToRgba(color, 0.1) }]}>
    <Text style={dataPillStyles.label}>{label}</Text>
    <Text style={[dataPillStyles.value, { color }]}>{value}</Text>
  </View>
);

const dataPillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  label: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: fontScale(FONT_SIZES.small),
    color: '#9CA3AF',
  },
  value: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: fontScale(FONT_SIZES.caption),
    fontWeight: '700',
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Styles ─────────────────────────────────────────────────────────────────────

const MONO_FONT = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

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
  botTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 3,
  },
  botDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  botName: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.small),
    fontWeight: '700',
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
  expandHint: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.small),
    color: '#52525b',
    marginLeft: 'auto',
  },
  message: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.body),
    lineHeight: LINE_HEIGHTS.body,
  },
  expandedData: {
    marginTop: 2,
    marginLeft: 14,
    paddingLeft: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderLeftWidth: 2,
  },
  dataRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
});

// ── Memo ───────────────────────────────────────────────────────────────────────

export const ConsoleLogItem = React.memo(ConsoleLogItemInner, (prev, next) => {
  return prev.entry.id === next.entry.id && prev.showBotName === next.showBotName;
});
