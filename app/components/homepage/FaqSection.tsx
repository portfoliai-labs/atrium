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
    question: "What exactly does PortfoliAI do?",
    answer: "It puts your investment portfolios, your bank accounts and your property in one place, values them every day in your currency, and analyses them with the tools a professional would use: returns, risk, costs, taxes, projections. An AI assistant answers questions about your own numbers, and a verified financial advisor can work with you inside the platform if you want one.",
  },
  {
    question: "Who is it for?",
    answer: "Private investors who want to understand what they own without maintaining a spreadsheet, and financial advisors who want their clients' portfolios, strategies and conversations in one place. Taxes and property market data are modelled for Italy; everything else works for any country and currency.",
  },
  {
    question: "How often does my data update?",
    answer: "Portfolio values are recomputed through the day as new prices arrive, and the full history (performance, risk, benchmark, costs, dividends) is rebuilt every night. Bank accounts connected through open banking sync twice a day, or on demand. Property values follow your own valuations and the official OMI market data for your zone.",
  },
  {
    question: "Do I have to re-upload my transactions every month?",
    answer: "No. You upload your full history once. After that you add new transactions as they happen, or import your broker's latest export: duplicates are recognised and skipped. Bank accounts can be connected directly, so their movements arrive on their own.",
  },
  {
    question: "Which brokers and banks are supported?",
    answer: "Any broker that exports a CSV or Excel file: the AI reads the columns, you confirm the mapping once, and the layout is remembered. Fineco, Interactive Brokers, Degiro and the ledgers of crypto exchanges are handled explicitly. Banks: any bank reachable through PSD2 open banking in Italy and ten other European countries, read-only.",
  },
  {
    question: "What can the AI assistant do, and what can't it?",
    answer: "It can read your portfolios, transactions, bank accounts and profile, look up any listed instrument and the markets, draw charts and tables from those results, and prepare a full PDF report on request. It cannot invent a number: every figure comes from a tool that read your data. It does not give investment advice, and it answers only about finance.",
  },
  {
    question: "How do you calculate the implicit cost of a trade?",
    answer: "For every trade we take half of the bid-ask spread of that day's price range on the exchange, times the quantity. It is an estimate, not a figure from your broker, but it is the only way to see a cost that never appears on a statement. Explicit commissions come from your transactions as they are.",
  },
  {
    question: "Is the tax estimate reliable?",
    answer: "It follows the Italian rules: 26% on capital gains, 12.5% on government and supranational bonds, funds and ETFs as non-offsettable capital income, losses carried forward four years, dividends and coupons with their withholdings, and both the declarative and the administered regimes. It is an estimate to plan with, not a tax return, and it is Italy only for now.",
  },
  {
    question: "Does real estate work outside Italy?",
    answer: "The ledger does: properties, mortgages, rents, costs and valuations work in any country and currency. Taxes (IMU, rental income, capital gains on sale) and local market prices are modelled only for Italy; a foreign property simply shows no tax and no market section.",
  },
  {
    question: "Is my financial data secure?",
    answer: "Data is encrypted in transit, downloads use short-lived signed links, and bank access is read-only under PSD2 with only the last four digits of your IBAN kept. Every service checks that you own the data on every call. Delete your account and each part of the platform erases what it holds about you.",
  },
  {
    question: "How does PortfoliAI work for advisors?",
    answer: "You are verified against your OCF registration, then matched with investors whose Investment Policy Statement fits your practice. You read their policy, work on their portfolios with the same analysis they see, adopt and share strategies you have backtested, publish to the strategy catalogue and the Journal, and talk to clients in a chat whose records are kept as MiFID II requires.",
  },
  {
    question: "Can I try it before signing up?",
    answer: "Yes. The login page has two read-only demo accounts, one as an investor and one as an advisor, filled with example portfolios, accounts, properties and clients.",
  },
  {
    question: "What does it cost, and can I cancel?",
    answer: "Everything is free during the beta. The Pro plan is on a waitlist at €49 a year; when it opens you can cancel from your account settings at any time and keep access to the end of the period you paid for.",
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
          color: isOpen ? '#C49A3C' : '#857e78',
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
              What it does, how it keeps your numbers honest, and where it stops.
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
