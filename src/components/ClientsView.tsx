import { useState, type FormEvent } from 'react';
import {
  UserPlus,
  Search,
  FilePlus2,
  Pencil,
  Trash2,
  X,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react';
import type { ClientProfile, Invoice } from '../types/invoice';

interface ClientsViewProps {
  clients: ClientProfile[];
  invoices: Invoice[];
  onAddClient: (client: Omit<ClientProfile, 'id' | 'createdAt'>) => void;
  onUpdateClient: (client: ClientProfile) => void;
  onDeleteClient: (id: string) => void;
  onCreateInvoiceForClient: (client: ClientProfile) => void;
}

const EMPTY_CLIENT_FORM: Omit<ClientProfile, 'id' | 'createdAt'> = {
  name: '',
  company: '',
  address: '',
  email: '',
  phone: '',
  notes: '',
};

export function ClientsView({
  clients,
  invoices,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onCreateInvoiceForClient,
}: ClientsViewProps) {
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientProfile | null>(null);
  const [form, setForm] = useState(EMPTY_CLIENT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openAddModal = () => {
    setEditingClient(null);
    setForm(EMPTY_CLIENT_FORM);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (client: ClientProfile) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      company: client.company,
      address: client.address,
      email: client.email,
      phone: client.phone,
      notes: client.notes ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() && !form.company.trim()) {
      setFormError('Please provide a client name or company name.');
      return;
    }
    if (editingClient) {
      onUpdateClient({
        ...editingClient,
        ...form,
      });
    } else {
      onAddClient(form);
    }
    setModalOpen(false);
  };

  const filtered = clients.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [c.name, c.company, c.email, c.phone, c.address]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const countInvoicesForClient = (client: ClientProfile) =>
    invoices.filter(
      (inv) =>
        inv.clientId === client.id ||
        (inv.customer.email &&
          client.email &&
          inv.customer.email.toLowerCase() === client.email.toLowerCase()) ||
        (inv.customer.name &&
          client.name &&
          inv.customer.name.toLowerCase() === client.name.toLowerCase())
    ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Client Directory
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Manage client profiles and pre-fill billing details in a single click when creating invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Client</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, company, or email..."
            aria-label="Search client profiles"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
          {filtered.length} client{filtered.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Client Cards / Empty State */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            No client profiles match your search
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Add a client profile to reuse their contact and billing details across invoices.
          </p>
          <button
            type="button"
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add First Client</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const invCount = countInvoicesForClient(client);
            const confirming = confirmDeleteId === client.id;
            return (
              <article
                key={client.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 space-y-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {client.company || client.name}
                      </h3>
                      {client.company && client.name && (
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                          {client.name}
                        </p>
                      )}
                    </div>
                    <span className="font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                      {invCount} invoice{invCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    {client.email && (
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                    )}
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="tabular-nums">{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                        <span className="whitespace-pre-line line-clamp-2">{client.address}</span>
                      </div>
                    )}
                  </div>

                  {client.notes && (
                    <p className="rounded-md bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                      {client.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => onCreateInvoiceForClient(client)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors dark:bg-blue-700 dark:hover:bg-blue-600 whitespace-nowrap"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" />
                    <span>New Invoice</span>
                  </button>

                  {confirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteClient(client.id);
                          setConfirmDeleteId(null);
                        }}
                        className="rounded bg-rose-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-700"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(client)}
                        aria-label={`Edit client ${client.name || client.company}`}
                        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(client.id)}
                        aria-label={`Delete client ${client.name || client.company}`}
                        className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingClient ? 'Edit Client Profile' : 'Add New Client'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingClient ? 'Edit Client Profile' : 'Add Client Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close client dialog"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="cli-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Client / Contact Name *
                  </label>
                  <input
                    id="cli-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Nadia Hussain"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cli-company"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Company / Organization
                  </label>
                  <input
                    id="cli-company"
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="e.g. Crescent Digital"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cli-email"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Email Address
                  </label>
                  <input
                    id="cli-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="billing@client.com"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cli-phone"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Phone Number
                  </label>
                  <input
                    id="cli-phone"
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+92 300 0000000"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="cli-address"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Billing Address
                  </label>
                  <textarea
                    id="cli-address"
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Street, City, Postal Code, Country"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="cli-notes"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Internal Billing Notes (optional)
                  </label>
                  <input
                    id="cli-notes"
                    type="text"
                    value={form.notes ?? ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Net 14 payment terms, tax-exempt"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                >
                  {editingClient ? 'Save Changes' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
