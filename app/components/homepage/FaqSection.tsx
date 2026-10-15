"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

interface FaqData {
  question: string;
  answer: string;
}

const faqData: FaqData[] = [
  {
    question: "How often does my data update?",
    answer: "Prices and portfolio metrics refresh once a day, after markets close. It's a deliberate choice: PortfoliAI is built for monitoring your positions over time, not for intraday trading decisions.",
  },
  {
    question: "Do I have to re-upload all my transactions every month?",
    answer: "No. You upload your full history once. After that, you only add new transactions as they happen — buys, sells, deposits — and the dashboard and reports update from there.",
  },
  {
    question: "What does the Insights section show me?",
    answer: "Everything about your portfolio in one place: performance and ROI, cash flow and dividends, risk and volatility, sector and region exposure, benchmark comparison, and a full risk model with efficient frontier — updated continuously, not generated on request.",
  },
  {
    question: "How do portfolio alerts work?",
    answer: "Set thresholds on value, drawdown, or allocation drift for your portfolio, and PortfoliAI notifies you the moment one is crossed — no need to check the dashboard every day.",
  },
  {
    question: "How do you calculate implicit costs?",
    answer: "For every trade, we estimate the bid-ask spread you paid from that session's price range on the exchange. It's an estimate, not an exact figure from your broker, but it's the only way to see a cost that never appears on a statement.",
  },
  {
    question: "How does the AI analysis work?",
    answer: "Our engine parses your CSV and Excel broker statements, identifying every transaction, commission, and implicit spread, then powers your dashboard, Insights, and alerts from that data.",
  },
  {
    question: "Is my financial data secure?",
    answer: "We use industry-standard measures — encryption in transit, access controls, and short-lived signed URLs for document downloads — to protect your data. Your data is retained only for as long as your account is active, and you can request deletion at any time from your account settings.",
  },
  {
    question: "How does PortfoliAI work for advisors?",
    answer: "You manage every client's portfolio from one dashboard: import their transactions, track AUM across your whole book, and get AI-powered insights and alerts for each client individually.",
  },
  {
    question: "Can I cancel my subscription at any time?",
    answer: "Yes, no contracts or hidden fees. Cancel from your account settings and you'll retain access until the end of your current billing period.",
  },
];

const FaqItem = ({
  faq,
  isOpen,
  onToggle,
  index,
}: {
  faq: FaqData;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay: index * 0.06 }}
    className="border-b border-stone-200 last:border-0"
  >
    <button
      onClick={onToggle}
      className="w-full flex items-start justify-between gap-6 py-6 text-left group"
    >
      <span
        className="text-[16px] font-bold text-stone-900 leading-snug tracking-tight group-hover:text-stone-700 transition-colors"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {faq.question}
      </span>
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center mt-0.5 transition-colors"
        style={{
          borderColor: isOpen ? '#C49A3C' : '#e7e5e0',
          color: isOpen ? '#C49A3C' : '#a8a29e',
        }}
      >
        {isOpen
          ? <Minus className="w-3 h-3" strokeWidth={2} />
          : <Plus className="w-3 h-3" strokeWidth={2} />
        }
      </div>
    </button>

    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <p className="pb-6 text-[13px] text-stone-500 leading-relaxed max-w-2xl">
            {faq.answer}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-stone-50 border-t border-stone-200 py-24 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-20 items-start">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-px bg-[#C49A3C]" />
              <span className="text-[11px] font-medium tracking-[0.12em] uppercase text-[#8A6A28]">
                FAQ
              </span>
            </div>
            <h2
              className="text-[clamp(26px,3vw,40px)] font-bold text-stone-900 leading-[1.1] tracking-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Common<br />questions.
            </h2>
            <p className="mt-4 text-[13px] text-stone-400 leading-relaxed">
              Everything you need to know about PortfoliAI.
            </p>
          </div>

          {/* FAQ list */}
          <div className="md:col-span-2 border-t border-stone-200">
            {faqData.map((faq, index) => (
              <FaqItem
                key={index}
                index={index}
                faq={faq}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
