import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import api from '../services/api';
import { FileItem } from '../types';

interface Props {
  file: FileItem | null;
  visible: boolean;
  onClose: () => void;
}

function buildEditorHtml(onlyofficeUrl: string, config: object, token: string): string {
  const scriptSrc = `${onlyofficeUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`;
  const fullConfig = JSON.stringify({ ...config, token });
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #1a1a2e; }
    #editor { width: 100%; height: 100%; }
    #loading {
      position: fixed; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; background: #1a1a2e; color: white;
      font-family: sans-serif; gap: 16px; z-index: 99;
    }
    #loading p { font-size: 14px; opacity: 0.7; }
  </style>
</head>
<body>
  <div id="loading"><p>Chargement de l'éditeur…</p></div>
  <div id="editor"></div>
  <script src="${scriptSrc}"></script>
  <script>
    window.addEventListener('load', function() {
      try {
        var config = ${fullConfig};
        config.events = {
          onDocumentReady: function() {
            var el = document.getElementById('loading');
            if (el) el.style.display = 'none';
          },
          onError: function(e) {
            document.getElementById('loading').innerHTML =
              '<p>Erreur lors du chargement</p><pre style="font-size:11px;opacity:0.6">' +
              JSON.stringify(e) + '</pre>';
          }
        };
        new DocsAPI.DocEditor('editor', config);
      } catch(e) {
        document.getElementById('loading').innerHTML =
          '<p>Erreur : ' + e.message + '</p>';
      }
    });
  </script>
</body>
</html>`;
}

export default function DocumentEditorModal({ file, visible, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !visible) return;
    setLoading(true);
    setError(null);
    setHtml(null);

    (async () => {
      try {
        const canEditRes = await api.get(`/onlyoffice/can-edit/${file.id}`);
        const { canEdit } = canEditRes.data as { canEdit: boolean; mode: string };
        if (!canEdit) {
          setError('Ce type de fichier ne peut pas être édité avec OnlyOffice.');
          setLoading(false);
          return;
        }

        const configRes = await api.get(`/onlyoffice/config/${file.id}`);
        const { config, token, onlyofficeUrl } = configRes.data as {
          config: object; token: string; onlyofficeUrl: string;
        };

        setHtml(buildEditorHtml(onlyofficeUrl, config, token));
        setLoading(false);
      } catch (err: any) {
        const msg = err?.response?.data?.error ?? 'Impossible de charger l\'éditeur';
        if (err?.response?.data?.code === 'PLAN_UPGRADE_REQUIRED') {
          setError('OnlyOffice nécessite le plan PRO ou supérieur.');
        } else {
          setError(msg);
        }
        setLoading(false);
      }
    })();
  }, [file?.id, visible]);

  if (!file) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {loading && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary[400]} />
              <Text style={styles.loadingText}>Chargement de l'éditeur…</Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.centered}>
              <Ionicons name="alert-circle-outline" size={56} color={colors.error} />
              <Text style={styles.errorTitle}>Erreur</Text>
              <Text style={styles.errorMsg}>{error}</Text>
              <TouchableOpacity style={styles.closeErrorBtn} onPress={onClose}>
                <Text style={styles.closeErrorText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && html && (
            <WebView
              source={{ html, baseUrl: '' }}
              style={styles.webview}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              mixedContentMode="always"
              onError={(e) => setError(`WebView error: ${e.nativeEvent.description}`)}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  fileName: {
    flex: 1,
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
    marginRight: spacing.md,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.white,
    opacity: 0.7,
    marginTop: spacing.md,
  },
  errorTitle: {
    ...typography.h4,
    color: colors.white,
    marginTop: spacing.sm,
  },
  errorMsg: {
    ...typography.bodySmall,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  closeErrorBtn: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    backgroundColor: '#374151',
    borderRadius: 8,
  },
  closeErrorText: {
    ...typography.button,
    color: colors.white,
  },
});
