import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GUIDED_PLANS, type GuidedPlan } from '../../domain/guided-plans';
import { colors, type Palette, scrim } from '../../theme/tokens';
import { useReducedMotion } from '../../theme/useReducedMotion';
import { type } from '../../theme/type';


interface Props {
  visible: boolean; palette: Palette; busy: boolean;
  onClose: () => void; onCreate: (templateId: string, title: string) => void;
}
export function GuidedPlansSheet({ visible, palette, busy, onClose, onCreate }: Props) {
  const reducedMotion = useReducedMotion();
  const [chosen, setChosen] = useState<GuidedPlan | null>(null);
  const [title, setTitle] = useState('');
  useEffect(() => { if (!visible) { setChosen(null); setTitle(''); } }, [visible]);
  const close = () => { if (!busy) onClose(); };
  return <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent
    animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={close}>
    <SafeAreaProvider>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close guided plans" />
        <View style={[styles.sheet, { backgroundColor: palette.background }]}>
          <SafeAreaView edges={['bottom']}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text style={[styles.kicker, { color: palette.accent }]}>BUILD YOUR DIRECTION</Text>
              <Text style={[styles.heading, { color: palette.foreground }]}>Guided plans</Text>
              <Text style={[styles.caption, { color: palette.muted }]}>
                Start with a real goal and a few editable next steps. Steps arrive in Inbox, without invented dates or notifications.
              </Text>
              {!chosen ? GUIDED_PLANS.map((item) => <Pressable key={item.id} accessibilityRole="button"
                accessibilityLabel={`Start ${item.title} guided plan`}
                onPress={() => { setChosen(item); setTitle(item.title); }}
                style={[styles.card, { borderColor: palette.border, backgroundColor: palette.surface }]}>
                <View style={styles.row}>
                  <Text style={[styles.cardTitle, { color: palette.foreground, flex: 1 }]}>{item.title}</Text>
                  <Text style={{ color: palette.accent, fontSize: 12 }}>{item.horizon} →</Text>
                </View>
                <Text style={[styles.caption, { color: palette.muted }]}>{item.description}</Text>
                <Text style={[styles.caption, { color: palette.accent }]}>{item.steps.length} editable next steps</Text>
              </Pressable>) : <>
                <Pressable accessibilityRole="button" onPress={() => setChosen(null)} style={styles.back}>
                  <Text style={{ color: palette.accent, fontWeight: '700' }}>← All guided plans</Text>
                </Pressable>
                <Text style={[styles.cardTitle, { color: palette.foreground }]}>Name your {chosen.horizon} goal</Text>
                <TextInput value={title} onChangeText={setTitle} maxLength={180}
                  placeholder="What matters to you?" placeholderTextColor={palette.muted}
                  accessibilityLabel="New guided goal title"
                  style={[styles.input, { backgroundColor: palette.surface, borderColor: palette.border, color: palette.foreground }]} />
                <Text style={[styles.caption, { color: palette.muted }]}>Included steps (all can be renamed or moved later):</Text>
                {chosen.steps.map((step) => <View key={step.title} style={styles.step}>
                  <Text style={[styles.cardTitle, { color: palette.foreground, fontSize: 13 }]}>○ {step.title}</Text>
                  <Text style={[styles.caption, { color: palette.muted }]}>{step.hint}</Text>
                </View>)}
                <Pressable accessibilityRole="button" disabled={!title.trim() || busy}
                  accessibilityState={{ disabled: !title.trim() || busy }}
                  onPress={() => onCreate(chosen.id, title)}
                  style={[styles.primary, { backgroundColor: palette.accent, opacity: !title.trim() || busy ? 0.45 : 1 }]}>
                  <Text style={{ color: palette.onAccent, fontWeight: '700' }}>{busy ? 'Creating…' : 'Create editable plan'}</Text>
                </Pressable>
              </>}
              <Pressable accessibilityRole="button" disabled={busy} onPress={close}
                style={styles.close}><Text style={{ color: palette.muted, fontWeight: '600' }}>Close</Text></Pressable>
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaProvider>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim },
  sheet: { maxHeight: '94%', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  content: { padding: 20, gap: 12, paddingBottom: 22 },
  kicker: { fontSize: 10, letterSpacing: 1.2, fontWeight: '800' },
  heading: { ...type.title },
  caption: { fontSize: 12, lineHeight: 19 },
  card: { borderRadius: 15, padding: 14, borderWidth: 1, gap: 6, minHeight: 93 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  back: { minHeight: 48, justifyContent: 'center' },
  step: { paddingVertical: 8, gap: 3 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  primary: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  close: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
