import { useState } from 'react';
import {
  GraduationCap,
  Mail,
  ShieldCheck,
  FileText,
  Scale,
  Compass,
  Quote,
  ArrowUpRight,
  Target,
} from 'lucide-react';
import type { NavSection } from '../types/invoice';

interface AboutUsViewProps {
  onNavigate?: (section: NavSection) => void;
}

export function AboutUsView({ onNavigate }: AboutUsViewProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Product Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
          About the Product
        </div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Universal Invoice Generator
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          Create. Customize. Invoice.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
          Universal Invoice Generator is built for individuals, freelancers, agencies, educational
          institutions, shops, and service providers who need refined, client-ready invoices without
          the complexity of heavyweight accounting or ERP platforms.
        </p>
      </section>

      {/* Founder & CEO Profile */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Founder Photograph */}
          <div className="md:col-span-4">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-[3/4] dark:border-slate-800 dark:bg-slate-800">
              {!imgError ? (
                <img
                  src="/assets/founder/founder-photo.jpeg"
                  alt="Muhammad Abdul Samad Tariq — CEO & Founder"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-slate-500">
                  <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                    MAST
                  </span>
                  <span className="mt-2 text-xs">CEO &amp; Founder Portrait</span>
                </div>
              )}
            </div>
          </div>

          {/* Creator Details */}
          <div className="md:col-span-8 space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Leadership &amp; Engineering
              </div>
              <h3 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Muhammad Abdul Samad Tariq
              </h3>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                CEO &amp; Founder
              </p>
            </div>

            <div className="inline-flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
              <GraduationCap className="h-4 w-4 mt-0.5 text-blue-700 dark:text-blue-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  BS Artificial Intelligence
                </div>
                <div className="text-slate-600 dark:text-slate-400">
                  Riphah International University
                </div>
              </div>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Founder Introduction
                </h4>
                <p>
                  Muhammad Abdul Samad Tariq is the CEO &amp; Founder of Universal Invoice Generator
                  and an Artificial Intelligence undergraduate at Riphah International University.
                  His engineering work focuses on practical, reliable software interfaces that
                  simplify everyday financial documentation for independent professionals and
                  growing teams worldwide.
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                  <span>The Journey Behind the Product</span>
                </h4>
                <p>
                  Universal Invoice Generator started from a straightforward observation: freelancers,
                  tutors, small shops, and agencies regularly spend too much time formatting clunky
                  spreadsheets or paying for bloated ERP suites just to send a single clean invoice.
                  Designing the product from the ground up meant prioritizing live visual feedback,
                  accurate multi-currency arithmetic, effortless PDF export, and flexible signature
                  and seal placement in one focused studio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Vision, Mission & Founder Message */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            <Target className="h-3.5 w-3.5" />
            <span>Product Vision</span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            To make executive-grade invoicing universally accessible—giving anyone, regardless of
            technical or accounting background, a fast, transparent, and customizable workspace to
            issue accurate invoices in minutes.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
            <Compass className="h-3.5 w-3.5" />
            <span>Mission &amp; Long-Term Objectives</span>
          </div>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 list-disc pl-4">
            <li>Deliver rock-solid minor-unit financial calculations across global currencies.</li>
            <li>Keep document design flexible across modern, classic, and minimal templates.</li>
            <li>Support honest, verifiable integrations for national and international payments.</li>
            <li>Preserve user privacy with transparent data controls and clear legal terms.</li>
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-900 p-6 sm:p-7 text-white dark:border-slate-800">
        <div className="flex items-start gap-3">
          <Quote className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-300">
              A Short Message from the Founder
            </div>
            <p className="text-sm leading-relaxed text-slate-200">
              &ldquo;Every invoice represents real work delivered with care. My goal with Universal
              Invoice Generator is to ensure the tools you use to present that work reflect the
              same standard of precision, clarity, and trust.&rdquo;
            </p>
            <div className="pt-1 text-xs font-medium text-slate-400">
              — Muhammad Abdul Samad Tariq, CEO &amp; Founder
            </div>
          </div>
        </div>
      </section>

      {/* Legal, Copyright & Contact Quick Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Scale className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span>Software License &amp; IP Notice</span>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('license')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                <span>Read License</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            &copy; {new Date().getFullYear()} Universal Invoice Generator &middot; Muhammad Abdul
            Samad Tariq (CEO &amp; Founder). Source code is released under the repository MIT
            License; project brand marks, founder portrait, and user-uploaded assets remain
            excluded from trademark endorsement.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span>Terms &amp; Conditions</span>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('terms')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                <span>Read Terms</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Provides invoice authoring, financial calculations, PDF export, and visual document
            styling. Uploaded or drawn signatures and stamps customize document appearance and do
            not constitute certified cryptographic e-signatures.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <ShieldCheck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
              <span>Privacy Policy</span>
            </div>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('privacy')}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                <span>Read Policy</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Workspace records, logos, and signatures are stored locally in your browser unless you
            explicitly generate a server-backed share link or configure backend email dispatch.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Mail className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            <span>Contact Information</span>
          </div>
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 space-y-1">
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">Leadership:</span>{' '}
              Muhammad Abdul Samad Tariq — CEO &amp; Founder
            </div>
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">Academic Background:</span>{' '}
              BS Artificial Intelligence, Riphah International University
            </div>
            <div>
              <span className="font-medium text-slate-800 dark:text-slate-200">Contact Email:</span>{' '}
              <span className="font-mono">[contact@universal-invoice-generator.example]</span>{' '}
              <span className="text-[11px] text-slate-400">(Editable Placeholder)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
