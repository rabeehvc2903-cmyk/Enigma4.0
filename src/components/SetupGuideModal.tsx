import React, { useState } from 'react';
import {
  BookOpen,
  Shield,
  Users,
  User,
  Trophy,
  Calendar,
  CheckCircle2,
  KeyRound,
  Sparkles,
  X,
  Info,
  Tv,
  Award,
  Clock,
  Eye,
  EyeOff,
  Sliders,
  ArrowRight,
  Printer,
  FileText,
  Zap,
  HelpCircle,
  ListOrdered
} from 'lucide-react';
import { festStore } from '../lib/store';

export type UserManualTab = 'quickstart' | 'admin' | 'leaders' | 'judges' | 'media' | 'participants' | 'roles';

interface SetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: UserManualTab | string;
}

export const SetupGuideModal: React.FC<SetupGuideModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'quickstart'
}) => {
  const [activeTab, setActiveTab] = useState<UserManualTab>(() => {
    if (initialTab === 'roles' || initialTab === 'admin' || initialTab === 'leaders' || initialTab === 'judges' || initialTab === 'media' || initialTab === 'participants') {
      return initialTab;
    }
    return 'quickstart';
  });

  // Synchronize when opened with a specific tab
  React.useEffect(() => {
    if (isOpen) {
      if (initialTab === 'roles' || initialTab === 'admin' || initialTab === 'leaders' || initialTab === 'judges' || initialTab === 'media' || initialTab === 'participants') {
        setActiveTab(initialTab);
      } else {
        setActiveTab('quickstart');
      }
    }
  }, [isOpen, initialTab]);

  // Handle ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const branding = festStore.getBrandingConfig();
  const festTitle = branding.title || 'Enigma 4.0';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="user-manual-modal"
        className="max-w-4xl w-full bg-[#131525] border border-purple-500/40 rounded-3xl p-5 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#242845] pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-bold uppercase text-[11px] tracking-wider">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              {festTitle} Official Guide
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Festival User Manual & Step-by-Step Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            id="close-user-manual-btn"
            className="p-2 rounded-xl bg-[#1a1e36] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0 ml-2"
            title="Close Manual"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-[#181b30] p-1.5 rounded-2xl border border-[#292d4a] overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('quickstart')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'quickstart'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>1. Quick Start Guide</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>2. Fest Admin</span>
          </button>

          <button
            onClick={() => setActiveTab('leaders')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'leaders'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>3. Group Leaders</span>
          </button>

          <button
            onClick={() => setActiveTab('judges')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'judges'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>4. Judges Desk</span>
          </button>

          <button
            onClick={() => setActiveTab('media')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'media'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>5. Media & Displays</span>
          </button>

          <button
            onClick={() => setActiveTab('participants')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'participants'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>6. Participant Pass</span>
          </button>

          <button
            onClick={() => setActiveTab('roles')}
            className={`py-2 px-3 sm:px-4 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'roles'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>7. Access & Roles</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="space-y-4 text-xs leading-relaxed text-slate-300 overflow-y-auto pr-1">

          {/* TAB 1: QUICK START (Full Festival Lifecycle) */}
          {activeTab === 'quickstart' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Complete Festival Workflow in 6 Easy Steps
                </h3>
                <p className="text-slate-400 text-xs">
                  Follow this linear progression to effortlessly configure, coordinate, judge, and publish your festival.
                </p>
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-purple-600 text-white font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">Setup Festival Branding & Stages</h4>
                      <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">Admin</span>
                    </div>
                    <p className="text-slate-300">
                      Go to <strong>Admin Dashboard &rarr; Settings</strong> to set the Festival Title (e.g. <em>Enigma 4.0</em>), tagline, dates, and stage venues (Stage 1, Stage 2, Off-Stage halls).
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">Create Competitions & Set Span Time</h4>
                      <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">New Features</span>
                    </div>
                    <p className="text-slate-300">
                      In the <strong>Competitions</strong> tab, click <strong>"Add Competition"</strong>:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px] mt-1">
                      <li><strong>Flexible Span Time:</strong> Type any normal integer (1, 2, 3, 5, 10, 45, 60... minutes) for exact scheduling duration.</li>
                      <li><strong>Formatted Description:</strong> Enter rules with line breaks, paragraphs, and criteria lists; spacing is preserved automatically.</li>
                      <li><strong>Point Scales:</strong> Set default or custom points for 1st, 2nd, and 3rd rank.</li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-amber-600 text-white font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">Group Leaders Add Participants & Chest Numbers</h4>
                      <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Leaders</span>
                    </div>
                    <p className="text-slate-300">
                      Group Leaders log into the <strong>Group Leader Portal</strong>, add team members to generate unique <strong>Chest Numbers</strong> (e.g. <em>ART-2026-001</em>), and enroll them in stage & off-stage competitions.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-sky-600 text-white font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">Schedule Stages with Conflict-Free Protection</h4>
                      <span className="text-[10px] uppercase font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">Scheduling</span>
                    </div>
                    <p className="text-slate-300">
                      Open <strong>Schedule & Stages</strong> or click <strong>"Create Schedule"</strong>. Assign competitions to stages and time slots. The built-in clash detection ensures no student is double-booked across concurrent events!
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    5
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">Push to Judge Desk & Evaluate Candidates</h4>
                      <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Judges</span>
                    </div>
                    <p className="text-slate-300">
                      Admin pushes competitions to the <strong>Judge Desk</strong>. Evaluators grade participants on criteria (Technique, Rhythm, Presentation) and submit digital marksheets directly back to Admin.
                    </p>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl flex gap-3.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-rose-600 text-white font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    6
                  </div>
                  <div className="space-y-1 w-full">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-white text-xs sm:text-sm">Publish Results, Manage Points & Print Certificates</h4>
                      <span className="text-[10px] uppercase font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Results & Media</span>
                    </div>
                    <p className="text-slate-300">
                      In <strong>Publish Competition Results</strong>, pick winners and publish. Use the <strong>Show / Hide</strong> toggle in the header to control when the group point tally is shown to the public. Head to <strong>Media Desk</strong> to generate social media posters and certificates.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEST ADMIN */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-rose-500/30 rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-rose-400" />
                  Fest Admin Comprehensive Management Guide
                </h3>
                <p className="text-slate-400 text-xs">
                  Full control over competition creation, scheduling, point visibility, evaluation approvals, and leaderboards.
                </p>
              </div>

              <div className="space-y-3">
                {/* Feature 1: Span Time */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                      <Clock className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-white text-xs sm:text-sm">1. Flexible Competition Span Time (Any Duration)</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 ml-auto">New</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    In <strong>Edit Competition</strong> or <strong>Add Competition</strong>, you are no longer limited to multiples of 5 (5, 10, 15...). You can now enter <strong>any exact number of minutes</strong> (e.g., 1 min, 2 min, 3 min, 7 min, 45 min, 90 min).
                  </p>
                  <div className="bg-[#121422] p-3 rounded-xl border border-[#242845] text-[11px] text-slate-400">
                    💡 <em>Tip:</em> For quick stage transitions, set short durations like 3 or 4 minutes. The scheduler will automatically allocate stage times accordingly.
                  </div>
                </div>

                {/* Feature 2: Home Points Show / Hide */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300">
                      <Eye className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-white text-xs sm:text-sm">2. Toggle Group Points on Home Screen (Show / Hide)</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 ml-auto">Header Control</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    Located in the header bar of the <strong>Publish Competition Results</strong> section:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                    <li>Click <strong className="text-emerald-400">Show</strong>: The live group point tally and standings leaderboard are displayed on the public Home Screen.</li>
                    <li>Click <strong className="text-rose-400">Hide</strong>: Suspends the public point banner, keeping the championship scores confidential until the grand closing ceremony!</li>
                  </ul>
                </div>

                {/* Feature 3: Formatted Descriptions */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300">
                      <FileText className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-white text-xs sm:text-sm">3. Formatted Multi-Line Descriptions & Guidelines</h4>
                  </div>
                  <p className="text-slate-300 text-xs">
                    When editing or creating competitions, paste your complete guidelines with enters, paragraphs, bullet points, and judging criteria. All line breaks and formatting are strictly preserved in both the admin desk and the participant competition modal!
                  </p>
                </div>

                {/* Feature 4: Custom Scale & Results Publishing */}
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300">
                      <Trophy className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-white text-xs sm:text-sm">4. Custom Point Scales & Result Publishing</h4>
                  </div>
                  <p className="text-slate-300 text-xs">
                    Use the <strong>"Edit Scale"</strong> button in the Publish Results header to customize point values (e.g. 1st: 10pts, 2nd: 7pts, 3rd: 5pts or custom grades like A: 5pts, B: 3pts). Select verified participants from judge scorecards and hit <strong>"Publish Results"</strong> to immediately update group standings.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GROUP LEADERS */}
          {activeTab === 'leaders' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-amber-500/30 rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-amber-400" />
                  Group Leader Handbook: Roster & Enrollment
                </h3>
                <p className="text-slate-400 text-xs">
                  Step-by-step instructions for registering teams, issuing student chest numbers, and enrolling in stage events.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-[10px]">1</span>
                    Register or Sign In
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Navigate to the <strong>Sign In</strong> screen. Select the <strong>Group Leader</strong> tab. If you are registering a new team, use the <strong>"Register Group"</strong> tab to enter your team name, group color, and secret password.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-[10px]">2</span>
                    Add Participants & Issue Chest Numbers
                  </h4>
                  <p className="text-slate-300 text-xs">
                    In your <strong>Team Participants</strong> tab, enter student name and category/grade (Junior, Senior, Sub-Junior). The system generates a dedicated <strong>Chest Number</strong> (e.g. <em>ART-2026-001</em>). Click the <strong>Copy ID</strong> button to share it with the student.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-[10px]">3</span>
                    Enroll in Stage & Off-Stage Competitions
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Go to <strong>Competition Enrollments</strong>. Choose the event and select your team participant. The system strictly honors the maximum quota limit per team (e.g. 1 or 2 entries per group), protecting against accidental over-enrollments.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black flex items-center justify-center text-[10px]">4</span>
                    Track Live Standings & Schedules
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Keep track of your group's overall rank, gold/silver/bronze medals tally, and upcoming stage times directly from your Leader Dashboard.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: JUDGES DESK */}
          {activeTab === 'judges' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-emerald-500/30 rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-emerald-400" />
                  Judges Desk: Scoring & Valuation Guide
                </h3>
                <p className="text-slate-400 text-xs">
                  Official marking workflow for evaluation, performance criteria grading, and marksheet transmission.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black font-black flex items-center justify-center text-[10px]">1</span>
                    Access Assigned Competitions
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Sign in with Judge credentials. View competitions that the Fest Admin has dispatched to your judging panel.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black font-black flex items-center justify-center text-[10px]">2</span>
                    Call Sheet & Performance Order
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Inspect the participant call sheet showing Chest Numbers, candidate names, and assigned groups. Ensure all performers are present before starting.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black font-black flex items-center justify-center text-[10px]">3</span>
                    Enter Criteria-Based Marks
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Grade each performer across official criteria (Technique, Rhythm, Stage Presence, Expression). Total marks and ranks are calculated automatically.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-black font-black flex items-center justify-center text-[10px]">4</span>
                    Submit Marksheet to Admin Desk
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Click <strong>"Submit Marksheet"</strong> once grading is completed. The scores are immediately synced to the Admin Results section for final verification and publishing.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MEDIA & DISPLAYS */}
          {activeTab === 'media' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-sky-500/30 rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <Tv className="w-4 h-4 text-sky-400" />
                  Media Dashboard, Social Posters & Certificate Desk
                </h3>
                <p className="text-slate-400 text-xs">
                  Tools for large-screen TV broadcasting, instant social media posters, and official certificate printing.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-sky-400" />
                    <h4 className="font-bold text-white text-xs">Live Stage Ticker</h4>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Broadcast real-time breaking news, result announcements, and stage schedule changes across venue screens and projector displays.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h4 className="font-bold text-white text-xs">Social Poster Generator</h4>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Instantly create high-resolution, branded announcement graphics for 1st, 2nd, and 3rd place winners to share across Instagram and WhatsApp.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <h4 className="font-bold text-white text-xs">Printable Certificates</h4>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Generate official award certificates with recipient names, chest numbers, festival seals, and signature lines ready for physical distribution.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    <h4 className="font-bold text-white text-xs">Typography & Fonts</h4>
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Switch between sleek modern fonts (Outfit, Cinzel, Montserrat, Plus Jakarta Sans) to customize the visual aura of stage displays.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PARTICIPANT PASS */}
          {activeTab === 'participants' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-purple-500/30 rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <User className="w-4 h-4 text-purple-400" />
                  Participant Portal & Digital Festival Pass
                </h3>
                <p className="text-slate-400 text-xs">
                  Passwordless, instant access designed for students using their assigned Chest Number.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-purple-400" />
                    Passwordless Login via Chest Number
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Participants do not need to memorize passwords. Simply choose <strong>Participant Portal</strong> on the Sign In page and enter your assigned Chest Number (e.g. <em>ART-2026-001</em>).
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    Personal Event Timetable & Venue Locations
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Your digital pass shows your enrolled events, exact scheduled dates and times, assigned stages, and rules at a single glance.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl space-y-2">
                  <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Live Result & Award Notifications
                  </h4>
                  <p className="text-slate-300 text-xs">
                    Receive immediate updates as soon as competition scores and winner lists are published by the festival admin.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ACCESS & ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#181b30] border border-[#292d4a] rounded-2xl">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  Portal Directory & Role Access Reference
                </h3>
                <p className="text-slate-400 text-xs">
                  Summary of privileges and access methods across the festival ecosystem:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-4 bg-[#181b30] border border-rose-500/30 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-rose-400 uppercase text-xs">Fest Admin</span>
                    <Shield className="w-4 h-4 text-rose-400" />
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Master control. Set branding, span times, stages, judge assignments, point visibility, and published results.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-amber-500/30 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-400 uppercase text-xs">Group Leader</span>
                    <Users className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Roster manager. Adds team members, copies Chest Numbers, and handles competition enrollments.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-emerald-500/30 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-400 uppercase text-xs">Judges Desk</span>
                    <Award className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Official valuation. Accesses assigned competition call sheets and records criteria-based candidate marks.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-sky-500/30 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sky-400 uppercase text-xs">Media Desk</span>
                    <Tv className="w-4 h-4 text-sky-400" />
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Broadcasting hub. Runs public TV news tickers, generates victory posters, and prints certificates.
                  </p>
                </div>

                <div className="p-4 bg-[#181b30] border border-purple-500/30 rounded-2xl space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-purple-400 uppercase text-xs">Participant Portal</span>
                    <User className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Student digital pass. Fast passwordless login using Chest Number to view scheduled stages and published rankings.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#242845] flex items-center justify-between">
          <div className="text-[11px] text-slate-500 hidden sm:flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Need help? Contact the Festival Admin or IT desk.</span>
          </div>
          <button
            onClick={onClose}
            id="close-guide-footer-btn"
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer ml-auto"
          >
            Got It, Close Guide
          </button>
        </div>

      </div>
    </div>
  );
};
