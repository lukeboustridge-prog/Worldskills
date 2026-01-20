import { BookOpen, Calendar, Users, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export default function OnboardingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 text-slate-800">

      {/* Header Section */}
      <div className="mb-12 border-b pb-6 border-slate-200">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">
          Getting Started: <span className="text-blue-600">Onboarding Guide</span>
        </h1>
        <p className="text-xl text-slate-600 leading-relaxed">
          Welcome to the WorldSkills Standards & Assessment team. This guide outlines your critical path to success,
          defining roles, deliverables, and the &quot;Golden Rules&quot; collected from past competition cycles.
        </p>
      </div>

      {/* 1. The Lifecycle of a Skill */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">1. The Lifecycle of a Skill</h2>
        </div>
        <p className="mb-8 text-slate-600">
          The road to the WorldSkills Competition (WSC) follows a rigorous 24-month cycle. While dates shift slightly each cycle, the milestones remain constant:
        </p>

        <div className="relative border-l-4 border-blue-200 ml-4 space-y-10 pl-8">
          {/* Milestone 1 */}
          <div className="relative">
            <span className="absolute -left-[42px] top-1 h-6 w-6 rounded-full bg-blue-600 border-4 border-white"></span>
            <h3 className="font-bold text-lg text-slate-900">12-18 Months Out (Skill Management Plan)</h3>
            <p className="text-slate-600 mt-1">Review the Technical Description (TD) and update the Infrastructure List (IL). This is the foundation—without the right equipment, the test cannot run.</p>
          </div>
          {/* Milestone 2 */}
          <div className="relative">
            <span className="absolute -left-[42px] top-1 h-6 w-6 rounded-full bg-blue-600 border-4 border-white"></span>
            <h3 className="font-bold text-lg text-slate-900">Competition Preparation Week (CPW)</h3>
            <p className="text-slate-600 mt-1">Typically ~6-9 months before WSC. SCMs, Chief Experts, and Workshop Managers meet to finalize the IL and agree on the Test Project concept.</p>
          </div>
          {/* Milestone 3 */}
          <div className="relative">
            <span className="absolute -left-[42px] top-1 h-6 w-6 rounded-full bg-blue-600 border-4 border-white"></span>
            <h3 className="font-bold text-lg text-slate-900">6 Months Out</h3>
            <p className="text-slate-600 mt-1"><strong>Test Project (TP) release</strong> (for circulated skills). Independent Test Project Designers work with SCMs to finalize the project.</p>
          </div>
          {/* Milestone 4 */}
          <div className="relative">
            <span className="absolute -left-[42px] top-1 h-6 w-6 rounded-full bg-blue-600 border-4 border-white"></span>
            <h3 className="font-bold text-lg text-slate-900">3 Months Out</h3>
            <p className="text-slate-600 mt-1"><strong>Marking Scheme (CIS) drafted.</strong> Assessment criteria must be aligned with the WorldSkills Occupational Standards (WSOS).</p>
          </div>
           {/* Milestone 5 */}
           <div className="relative">
            <span className="absolute -left-[42px] top-1 h-6 w-6 rounded-full bg-red-500 border-4 border-white"></span>
            <h3 className="font-bold text-lg text-slate-900">C-4 Days (Competition)</h3>
            <p className="text-slate-600 mt-1">Experts arrive, finalize assessment criteria (30% change rule), and validate the IL.</p>
          </div>
        </div>
      </section>

      {/* 2. Role Definitions */}
      <section className="mb-16 bg-slate-50 p-8 rounded-xl border border-slate-200">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">2. Role Definitions</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-bold text-blue-800 mb-2">Skill Competition Manager (SCM)</h3>
            <p className="text-slate-600 italic mb-2">&quot;The technical CEO of the skill&quot;</p>
            <p className="text-sm text-slate-700">They are responsible for the overall management of the competition preparation and execution, ensuring the Test Project is industry-relevant and the Infrastructure List is accurate, while leading the Expert group on the floor to guarantee a fair competition.</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-xl font-bold text-green-700 mb-2">Skill Advisor (SA)</h3>
            <p className="text-slate-600 italic mb-2">&quot;Quality assurance partner and guide&quot;</p>
            <p className="text-sm text-slate-700">They do not decide <em>what</em> is tested (technical content) but ensure <em>how</em> it is tested meets WorldSkills standards. They support you in structuring the Marking Scheme, configuring the Competition Information System (CIS), and validating that all assessment practices align with the WSOS.</p>
          </div>
        </div>
      </section>

      {/* 3. Core Deliverables */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">3. Core Deliverables (&quot;The Big 3&quot;)</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="border border-slate-200 rounded-lg p-5 hover:border-blue-400 transition-colors">
            <h3 className="font-bold text-lg text-slate-900 mb-3">1. The Infrastructure List (IL)</h3>
            <p className="text-sm text-slate-700 mb-4">A precise inventory of every tool, material, and machine required on the competition floor.</p>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 font-medium">
              <strong>Why it matters:</strong> If it&apos;s not on the list, it won&apos;t be in the workshop. An inaccurate IL leads to &quot;fire-fighting&quot; during CPW.
            </div>
          </div>

          {/* Card 2 */}
          <div className="border border-slate-200 rounded-lg p-5 hover:border-blue-400 transition-colors">
            <h3 className="font-bold text-lg text-slate-900 mb-3">2. The Test Project (TP)</h3>
            <p className="text-sm text-slate-700 mb-4">The practical task competitors must complete. It must be valid, reliable, and fair.</p>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 font-medium">
              <strong>Why it matters:</strong> It is the &quot;linking element&quot; that forces Experts to know the Technical Description and Assessment methodologies.
            </div>
          </div>

          {/* Card 3 */}
          <div className="border border-slate-200 rounded-lg p-5 hover:border-blue-400 transition-colors">
            <h3 className="font-bold text-lg text-slate-900 mb-3">3. The Marking Scheme (CIS)</h3>
            <p className="text-sm text-slate-700 mb-4">The digital scoring criteria entered into the Competition Information System (CIS).</p>
            <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 font-medium">
              <strong>Why it matters:</strong> Good projects fail with bad marking. &quot;Judgment Marking&quot; without clear definitions leads to disputes.
            </div>
          </div>
        </div>
      </section>

      {/* 4. Golden Rules */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <CheckCircle className="w-8 h-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">4. Golden Rules for Success</h2>
        </div>
        <p className="mb-6 text-slate-600">Derived from Post-Competition Reports (WSC2019 - WSC2024)</p>

        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-slate-900">Don&apos;t Ignore the Assessment during CPW</h4>
              <p className="text-sm text-slate-700 mt-1">Most SCMs focus purely on infrastructure (equipment). <strong>Success Tip:</strong> Dedicate at least one full day of CPW to sitting with your Skill Advisor to draft your Marking Scheme.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <div>
              <h4 className="font-bold text-slate-900">Hide Calculations in CIS</h4>
              <p className="text-sm text-slate-700">Configure CIS to &quot;hide&quot; mark calculations from Experts. They should judge the performance, not &quot;engineer&quot; the score.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
             <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <div>
              <h4 className="font-bold text-slate-900">Hardware Logistics Matter</h4>
              <p className="text-sm text-slate-700">Ensure you know exactly how many tablets/laptops are ordered for marking. Reverting to paper marking causes massive delays.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
             <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <div>
              <h4 className="font-bold text-slate-900">Validate the WSOS Alignment</h4>
              <p className="text-sm text-slate-700">Ensure your Marking Scheme perfectly mirrors the weightings in the WSOS. Deviations here are the #1 reason for document rejection.</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
             <div className="h-2 w-2 mt-2 rounded-full bg-blue-500 flex-shrink-0"></div>
            <div>
              <h4 className="font-bold text-slate-900">Use the &quot;Community&quot;</h4>
              <p className="text-sm text-slate-700">Ensure all your Experts are in the official WhatsApp Community/Group early. If they join late, they miss critical history.</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
