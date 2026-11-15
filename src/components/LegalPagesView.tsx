import { Scale, ShieldCheck, FileText, ArrowLeft, Cookie } from 'lucide-react';
import type { NavSection } from '../types/invoice';

interface LegalPagesViewProps {
  section: 'license' | 'privacy' | 'terms';
  onNavigate: (section: NavSection) => void;
  onOpenCookieSettings: () => void;
}

interface LegalSectionBlock {
  title: string;
  body: string[];
}

const LICENSE_SECTIONS: LegalSectionBlock[] = [
  {
    title: '1. Product Ownership & Authorship',
    body: [
      'Universal Invoice Generator is created, led, and maintained by Muhammad Abdul Samad Tariq (CEO & Founder).',
      'Placeholder Legal Entity Notice: [Insert Legal Entity / Registered Business Name if incorporated prior to commercial SaaS hosting].',
    ],
  },
  {
    title: '2. Copyright & Open-Source MIT License',
    body: [
      '© 2026 Muhammad Abdul Samad Tariq — Universal Invoice Generator.',
      'The application source code in this repository is licensed under the MIT License (see root LICENSE file), permitting free use, copying, modification, and distribution subject to retaining the copyright notice and license disclaimer.',
    ],
  },
  {
    title: '3. Distinction Between Code License & Brand / Portrait Assets',
    body: [
      'While the software codebase is open-source under the MIT License, the founder photograph, personal identity details, and any unregistered brand marks may not be used to imply endorsement by Muhammad Abdul Samad Tariq without explicit permission.',
    ],
  },
  {
    title: '4. Permitted Application Usage',
    body: [
      'Users may self-host, fork, or run Universal Invoice Generator to draft, customize, manage, print, download as PDF, and share invoices for personal, educational, freelance, or commercial business billing.',
    ],
  },
  {
    title: '5. Hosted SaaS Operators & Redistribution Notice',
    body: [
      'Anyone redistributing or hosting modified versions under the MIT License must retain the original copyright notice and MIT permission notice in all copies or substantial portions of the software, and must configure their own legal entity, privacy contact, and SMTP/payment credentials.',
    ],
  },
  {
    title: '6. Trademarks & Branding',
    body: [
      'The name "Universal Invoice Generator" and its tagline "Create. Customize. Invoice." are original product identifiers. No unverified government trademark registration is claimed; this clause serves as a customizable operator placeholder: [Trademark Registration Details if applicable].',
    ],
  },
  {
    title: '7. Third-Party & Open-Source Libraries',
    body: [
      'Universal Invoice Generator incorporates open-source software packages—including React, TypeScript, Vite, Tailwind CSS, Express, Helmet, Lucide Icons, Motion, Nodemailer, and jsPDF—each governed by its respective MIT, Apache-2.0, or BSD open-source license.',
    ],
  },
  {
    title: '8. User-Generated Content Ownership',
    body: [
      'You retain 100% ownership and responsibility for all business logos, uploaded signatures, company seals, client directory data, line items, and invoice PDFs created using the application.',
    ],
  },
  {
    title: '9. Service Availability & Limitations',
    body: [
      'Software features are provided on an "as-is" and "as-available" basis. Features relying on optional server credentials (such as SMTP email delivery or third-party payment webhooks) function only when validly configured by the operator.',
    ],
  },
  {
    title: '10. License Termination',
    body: [
      'Any unauthorized redistribution, automated abuse, or breach of these license terms automatically terminates permitted commercial usage rights.',
    ],
  },
  {
    title: '11. Licensing & IP Contact Information',
    body: [
      'For licensing permissions, enterprise inquiries, or attribution questions, contact Muhammad Abdul Samad Tariq (CEO & Founder) at [legal@universal-invoice-generator.example] (Editable Placeholder).',
    ],
  },
];

const PRIVACY_SECTIONS: LegalSectionBlock[] = [
  {
    title: '1. Introduction',
    body: [
      'Universal Invoice Generator ("we", "our", "the Application"), led by Muhammad Abdul Samad Tariq (CEO & Founder), is committed to transparency regarding how workspace and billing data is stored and processed.',
    ],
  },
  {
    title: '2. Data Controller & Contact Placeholder',
    body: [
      'Data Controller: [Insert Business / Legal Entity Name — Currently operated by Muhammad Abdul Samad Tariq, CEO & Founder]. Contact: [privacy@universal-invoice-generator.example] (Editable Placeholder).',
    ],
  },
  {
    title: '3. Information You Provide Directly',
    body: [
      'When using the workspace, you may enter business names, logos, addresses, tax registration numbers, client contact records, invoice line items, currency selections, notes, payment instructions, drawn or uploaded signatures, and company stamps.',
    ],
  },
  {
    title: '4. Local Browser Storage vs. Backend Server Storage',
    body: [
      'Workspace data (invoices, drafts, client directory, business profile, settings, and local payment identifiers) is primarily stored locally in your browser via `localStorage`. When you explicitly click to generate a cross-device Share Link or dispatch a recurring invoice through the optional backend server, a sanitized copy of that invoice is written to the server storage directory configured via `DATA_DIR` so recipients on other devices can view it.',
    ],
  },
  {
    title: '5. Automatically Collected Technical Data',
    body: [
      'Standard HTTP server logs may temporarily observe request paths, status codes, and timestamps required to serve API responses (e.g., loading a shared invoice token).',
    ],
  },
  {
    title: '6. Payment & Financial Information',
    body: [
      'This application does not process or store raw credit card numbers or CVV codes. Server-side payment adapter secret keys (e.g., Stripe or PayPal credentials) belong strictly in server environment variables and are never saved in browser storage or returned to client browsers.',
    ],
  },
  {
    title: '7. Invoices, Signatures & Uploaded Assets',
    body: [
      'Uploaded logos, signatures, and company stamps are stored as encoded image data in your browser profile (or inside an explicitly shared invoice snapshot) to render previews and generate PDF files.',
    ],
  },
  {
    title: '8. How We Use Information',
    body: [
      'Data is used solely to calculate totals, render live invoice previews, export multi-page PDF documents, manage recurring schedules, and render shareable recipient invoice pages requested by you.',
    ],
  },
  {
    title: '9. Legal Bases (Where Applicable)',
    body: [
      'Processing occurs based on your contractual/functional request to generate invoices, legitimate interest in secure operation, and explicit opt-in consent for non-essential cookie categories.',
    ],
  },
  {
    title: '10. Cookies & Local Storage Technologies',
    body: [
      'Essential browser storage preserves your workspace data and your cookie consent choice. Optional Functional, Analytics, and Marketing categories remain disabled until you opt in via Cookie Settings.',
    ],
  },
  {
    title: '11. Third-Party Services & Integrations',
    body: [
      'If an operator configures optional SMTP mail servers or third-party payment gateways (e.g., Stripe, PayPal, regional wallets), data necessary to deliver that invoice or verify a webhook is transmitted to the configured provider.',
    ],
  },
  {
    title: '12. Data Sharing & Disclosure',
    body: [
      'We do not sell, rent, or trade your invoice or client data. Shared invoice views strip private internal creator notes (`internalNotes`) and expose invoice details strictly to holders of the unguessable share token until revoked or expired.',
    ],
  },
  {
    title: '13. Data Retention',
    body: [
      'Local browser data persists until you clear browser storage or restore demo defaults in Settings. Server-side share snapshots persist until revoked, expired, or removed by the server administrator (`[Insert Retention Policy Window if hosted commercially]`).',
    ],
  },
  {
    title: '14. Security Safeguards & Honest Scope',
    body: [
      'Unguessable cryptographic tokens protect share links, webhook endpoints verify HMAC signatures when secrets are configured, and secret keys remain server-side. Note: browser `localStorage` is readable by scripts running on the same origin and is not end-to-end encrypted at rest; operators deploying publicly should enable HTTPS/TLS and appropriate access controls.',
    ],
  },
  {
    title: '15. International Data Transfers',
    body: [
      'When hosted on cloud infrastructure or connected to global payment providers, data may be processed in regions where your hosting or payment provider operates (`[Insert Jurisdiction Details]`).',
    ],
  },
  {
    title: '16. Your Privacy Rights',
    body: [
      'You may inspect, edit, export (via PDF/print), or delete any invoice or client record directly inside the workspace, revoke share links at any time, or withdraw optional cookie consent via Cookie Settings.',
    ],
  },
  {
    title: '17. Children’s Privacy',
    body: [
      'Universal Invoice Generator is a business and productivity utility not directed at children under 13 (or applicable minimum digital consent age).',
    ],
  },
  {
    title: '18. Automated Decision-Making',
    body: [
      'The application performs deterministic financial arithmetic and scheduled date calculations only; it does not perform automated profiling or credit scoring.',
    ],
  },
  {
    title: '19. Policy Updates',
    body: [
      'Material updates to storage or cookie behavior will update the policy version and prompt renewed consent where required.',
    ],
  },
  {
    title: '20. Effective Date & Versioning',
    body: [
      'Current Version: November 2026 (`2026-11-v1`).',
    ],
  },
  {
    title: '21. Privacy Contact',
    body: [
      'Direct privacy inquiries to Muhammad Abdul Samad Tariq (CEO & Founder) at [privacy@universal-invoice-generator.example] (Editable Placeholder).',
    ],
  },
];

const TERMS_SECTIONS: LegalSectionBlock[] = [
  {
    title: '1. Acceptance of Terms',
    body: [
      'By accessing or using Universal Invoice Generator, you agree to these Terms & Conditions. If deploying for an organization, you confirm authority to bind that organization.',
    ],
  },
  {
    title: '2. Service Description',
    body: [
      'Universal Invoice Generator provides invoice authoring, minor-unit financial calculation, template styling, PDF export, local/server client & recurring schedule management, and payment instruction/link formatting.',
    ],
  },
  {
    title: '3. Operator & Entity Placeholder',
    body: [
      'Operated under the leadership of Muhammad Abdul Samad Tariq (CEO & Founder). Formal Legal Entity Placeholder: [Insert Registered Company Name, Registration Number & Address before commercial launch].',
    ],
  },
  {
    title: '4. Eligibility',
    body: [
      'You must be legally capable of entering commercial billing arrangements under your local laws to use this tool for business invoicing.',
    ],
  },
  {
    title: '5. User Responsibilities',
    body: [
      'You are responsible for verifying recipient details, line item accuracy, currency selection, tax rates, and keeping copies of critical financial records.',
    ],
  },
  {
    title: '6. Accuracy of Invoice & Tax Calculations',
    body: [
      'While the calculation engine uses integer minor-unit arithmetic and verified tax/discount sequences, you are solely responsible for confirming tax compliance, statutory invoice wording, VAT/GST/sales tax treatment, and accounting rules in your jurisdiction.',
    ],
  },
  {
    title: '7. Electronic Signatures & Company Seals Disclaimer',
    body: [
      'Drawn or uploaded signatures and company seal images customize the visual appearance of invoices and exported PDFs. They do NOT constitute a legally binding cryptographic digital signature or certificate authority verification (e.g., eIDAS QES or PKI) unless paired with an external qualified e-signature workflow.',
    ],
  },
  {
    title: '8. Share Links & Recipient Access',
    body: [
      'Anyone possessing an active, non-revoked share link can view the sanitized public invoice. You are responsible for transmitting share URLs securely and revoking links when no longer needed.',
    ],
  },
  {
    title: '9. Payment Gateways & Third-Party Settlement',
    body: [
      'Universal Invoice Generator is NOT a bank, escrow, or licensed money transmitter. Online checkout verification requires valid server-side API credentials and signed webhook events from the respective payment provider. Bank/wallet account identifiers displayed on invoices facilitate direct customer settlement outside this application.',
    ],
  },
  {
    title: '10. Recurring Schedules & Email Delivery',
    body: [
      'Automated email dispatch relies on operator-configured SMTP credentials. When SMTP is unconfigured, generated invoices remain local/queued and are marked "Setup Required" rather than sent.',
    ],
  },
  {
    title: '11. Acceptable Use Policy',
    body: [
      'You may not use the application to generate fraudulent invoices, phishing links, unlawful financial instruments, or deceptive payment demands.',
    ],
  },
  {
    title: '12. Intellectual Property Ownership',
    body: [
      'Application UI, code, and branding belong to Universal Invoice Generator / Muhammad Abdul Samad Tariq as detailed on the Software License page. You retain rights to your uploaded business content.',
    ],
  },
  {
    title: '13. User Content License to Operate',
    body: [
      'You grant the application permission solely to process, store locally/server-side upon your request, and render your logos, text, and signatures into invoice previews and PDFs.',
    ],
  },
  {
    title: '14. Prototype / Non-Accounting Software Notice',
    body: [
      'This product is a focused invoice generator—not an ERP, statutory tax filing system, or audited double-entry accounting ledger.',
    ],
  },
  {
    title: '15. Fees & Commercial Plans Placeholder',
    body: [
      '[Placeholder: Free / Open evaluation workspace. Insert subscription fees, billing cycles, and refund terms if commercial SaaS tiers are introduced.]',
    ],
  },
  {
    title: '16. Third-Party Links & Dependencies',
    body: [
      'External payment portals or gateway documentation are governed by those providers’ respective terms and privacy policies.',
    ],
  },
  {
    title: '17. Disclaimer of Warranties',
    body: [
      'To the maximum extent permitted by law, the application is provided "AS IS" without warranties of merchantability, fitness for a particular regulatory purpose, or uninterrupted availability.',
    ],
  },
  {
    title: '18. Limitation of Liability',
    body: [
      'In no event shall the creator, CEO & Founder, or contributors be liable for indirect, incidental, lost-profit, tax-penalty, or data-loss damages arising from use of the software.',
    ],
  },
  {
    title: '19. Indemnification',
    body: [
      'You agree to indemnify the operator against claims arising from fraudulent billing content, unauthorized trademarked logos uploaded by you, or breach of applicable tax/commercial laws.',
    ],
  },
  {
    title: '20. Suspension & Termination',
    body: [
      'Operators hosting multi-user deployments may revoke share tokens or suspend access in response to abuse or unlawful activity.',
    ],
  },
  {
    title: '21. Governing Law & Jurisdiction Placeholder',
    body: [
      'Governing Law: [Insert Governing Law & Competent Courts Jurisdiction prior to commercial launch].',
    ],
  },
  {
    title: '22. Amendments & Contact',
    body: [
      'Updated terms take effect when published in the application. Questions may be directed to Muhammad Abdul Samad Tariq (CEO & Founder) at [legal@universal-invoice-generator.example] (Editable Placeholder).',
    ],
  },
];

export function LegalPagesView({
  section,
  onNavigate,
  onOpenCookieSettings,
}: LegalPagesViewProps) {
  const meta =
    section === 'license'
      ? {
          title: 'Software License & Intellectual Property',
          subtitle:
            'Ownership, copyright, permitted usage, open-source dependency attribution, and IP rights.',
          Icon: Scale,
          blocks: LICENSE_SECTIONS,
          updated: 'November 2026',
        }
      : section === 'privacy'
        ? {
            title: 'Privacy Policy',
            subtitle:
              'Transparent explanation of local browser storage, optional backend share links, cookies, and data rights.',
            Icon: ShieldCheck,
            blocks: PRIVACY_SECTIONS,
            updated: 'November 2026 (v2026-11-v1)',
          }
        : {
            title: 'Terms & Conditions',
            subtitle:
              'Usage terms, financial/tax compliance responsibility, visual e-signature disclaimer, and service boundaries.',
            Icon: FileText,
            blocks: TERMS_SECTIONS,
            updated: 'November 2026',
          };

  const Icon = meta.Icon;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('about')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to About Us</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: 'license', label: 'License & IP' },
              { id: 'privacy', label: 'Privacy Policy' },
              { id: 'terms', label: 'Terms & Conditions' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                section === tab.id
                  ? 'bg-slate-900 text-white dark:bg-blue-700'
                  : 'border border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenCookieSettings}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <Cookie className="h-3.5 w-3.5" />
            <span>Cookie Settings</span>
          </button>
        </div>
      </div>

      {/* Document Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {meta.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{meta.subtitle}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Product: Universal Invoice Generator</span>
              <span>&middot;</span>
              <span>Muhammad Abdul Samad Tariq (CEO &amp; Founder)</span>
              <span>&middot;</span>
              <span>Effective: {meta.updated}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <strong>Template &amp; Non-Legal-Advice Notice:</strong> These pages accurately describe how
        this application processes data and handles payments, and include{' '}
        <code className="font-mono">[Editable Placeholder]</code> fields for entity name,
        jurisdiction, and support email. They do not constitute legal advice—operators deploying
        commercially should tailor placeholders with qualified legal counsel.
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {meta.blocks.map((block) => (
          <article
            key={block.title}
            className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-2.5 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{block.title}</h3>
            {block.body.map((paragraph, i) => (
              <p
                key={i}
                className="text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              >
                {paragraph}
              </p>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}
