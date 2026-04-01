import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ForexLogEntry } from '../../types/forex';

const MONO_FONT = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const STATUS_COLORS: Record<string, string> = {
  RFQ: '#60a5fa',
  QUOTE: '#22d3ee',
  MATCH: '#4ade80',
  SETTLE: '#34d399',
  PVP: '#a78bfa',
};

const STATUS_LABELS: Record<string, string> = {
  RFQ: 'REQUEST',
  QUOTE: 'QUOTE',
  MATCH: 'MATCHED',
  SETTLE: 'SETTLED',
  PVP: 'PVP',
};

interface ForexTradeMatchingViewProps {
  logs: ForexLogEntry[];
  maxItems?: number;
}

// ── Trade Row Component ────────────────────────────────────────────────────────

const TradeRow: React.FC<{ log: ForexLogEntry; index: number }> = React.memo(({ log, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, []);

  const time = new Date(log.timestamp);
  const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;
  const pairId = log.pairId || '--';
  const pairShort = pairId.replace('USDC_', '');
  const color = STATUS_COLORS[log.type] || '#a1a1aa';
  const statusLabel = STATUS_LABELS[log.type] || log.type;

  // Extract trade details
  const side = log.data?.side as string | undefined;
  const lots = log.data?.lots as number | undefined;
  const pips = log.data?.pips as number | undefined;
  const pnl = log.data?.pnl as number | undefined;
  const price = log.data?.price || log.data?.quotePrice || log.data?.matchPrice || log.data?.settlePrice;

  const isProfit = pnl !== undefined ? pnl >= 0 : pips !== undefined ? pips >= 0 : undefined;
  const isSettlement = log.type === 'SETTLE' || log.type === 'PVP';

  return (
    <Animated.View
      style={[
        styles.tradeRow,
        index % 2 === 0 && styles.tradeRowAlt,
        isSettlement && styles.tradeRowHighlight,
        { opacity: fadeAnim },
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <View style={styles.tradeContent}>
        {/* Row 1: Time + Pair + Status */}
        <View style={styles.tradeHeader}>
          <Text style={styles.tradeTime}>{timeStr}</Text>
          <Text style={styles.tradePair}>{pairShort}</Text>

          {/* Side badge */}
          {side && (
            <View
              style={[
                styles.sideBadge,
                {
                  backgroundColor: side === 'BUY' ? '#10B98118' : '#EF444418',
                  borderColor: side === 'BUY' ? '#10B98140' : '#EF444440',
                },
              ]}
            >
              <Text
                style={[
                  styles.sideText,
                  { color: side === 'BUY' ? '#10B981' : '#EF4444' },
                ]}
              >
                {side}
              </Text>
            </View>
          )}

          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
            <Text style={[styles.statusText, { color }]}>{statusLabel}</Text>
          </View>

          {/* P&L at end */}
          {pnl !== undefined && (
            <Text
              style={[
                styles.tradePnl,
                { color: isProfit ? '#10B981' : '#EF4444' },
              ]}
            >
              {isProfit ? '+' : ''}{pnl.toFixed(2)}
            </Text>
          )}
        </View>

        {/* Row 2: Trade details */}
        <View style={styles.tradeDetails}>
          {lots !== undefined && (
            <Text style={styles.tradeDetail}>
              <Text style={styles.detailLabel}>Lots </Text>
              <Text style={styles.detailValue}>{lots.toFixed(2)}</Text>
            </Text>
          )}
          {price !== undefined && (
            <Text style={styles.tradeDetail}>
              <Text style={styles.detailLabel}>@ </Text>
              <Text style={styles.detailValue}>{typeof price === 'number' ? price.toFixed(4) : price}</Text>
            </Text>
          )}
          {pips !== undefined && (
            <Text style={[styles.tradeDetail, { color: pips >= 0 ? '#10B981' : '#EF4444' }]}>
              <Text style={styles.detailLabel}>Pips </Text>
              {pips >= 0 ? '+' : ''}{pips.toFixed(1)}
            </Text>
          )}
          {!lots && !price && !pips && (
            <Text style={styles.tradeMessage} numberOfLines={1}>{log.message}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
}, (prev, next) => prev.log.id === next.log.id);

// ── Main Component ─────────────────────────────────────────────────────────────

export const ForexTradeMatchingView: React.FC<ForexTradeMatchingViewProps> = ({
  logs,
  maxItems = 50,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);

  const tradeLogs = logs
    .filter((l) => ['RFQ', 'QUOTE', 'MATCH', 'SETTLE', 'PVP'].includes(l.type))
    .slice(-maxItems);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (tradeLogs.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [tradeLogs.length]);

  // Stats summary
  const matchCount = tradeLogs.filter(l => l.type === 'MATCH').length;
  const settleCount = tradeLogs.filter(l => l.type === 'SETTLE').length;
  const pvpCount = tradeLogs.filter(l => l.type === 'PVP').length;

  if (tradeLogs.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.empty}>
          <Ionicons name="swap-horizontal-outline" size={32} color="#333" />
          <Text style={styles.emptyTitle}>{t('forex.waiting_for_trades')}</Text>
          <Text style={styles.emptySubtext}>RFQ matching engine initializing...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: '#4ade80' }]} />
          <Text style={styles.summaryLabel}>Matched</Text>
          <Text style={styles.summaryValue}>{matchCount}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: '#34d399' }]} />
          <Text style={styles.summaryLabel}>Settled</Text>
          <Text style={styles.summaryValue}>{settleCount}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View style={[styles.summaryDot, { backgroundColor: '#a78bfa' }]} />
          <Text style={styles.summaryLabel}>PvP</Text>
          <Text style={styles.summaryValue}>{pvpCount}</Text>
        </View>
      </View>

      {/* Column Header */}
      <View style={styles.columnHeader}>
        <Text style={[styles.colLabel, { width: 58 }]}>TIME</Text>
        <Text style={[styles.colLabel, { width: 48 }]}>PAIR</Text>
        <Text style={[styles.colLabel, { flex: 1 }]}>STATUS</Text>
        <Text style={[styles.colLabel, { width: 60, textAlign: 'right' }]}>P&L</Text>
      </View>

      {/* Trade List */}
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {tradeLogs.map((log, index) => (
          <TradeRow key={log.id} log={log} index={index} />
        ))}
      </ScrollView>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },

  // Summary Bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  summaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  summaryValue: {
    fontFamily: MONO_FONT,
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '700',
  },
  summaryDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#1a1a1a',
  },

  // Column Header
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  colLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4a4a4a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Trade List
  list: {
    flex: 1,
  },
  tradeRow: {
    flexDirection: 'row',
    minHeight: 52,
  },
  tradeRowAlt: {
    backgroundColor: '#0d0d0d',
  },
  tradeRowHighlight: {
    backgroundColor: '#10B98108',
  },
  accentBar: {
    width: 3,
  },
  tradeContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
  },

  // Trade Header
  tradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tradeTime: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: '#666666',
  },
  tradePair: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  sideBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  sideText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tradePnl: {
    fontFamily: MONO_FONT,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },

  // Trade Details
  tradeDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  tradeDetail: {
    fontFamily: MONO_FONT,
    fontSize: 11,
    color: '#9ca3af',
  },
  detailLabel: {
    color: '#4a4a4a',
  },
  detailValue: {
    color: '#9ca3af',
  },
  tradeMessage: {
    fontSize: 11,
    color: '#666666',
  },

  // Empty State
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#4a4a4a',
  },
});
