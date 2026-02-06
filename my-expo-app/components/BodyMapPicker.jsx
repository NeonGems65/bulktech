import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const MUSCLE_AREAS = {
  Chest: 'Chest',
  Back: 'Back',
  Arms: 'Arms',
  Legs: 'Legs',
  Core: 'Core',
};

export default function BodyMapPicker({ selectedArea, onSelectArea }) {
  // Two-finger gestures (pinch/rotate) so single-finger taps work for selecting body parts.
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const startRotation = useSharedValue(0);
  const startScale = useSharedValue(1);

  const rotationGesture = useMemo(
    () =>
      Gesture.Rotation()
        .onBegin(() => {
          startRotation.value = rotation.value;
        })
        .onUpdate((e) => {
          rotation.value = startRotation.value + e.rotation;
        }),
    [rotation, startRotation]
  );

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          startScale.value = scale.value;
        })
        .onUpdate((e) => {
          // clamp scale a bit
          const next = Math.max(0.8, Math.min(1.8, startScale.value * e.scale));
          scale.value = next;
        }),
    [scale, startScale]
  );

  const composed = useMemo(() => Gesture.Simultaneous(rotationGesture, pinchGesture), [rotationGesture, pinchGesture]);

  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${rotation.value}rad` }, { scale: scale.value }],
  }));

  const handleSelect = (area) => {
    onSelectArea?.(area);
  };

  const resetView = () => {
    rotation.value = 0;
    scale.value = 1;
  };

  // Diagram-like body map (outline + fill highlight), inspired by generic muscle charts.
  // This is custom-drawn (no external image assets).
  const stroke = '#111111';
  const baseFill = '#FFFFFF';
  const highlightFill = '#D32F2F';

  const fillFor = (area) => (selectedArea === area ? highlightFill : baseFill);

  // Left = front, Right = back
  const BODY = {
    front: {
      offsetX: 10,
      label: 'Front',
      outline: [
        // head
        'M50 10 C38 10 30 18 30 30 C30 42 38 50 50 50 C62 50 70 42 70 30 C70 18 62 10 50 10 Z',
        // torso
        'M28 55 C33 52 40 50 50 50 C60 50 67 52 72 55 C80 60 83 72 82 88 C81 112 79 138 74 160 C70 176 64 188 50 190 C36 188 30 176 26 160 C21 138 19 112 18 88 C17 72 20 60 28 55 Z',
        // left arm
        'M18 78 C9 86 9 110 13 132 C15 145 18 155 24 165 C27 170 32 170 34 166 C37 160 35 148 33 138 C30 120 30 98 34 84 C36 76 25 72 18 78 Z',
        // right arm
        'M82 78 C91 86 91 110 87 132 C85 145 82 155 76 165 C73 170 68 170 66 166 C63 160 65 148 67 138 C70 120 70 98 66 84 C64 76 75 72 82 78 Z',
        // legs (combined outer)
        'M34 190 C30 210 30 232 32 252 C33 262 40 268 50 268 C60 268 67 262 68 252 C70 232 70 210 66 190 Z',
      ],
      regions: [
        // chest
        { area: MUSCLE_AREAS.Chest, d: 'M30 70 C36 62 44 60 50 60 C56 60 64 62 70 70 L68 95 C62 104 56 108 50 108 C44 108 38 104 32 95 Z' },
        // core/abs
        { area: MUSCLE_AREAS.Core, d: 'M34 100 L66 100 L70 145 C63 160 56 166 50 166 C44 166 37 160 30 145 Z' },
        // arms (shoulders + forearms simplified)
        { area: MUSCLE_AREAS.Arms, d: 'M18 84 C12 92 12 112 15 128 C17 140 20 150 24 158 C28 164 33 162 34 156 C35 148 31 136 29 126 C27 112 27 98 30 88 C31 84 24 80 18 84 Z' },
        { area: MUSCLE_AREAS.Arms, d: 'M82 84 C88 92 88 112 85 128 C83 140 80 150 76 158 C72 164 67 162 66 156 C65 148 69 136 71 126 C73 112 73 98 70 88 C69 84 76 80 82 84 Z' },
        // legs
        { area: MUSCLE_AREAS.Legs, d: 'M36 192 L48 192 L46 264 C40 262 37 258 36 252 C33 232 33 212 36 192 Z' },
        { area: MUSCLE_AREAS.Legs, d: 'M52 192 L64 192 C67 212 67 232 64 252 C63 258 60 262 54 264 Z' },
      ],
    },
    back: {
      offsetX: 110,
      label: 'Back',
      outline: [
        // head
        'M50 10 C38 10 30 18 30 30 C30 42 38 50 50 50 C62 50 70 42 70 30 C70 18 62 10 50 10 Z',
        // torso
        'M28 55 C33 52 40 50 50 50 C60 50 67 52 72 55 C80 60 83 72 82 88 C81 112 79 138 74 160 C70 176 64 188 50 190 C36 188 30 176 26 160 C21 138 19 112 18 88 C17 72 20 60 28 55 Z',
        // left arm
        'M18 78 C9 86 9 110 13 132 C15 145 18 155 24 165 C27 170 32 170 34 166 C37 160 35 148 33 138 C30 120 30 98 34 84 C36 76 25 72 18 78 Z',
        // right arm
        'M82 78 C91 86 91 110 87 132 C85 145 82 155 76 165 C73 170 68 170 66 166 C63 160 65 148 67 138 C70 120 70 98 66 84 C64 76 75 72 82 78 Z',
        // legs
        'M34 190 C30 210 30 232 32 252 C33 262 40 268 50 268 C60 268 67 262 68 252 C70 232 70 210 66 190 Z',
      ],
      regions: [
        // upper back + lats
        { area: MUSCLE_AREAS.Back, d: 'M30 68 C36 60 44 58 50 58 C56 58 64 60 70 68 L73 140 C66 154 58 160 50 160 C42 160 34 154 27 140 Z' },
        // lower back / core
        { area: MUSCLE_AREAS.Core, d: 'M32 142 L68 142 L66 170 C60 178 56 182 50 182 C44 182 40 178 34 170 Z' },
        // arms
        { area: MUSCLE_AREAS.Arms, d: 'M18 84 C12 92 12 112 15 128 C17 140 20 150 24 158 C28 164 33 162 34 156 C35 148 31 136 29 126 C27 112 27 98 30 88 C31 84 24 80 18 84 Z' },
        { area: MUSCLE_AREAS.Arms, d: 'M82 84 C88 92 88 112 85 128 C83 140 80 150 76 158 C72 164 67 162 66 156 C65 148 69 136 71 126 C73 112 73 98 70 88 C69 84 76 80 82 84 Z' },
        // legs
        { area: MUSCLE_AREAS.Legs, d: 'M36 192 L48 192 L46 264 C40 262 37 258 36 252 C33 232 33 212 36 192 Z' },
        { area: MUSCLE_AREAS.Legs, d: 'M52 192 L64 192 C67 212 67 232 64 252 C63 258 60 262 54 264 Z' },
      ],
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Tap a muscle area</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.smallButton} onPress={resetView}>
            <Text style={styles.smallButtonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.helper}>Use two fingers to rotate/zoom. Tap regions on the front/back.</Text>

      <View style={styles.mapOuter}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.mapInner, mapStyle]}>
            <Svg width={320} height={300} viewBox="0 0 220 280">
              {/* Front */}
              <G transform={`translate(${BODY.front.offsetX} 0)`}>
                {BODY.front.outline.map((d, idx) => (
                  <Path key={`fo-${idx}`} d={d} fill={baseFill} stroke={stroke} strokeWidth={2} />
                ))}
                {BODY.front.regions.map((r, idx) => (
                  <Path
                    key={`fr-${r.area}-${idx}`}
                    d={r.d}
                    fill={fillFor(r.area)}
                    stroke={stroke}
                    strokeWidth={2}
                    onPress={() => handleSelect(r.area)}
                  />
                ))}
              </G>

              {/* Back */}
              <G transform={`translate(${BODY.back.offsetX} 0)`}>
                {BODY.back.outline.map((d, idx) => (
                  <Path key={`bo-${idx}`} d={d} fill={baseFill} stroke={stroke} strokeWidth={2} />
                ))}
                {BODY.back.regions.map((r, idx) => (
                  <Path
                    key={`br-${r.area}-${idx}`}
                    d={r.d}
                    fill={fillFor(r.area)}
                    stroke={stroke}
                    strokeWidth={2}
                    onPress={() => handleSelect(r.area)}
                  />
                ))}
              </G>
            </Svg>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.legend}>
        {Object.values(MUSCLE_AREAS).map((area) => (
          <TouchableOpacity
            key={area}
            style={[styles.legendChip, selectedArea === area && styles.legendChipSelected]}
            onPress={() => handleSelect(area)}
          >
            <Text style={[styles.legendText, selectedArea === area && styles.legendTextSelected]}>{area}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    backgroundColor: '#555',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  smallButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  helper: {
    color: '#666',
    marginTop: 6,
    marginBottom: 10,
    fontSize: 12,
  },
  mapOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F4',
    borderRadius: 16,
    paddingVertical: 10,
  },
  mapInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendChip: {
    backgroundColor: '#EEE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  legendChipSelected: {
    backgroundColor: '#D32F2F',
  },
  legendText: {
    color: '#333',
    fontWeight: '700',
    fontSize: 12,
  },
  legendTextSelected: {
    color: '#FFF',
  },
});
