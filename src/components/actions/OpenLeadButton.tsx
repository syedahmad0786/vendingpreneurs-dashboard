"use client";

import React from "react";
import { ExternalLink } from "lucide-react";

interface OpenLeadButtonProps {
  tableId: string;
  recordId: string;
}

export default function OpenLeadButton({
  tableId,
  recordId,
}: OpenLeadButtonProps) {
  const airtableUrl = `https://airtable.com/${tableId}/${recordId}`;

  return (
    <a
      href={airtableUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="
        inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
        text-text-secondary border border-white/10
        hover:text-text-primary hover:border-white/20 hover:bg-white/5
        transition-all duration-200
      "
    >
      <ExternalLink className="w-4 h-4" />
      <span>Open in Airtable</span>
    </a>
  );
}