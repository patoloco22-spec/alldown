import React, { useState, useRef } from 'react';
import { X, Plus, Trash2, Edit, Save, MoreHorizontal, FileText, Video, Music, Image, Archive, Cpu, Folder, Palette, GripVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import type { DownloadCategory } from '@shared/types';
import { hexToRgb } from '../../utils/formatters';

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  categories: DownloadCategory[];
  onCategoriesChange: () => void;
}

const DEFAULT_ICONS = [
  { id: 'file-text', label: 'Document', component: FileText },
  { id: 'video', label: 'Video', component: Video },
  { id: 'music', label: 'Audio', component: Music },
  { id: 'image', label: 'Image', component: Image },
  { id: 'archive', label: 'Archive', component: Archive },
  { id: 'cpu', label: 'Software', component: Cpu },
  { id: 'folder', label: 'Folder', component: Folder },
] as const;

const PRESET_COLORS = [
  '#3b82f6', '#ec4899', '#8b5cf6', '#10b981',
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#eab308',
] as const;

export function CategoryManagerModal({
  open,
  onClose,
  categories,
  onCategoriesChange,
}: CategoryManagerModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<Partial<DownloadCategory>>({
    name: '',
    color: PRESET_COLORS[0],
    icon: 'folder',
    extensions: '',
    defaultPath: '',
    autoAdd: true,
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return;

    const result = await window.electronAPI.categories.add({
      name: newCategory.name.trim(),
      color: newCategory.color || PRESET_COLORS[0],
      icon: newCategory.icon || 'folder',
      extensions: newCategory.extensions?.split(',').map(e => e.trim().toLowerCase()).filter(Boolean) || [],
      defaultPath: newCategory.defaultPath || '',
      autoAdd: newCategory.autoAdd ?? true,
      order: categories.length,
    });

    if (result.success) {
      setNewCategory({
        name: '',
        color: PRESET_COLORS[0],
        icon: 'folder',
        extensions: '',
        defaultPath: '',
        autoAdd: true,
      });
      onCategoriesChange();
    }
  };

  const handleUpdateCategory = async (id: string, updates: Partial<DownloadCategory>) => {
    const result = await window.electronAPI.categories.update(id, updates);
    if (result.success) {
      setEditingId(null);
      onCategoriesChange();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (id === 'other') return; // Can't delete default
    if (!window.confirm('Delete this category? Downloads will be moved to "Other".')) return;

    const result = await window.electronAPI.categories.remove(id);
    if (result.success) {
      onCategoriesChange();
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetId) {
      // Reorder logic would go here
      // For now just update the order
      onCategoriesChange();
    }
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        ref={modalRef}
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-xl animate-slide-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm z-10 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <MoreHorizontal className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Manage Categories</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Organize downloads by file type</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category List */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Add New Category */}
          <div className="card p-4 mb-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Add New Category</h3>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                    placeholder="My Category"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newCategory.color || PRESET_COLORS[0]}
                      onChange={e => setNewCategory({ ...newCategory, color: e.target.value })}
                      className="w-10 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                    <div className="flex gap-1 flex-wrap">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewCategory({ ...newCategory, color })}
                          className={clsx(
                            'w-6 h-6 rounded transition-transform',
                            newCategory.color === color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-110'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {DEFAULT_ICONS.map(icon => {
                      const Icon = icon.component;
                      return (
                        <button
                          key={icon.id}
                          type="button"
                          onClick={() => setNewCategory({ ...newCategory, icon: icon.id })}
                          className={clsx(
                            'btn-icon p-2 rounded-lg',
                            newCategory.icon === icon.id ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'bg-slate-100 dark:bg-slate-700'
                          )}
                          title={icon.label}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="label">Default Save Path (relative)</label>
                  <input
                    type="text"
                    value={newCategory.defaultPath}
                    onChange={e => setNewCategory({ ...newCategory, defaultPath: e.target.value })}
                    placeholder="MyFolder"
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="label">File Extensions (comma separated)</label>
                <input
                  type="text"
                  value={newCategory.extensions}
                  onChange={e => setNewCategory({ ...newCategory, extensions: e.target.value })}
                  placeholder="pdf, doc, docx, txt"
                  className="input font-mono text-sm"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Files with these extensions will be auto-categorized
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newCategory.autoAdd}
                  onChange={e => setNewCategory({ ...newCategory, autoAdd: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Auto-add matching downloads to this category</span>
              </label>

              <div className="flex justify-end">
                <button onClick={handleAddCategory} className="btn-primary" disabled={!newCategory.name?.trim()}>
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
              </div>
            </div>
          </div>

          {/* Existing Categories */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center justify-between">
              Existing Categories
              <span className="badge badge-neutral">{categories.length}</span>
            </h3>

            <div className="space-y-2" role="list">
              {categories.map((category, index) => {
                const Icon = DEFAULT_ICONS.find(i => i.id === category.icon)?.component || Folder;
                const isDefault = category.id === 'other';
                const isEditing = editingId === category.id;

                return (
                  <div
                    key={category.id}
                    draggable={!isDefault}
                    onDragStart={e => handleDragStart(e, category.id)}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(e, category.id)}
                    onDragEnd={handleDragEnd}
                    className={clsx(
                      'card p-3 flex items-center gap-4 transition-all duration-150',
                      isEditing && 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10',
                      draggedId === category.id && 'opacity-50',
                      isDefault && 'opacity-75'
                    )}
                    role="listitem"
                  >
                    {/* Drag Handle */}
                    {!isDefault && (
                      <button className="btn-icon p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing" aria-label="Drag to reorder">
                        <GripVertical className="w-5 h-5" />
                      </button>
                    )}

                    {/* Icon & Color */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: category.color + '20' }}>
                      <Icon className="w-5 h-5" style={{ color: category.color }} />
                    </div>

                    {/* Category Info */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            defaultValue={category.name}
                            onBlur={e => handleUpdateCategory(category.id, { name: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && handleUpdateCategory(category.id, { name: e.target.value })}
                            className="input font-medium"
                            autoFocus
                          />
                          <div className="grid gap-2 sm:grid-cols-3">
                            <input
                              type="color"
                              defaultValue={category.color}
                              onBlur={e => handleUpdateCategory(category.id, { color: e.target.value })}
                              className="w-10 h-10 rounded border border-slate-300 dark:border-slate-600 cursor-pointer"
                            />
                            <select
                              defaultValue={category.icon}
                              onBlur={e => handleUpdateCategory(category.id, { icon: e.target.value })}
                              className="input"
                            >
                              {DEFAULT_ICONS.map(i => (
                                <option key={i.id} value={i.id}>{i.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              defaultValue={category.defaultPath}
                              onBlur={e => handleUpdateCategory(category.id, { defaultPath: e.target.value })}
                              placeholder="Save path"
                              className="input text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            defaultValue={category.extensions.join(', ')}
                            onBlur={e => handleUpdateCategory(category.id, { extensions: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) })}
                            placeholder="Extensions (comma separated)"
                            className="input font-mono text-sm"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{category.name}</span>
                            {isDefault && <span className="badge badge-neutral text-xs">Default</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-mono truncate max-w-[200px]">{category.extensions.join(', ') || '—'}</span>
                            {category.defaultPath && (
                              <span className="truncate max-w-[150px]">{category.defaultPath}</span>
                            )}
                            <span className={clsx('badge text-xs', category.autoAdd ? 'badge-primary' : 'badge-neutral')}>
                              {category.autoAdd ? 'Auto-add' : 'Manual'}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {!isDefault && !isEditing && (
                        <button
                          onClick={() => setEditingId(category.id)}
                          className="btn-icon p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      {isEditing && (
                        <>
                          <button
                            onClick={() => handleUpdateCategory(category.id, { name: category.name })}
                            className="btn-icon p-1.5 text-green-600 hover:text-green-400"
                            title="Save"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn-icon p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {!isDefault && !isEditing && (
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="btn-icon p-1.5 text-red-600 hover:text-red-400"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {isDefault && (
                        <span className="w-8 text-center text-slate-300">
                          <Trash2 className="w-4 h-4 mx-auto opacity-30" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 sticky bottom-0 rounded-b-xl">
          <button onClick={onClose} className="btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}