"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, ChevronRight, UploadCloud } from "lucide-react";
import { advisorService } from "../../services/advisorService";
import type { Client } from "../../models/Advisor";
import { FileUploader } from "./FileUploader";

function initials(client: Client) {
  const f = client.first_name?.[0] ?? "";
  const l = client.last_name?.[0] ?? "";
  return (f + l).toUpperCase() || client.email[0].toUpperCase();
}

function ClientPicker({
  clients,
  onSelect,
}: {
  clients: Client[];
  onSelect: (client: Client) => void;
}) {
  return (
    <div className="space-y-8 pb-12">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C49A3C] mb-1">Transactions</p>
        <h1 className="text-3xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Select a Client
        </h1>
        <p className="text-sm text-[#78716c] mt-2">Choose the client you want to upload documents for.</p>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-4">
            <UploadCloud className="w-7 h-7 text-[#C49A3C]" />
          </div>
          <h3 className="text-lg font-bold text-[#1c1917] mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            No clients registered
          </h3>
          <p className="text-sm text-[#78716c]">Add a client from the Clients section before uploading documents.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((client) => (
            <button
              key={client.uuid}
              onClick={() => onSelect(client)}
              className="group bg-white rounded-[1.5rem] border border-[rgba(196,154,60,0.2)] p-5 hover:border-[#C49A3C]/50 hover:shadow-sm transition-all text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] text-sm shrink-0">
                {initials(client)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1c1917] text-sm truncate">
                  {client.first_name || client.last_name
                    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
                    : "—"}
                </p>
                <p className="text-xs text-[#78716c] truncate">{client.email}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#a8a29e] group-hover:text-[#C49A3C] group-hover:translate-x-0.5 transition-all shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdvisorUploadSection() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const data = await advisorService.getClients();
      setClients(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadClients(); }, [loadClients]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  if (!selected) {
    return <ClientPicker clients={clients} onSelect={setSelected} />;
  }

  const selectedName = selected.first_name || selected.last_name
    ? `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim()
    : selected.email;

  return (
    <div className="space-y-6 pb-12">
      {/* Client context bar */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-[rgba(196,154,60,0.2)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] text-xs shrink-0">
            {initials(selected)}
          </div>
          <div>
            <p className="text-xs font-bold text-[#78716c] uppercase tracking-wider">Uploading for</p>
            <p className="text-sm font-bold text-[#1c1917]">{selectedName}</p>
          </div>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="p-2 rounded-xl hover:bg-[#F7F5EF] text-[#78716c] hover:text-[#1c1917] transition-colors"
          title="Change client"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <FileUploader forUserUuid={selected.uuid} />
    </div>
  );
}
