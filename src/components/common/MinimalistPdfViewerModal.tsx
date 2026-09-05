import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { X, Share2, FileText } from 'lucide-react-native'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system/legacy'
import { triggerHaptic } from '@/lib/personalHaptics'

interface MinimalistPdfViewerModalProps {
  visible: boolean
  pdfUri: string | null
  pdfTitle: string
  onClose: () => void
}

export function MinimalistPdfViewerModal({
  visible,
  pdfUri,
  pdfTitle,
  onClose,
}: MinimalistPdfViewerModalProps) {
  const insets = useSafeAreaInsets()
  const [webViewSource, setWebViewSource] = useState<{ uri: string } | null>(null)
  const [shareableUri, setShareableUri] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let isMounted = true
    const preparePdf = async () => {
      if (!pdfUri) {
        setWebViewSource(null)
        setShareableUri(null)
        return
      }
      setLoading(true)
      try {
        let safeShare = pdfUri
        if (pdfUri.startsWith('file://')) {
          try {
            const base64 = await FileSystem.readAsStringAsync(pdfUri, {
              encoding: FileSystem.EncodingType.Base64,
            })
            if (isMounted) {
              setWebViewSource({ uri: `data:application/pdf;base64,${base64}` })
              setShareableUri(pdfUri)
              setLoading(false)
              return
            }
          } catch (e) {
            console.warn('[PdfViewer] Falló lectura base64:', e)
          }
        }
        if (isMounted) {
          setWebViewSource({ uri: safeShare })
          setShareableUri(safeShare)
          setLoading(false)
        }
      } catch {
        if (isMounted) {
          setWebViewSource({ uri: pdfUri })
          setShareableUri(pdfUri)
          setLoading(false)
        }
      }
    }

    if (visible && pdfUri) {
      preparePdf()
    }

    return () => {
      isMounted = false
    }
  }, [visible, pdfUri])

  if (!pdfUri) return null

  const handleShare = async () => {
    const uriToShare = shareableUri || pdfUri
    triggerHaptic('light')
    try {
      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable && uriToShare) {
        await Sharing.shareAsync(uriToShare, {
          dialogTitle: pdfTitle,
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Aviso', 'La opción de compartir no está disponible.')
      }
    } catch (err) {
      console.error('Error al compartir PDF:', err)
    }
  }

  const handleClose = () => {
    triggerHaptic('light')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 8 : insets.top }]}>
        {/* Header Minimalista */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.pdfIconBox}>
              <FileText size={15} color="#EF4444" />
            </View>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {pdfTitle || 'Documento PDF'}
              </Text>
              <Text style={styles.headerSubtitle}>Visor Integrado Synapse</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={handleShare} hitSlop={12} style={styles.actionBtn}>
              <Share2 size={16} color="#A1A1AA" />
            </Pressable>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Visor Nativo de PDF (Apple WKWebView Engine) */}
        <View style={styles.webviewContainer}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>Cargando PDF...</Text>
            </View>
          ) : webViewSource ? (
            <WebView
              source={webViewSource}
              style={styles.webview}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowFileAccessFromFileURLs={true}
              allowUniversalAccessFromFileURLs={true}
              scalesPageToFit={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loadingText}>Cargando PDF...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.loadingText}>Cargando PDF...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#09090B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  pdfIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: '#18181B',
  },
  webview: {
    flex: 1,
    backgroundColor: '#18181B',
  },
  loadingBox: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '500',
  },
})
