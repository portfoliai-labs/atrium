"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, ChevronRight, ArrowLeft } from "lucide-react";
import { advisorService } from "../../services/advisorService";
import type { Client } from "../../models/Advisor";
import { ReportsList } from "./ReportsList";

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
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C49A3C] mb-1">Reports</p>
        <h1 className="text-3xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Select a Client
        </h1>
        <p className="text-sm text-[#78716c] mt-2">Choose the client whose documents you want to view.</p>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[#C49A3C]" />
          </div>
          <h3 className="text-lg font-bold text-[#1c1917] mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            No clients registered
          </h3>
          <p className="text-sm text-[#78716c]">Add a client from the Clients section to view their documents.</p>
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

export function AdvisorReportsList() {
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

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb / back bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white border border-transparent hover:border-[rgba(196,154,60,0.2)] text-[#78716c] hover:text-[#1c1917] font-bold text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Clients
        </button>
        <span className="text-[#a8a29e]">/</span>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] text-[10px] shrink-0">
            {initials(selected)}
          </div>
          <span className="text-sm font-bold text-[#1c1917]">
            {selected.first_name || selected.last_name
              ? `${selected.first_name ?? ""} ${selected.last_name ?? ""}`.trim()
              : selected.email}
          </span>
        </div>
      </div>

      <ReportsList forUserUuid={selected.uuid} />
    </div>
  );
}
