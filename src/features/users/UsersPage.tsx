import React, { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  UserCog, UserPlus, Search, Shield, Briefcase, ShoppingCart,
  CheckCircle2, XCircle, KeyRound, Pencil, UserX, UserCheck, Trash2,
  AlertTriangle, RefreshCw, X, Eye, EyeOff, Loader2,
  ShieldCheck, Check, RotateCcw, Sliders, Lock
} from 'lucide-react'
import { authService, UserListItem, RoleItem, SYSTEM_PERMISSIONS, PermissionDefinition } from '@/services/auth/authService'
import { useAuthStore, usePermission } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { formatDate } from '@/lib/formatters'

export function UsersPage() {
  const { t } = useTranslation()
  const { user: currentUser } = useAuthStore()
  const { can, isAdmin } = usePermission()
  const { language } = useSettingsStore()
  const isRTL = language === 'ar'

  const [users, setUsers] = useState<UserListItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')

  // Notification / Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserListItem | null>(null)
  const [passwordResetUser, setPasswordResetUser] = useState<UserListItem | null>(null)
  const [confirmToggleUser, setConfirmToggleUser] = useState<UserListItem | null>(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [permissionManageUser, setPermissionManageUser] = useState<UserListItem | null>(null)

  // Form states - Create User
  const [createForm, setCreateForm] = useState({
    username: '',
    fullName: '',
    fullNameAr: '',
    password: '',
    confirmPassword: '',
    roleId: '',
    isActive: true,
  })
  const [showCreatePass, setShowCreatePass] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Form states - Edit User
  const [editForm, setEditForm] = useState({
    fullName: '',
    fullNameAr: '',
    roleId: '',
    isActive: true,
  })
  const [isUpdating, setIsUpdating] = useState(false)
  const [editError, setEditError] = useState('')

  // Form states - Reset Password
  const [resetPassForm, setResetPassForm] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [showResetPass, setShowResetPass] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  // Permissions Management State
  const [userPerms, setUserPerms] = useState<string[]>([])
  const [isCustomPerms, setIsCustomPerms] = useState(false)
  const [isLoadingPerms, setIsLoadingPerms] = useState(false)
  const [isSavingPerms, setIsSavingPerms] = useState(false)
  const [permError, setPermError] = useState('')
  const [permSearch, setPermSearch] = useState('')
  const [customPermUsersMap, setCustomPermUsersMap] = useState<Record<string, boolean>>({})

  // Load users and roles from database
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [userList, roleList] = await Promise.all([
        authService.getUsers(),
        authService.getRoles(),
      ])
      setUsers(userList)
      setRoles(roleList)
      if (roleList.length > 0 && !createForm.roleId) {
        const defaultRole = roleList.find(r => r.name === 'cashier') || roleList[0]
        setCreateForm(prev => ({ ...prev, roleId: defaultRole.id }))
      }

      // Check which users have custom permissions
      const customMap: Record<string, boolean> = {}
      await Promise.all(
        userList.map(async (u) => {
          try {
            const res = await authService.getUserCustomPermissions(u.id)
            customMap[u.id] = res.isCustom
          } catch {
            customMap[u.id] = false
          }
        })
      )
      setCustomPermUsersMap(customMap)
    } catch (err) {
      console.error('Failed to load users:', err)
      setFeedback({ type: 'error', message: t('auth.errors.system_error', 'حدث خطأ في النظام') })
    } finally {
      setIsLoading(false)
    }
  }

  // Handlers - Open Permissions Modal
  const openPermissions = async (u: UserListItem) => {
    setPermissionManageUser(u)
    setIsLoadingPerms(true)
    setPermError('')
    setPermSearch('')
    try {
      const res = await authService.getUserCustomPermissions(u.id)
      setUserPerms(res.permissions)
      setIsCustomPerms(res.isCustom)
    } catch (err: any) {
      console.error('Failed to fetch user permissions:', err)
      setPermError(err.message || 'Failed to load permissions')
    } finally {
      setIsLoadingPerms(false)
    }
  }

  // Permission toggles
  const handleTogglePerm = (permKey: string) => {
    setIsCustomPerms(true)
    setUserPerms(prev => {
      if (prev.includes('*')) {
        // Expand all permissions except the toggled one
        const allKeys = SYSTEM_PERMISSIONS.map(p => p.key)
        return allKeys.filter(k => k !== permKey)
      }
      if (prev.includes(permKey)) {
        return prev.filter(k => k !== permKey)
      } else {
        return [...prev, permKey]
      }
    })
  }

  const handleToggleCategory = (category: string, enable: boolean) => {
    setIsCustomPerms(true)
    const categoryKeys = SYSTEM_PERMISSIONS.filter(p => p.category === category).map(p => p.key)
    setUserPerms(prev => {
      let currentKeys = prev.includes('*') ? SYSTEM_PERMISSIONS.map(p => p.key) : [...prev]
      if (enable) {
        return Array.from(new Set([...currentKeys, ...categoryKeys]))
      } else {
        return currentKeys.filter(k => !categoryKeys.includes(k))
      }
    })
  }

  const handleSelectAllPerms = () => {
    setIsCustomPerms(true)
    setUserPerms(SYSTEM_PERMISSIONS.map(p => p.key))
  }

  const handleDeselectAllPerms = () => {
    setIsCustomPerms(true)
    setUserPerms([])
  }

  const handleResetToRoleDefaults = () => {
    if (!permissionManageUser) return
    const roleDefaults = authService.getDefaultRolePermissions(permissionManageUser.roleName)
    setUserPerms(roleDefaults)
    setIsCustomPerms(false)
  }

  const handleSavePermissions = async () => {
    if (!currentUser || !permissionManageUser) return
    setIsSavingPerms(true)
    setPermError('')
    try {
      if (!isCustomPerms) {
        await authService.resetUserPermissionsToRole(permissionManageUser.id, currentUser)
      } else {
        await authService.setUserPermissions(permissionManageUser.id, userPerms, currentUser)
      }
      setFeedback({
        type: 'success',
        message: t('users.permissionsSaved', 'تم حفظ صلاحيات المستخدم بنجاح')
      })
      setPermissionManageUser(null)
      await loadData()
    } catch (err: any) {
      setPermError(err.message || 'Failed to save permissions')
    } finally {
      setIsSavingPerms(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Auto-dismiss feedback banner after 4s
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedback])

  // Stats
  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter(u => u.isActive).length
    const admins = users.filter(u => u.roleName === 'admin' && u.isActive).length
    return { total, active, admins }
  }, [users])

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch =
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.fullNameAr && u.fullNameAr.includes(searchQuery))

      const matchesRole = roleFilter === 'ALL' || u.roleName === roleFilter
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && u.isActive) ||
        (statusFilter === 'INACTIVE' && !u.isActive)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  // Handlers - Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    setCreateError('')

    if (!createForm.username.trim() || createForm.username.trim().length < 3) {
      setCreateError(t('users.usernameTooShort', 'يجب ألا يقل اسم المستخدم عن 3 أحرف'))
      return
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(createForm.username.trim())) {
      setCreateError(t('users.invalidUsername', 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام وشرطة فقط'))
      return
    }
    if (!createForm.fullName.trim()) {
      setCreateError(t('users.nameRequired', 'الاسم المعروض مطلوب'))
      return
    }
    if (!createForm.password || createForm.password.length < 6) {
      setCreateError(t('users.passwordTooShort', 'يجب ألا تقل كلمة المرور عن 6 أحرف'))
      return
    }
    if (createForm.password !== createForm.confirmPassword) {
      setCreateError(t('users.passwordMismatch', 'كلمتا المرور غير متطابقتين'))
      return
    }

    setIsCreating(true)
    try {
      const res = await authService.createUser(
        {
          username: createForm.username.trim(),
          fullName: createForm.fullName.trim(),
          fullNameAr: createForm.fullNameAr.trim() || undefined,
          password: createForm.password,
          roleId: createForm.roleId,
          isActive: createForm.isActive,
        },
        currentUser
      )

      if (res.success) {
        setIsCreateOpen(false)
        setCreateForm({
          username: '',
          fullName: '',
          fullNameAr: '',
          password: '',
          confirmPassword: '',
          roleId: roles.find(r => r.name === 'cashier')?.id || roles[0]?.id || '',
          isActive: true,
        })
        setFeedback({ type: 'success', message: t('users.userCreated', 'تم إنشاء حساب المستخدم بنجاح') })
        await loadData()
      } else {
        if (res.error === 'username_taken') {
          setCreateError(t('users.usernameTaken', 'اسم المستخدم محجوز بالفعل'))
        } else if (res.error === 'permission_denied') {
          setCreateError(t('rbac.permissionDenied', 'ليس لديك الصلاحية لتنفيذ هذا الإجراء'))
        } else {
          setCreateError(res.error || t('auth.errors.system_error', 'حدث خطأ في النظام'))
        }
      }
    } catch (err: any) {
      setCreateError(err.message || t('auth.errors.system_error'))
    } finally {
      setIsCreating(false)
    }
  }

  // Handlers - Edit User
  const openEdit = (u: UserListItem) => {
    setEditUser(u)
    setEditForm({
      fullName: u.fullName,
      fullNameAr: u.fullNameAr || '',
      roleId: u.roleId,
      isActive: u.isActive,
    })
    setEditError('')
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !editUser) return
    setEditError('')

    if (!editForm.fullName.trim()) {
      setEditError(t('users.nameRequired', 'الاسم المعروض مطلوب'))
      return
    }

    setIsUpdating(true)
    try {
      const res = await authService.updateUser(
        editUser.id,
        {
          fullName: editForm.fullName.trim(),
          fullNameAr: editForm.fullNameAr.trim() || undefined,
          roleId: editForm.roleId,
          isActive: editForm.isActive,
        },
        currentUser
      )

      if (res.success) {
        setEditUser(null)
        setFeedback({ type: 'success', message: t('users.userUpdated', 'تم تحديث بيانات المستخدم بنجاح') })
        await loadData()
      } else {
        if (res.error === 'cannot_deactivate_self') {
          setEditError(t('users.cannotDeactivateSelf', 'لا يمكنك تعطيل حسابك الحالي'))
        } else if (res.error === 'cannot_remove_last_admin') {
          setEditError(t('users.cannotRemoveLastAdmin', 'لا يمكن تعطيل أو تغيير دور مسؤول النظام الأخير'))
        } else {
          setEditError(res.error || t('auth.errors.system_error'))
        }
      }
    } catch (err: any) {
      setEditError(err.message || t('auth.errors.system_error'))
    } finally {
      setIsUpdating(false)
    }
  }

  // Handlers - Reset Password
  const openResetPassword = (u: UserListItem) => {
    setPasswordResetUser(u)
    setResetPassForm({ newPassword: '', confirmPassword: '' })
    setResetError('')
  }

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !passwordResetUser) return
    setResetError('')

    if (!resetPassForm.newPassword || resetPassForm.newPassword.length < 6) {
      setResetError(t('users.passwordTooShort', 'يجب ألا تقل كلمة المرور عن 6 أحرف'))
      return
    }
    if (resetPassForm.newPassword !== resetPassForm.confirmPassword) {
      setResetError(t('users.passwordMismatch', 'كلمتا المرور غير متطابقتين'))
      return
    }

    setIsResetting(true)
    try {
      const res = await authService.resetPassword(passwordResetUser.id, resetPassForm.newPassword, currentUser)
      if (res.success) {
        setPasswordResetUser(null)
        setFeedback({ type: 'success', message: t('users.passwordResetSuccess', 'تم إعادة تعيين كلمة المرور بنجاح') })
      } else {
        setResetError(res.error || t('auth.errors.system_error'))
      }
    } catch (err: any) {
      setResetError(err.message || t('auth.errors.system_error'))
    } finally {
      setIsResetting(false)
    }
  }

  // Handlers - Toggle Active (Deactivate / Reactivate)
  const confirmToggle = async () => {
    if (!currentUser || !confirmToggleUser) return
    const newActiveState = !confirmToggleUser.isActive

    try {
      const res = await authService.updateUser(
        confirmToggleUser.id,
        {
          fullName: confirmToggleUser.fullName,
          fullNameAr: confirmToggleUser.fullNameAr || undefined,
          roleId: confirmToggleUser.roleId,
          isActive: newActiveState,
        },
        currentUser
      )

      if (res.success) {
        setConfirmToggleUser(null)
        setFeedback({
          type: 'success',
          message: newActiveState
            ? t('users.reactivateSuccess', 'تم تنشيط الحساب بنجاح')
            : t('users.deactivateSuccess', 'تم تعطيل الحساب بنجاح')
        })
        await loadData()
      } else {
        const msg = res.error === 'cannot_deactivate_self'
          ? t('users.cannotDeactivateSelf')
          : res.error === 'cannot_remove_last_admin'
          ? t('users.cannotRemoveLastAdmin')
          : res.error || t('auth.errors.system_error')
        setFeedback({ type: 'error', message: msg })
        setConfirmToggleUser(null)
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || t('auth.errors.system_error') })
      setConfirmToggleUser(null)
    }
  }

  // Handlers - Delete User
  const handleDeleteUser = async () => {
    if (!currentUser || !deleteConfirmUser) return
    setDeleteError('')
    setIsDeleting(true)
    try {
      const res = await authService.deleteUser(deleteConfirmUser.id, currentUser)
      if (res.success) {
        setDeleteConfirmUser(null)
        const msg = res.mode === 'hard_deleted'
          ? t('users.deleteSuccess', 'تم حذف المستخدم بنجاح')
          : res.fallbackNotice
          ? t('users.deactivateFallback', 'لا يمكن حذف المستخدم لأنه مرتبط بسجلات سابقة. تم تعطيل المستخدم بدلًا من حذفه.')
          : t('users.deactivateSuccess', 'تم تعطيل المستخدم بنجاح')

        setFeedback({
          type: 'success',
          message: msg,
        })
        await loadData()
      } else {
        const msg =
          res.error === 'cannot_delete_self'
            ? t('users.cannotDeleteSelf', 'لا يمكنك حذف حسابك الحالي')
            : res.error === 'cannot_remove_last_admin'
            ? t('users.cannotRemoveLastAdmin', 'لا يمكن حذف مسؤول النظام الأخير')
            : res.error === 'permission_denied'
            ? t('rbac.permissionDenied', 'ليس لديك الصلاحية لتنفيذ هذا الإجراء')
            : res.error || t('auth.errors.system_error', 'حدث خطأ في النظام')
        setDeleteError(msg)
        setFeedback({ type: 'error', message: msg })
      }
    } catch (err: any) {
      const message = err.message || t('auth.errors.system_error')
      console.error('[Delete User]', err)
      setDeleteError(message)
      setFeedback({ type: 'error', message })
    } finally {
      setIsDeleting(false)
    }
  }

  // Helper: Role Icon & Badge
  const getRoleBadge = (roleName: string, roleDisplay: string) => {
    switch (roleName) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Shield className="w-3.5 h-3.5" />
            {roleDisplay}
          </span>
        )
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent-foreground border border-accent/20">
            <Briefcase className="w-3.5 h-3.5" />
            {roleDisplay}
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary text-secondary-foreground border border-border">
            <ShoppingCart className="w-3.5 h-3.5" />
            {roleDisplay}
          </span>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/40 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{t('users.title', 'إدارة المستخدمين')}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('users.subtitle', 'إدارة حسابات المستخدمين وصلاحياتهم في النظام')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('common.refresh', 'تحديث')}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {(isAdmin || can('create', 'users')) && (
            <button
              onClick={() => {
                setCreateError('')
                setIsCreateOpen(true)
              }}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('users.addUser', 'إضافة مستخدم')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className="px-6 pt-4">
          <div
            className={`p-3 rounded-xl border flex items-center justify-between text-sm animate-fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-destructive/10 border-destructive/30 text-destructive'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass p-4 rounded-xl border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('users.totalUsers', 'إجمالي المستخدمين')}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserCog className="w-5 h-5" />
            </div>
          </div>

          <div className="glass p-4 rounded-xl border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('users.activeUsers', 'المستخدمين النشطين')}</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="glass p-4 rounded-xl border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">{t('users.adminCount', 'مسؤولي النظام')}</p>
              <p className="text-2xl font-bold text-primary mt-1">{stats.admins}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/60 p-3 rounded-xl border border-border">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('users.searchPlaceholder', 'البحث باسم المستخدم أو الاسم الكامل...')}
              className="w-full h-9 ps-9 pe-3 rounded-lg bg-input/60 border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-input/60 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">{t('users.allRoles', 'جميع الأدوار')}</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="cashier">Cashier</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-lg bg-input/60 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">{t('users.allStatuses', 'جميع الحالات')}</option>
              <option value="ACTIVE">{t('users.active', 'نشط')}</option>
              <option value="INACTIVE">{t('users.inactive', 'معطل')}</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="glass rounded-xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-muted/40 border-b border-border text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-start font-semibold">{t('users.username', 'المستخدم')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('users.role', 'الدور')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('users.status', 'الحالة')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('users.lastLogin', 'آخر تسجيل دخول')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('users.createdAt', 'تاريخ الإنشاء')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('users.actions', 'الإجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span>{t('common.loading', 'جاري التحميل...')}</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <UserCog className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">{t('common.noData', 'لا يوجد مستخدمين مطابقين للبحث')}</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const isSelf = currentUser?.id === u.id
                    const isLastAdmin = u.roleName === 'admin' && stats.admins <= 1 && u.isActive

                    return (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        {/* User Identity */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary flex-shrink-0">
                              {u.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground text-sm truncate">
                                  {isRTL ? u.fullNameAr || u.fullName : u.fullName}
                                </p>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/15 text-primary font-medium">
                                    {t('users.you', 'أنت')}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col items-start gap-1">
                            {getRoleBadge(
                              u.roleName,
                              isRTL ? u.roleDisplayNameAr || u.roleDisplayName : u.roleDisplayName
                            )}
                            {customPermUsersMap[u.id] && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-medium">
                                <Sliders className="w-2.5 h-2.5" />
                                <span>{isRTL ? 'صلاحيات مخصصة' : 'Custom'}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                              {t('users.active', 'نشط')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                              <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                              {t('users.inactive', 'معطل')}
                            </span>
                          )}
                        </td>

                        {/* Last Login */}
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                          {u.lastLoginAt ? formatDate(u.lastLoginAt, true) : t('users.never', 'لم يسجل دخول بعد')}
                        </td>

                        {/* Created Date */}
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                          {formatDate(u.createdAt, false)}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-end">
                          <div className="flex items-center justify-end gap-1">
                            {/* Manage Permissions Button */}
                            {(isAdmin || can('update', 'users')) && (
                              <button
                                onClick={() => openPermissions(u)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  customPermUsersMap[u.id]
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                    : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'
                                }`}
                                title={isRTL ? 'إدارة الصلاحيات وتخصيصها' : 'Manage User Permissions'}
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
                            )}

                            {/* Edit Button */}
                            {(isAdmin || can('update', 'users')) && (
                              <button
                                onClick={() => openEdit(u)}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title={t('users.editUser', 'تعديل')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}

                            {/* Reset Password Button */}
                            {(isAdmin || can('update', 'users')) && (
                              <button
                                onClick={() => openResetPassword(u)}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title={t('users.resetPassword', 'إعادة تعيين كلمة المرور')}
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>
                            )}

                            {/* Deactivate / Reactivate Toggle */}
                            {(isAdmin || can('update', 'users') || can('delete', 'users')) && (
                              <button
                                onClick={() => setConfirmToggleUser(u)}
                                disabled={isSelf || isLastAdmin}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isSelf || isLastAdmin
                                    ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                                    : u.isActive
                                    ? 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                                    : 'hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400'
                                }`}
                                title={
                                  isSelf
                                    ? t('users.cannotDeactivateSelf')
                                    : isLastAdmin
                                    ? t('users.cannotRemoveLastAdmin')
                                    : u.isActive
                                    ? t('users.deactivate', 'تعطيل الحساب')
                                    : t('users.reactivate', 'تنشيط الحساب')
                                }
                              >
                                {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                              </button>
                            )}

                            {/* Delete User Button */}
                            {(isAdmin || can('delete', 'users')) && (
                              <button
                                onClick={() => {
                                  setDeleteError('')
                                  setDeleteConfirmUser(u)
                                }}
                                disabled={isSelf || isLastAdmin}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isSelf || isLastAdmin
                                    ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                                    : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                                }`}
                                title={
                                  isSelf
                                    ? t('users.cannotDeleteSelf', 'لا يمكنك حذف حسابك الحالي')
                                    : isLastAdmin
                                    ? t('users.cannotRemoveLastAdmin', 'لا يمكن حذف مسؤول النظام الأخير')
                                    : t('users.delete', 'حذف')
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: Create User ────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md glass rounded-2xl border border-border shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserPlus className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">{t('users.addUser', 'إضافة مستخدم جديد')}</h2>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Username */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.username', 'اسم المستخدم')} *
                </label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={e => setCreateForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. cashier1"
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>

              {/* Full Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {t('users.displayName', 'الاسم المعروض')} *
                  </label>
                  <input
                    type="text"
                    value={createForm.fullName}
                    onChange={e => setCreateForm(p => ({ ...p, fullName: e.target.value }))}
                    placeholder="Full Name"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {t('users.displayNameAr', 'الاسم بالعربية')}
                  </label>
                  <input
                    type="text"
                    value={createForm.fullNameAr}
                    onChange={e => setCreateForm(p => ({ ...p, fullNameAr: e.target.value }))}
                    placeholder="الاسم بالعربية"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.role', 'الدور')} *
                </label>
                <select
                  value={createForm.roleId}
                  onChange={e => setCreateForm(p => ({ ...p, roleId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {isRTL ? r.displayNameAr || r.displayName : r.displayName} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Passwords */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {t('users.password', 'كلمة المرور')} *
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePass ? 'text' : 'password'}
                      value={createForm.password}
                      onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full h-9 px-3 pe-9 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePass(!showCreatePass)}
                      className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCreatePass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {t('users.confirmPassword', 'تأكيد كلمة المرور')} *
                  </label>
                  <input
                    type={showCreatePass ? 'text' : 'password'}
                    value={createForm.confirmPassword}
                    onChange={e => setCreateForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold text-foreground">{t('users.status', 'الحالة')}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {createForm.isActive ? t('users.active', 'الحساب نشط ويمكنه الدخول') : t('users.inactive', 'الحساب معطل')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={createForm.isActive}
                  onChange={e => setCreateForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('common.save', 'حفظ')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: Edit User ──────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md glass rounded-2xl border border-border shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Pencil className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {t('users.editUser', 'تعديل المستخدم')}: @{editUser.username}
                </h2>
              </div>
              <button
                onClick={() => setEditUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.displayName', 'الاسم المعروض')} *
                </label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Arabic Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.displayNameAr', 'الاسم بالعربية')}
                </label>
                <input
                  type="text"
                  value={editForm.fullNameAr}
                  onChange={e => setEditForm(p => ({ ...p, fullNameAr: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Role */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.role', 'الدور')}
                </label>
                <select
                  value={editForm.roleId}
                  onChange={e => setEditForm(p => ({ ...p, roleId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>
                      {isRTL ? r.displayNameAr || r.displayName : r.displayName} ({r.name})
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                <div>
                  <p className="text-xs font-semibold text-foreground">{t('users.status', 'الحالة')}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {editForm.isActive ? t('users.active', 'الحساب نشط') : t('users.inactive', 'الحساب معطل')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  disabled={currentUser?.id === editUser.id}
                  onChange={e => setEditForm(p => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 accent-primary rounded cursor-pointer disabled:opacity-40"
                />
              </div>
              {currentUser?.id === editUser.id && (
                <p className="text-[11px] text-muted-foreground">
                  * {t('users.cannotDeactivateSelf', 'لا يمكنك تعطيل حسابك الحالي')}
                </p>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('common.save', 'حفظ التعديلات')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Reset Password ─────────────────────────────────────── */}
      {passwordResetUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md glass rounded-2xl border border-border shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  {t('users.resetPassword', 'إعادة تعيين كلمة المرور')} (@{passwordResetUser.username})
                </h2>
              </div>
              <button
                onClick={() => setPasswordResetUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(
                  'users.resetNotice',
                  'سيتم تغيير كلمة المرور للمستخدم وإنهاء جميع جلسات تسجيل الدخول الحالية فوراً.'
                )}
              </p>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.newPassword', 'كلمة المرور الجديدة')} *
                </label>
                <div className="relative">
                  <input
                    type={showResetPass ? 'text' : 'password'}
                    value={resetPassForm.newPassword}
                    onChange={e => setResetPassForm(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full h-9 px-3 pe-9 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showResetPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t('users.confirmPassword', 'تأكيد كلمة المرور')} *
                </label>
                <input
                  type={showResetPass ? 'text' : 'password'}
                  value={resetPassForm.confirmPassword}
                  onChange={e => setResetPassForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-lg bg-input border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordResetUser(null)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('users.resetPassword', 'تأكيد التغيير')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 4: Confirm Deactivate / Reactivate ─────────────────────── */}
      {confirmToggleUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm glass rounded-2xl border border-border shadow-2xl p-6 text-center animate-scale-up">
            <div
              className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
                confirmToggleUser.isActive
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {confirmToggleUser.isActive ? <UserX className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
            </div>

            <h3 className="text-base font-bold text-foreground mb-2">
              {confirmToggleUser.isActive
                ? t('users.deactivate', 'تعطيل حساب المستخدم')
                : t('users.reactivate', 'تنشيط حساب المستخدم')}
            </h3>

            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              {confirmToggleUser.isActive
                ? t('users.deleteConfirm', 'هل أنت متأكد من تعطيل هذا المستخدم؟ لن يتمكن من تسجيل الدخول للنظام.')
                : t('users.reactivateConfirm', 'هل أنت متأكد من إعادة تنشيط هذا الحساب والسماح له بالدخول؟')}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setConfirmToggleUser(null)}
                className="px-4 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                onClick={confirmToggle}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors text-white shadow-sm ${
                  confirmToggleUser.isActive
                    ? 'bg-destructive hover:bg-destructive/90'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {t('common.confirm', 'تأكيد')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 6: Confirm Delete User ─────────────────────────── */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm glass rounded-2xl border border-border shadow-2xl p-6 text-center animate-scale-up">
            <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center bg-destructive/10 text-destructive border border-destructive/20">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-foreground mb-2">
              {t('users.deleteConfirmTitle', 'هل أنت متأكد من حذف المستخدم؟')}
            </h3>

            <div className="bg-muted/30 p-3 rounded-xl border border-border mb-4 text-start space-y-1">
              <p className="text-xs font-semibold text-foreground">
                {isRTL ? deleteConfirmUser.fullNameAr || deleteConfirmUser.fullName : deleteConfirmUser.fullName}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                @{deleteConfirmUser.username}
              </p>
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs mb-4 flex items-center gap-2 text-start">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              {t('users.deleteWarning', 'سيتم تعطيل حساب المستخدم وإنهاء جلساته النشطة فوراً مع الحفاظ على سجل المبيعات والعمليات المالية.')}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
              >
                {t('common.cancel', 'إلغاء')}
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t('users.deleteUserAction', 'حذف المستخدم')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: Granular Permission Matrix ─────────────────────────── */}
      {permissionManageUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] glass rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-card/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-foreground">
                      {isRTL ? 'إدارة صلاحيات المستخدم' : 'Manage User Permissions'}: {permissionManageUser.fullName}
                    </h2>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border font-mono text-muted-foreground">
                      @{permissionManageUser.username}
                    </span>
                    {isCustomPerms ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                        {isRTL ? 'صلاحيات مخصصة' : 'Custom Overrides'}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                        {isRTL ? `افتراضي (${permissionManageUser.roleDisplayNameAr || permissionManageUser.roleDisplayName})` : `Role Default (${permissionManageUser.roleDisplayName})`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isRTL
                      ? 'حدد الصلاحيات الممنوحة لهذا المستخدم بدقة. سيتم حفظها وتطبيقها فورياً على جميع شاشات وعمليات النظام.'
                      : 'Explicitly configure granular access permissions for this user across POS, Inventory, Sales, and Settings.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPermissionManageUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="px-6 py-3 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Search Permissions */}
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={permSearch}
                  onChange={e => setPermSearch(e.target.value)}
                  placeholder={isRTL ? 'بحث في الصلاحيات...' : 'Filter permissions...'}
                  className="w-full h-8 ps-8 pe-3 rounded-lg bg-input/80 border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllPerms}
                  className="px-2.5 py-1.5 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <span>{isRTL ? 'تحديد الكل' : 'Select All'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAllPerms}
                  className="px-2.5 py-1.5 rounded-lg border border-border text-foreground text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5 text-destructive" />
                  <span>{isRTL ? 'إلغاء تحديد الكل' : 'Deselect All'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetToRoleDefaults}
                  className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex items-center gap-1.5"
                  title={isRTL ? 'استرجاع الصلاحيات القياسية للدور' : 'Reset to Role Defaults'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'استعادة الافتراضي للدور' : 'Role Defaults'}</span>
                </button>
              </div>
            </div>

            {/* Modal Body / Categories List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {permError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{permError}</span>
                </div>
              )}

              {isLoadingPerms ? (
                <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-xs">{isRTL ? 'جاري تحميل الصلاحيات...' : 'Loading permissions...'}</p>
                </div>
              ) : (
                (() => {
                  const categoriesMeta: Record<string, { titleAr: string; titleEn: string }> = {
                    pos: { titleAr: 'نقطة البيع والكاشير', titleEn: 'Point of Sale (POS)' },
                    sales: { titleAr: 'المبيعات والإيصالات والمرتجعات', titleEn: 'Sales & Receipts' },
                    products: { titleAr: 'كتالوج المنتجات والأسعار', titleEn: 'Products & Pricing' },
                    inventory: { titleAr: 'المخزون والجرد والتحويلات', titleEn: 'Inventory & Stock' },
                    purchasing: { titleAr: 'فواتير المشتريات والتوريد', titleEn: 'Purchasing & POs' },
                    customers: { titleAr: 'العملاء والموردون', titleEn: 'Customers & Suppliers' },
                    finance: { titleAr: 'الخزينة والورديات والمصروفات', titleEn: 'Cash Shifts & Expenses' },
                    reports: { titleAr: 'التقارير المالية والتحليلية', titleEn: 'Reports & Analytics' },
                    users: { titleAr: 'إدارة المستخدمين والأمان', titleEn: 'Users & Roles Management' },
                    settings: { titleAr: 'إعدادات النظام والمتجر', titleEn: 'System Settings' },
                    system: { titleAr: 'أدوات النظام والباركود وسجل التدقيق', titleEn: 'System Tools & Barcodes' },
                  }

                  const grouped = SYSTEM_PERMISSIONS.reduce((acc, perm) => {
                    if (
                      permSearch &&
                      !perm.labelAr.toLowerCase().includes(permSearch.toLowerCase()) &&
                      !perm.labelEn.toLowerCase().includes(permSearch.toLowerCase()) &&
                      !perm.key.toLowerCase().includes(permSearch.toLowerCase())
                    ) {
                      return acc
                    }
                    if (!acc[perm.category]) acc[perm.category] = []
                    acc[perm.category].push(perm)
                    return acc
                  }, {} as Record<string, PermissionDefinition[]>)

                  const categoryKeys = Object.keys(grouped)

                  if (categoryKeys.length === 0) {
                    return (
                      <div className="py-12 text-center text-muted-foreground text-xs">
                        {isRTL ? 'لا توجد صلاحيات مطابقة لبحثك' : 'No permissions matched your search query'}
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-6">
                      {categoryKeys.map((catKey) => {
                        const items = grouped[catKey]
                        const meta = categoriesMeta[catKey] || { titleAr: catKey, titleEn: catKey }
                        const isAllSelected = items.every(
                          (p) => userPerms.includes('*') || userPerms.includes(p.key)
                        )

                        return (
                          <div
                            key={catKey}
                            className="glass rounded-xl border border-border overflow-hidden shadow-sm"
                          >
                            {/* Category Header */}
                            <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                <h3 className="text-xs font-bold text-foreground">
                                  {isRTL ? meta.titleAr : meta.titleEn}
                                </h3>
                                <span className="text-[10px] text-muted-foreground">
                                  ({items.filter((p) => userPerms.includes('*') || userPerms.includes(p.key)).length}/{items.length})
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleCategory(catKey, !isAllSelected)}
                                className="text-[11px] font-medium text-primary hover:underline"
                              >
                                {isAllSelected
                                  ? isRTL ? 'إلغاء تحديد القسم' : 'Deselect Category'
                                  : isRTL ? 'تحديد القسم بالكامل' : 'Select All in Category'}
                              </button>
                            </div>

                            {/* Permission Items Grid */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                              {items.map((perm) => {
                                const isChecked = userPerms.includes('*') || userPerms.includes(perm.key)
                                return (
                                  <label
                                    key={perm.key}
                                    onClick={() => handleTogglePerm(perm.key)}
                                    className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                                      isChecked
                                        ? 'bg-primary/5 border-primary/30'
                                        : 'bg-card/40 border-border/60 hover:bg-muted/30'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-foreground leading-snug">
                                        {isRTL ? perm.labelAr : perm.labelEn}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] font-mono text-muted-foreground">
                                          {perm.key}
                                        </span>
                                        {isRTL && (
                                          <span className="text-[10px] text-muted-foreground/70 font-sans truncate">
                                            {perm.labelEn}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-card/60 flex items-center justify-between shrink-0">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {userPerms.includes('*') ? SYSTEM_PERMISSIONS.length : userPerms.length}
                </span>{' '}
                {isRTL ? 'صلاحية مفعلة من أصل' : 'permissions enabled of'}{' '}
                <span className="font-semibold text-foreground">{SYSTEM_PERMISSIONS.length}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionManageUser(null)}
                  className="px-4 py-2 rounded-lg border border-border text-foreground text-xs font-medium hover:bg-muted transition-colors"
                >
                  {t('common.cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={isSavingPerms}
                  className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isSavingPerms && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRTL ? 'حفظ الصلاحيات المحددة' : 'Save Permissions'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
