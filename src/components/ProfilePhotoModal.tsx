import React, { useState } from 'react';
import { UserProfile } from '../types';
import { festStore } from '../lib/store';
import { REAL_PEOPLE_PHOTOS, getParticipantPhoto } from '../lib/avatarUtils';
import { compressImage } from '../lib/imageUtils';
import { X, Upload, Camera, Check, Link as LinkIcon, RefreshCw, User } from 'lucide-react';

interface ProfilePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onPhotoUpdated?: (updatedUser: UserProfile) => void;
}

export const ProfilePhotoModal: React.FC<ProfilePhotoModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPhotoUpdated
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<string>(
    currentUser.photoUrl || getParticipantPhoto(currentUser.name, currentUser.photoUrl)
  );
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMsg('');
      // Compress image for localStorage friendliness
      const compressed = await compressImage(file, 600, 600, 0.8);
      setSelectedPhoto(compressed);
      setIsUploading(false);
    } catch (err) {
      console.error('Photo compression error:', err);
      setErrorMsg('Failed to process image file. Please try a different photo.');
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    try {
      const res = festStore.updateProfileCredentials(currentUser.id, {
        photoUrl: selectedPhoto
      });

      if (res.success) {
        setSuccessMsg('Profile photo updated successfully!');
        const updatedUser: UserProfile = {
          ...currentUser,
          photoUrl: selectedPhoto
        };
        if (onPhotoUpdated) {
          onPhotoUpdated(updatedUser);
        }
        setTimeout(() => {
          setSuccessMsg('');
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Failed to update photo.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error updating profile photo.');
    }
  };

  const handleApplyUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    setSelectedPhoto(customUrlInput.trim());
    setCustomUrlInput('');
  };

  const handleResetDefault = () => {
    const defaultPhoto = getParticipantPhoto(currentUser.name);
    setSelectedPhoto(defaultPhoto);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#151728] border border-[#292d4a] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl space-y-0 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#292d4a]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Change Profile Photo</h2>
              <p className="text-xs text-slate-400 font-medium">Select a No Profile (shadow head) avatar or upload a custom photo</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#181b30] hover:bg-[#202542] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Current Selection Preview */}
          <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-5 p-4 rounded-2xl bg-[#181b30] border border-[#292d4a]">
            <div className="relative group">
              <img
                src={selectedPhoto}
                alt="Profile Preview"
                className="w-24 h-24 rounded-2xl object-cover border-2 border-purple-500 shadow-xl shadow-purple-600/30"
              />
              <span className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-purple-600 text-white shadow-md">
                <Check className="w-4 h-4" />
              </span>
            </div>

            <div className="text-center sm:text-left space-y-1">
              <div className="text-sm font-extrabold text-white">{currentUser.name}</div>
              <div className="text-xs text-purple-400 font-mono font-bold">Chest No: {currentUser.userId}</div>
              <div className="text-xs text-slate-400">
                {currentUser.groupName} • {currentUser.category || 'Participant'}
              </div>

              <button
                type="button"
                onClick={handleResetDefault}
                className="mt-2 text-xs font-semibold text-slate-300 hover:text-purple-300 flex items-center justify-center sm:justify-start gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reset Default Photo
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1 bg-[#181b30] rounded-2xl border border-[#292d4a]">
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'presets'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> No Profile
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Upload File
            </button>

            <button
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'url'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" /> Image Link
            </button>
          </div>

          {/* TAB 1: Shadow Head (No Profile) Preset Grid */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Choose a Shadow Head Silhouette</span>
                <span className="text-[11px] text-purple-400 font-mono font-semibold">{REAL_PEOPLE_PHOTOS.length} Styles</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                {REAL_PEOPLE_PHOTOS.map((photo, index) => {
                  const isSelected = selectedPhoto === photo;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedPhoto(photo)}
                      className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group ${
                        isSelected
                          ? 'border-purple-500 scale-105 shadow-lg shadow-purple-600/30'
                          : 'border-[#292d4a] hover:border-purple-400/60 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={photo}
                        alt={`Shadow Head Silhouette ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                          <Check className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-[#292d4a] hover:border-purple-500/60 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all bg-[#181b30]/60 hover:bg-[#181b30]">
                <div className="p-4 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="text-center space-y-1">
                  <span className="text-sm font-extrabold text-white block">Click to select a photo from your device</span>
                  <span className="text-xs text-slate-400 block">Supports JPG, PNG, WEBP (Auto-optimized)</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </label>

              {isUploading && (
                <div className="text-xs text-purple-400 font-bold text-center animate-pulse">
                  Compressing & processing photo...
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Image URL Input */}
          {activeTab === 'url' && (
            <form onSubmit={handleApplyUrl} className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Paste Direct Image URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/my-photo.jpg"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 bg-[#181b30] border border-[#292d4a] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shrink-0"
                >
                  Apply URL
                </button>
              </div>
            </form>
          )}

          {/* Status Messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#292d4a] bg-[#121424]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[#181b30] hover:bg-[#202542] text-slate-300 font-bold text-xs transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="poster-btn-primary px-6 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-purple-600/30"
          >
            <Check className="w-4 h-4" /> Save Profile Photo
          </button>
        </div>

      </div>
    </div>
  );
};
