import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import type { DateFormatOption, Invoice, SavedBusinessProfile, TemplateId } from '../types/invoice';
import { ACCENT_COLOR_PRESETS, INITIAL_INVOICES } from '../data/seedData';
import { InvoiceRenderer } from './InvoiceRenderer';

interface TemplatesViewProps {
  businessProfile: SavedBusinessProfile;
  dateFormat: DateFormatOption;
  activeTemplate: TemplateId;
  onUseTemplate: (template: TemplateId, accentColor: string) => void;
}

const TEMPLATE_META: {
  id: TemplateId;
  code: string;
  name: string;
  summary: string;
  highlights: string[];
}[] = [
  {
    id: 'modern',
    code: 'Template 01',
    name: 'Modern',
    summary:
      'Premium corporate layout with structured contrast headers, clean grid alignment, and strong typographic hierarchy.',
    highlights: [
      'Bold accent top rule and table header',
      'Balanced two-column billing summary',
      'Ideal for agencies, SaaS, and studios',
    ],
  },
  {
    id: 'classic',
    code: 'Template 02',
    name: 'Classic',
    summary:
      'Traditional institutional invoice structure with formal serif typography and clearly framed financial metadata.',
    highlights: [
      'Centered or balanced formal letterhead',
      'Structured boxed invoice reference grid',
      'Built for consultancies and established firms',
    ],
  },
  {
    id: 'minimal',
    code: 'Template 03',
    name: 'Minimal',
    summary:
      'Clean, distraction-free editorial layout emphasizing whitespace, crisp hairline dividers, and effortless readability.',
    highlights: [
      'Whisper-quiet labels and borderless rows',
      'Generous breathing room for line items',
      'Great for freelancers and independent creators',
    ],
  },
];

export function TemplatesView({
  businessProfile,
  dateFormat,
  activeTemplate,
  onUseTemplate,
}: TemplatesViewProps) {
  const [previewAccent, setPreviewAccent] = useState('#1D4ED8');

  const baseSample: Invoice = {
    ...INITIAL_INVOICES[0],
    business: {
      name: businessProfile.name || INITIAL_INVOICES[0].business.name,
      logoDataUrl: businessProfile.logoDataUrl || INITIAL_INVOICES[0].business.logoDataUrl,
      address: businessProfile.address || INITIAL_INVOICES[0].business.address,
      phone: businessProfile.phone || INITIAL_INVOICES[0].business.phone,
      email: businessProfile.email || INITIAL_INVOICES[0].business.email,
      website: businessProfile.website || INITIAL_INVOICES[0].business.website,
      taxNumber: businessProfile.taxNumber || INITIAL_INVOICES[0].business.taxNumber,
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Professional Invoice Templates
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Preview each layout with your business details and launch directly into the Invoice Studio.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Preview Accent:
          </span>
          {ACCENT_COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={`Preview templates in ${c.name}`}
              onClick={() => setPreviewAccent(c.value)}
              className={`h-5 w-5 rounded border transition-transform ${
                previewAccent === c.value
                  ? 'scale-110 border-slate-900 ring-2 ring-blue-500/30 dark:border-white'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              style={{ backgroundColor: c.value }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {TEMPLATE_META.map((tpl) => {
          const isCurrent = activeTemplate === tpl.id;
          const sampleInvoice: Invoice = {
            ...baseSample,
            design: {
              ...baseSample.design,
              template: tpl.id,
              accentColor: previewAccent,
              fontStyle: tpl.id === 'classic' ? 'serif' : 'sans',
              logoPlacement: tpl.id === 'classic' ? 'center' : 'left',
              headerStyle: tpl.id === 'classic' ? 'bordered' : 'clean',
              footerStyle: tpl.id === 'minimal' ? 'minimal' : 'detailed',
            },
          };

          return (
            <article
              key={tpl.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-slate-800 dark:bg-slate-900"
            >
              {/* Scaled Live Mini Preview */}
              <div className="border-b border-slate-200 bg-slate-100/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <div className="h-[310px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
                  <div className="origin-top-left scale-[0.58] w-[172.4%] pointer-events-none select-none">
                    <InvoiceRenderer
                      invoice={sampleInvoice}
                      dateFormat={dateFormat}
                      interactive={false}
                      compact={true}
                    />
                  </div>
                </div>
              </div>

              {/* Template Details & Action */}
              <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {tpl.code}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                        <Check className="h-3 w-3" />
                        <span>Active in Studio</span>
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {tpl.name}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {tpl.summary}
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {tpl.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-2">
                        <span className="h-1 w-1 rounded-full bg-slate-400 shrink-0" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => onUseTemplate(tpl.id, previewAccent)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600"
                >
                  <span>Use {tpl.name} Template</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
