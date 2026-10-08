/**
 * MAKERS POS — WhatsApp Share Modal Component
 * Displays receipt image preview with options to copy to clipboard, save as PNG,
 * and open WhatsApp chat directly.
 */

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Copy,
  Download,
  ExternalLink,
  Check,
  X,
  Phone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import {
  copyBlobToClipboard,
  getWhatsAppUrl,
  buildWhatsAppMessage,
  openExternalUrl,
  normalizePhone,
} from '@/services/whatsapp/whatsappService'

interface WhatsAppShareModalProps {
  isOpen: boolean
  onClose: () => void
  imageDataUrl: string | null
  blob: Blob | null
  invoiceNumber: string
  total: number
  customerPhone?: string
  customerName?: string
}

export function WhatsAppShareModal({
  isOpen,
  onClose,
  imageDataUrl,
  blob,
  invoiceNumber,
  total,
  customerPhone = '',
  customerName = '',
}: WhatsAppShareModalProps) {
  const { t, i18n } = useTranslation()
  const isArabic = i18n.language !== 'en'

  const [phone, setPhone] = useState(customerPhone)
  const [copied, setCopied] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Keep phone updated if prop changes
  React.useEffect(() => {
    if (customerPhone) {
      setPhone(customerPhone)
    }
  }, [customerPhone])

  if (!isOpen || !imageDataUrl) return null

  const handleCopyImage = async () => {
    if (!blob) return
    const success = await copyBlobToClipboard(blob)
    if (success) {
      setCopied(true)
      setFeedback(isArabic ? 'تم نسخ صورة الإيصال للحافظة (Ctrl+V للصق)' : 'Receipt image copied to clipboard (Ctrl+V)')
      setTimeout(() => setCopied(false), 3000)
    } else {
      setFeedback(isArabic ? 'تعذر نسخ الصورة تلقائياً، يمكنك حفظها كملف' : 'Could not copy image, you can download it')
    }
  }

  const handleDownload = () => {
    try {
      const a = document.createElement('a')
      a.href = imageDataUrl
      a.download = `receipt_${invoiceNumber}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setFeedback(isArabic ? 'تم تحميل صورة الفاتورة بنجاح' : 'Receipt image saved')
    } catch (err) {
      console.error('Download error:', err)
    }
  }

  const handleOpenWhatsApp = async () => {
    // Copy image first so user can paste it right into chat
    if (blob) {
      await copyBlobToClipboard(blob)
    }

    const messageText = buildWhatsAppMessage({
      invoiceNumber,
      total,
    })
    const url = getWhatsAppUrl(phone, messageText)
    await openExternalUrl(url)

    setFeedback(isArabic ? 'تم فتح واتساب ونسخ الصورة للصق (Ctrl+V)' : 'Opened WhatsApp & copied image for pasting')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t('whatsapp.send', 'إرسال الفاتورة عبر واتساب')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {customerName ? `${customerName} — ` : ''}#{invoiceNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Phone Input Row */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t('whatsapp.enterPhone', 'رقم هاتف العميل (واتساب):')}
            </label>
            <div className="relative flex items-center">
              <Phone className="w-4 h-4 absolute start-3 text-muted-foreground" />
              <input
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full ps-9 pe-3 py-2 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isArabic
                ? 'يمكنك إدخال الرقم المحلي (مثل 010...) أو تركه فارغاً لاختيار جهة اتصال في واتساب'
                : 'Enter local number (e.g. 010...) or leave empty to choose chat in WhatsApp'}
            </p>
          </div>

          {/* Feedback alert */}
          {feedback && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Receipt Image Preview */}
          <div className="border border-border rounded-xl p-3 bg-muted/20 flex flex-col items-center">
            <span className="text-xs font-semibold text-muted-foreground mb-2">
              {isArabic ? 'معاينة صورة الإيصال:' : 'Receipt Image Preview:'}
            </span>
            <div className="max-h-72 overflow-y-auto border border-border/60 rounded-lg shadow-sm bg-white p-2">
              <img
                src={imageDataUrl}
                alt="Receipt Preview"
                className="w-64 h-auto object-contain mx-auto"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyImage}
              className="px-3.5 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t('whatsapp.copied', 'تم النسخ') : t('whatsapp.copyImage', 'نسخ الصورة')}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl border border-border bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('whatsapp.saveImage', 'حفظ الصورة')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('whatsapp.openWhatsApp', 'فتح واتساب')}</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
