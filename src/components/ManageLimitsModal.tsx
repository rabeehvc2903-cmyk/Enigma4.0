import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Info, 
  Layers, 
  Plus, 
  Minus,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { festStore, DEFAULT_LIMIT_RULES } from '../lib/store';
import { LimitRulesConfig, CategoryLimitRule } from '../types';

interface ManageLimitsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageLimitsModal: React.FC<ManageLimitsModalProps> = ({
  isOpen,
  onClose
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [config, setConfig] = useState<LimitRulesConfig>(DEFAULT_LIMIT_RULES);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const currentCats = festStore.getCategories();
      setCategories(currentCats);

      const existingRules = festStore.getLimitRules();
      // Ensure all current categories are present in categoryLimits
      const mergedLimits: Record<string, CategoryLimitRule> = { ...existingRules.categoryLimits };
      currentCats.forEach(cat => {
        if (!mergedLimits[cat]) {
          mergedLimits[cat] = festStore.getCategoryLimit(cat);
        }
      });

      setConfig({
        ...existingRules,
        categoryLimits: mergedLimits
      });
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpdateCategoryRule = (category: string, field: 'stage' | 'offStage', delta: number) => {
    const currentRule = config.categoryLimits[category] || {
      stage: config.defaultStageLimit,
      offStage: config.defaultOffStageLimit
    };

    const newVal = Math.max(0, Math.min(50, (currentRule[field] ?? 0) + delta));
    setConfig(prev => ({
      ...prev,
      categoryLimits: {
        ...prev.categoryLimits,
        [category]: {
          ...currentRule,
          [field]: newVal
        }
      }
    }));
  };

  const handleSetCategoryRuleValue = (category: string, field: 'stage' | 'offStage', value: number) => {
    const validVal = isNaN(value) ? 0 : Math.max(0, Math.min(50, value));
    const currentRule = config.categoryLimits[category] || {
      stage: config.defaultStageLimit,
      offStage: config.defaultOffStageLimit
    };

    setConfig(prev => ({
      ...prev,
      categoryLimits: {
        ...prev.categoryLimits,
        [category]: {
          ...currentRule,
          [field]: validVal
        }
      }
    }));
  };

  const handleUpdateDefaultLimit = (field: 'defaultStageLimit' | 'defaultOffStageLimit', delta: number) => {
    const newVal = Math.max(0, Math.min(50, (config[field] ?? 0) + delta));
    setConfig(prev => ({
      ...prev,
      [field]: newVal
    }));
  };

  const handleResetToDefaults = () => {
    setConfig(DEFAULT_LIMIT_RULES);
  };

  const handleSave = () => {
    festStore.updateLimitRules(config);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#121422] border border-[#292d4a] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#292d4a] flex items-center justify-between bg-[#17192c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                Participant Competition Limits
              </h3>
              <p className="text-xs text-slate-400">
                Configure maximum Stage & Off-Stage events per participant by Competition Category
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e223b] hover:bg-[#2a2f52] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="px-5 py-3 bg-purple-950/20 border-b border-purple-500/20 flex items-center justify-between gap-3 text-xs text-purple-200/90">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-purple-400 shrink-0" />
            <span>
              Limits are enforced automatically based on each <strong>competition's category</strong> when enrolling participants into Stage & Off-Stage events.
            </span>
          </div>
          <button
            onClick={handleResetToDefaults}
            className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold text-[11px] flex items-center gap-1 shrink-0 transition-all cursor-pointer"
            title="Reset to recommended defaults (e.g. Junior 4/5, Senior 3/5)"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        {/* Body content with Category limit cards */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              Competition Category Specific Limits
            </label>

            <div className="space-y-3">
              {categories.map((cat) => {
                const rule = config.categoryLimits[cat] || {
                  stage: config.defaultStageLimit,
                  offStage: config.defaultOffStageLimit
                };
                const total = rule.stage + rule.offStage;

                return (
                  <div
                    key={cat}
                    className="p-4 rounded-2xl bg-[#17192c] border border-[#252843] hover:border-purple-500/30 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
                        <h4 className="font-black text-white text-sm tracking-wide">
                          {cat}
                        </h4>
                      </div>
                      <div className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold">
                        Total Max: {total} Events
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Stage Limit */}
                      <div className="p-3 rounded-xl bg-[#10121e] border border-[#20243c] flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-200">Stage Events</div>
                          <div className="text-[10px] text-slate-400">On-Stage competitions</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateCategoryRule(cat, 'stage', -1)}
                            className="w-7 h-7 rounded-lg bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#292d4a]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={rule.stage}
                            onChange={(e) => handleSetCategoryRuleValue(cat, 'stage', parseInt(e.target.value))}
                            className="w-12 text-center bg-[#17192c] border border-purple-500/40 rounded-lg py-1 text-sm font-black text-purple-300 focus:outline-none focus:border-purple-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCategoryRule(cat, 'stage', 1)}
                            className="w-7 h-7 rounded-lg bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#292d4a]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Off-Stage Limit */}
                      <div className="p-3 rounded-xl bg-[#10121e] border border-[#20243c] flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-200">Off-Stage Events</div>
                          <div className="text-[10px] text-slate-400">Non-stage competitions</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateCategoryRule(cat, 'offStage', -1)}
                            className="w-7 h-7 rounded-lg bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#292d4a]"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={rule.offStage}
                            onChange={(e) => handleSetCategoryRuleValue(cat, 'offStage', parseInt(e.target.value))}
                            className="w-12 text-center bg-[#17192c] border border-indigo-500/40 rounded-lg py-1 text-sm font-black text-indigo-300 focus:outline-none focus:border-indigo-400"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCategoryRule(cat, 'offStage', 1)}
                            className="w-7 h-7 rounded-lg bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#292d4a]"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Default Fallback for New / Custom Categories */}
          <div className="p-4 rounded-2xl bg-[#17192c]/70 border border-[#22253d] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-300">
                  Default Fallback Limit
                </h4>
                <p className="text-[11px] text-slate-400">
                  Applied to any newly added category or unspecified competition category
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-2.5 rounded-xl bg-[#10121e] border border-[#20243c] flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Default Stage:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateDefaultLimit('defaultStageLimit', -1)}
                    className="w-6 h-6 rounded bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 flex items-center justify-center text-xs"
                  >
                    -
                  </button>
                  <span className="font-black text-sm text-purple-300 w-8 text-center">{config.defaultStageLimit}</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateDefaultLimit('defaultStageLimit', 1)}
                    className="w-6 h-6 rounded bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 flex items-center justify-center text-xs"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#10121e] border border-[#20243c] flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">Default Off-Stage:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleUpdateDefaultLimit('defaultOffStageLimit', -1)}
                    className="w-6 h-6 rounded bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 flex items-center justify-center text-xs"
                  >
                    -
                  </button>
                  <span className="font-black text-sm text-indigo-300 w-8 text-center">{config.defaultOffStageLimit}</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateDefaultLimit('defaultOffStageLimit', 1)}
                    className="w-6 h-6 rounded bg-[#1a1d33] hover:bg-[#252a4a] text-slate-300 flex items-center justify-center text-xs"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#292d4a] bg-[#17192c] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1e223b] hover:bg-[#2a2f52] text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={savedSuccess}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-75"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span>Limits Saved!</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Limits</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
