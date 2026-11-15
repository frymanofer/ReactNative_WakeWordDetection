import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ChatTemplate, LocalLLMModelConfig, ModelId } from './types';
import {
  CHAT_TEMPLATE_PRESETS,
  ChatTemplatePresetId,
  findMatchingPreset,
} from './chatTemplates';
import { LOCAL_LLM_DEFAULT_CUSTOM_CONTEXT_SIZE } from './constants';
import {
  addCustomModel,
  getSelectedModel,
  listModels,
  removeCustomModel,
  setSelectedModel,
} from './ModelRegistry';
import { deleteModel, downloadModel, isModelDownloaded } from './ModelManager';

// Lets the user choose which on-device model Local AI Chat uses, download or
// delete model files, and add their own GGUF with the matching chat template.
// The selection is persisted by ModelRegistry and picked up on the next turn.

interface Props {
  visible: boolean;
  /** Disables switching while a reply is being generated. */
  isBusy?: boolean;
  onClose: () => void;
  /** Called with the newly selected model. */
  onModelSelected?: (model: LocalLLMModelConfig) => void;
}

// Template fields are edited with newlines shown as a literal "\n", since a
// newline is often the significant last character of a prefix.
const escapeField = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
const unescapeField = (s: string) =>
  s.replace(/\\(\\|n)/g, (_m, c: string) => (c === 'n' ? '\n' : '\\'));

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
}

function templateLabel(template: ChatTemplate): string {
  const preset = findMatchingPreset(template);
  return preset ? CHAT_TEMPLATE_PRESETS[preset].label : 'Custom template';
}

type TemplateChoice = ChatTemplatePresetId | 'custom';

interface CustomFields {
  systemPrefix: string;
  userPrefix: string;
  assistantPrefix: string;
  turnSuffix: string;
  stopSequence: string;
  mergeSystem: boolean;
}

function fieldsFromTemplate(t: ChatTemplate): CustomFields {
  return {
    systemPrefix: escapeField(t.systemPrefix),
    userPrefix: escapeField(t.userPrefix),
    assistantPrefix: escapeField(t.assistantPrefix),
    turnSuffix: escapeField(t.turnSuffix),
    stopSequence: escapeField(t.stopSequences[0] ?? ''),
    mergeSystem: t.systemMode === 'merge-into-first-user',
  };
}

function templateFromFields(f: CustomFields): ChatTemplate {
  const stop = unescapeField(f.stopSequence);
  return {
    systemPrefix: unescapeField(f.systemPrefix),
    userPrefix: unescapeField(f.userPrefix),
    assistantPrefix: unescapeField(f.assistantPrefix),
    turnSuffix: unescapeField(f.turnSuffix),
    systemMode: f.mergeSystem ? 'merge-into-first-user' : 'role',
    stopSequences: stop ? [stop] : [],
  };
}

export default function ModelPicker({ visible, isBusy = false, onClose, onModelSelected }: Props) {
  const [models, setModels] = useState<LocalLLMModelConfig[]>([]);
  const [selectedId, setSelectedId] = useState<ModelId | null>(null);
  const [downloaded, setDownloaded] = useState<Record<ModelId, boolean>>({});
  const [progress, setProgress] = useState<Record<ModelId, number>>({});

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [contextSize, setContextSize] = useState(String(LOCAL_LLM_DEFAULT_CUSTOM_CONTEXT_SIZE));
  const [templateChoice, setTemplateChoice] = useState<TemplateChoice>('chatml');
  const [customFields, setCustomFields] = useState<CustomFields>(
    fieldsFromTemplate(CHAT_TEMPLATE_PRESETS.chatml.template),
  );
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    const [all, selected] = await Promise.all([listModels(), getSelectedModel()]);
    const flags = await Promise.all(all.map((m) => isModelDownloaded(m)));
    setModels(all);
    setSelectedId(selected.id);
    setDownloaded(Object.fromEntries(all.map((m, i) => [m.id, flags[i]])));
  }, []);

  useEffect(() => {
    if (visible) refresh().catch((e) => console.log('[LocalLLM] picker refresh failed:', e));
  }, [visible, refresh]);

  const select = async (model: LocalLLMModelConfig) => {
    if (isBusy || model.id === selectedId) return;
    await setSelectedModel(model.id);
    setSelectedId(model.id);
    onModelSelected?.(model);
  };

  const download = async (model: LocalLLMModelConfig) => {
    setProgress((p) => ({ ...p, [model.id]: 0 }));
    try {
      await downloadModel(model, (fraction) => setProgress((p) => ({ ...p, [model.id]: fraction })));
      setDownloaded((d) => ({ ...d, [model.id]: true }));
    } catch (error: any) {
      Alert.alert('Download failed', String(error?.message ?? error));
    } finally {
      setProgress((p) => {
        const { [model.id]: _done, ...rest } = p;
        return rest;
      });
    }
  };

  const confirmDeleteFile = (model: LocalLLMModelConfig) => {
    Alert.alert('Delete model file?', `${model.displayName} will be downloaded again when used.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteModel(model);
          setDownloaded((d) => ({ ...d, [model.id]: false }));
        },
      },
    ]);
  };

  const confirmRemove = (model: LocalLLMModelConfig) => {
    Alert.alert('Remove model?', `Removes ${model.displayName} from the list and deletes its file.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteModel(model);
          await removeCustomModel(model.id);
          await refresh();
        },
      },
    ]);
  };

  const chooseTemplate = (choice: TemplateChoice) => {
    setTemplateChoice(choice);
    // Starting "Custom" from the last preset makes small edits easy.
    if (choice !== 'custom') setCustomFields(fieldsFromTemplate(CHAT_TEMPLATE_PRESETS[choice].template));
  };

  const resetForm = () => {
    setName('');
    setUrl('');
    setContextSize(String(LOCAL_LLM_DEFAULT_CUSTOM_CONTEXT_SIZE));
    chooseTemplate('chatml');
    setFormError('');
    setIsAdding(false);
  };

  const saveCustomModel = async () => {
    setFormError('');
    try {
      const chatTemplate =
        templateChoice === 'custom'
          ? templateFromFields(customFields)
          : CHAT_TEMPLATE_PRESETS[templateChoice].template;
      if (!chatTemplate.userPrefix || !chatTemplate.assistantPrefix) {
        throw new Error('User and assistant prefixes are required');
      }
      const model = await addCustomModel({
        displayName: name,
        url,
        contextSize: Number(contextSize),
        chatTemplate,
      });
      resetForm();
      await refresh();
      await select(model);
    } catch (error: any) {
      setFormError(String(error?.message ?? error));
    }
  };

  const renderModel = (model: LocalLLMModelConfig) => {
    const isSelected = model.id === selectedId;
    const pct = progress[model.id];
    const isDownloading = pct !== undefined;
    return (
      <TouchableOpacity
        key={model.id}
        activeOpacity={0.7}
        disabled={isBusy}
        style={[styles.modelRow, isSelected && styles.modelRowSelected]}
        onPress={() => select(model)}>
        <View style={styles.modelInfo}>
          <Text style={styles.modelName}>
            {isSelected ? '✓ ' : ''}
            {model.displayName}
          </Text>
          <Text style={styles.modelMeta}>
            {[templateLabel(model.chatTemplate), formatSize(model.sizeBytes), `${model.contextSize} ctx`]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={styles.modelMeta}>
            {isDownloading
              ? `Downloading ${Math.round(pct * 100)}%`
              : downloaded[model.id]
                ? 'Downloaded'
                : 'Not downloaded (downloads on first use)'}
          </Text>
        </View>
        <View style={styles.modelActions}>
          {isDownloading ? (
            <ActivityIndicator color="#ffffff" />
          ) : downloaded[model.id] ? (
            <TouchableOpacity style={styles.smallButton} onPress={() => confirmDeleteFile(model)}>
              <Text style={styles.smallButtonText}>Delete file</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.smallButton} onPress={() => download(model)}>
              <Text style={styles.smallButtonText}>Download</Text>
            </TouchableOpacity>
          )}
          {model.isCustom && !isDownloading && (
            <TouchableOpacity style={[styles.smallButton, styles.dangerButton]} onPress={() => confirmRemove(model)}>
              <Text style={styles.smallButtonText}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderField = (label: string, key: keyof Omit<CustomFields, 'mergeSystem'>) => (
    <View style={styles.fieldRow}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, styles.monoInput]}
        value={customFields[key]}
        onChangeText={(v) => setCustomFields((f) => ({ ...f, [key]: v }))}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>On-device model</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
          {isBusy && <Text style={styles.busyText}>Wait for the current reply to finish to switch models.</Text>}
          <ScrollView keyboardShouldPersistTaps="handled">
            {models.map(renderModel)}

            {!isAdding ? (
              <TouchableOpacity style={styles.addButton} onPress={() => setIsAdding(true)}>
                <Text style={styles.addButtonText}>+ Add custom model</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Custom model</Text>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Llama 3.2 3B" placeholderTextColor="rgba(255,255,255,0.4)" />
                <Text style={styles.label}>GGUF download URL (https)</Text>
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://huggingface.co/.../model-Q4_K_M.gguf"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
                <Text style={styles.label}>Context size (tokens)</Text>
                <TextInput style={styles.input} value={contextSize} onChangeText={setContextSize} keyboardType="number-pad" />

                <Text style={styles.label}>Chat template</Text>
                <View style={styles.chipRow}>
                  {(Object.values(CHAT_TEMPLATE_PRESETS) as Array<(typeof CHAT_TEMPLATE_PRESETS)[ChatTemplatePresetId]>).map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.chip, templateChoice === p.id && styles.chipSelected]}
                      onPress={() => chooseTemplate(p.id)}>
                      <Text style={styles.chipText}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.chip, templateChoice === 'custom' && styles.chipSelected]}
                    onPress={() => chooseTemplate('custom')}>
                    <Text style={styles.chipText}>Custom</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>
                  {templateChoice === 'custom'
                    ? 'Type a newline as \\n. Leave out the BOS token; it is added automatically.'
                    : `Used by ${CHAT_TEMPLATE_PRESETS[templateChoice].usedBy}. Check the model's page if unsure.`}
                </Text>

                {templateChoice === 'custom' && (
                  <View>
                    {renderField('User prefix', 'userPrefix')}
                    {renderField('Assistant prefix', 'assistantPrefix')}
                    {renderField('Turn suffix', 'turnSuffix')}
                    {renderField('System prefix', 'systemPrefix')}
                    {renderField('Stop sequence', 'stopSequence')}
                    <TouchableOpacity
                      style={[styles.chip, customFields.mergeSystem && styles.chipSelected, styles.toggleChip]}
                      onPress={() => setCustomFields((f) => ({ ...f, mergeSystem: !f.mergeSystem }))}>
                      <Text style={styles.chipText}>
                        {customFields.mergeSystem ? '✓ ' : ''}No system role (put system text in first user turn)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!!formError && <Text style={styles.errorText}>{formError}</Text>}
                <View style={styles.formActions}>
                  <TouchableOpacity style={[styles.smallButton, styles.formButton]} onPress={resetForm}>
                    <Text style={styles.smallButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallButton, styles.formButton, styles.saveButton]} onPress={saveCustomModel}>
                    <Text style={styles.smallButtonText}>Add and select</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: 'rgba(7, 12, 26, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#ffffff' },
  closeButton: { paddingHorizontal: 12, paddingVertical: 6 },
  closeText: { color: '#34C759', fontSize: 17, fontWeight: '600' },
  busyText: { color: '#FFCC00', fontSize: 13, marginBottom: 8 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modelRowSelected: { borderColor: '#34C759', backgroundColor: 'rgba(52, 199, 89, 0.18)' },
  modelInfo: { flex: 1, paddingRight: 8 },
  modelName: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  modelMeta: { color: 'rgba(255, 255, 255, 0.65)', fontSize: 12, marginTop: 2 },
  modelActions: { alignItems: 'flex-end', gap: 6 },
  smallButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dangerButton: { backgroundColor: 'rgba(255, 59, 48, 0.6)' },
  smallButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  addButton: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  form: { marginTop: 4, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.06)' },
  formTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  label: { color: 'rgba(255, 255, 255, 0.65)', fontSize: 12, marginTop: 8, marginBottom: 4 },
  input: {
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  monoInput: { fontFamily: 'Menlo', fontSize: 13 },
  fieldRow: { marginBottom: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  chipSelected: { backgroundColor: '#34C759', borderColor: 'rgba(255, 255, 255, 0.4)' },
  chipText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  toggleChip: { marginTop: 10, alignSelf: 'flex-start' },
  hint: { color: 'rgba(255, 255, 255, 0.55)', fontSize: 12, marginTop: 6 },
  errorText: { color: '#FF6B6B', fontSize: 13, marginTop: 10 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  formButton: { paddingHorizontal: 14, paddingVertical: 9 },
  saveButton: { backgroundColor: '#34C759' },
});
