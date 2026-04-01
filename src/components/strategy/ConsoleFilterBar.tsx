import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, FONT_WEIGHTS, SPACING, RADIUS } from '../../theme';
import { fontScale, moderateScale } from '../../utils/responsive';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConsoleFilterBarProps {
  selectedChains: string[];
  selectedPairs: string[];
  onChainsChange: (chains: string[]) => void;
  onPairsChange: (pairs: string[]) => void;
  activeBotCount: number;
  totalTrades: number;
  totalPnl: number;
}

// ── Data ───────────────────────────────────────────────────────────────────────

const CHAINS = [
  { id: 'ethereum', name: 'ETH', icon: 'Ξ', color: '#627EEA' },
  { id: 'arbitrum', name: 'ARB', icon: '◆', color: '#28A0F0' },
  { id: 'bsc', name: 'BSC', icon: '◇', color: '#F3BA2F' },
  { id: 'base', name: 'BASE', icon: '●', color: '#0052FF' },
  { id: 'polygon', name: 'MATIC', icon: '⬡', color: '#8247E5' },
  { id: 'optimism', name: 'OP', icon: '◉', color: '#FF0420' },
  { id: 'avalanche', name: 'AVAX', icon: '▲', color: '#E84142' },
];

const PAIRS = [
  { id: 'BTC', name: 'BTC/USDT', color: '#F7931A' },
  { id: 'ETH', name: 'ETH/USDT', color: '#627EEA' },
  { id: 'SOL', name: 'SOL/USDT', color: '#00FFA3' },
  { id: 'BNB', name: 'BNB/USDT', color: '#F3BA2F' },
  { id: 'AVAX', name: 'AVAX/USDT', color: '#E84142' },
  { id: 'ARB', name: 'ARB/USDT', color: '#28A0F0' },
  { id: 'DOGE', name: 'DOGE/USDT', color: '#C2A633' },
  { id: 'LINK', name: 'LINK/USDT', color: '#2A5ADA' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export const ConsoleFilterBar: React.FC<ConsoleFilterBarProps> = ({
  selectedChains,
  selectedPairs,
  onChainsChange,
  onPairsChange,
  activeBotCount,
  totalTrades,
  totalPnl,
}) => {
  const [showChainModal, setShowChainModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);

  const toggleChain = (chainId: string) => {
    if (selectedChains.includes(chainId)) {
      onChainsChange(selectedChains.filter((c) => c !== chainId));
    } else {
      onChainsChange([...selectedChains, chainId]);
    }
  };

  const togglePair = (pairId: string) => {
    if (selectedPairs.includes(pairId)) {
      onPairsChange(selectedPairs.filter((p) => p !== pairId));
    } else {
      onPairsChange([...selectedPairs, pairId]);
    }
  };

  const chainLabel = selectedChains.length === 0
    ? 'All Chains'
    : selectedChains.length === 1
      ? CHAINS.find(c => c.id === selectedChains[0])?.name || selectedChains[0]
      : `${selectedChains.length} chains`;

  const pairLabel = selectedPairs.length === 0
    ? 'All Pairs'
    : selectedPairs.length === 1
      ? selectedPairs[0]
      : `${selectedPairs.length} pairs`;

  return (
    <View style={styles.container}>
      {/* Live Stats Bar */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={[styles.statusDot, styles.dotActive]} />
          <Text style={styles.statLabel}>LIVE</Text>
          <Text style={styles.statValueCyan}>{activeBotCount}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Ionicons name="swap-horizontal" size={12} color="#8B5CF6" />
          <Text style={styles.statLabel}>TRADES</Text>
          <Text style={styles.statValuePurple}>{totalTrades}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Ionicons name="trending-up" size={12} color={totalPnl >= 0 ? '#10B981' : '#EF4444'} />
          <Text style={styles.statLabel}>P&L</Text>
          <Text style={[styles.statValueGreen, totalPnl < 0 && styles.statValueRed]}>
            {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Filter Controls */}
      <View style={styles.filterRow}>
        {/* Chain Filter */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowChainModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.filterIcon}>
            <Text style={styles.chainIcon}>⬡</Text>
          </View>
          <Text style={styles.filterText}>{chainLabel}</Text>
          <Ionicons name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>

        {/* Pair Filter */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowPairModal(true)}
          activeOpacity={0.7}
        >
          <View style={styles.filterIcon}>
            <Ionicons name="analytics" size={14} color="#00d4ff" />
          </View>
          <Text style={styles.filterText}>{pairLabel}</Text>
          <Ionicons name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>

        {/* Clear Filters */}
        {(selectedChains.length > 0 || selectedPairs.length > 0) && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              onChainsChange([]);
              onPairsChange([]);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={16} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>

      {/* Chain Selection Modal */}
      <Modal
        visible={showChainModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowChainModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowChainModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Chains</Text>
              <TouchableOpacity onPress={() => setShowChainModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {CHAINS.map((chain) => {
                const isSelected = selectedChains.includes(chain.id);
                return (
                  <TouchableOpacity
                    key={chain.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => toggleChain(chain.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.chainIconBox, { backgroundColor: chain.color + '20' }]}>
                      <Text style={[styles.chainIconText, { color: chain.color }]}>
                        {chain.icon}
                      </Text>
                    </View>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {chain.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setShowChainModal(false)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pair Selection Modal */}
      <Modal
        visible={showPairModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPairModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPairModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Trading Pairs</Text>
              <TouchableOpacity onPress={() => setShowPairModal(false)}>
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList}>
              {PAIRS.map((pair) => {
                const isSelected = selectedPairs.includes(pair.id);
                return (
                  <TouchableOpacity
                    key={pair.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => togglePair(pair.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.pairDot, { backgroundColor: pair.color }]} />
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {pair.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDoneButton}
              onPress={() => setShowPairModal(false)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────

const MONO_FONT = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2535',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    backgroundColor: '#0d1420',
    borderBottomWidth: 1,
    borderBottomColor: '#1a2535',
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#1a2535',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statLabel: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(9),
    color: '#666',
    letterSpacing: 0.5,
  },
  statValueCyan: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.caption),
    fontWeight: FONT_WEIGHTS.bold,
    color: '#00d4ff',
  },
  statValuePurple: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.caption),
    fontWeight: FONT_WEIGHTS.bold,
    color: '#8B5CF6',
  },
  statValueGreen: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.caption),
    fontWeight: FONT_WEIGHTS.bold,
    color: '#10B981',
  },
  statValueRed: {
    color: '#EF4444',
  },

  // Filter Row
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 6,
  },
  filterIcon: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#0d1420',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chainIcon: {
    fontSize: 12,
    color: '#00d4ff',
  },
  filterText: {
    flex: 1,
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.caption),
    color: '#9CA3AF',
  },
  clearButton: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: '#111827',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1f2937',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  modalTitle: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.h4),
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
  modalList: {
    paddingVertical: SPACING.sm,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  modalItemSelected: {
    backgroundColor: '#1f293710',
  },
  chainIconBox: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chainIconText: {
    fontSize: 16,
    fontWeight: FONT_WEIGHTS.bold,
  },
  pairDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.xs,
  },
  modalItemText: {
    flex: 1,
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.body),
    color: '#9CA3AF',
  },
  modalItemTextSelected: {
    color: '#fff',
  },
  modalDoneButton: {
    backgroundColor: '#188775',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  modalDoneText: {
    fontFamily: MONO_FONT,
    fontSize: fontScale(FONT_SIZES.body),
    fontWeight: FONT_WEIGHTS.bold,
    color: '#fff',
  },
});
